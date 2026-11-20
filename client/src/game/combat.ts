import * as THREE from 'three';
import type { Character } from './character';
import type { Collider } from './mecca';

/**
 * Staff combat and stealth for the fictional traveler.
 *
 * Non-graphic by design: hits flash and stagger, opponents never bleed or die; when
 * beaten they kneel, yield and leave. The player is "overwhelmed" rather than killed and
 * retries from a checkpoint.
 */

export interface PlayerStats {
  maxHealth: number;
  maxStamina: number;
  /** 0..1 fraction of damage prevented by the defense upgrade. */
  defense: number;
}

export const statsFor = (upgrades: Record<string, number>): PlayerStats => ({
  maxHealth: 100,
  maxStamina: 100 + 25 * (upgrades.stamina ?? 0),
  defense: Math.min(0.45, 0.15 * (upgrades.defense ?? 0)),
});

const ATTACK = { duration: 0.42, hitAt: 0.16, range: 1.9, arc: Math.PI * 0.6, stamina: 12, comboWindow: 0.35 };
const DODGE = { duration: 0.38, iframes: 0.3, distance: 3.6, stamina: 22 };
const BLOCK = { parryWindow: 0.22, chipStamina: 18 };

export type CombatEvent =
  | { type: 'hit'; enemy: Enemy; finisher: boolean }
  | { type: 'parry'; enemy: Enemy }
  | { type: 'blocked' }
  | { type: 'hurt'; amount: number }
  | { type: 'yielded'; enemy: Enemy }
  | { type: 'detected'; enemy: Enemy }
  | { type: 'overwhelmed' }
  | { type: 'victory' };

/** The local player's combat state, driven by Controls and PlayerController. */
export class PlayerCombat {
  health: number;
  stamina: number;
  stats: PlayerStats;
  attackT = -1;
  combo = 0;
  private comboTimer = 0;
  dodgeT = -1;
  private dodgeDir = new THREE.Vector3();
  blockHeldFor = -1;
  hurtT = 0;
  private hitThisSwing = new Set<Enemy>();

  constructor(stats: PlayerStats) {
    this.stats = stats;
    this.health = stats.maxHealth;
    this.stamina = stats.maxStamina;
  }

  setStats(stats: PlayerStats) {
    this.health = Math.min(stats.maxHealth, this.health + (stats.maxHealth - this.stats.maxHealth));
    this.stamina = Math.min(stats.maxStamina, this.stamina);
    this.stats = stats;
  }

  get attacking() {
    return this.attackT >= 0;
  }
  get dodging() {
    return this.dodgeT >= 0;
  }
  get invulnerable() {
    return this.dodgeT >= 0 && this.dodgeT < DODGE.iframes;
  }

  tryAttack(): boolean {
    if (this.dodging || this.stamina < ATTACK.stamina * 0.5) return false;
    if (this.attacking && this.attackT < ATTACK.duration - ATTACK.comboWindow) return false;
    this.combo = this.comboTimer > 0 ? (this.combo % 3) + 1 : 1;
    this.attackT = 0;
    this.stamina = Math.max(0, this.stamina - ATTACK.stamina);
    this.hitThisSwing.clear();
    return true;
  }

  tryDodge(dir: THREE.Vector3): boolean {
    if (this.dodging || this.stamina < DODGE.stamina) return false;
    this.dodgeT = 0;
    this.attackT = -1;
    this.stamina -= DODGE.stamina;
    this.dodgeDir.copy(dir).setY(0).normalize();
    return true;
  }

  /** Returns how far to move this frame because of a dodge roll. */
  update(dt: number, blocking: boolean, moving: boolean, running: boolean): THREE.Vector3 {
    const offset = new THREE.Vector3();
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (this.attackT >= ATTACK.duration) {
        this.attackT = -1;
        this.comboTimer = ATTACK.comboWindow;
      }
    } else if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.dodgeT >= 0) {
      const before = this.dodgeT;
      this.dodgeT += dt;
      const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, t / DODGE.duration), 2);
      offset.copy(this.dodgeDir).multiplyScalar((ease(this.dodgeT) - ease(before)) * DODGE.distance);
      if (this.dodgeT >= DODGE.duration) this.dodgeT = -1;
    }
    this.blockHeldFor = blocking && !this.dodging && !this.attacking ? Math.max(0, this.blockHeldFor) + dt : -1;
    if (this.hurtT > 0) this.hurtT -= dt;
    const spending = this.attacking || this.dodging || this.blockHeldFor >= 0 || (moving && running);
    if (!spending) this.stamina = Math.min(this.stats.maxStamina, this.stamina + dt * 32);
    else if (moving && running) this.stamina = Math.max(0, this.stamina - dt * 8);
    return offset;
  }

  /** True on the frame the current swing should connect. */
  swingConnects(dt: number): boolean {
    return this.attackT >= ATTACK.hitAt && this.attackT - dt < ATTACK.hitAt;
  }

  canHit(enemy: Enemy) {
    if (this.hitThisSwing.has(enemy)) return false;
    this.hitThisSwing.add(enemy);
    return true;
  }
}

type EnemyState = 'idle' | 'patrol' | 'alert' | 'approach' | 'circle' | 'windup' | 'strike' | 'recover' | 'stagger' | 'yield' | 'gone';

export interface EnemyOptions {
  name: string;
  health: number;
  damage: number;
  /** Training partners never hunt the player and stop at a light touch. */
  training?: boolean;
  /** Facing (radians around Y) when standing guard. */
  facing: number;
  /** Optional slow look-around: radians either side of `facing`. */
  scan?: number;
  scanSpeed?: number;
  vision?: { range: number; fov: number };
}

const UP = new THREE.Vector3(0, 1, 0);

/** An opponent: a fictional sparring partner or extortioner. */
export class Enemy {
  state: EnemyState = 'idle';
  health: number;
  readonly home: THREE.Vector3;
  detection = 0;
  private t = 0;
  private strafe = Math.random() > 0.5 ? 1 : -1;
  private scanT = Math.random() * 10;
  readonly telegraph: THREE.Mesh;
  readonly cone: THREE.Mesh | null = null;
  private flash = 0;

  constructor(
    readonly character: Character,
    readonly opts: EnemyOptions,
    scene: THREE.Object3D,
  ) {
    this.health = opts.health;
    this.home = character.root.position.clone();
    character.root.rotation.y = opts.facing;
    character.equipStaff();
    // Red ring under the opponent while winding up: the cue to block or dodge.
    this.telegraph = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 32),
      new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.y = 0.05;
    character.root.add(this.telegraph);
    if (opts.vision) {
      const { range, fov } = opts.vision;
      const geo = new THREE.CircleGeometry(range, 24, Math.PI / 2 - fov / 2, fov);
      geo.rotateX(-Math.PI / 2);
      this.cone = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
      );
      this.cone.position.y = 0.04;
      // CircleGeometry's "up" (+y before rotation) becomes -z: rotate so it points along +z (forward).
      this.cone.rotation.y = Math.PI;
      character.root.add(this.cone);
    }
    void scene;
  }

  get position() {
    return this.character.root.position;
  }

  get active() {
    return this.state !== 'yield' && this.state !== 'gone';
  }

  get engaged() {
    return ['approach', 'circle', 'windup', 'strike', 'recover', 'stagger'].includes(this.state);
  }

  forward(out = new THREE.Vector3()) {
    const y = this.character.root.rotation.y;
    return out.set(Math.sin(y), 0, Math.cos(y));
  }

  engage() {
    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'alert') {
      this.state = 'approach';
      this.t = 0;
      if (this.cone) this.cone.visible = false;
    }
  }

  takeHit(damage: number, from: THREE.Vector3) {
    if (!this.active) return;
    this.health -= damage;
    this.flash = 0.15;
    const away = this.position.clone().sub(from).setY(0).normalize();
    this.position.addScaledVector(away, 0.35);
    if (this.health <= 0) {
      this.state = 'yield';
      this.t = 0;
      this.character.setAnim('yield');
      this.telegraph.visible = false;
      return;
    }
    this.state = 'stagger';
    this.t = 0;
    this.character.setAnim('hit');
  }

  parried() {
    this.state = 'stagger';
    this.t = -0.9; // long opening after a parry
    this.character.setAnim('hit');
  }

  /** Can this opponent see `p`? Vision cone plus walls blocking the line of sight. */
  sees(p: THREE.Vector3, colliders: Collider[]): number {
    const v = this.opts.vision;
    if (!v || !this.active) return 0;
    const to = p.clone().sub(this.position).setY(0);
    const dist = to.length();
    if (dist > v.range) return 0;
    const angle = to.angleTo(this.forward());
    if (angle > v.fov / 2) return 0;
    if (blocked(this.position, p, colliders)) return 0;
    return 1 - dist / v.range; // closer = noticed faster
  }

  update(dt: number, player: THREE.Vector3, ctx: { mayAttack: boolean; colliders: Collider[] }): 'strike' | null {
    this.t += dt;
    const c = this.character;
    const to = player.clone().sub(this.position).setY(0);
    const dist = to.length();
    const face = (dir: THREE.Vector3, k = 10) => {
      const yaw = Math.atan2(dir.x, dir.z);
      const cur = c.root.rotation.y;
      c.root.rotation.y = cur + Math.atan2(Math.sin(yaw - cur), Math.cos(yaw - cur)) * Math.min(1, dt * k);
    };
    const step = (dir: THREE.Vector3, speed: number) => {
      const next = this.position.clone().addScaledVector(dir.clone().normalize(), speed * dt);
      if (!ctx.colliders.some((b) => next.x > b.min.x - 0.35 && next.x < b.max.x + 0.35 && next.z > b.min.y - 0.35 && next.z < b.max.y + 0.35)) {
        this.position.copy(next);
      }
    };
    (this.telegraph.material as THREE.MeshBasicMaterial).opacity = this.state === 'windup' ? 0.5 + 0.4 * Math.sin(this.t * 30) : 0;
    if (this.flash > 0) this.flash -= dt;
    let result: 'strike' | null = null;

    switch (this.state) {
      case 'idle':
      case 'patrol':
      case 'alert': {
        if (this.opts.scan) {
          this.scanT += dt * (this.opts.scanSpeed ?? 0.5);
          c.root.rotation.y = this.opts.facing + Math.sin(this.scanT) * this.opts.scan;
        }
        c.setAnim('idle');
        break;
      }
      case 'approach': {
        face(to);
        if (dist > 2.4) {
          step(to, 2.6);
          c.setAnim('walk');
        } else {
          this.state = 'circle';
          this.t = 0;
        }
        break;
      }
      case 'circle': {
        face(to);
        const side = new THREE.Vector3().crossVectors(UP, to).normalize().multiplyScalar(this.strafe);
        const keep = dist > 2.8 ? to.clone().normalize() : dist < 2.0 ? to.clone().normalize().negate() : new THREE.Vector3();
        step(side.add(keep), 1.3);
        c.setAnim('walk');
        if (this.t > 2.5) this.strafe *= -1;
        if (ctx.mayAttack && this.t > 0.6 && dist < 3.2) {
          this.state = 'windup';
          this.t = 0;
        }
        break;
      }
      case 'windup': {
        face(to, 6);
        c.setAnim('block');
        if (dist > 1.6) step(to, 1.8);
        if (this.t > (this.opts.training ? 0.85 : 0.65)) {
          this.state = 'strike';
          this.t = 0;
          c.setAnim('attack');
          result = 'strike';
        }
        break;
      }
      case 'strike': {
        if (this.t > 0.3) {
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'recover': {
        c.setAnim('idle');
        if (this.t > 0.7) {
          this.state = 'circle';
          this.t = 0;
        }
        break;
      }
      case 'stagger': {
        if (this.t > 0.35) {
          this.state = 'circle';
          this.t = 0;
        }
        break;
      }
      case 'yield': {
        // Kneel, then leave the area: nobody is harmed on screen.
        if (this.t > 1.6) {
          c.setAnim('walk');
          const away = this.position.clone().sub(player).setY(0).normalize();
          face(away);
          step(away, 2.2);
          if (this.t > 4.2) {
            this.state = 'gone';
            c.root.visible = false;
          }
        }
        break;
      }
      case 'gone':
        break;
    }
    return result;
  }
}

/** Does a wall stand between a and b? Samples the segment against the collider boxes. */
export function blocked(a: THREE.Vector3, b: THREE.Vector3, colliders: Collider[]): boolean {
  const steps = Math.ceil(a.distanceTo(b) / 0.4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (colliders.some((c) => x > c.min.x && x < c.max.x && z > c.min.y && z < c.max.y)) return true;
  }
  return false;
}

/**
 * Runs one encounter: who may attack (one opponent at a time), hits both ways, stealth
 * detection, and how it ends.
 */
export class Fight {
  readonly enemies: Enemy[] = [];
  started = false;
  over = false;
  private attackToken: Enemy | null = null;
  private tokenCooldown = 0;
  private readonly onEvent: (e: CombatEvent) => void;

  constructor(
    readonly id: string,
    onEvent: (e: CombatEvent) => void,
    readonly stealth = false,
  ) {
    this.onEvent = onEvent;
  }

  add(enemy: Enemy) {
    this.enemies.push(enemy);
    return enemy;
  }

  start() {
    if (this.started || this.over) return;
    this.started = true;
    for (const e of this.enemies) e.engage();
  }

  /** Called every frame while the player is in this encounter's area. */
  update(dt: number, player: THREE.Vector3, me: PlayerCombat, colliders: Collider[], sneaking: boolean) {
    if (this.over) {
      for (const e of this.enemies) e.update(dt, player, { mayAttack: false, colliders });
      return;
    }
    // Stealth: fill each watcher's detection meter while they can see the player.
    if (this.stealth && !this.started) {
      for (const e of this.enemies) {
        const seen = e.sees(player, colliders);
        const rate = seen > 0 ? (0.6 + seen * 2.2) * (sneaking ? 0.35 : 1) : -0.5;
        e.detection = THREE.MathUtils.clamp(e.detection + rate * dt, 0, 1);
        if (e.detection >= 1) {
          this.onEvent({ type: 'detected', enemy: e });
          this.start();
          break;
        }
      }
    }
    this.tokenCooldown -= dt;
    if (this.attackToken && (!this.attackToken.active || ['circle', 'stagger'].includes(this.attackToken.state))) {
      if (this.attackToken.state !== 'windup' && this.attackToken.state !== 'strike') {
        this.attackToken = null;
        this.tokenCooldown = 0.5;
      }
    }
    if (!this.attackToken && this.tokenCooldown <= 0 && this.started) {
      const candidates = this.enemies.filter((e) => e.state === 'circle');
      this.attackToken = candidates.sort((a, b) => a.position.distanceTo(player) - b.position.distanceTo(player))[0] ?? null;
    }
    for (const e of this.enemies) {
      const struck = e.update(dt, player, { mayAttack: e === this.attackToken, colliders });
      if (struck) this.resolveStrike(e, player, me);
    }
    if (this.started && this.enemies.every((e) => !e.active)) {
      this.over = true;
      this.onEvent({ type: 'victory' });
    }
  }

  /** The player's swing: hit every opponent in front within reach. */
  playerSwing(player: THREE.Vector3, facing: THREE.Vector3, me: PlayerCombat) {
    if (this.over) return;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const to = e.position.clone().sub(player).setY(0);
      if (to.length() > ATTACK.range || to.angleTo(facing) > ATTACK.arc / 2) continue;
      if (!me.canHit(e)) continue;
      if (!this.started) this.start(); // attacking from hiding starts the fight
      const finisher = me.combo === 3;
      e.takeHit(finisher ? 2 : 1, player);
      this.onEvent({ type: 'hit', enemy: e, finisher });
      if (!e.active) this.onEvent({ type: 'yielded', enemy: e });
    }
  }

  private resolveStrike(e: Enemy, player: THREE.Vector3, me: PlayerCombat) {
    const to = player.clone().sub(e.position).setY(0);
    if (to.length() > 2.1 || to.angleTo(e.forward()) > Math.PI / 3) return; // whiffed
    if (me.invulnerable) return; // dodged through it
    if (me.blockHeldFor >= 0) {
      if (me.blockHeldFor <= BLOCK.parryWindow) {
        e.parried();
        this.onEvent({ type: 'parry', enemy: e });
      } else {
        me.stamina = Math.max(0, me.stamina - BLOCK.chipStamina);
        this.onEvent({ type: 'blocked' });
      }
      return;
    }
    const amount = Math.round(e.opts.damage * (1 - me.stats.defense));
    me.health = Math.max(0, me.health - amount);
    me.hurtT = 0.3;
    this.onEvent({ type: 'hurt', amount });
    if (me.health <= 0) this.onEvent({ type: 'overwhelmed' });
  }

  /** Put everyone back for a retry. */
  reset() {
    this.started = false;
    this.over = false;
    this.attackToken = null;
    for (const e of this.enemies) {
      e.health = e.opts.health;
      e.detection = 0;
      e.state = 'idle';
      e.position.copy(e.home);
      e.character.root.rotation.y = e.opts.facing;
      e.character.root.visible = true;
      e.character.setAnim('idle');
      if (e.cone) e.cone.visible = true;
    }
  }
}

/** Short-lived visual effects: swing arcs, hit sparks, parry flashes. */
export class Effects {
  private items: { mesh: THREE.Object3D; life: number; max: number; grow?: number }[] = [];
  constructor(private readonly scene: THREE.Object3D) {}

  swing(at: THREE.Vector3, yaw: number, combo: number) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.6, 24, 1, -ATTACK.arc / 2, ATTACK.arc),
      new THREE.MeshBasicMaterial({ color: combo === 3 ? '#ffd27a' : '#fff1d6', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    );
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = yaw - Math.PI / 2;
    arc.position.copy(at).setY(1.05);
    this.add(arc, 0.18);
  }

  burst(at: THREE.Vector3, color: string, size = 0.6) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.5, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    );
    m.position.copy(at).setY(1.2);
    this.add(m, 0.22, 2.5);
  }

  private add(mesh: THREE.Object3D, life: number, grow?: number) {
    this.scene.add(mesh);
    this.items.push({ mesh, life, max: life, grow });
  }

  update(dt: number) {
    this.items = this.items.filter((it) => {
      it.life -= dt;
      const k = Math.max(0, it.life / it.max);
      const mat = (it.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = k * 0.8;
      if (it.grow) it.mesh.scale.setScalar(1 + (1 - k) * it.grow);
      if (it.life > 0) return true;
      this.scene.remove(it.mesh);
      (it.mesh as THREE.Mesh).geometry.dispose();
      mat.dispose();
      return false;
    });
  }
}
