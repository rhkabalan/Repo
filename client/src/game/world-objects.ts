import * as THREE from 'three';
import type { Collider } from './mecca';
import { wood } from './textures';

/**
 * Crate-pushing puzzle: crates slide one grid cell at a time when the player walks into
 * them; when every pressure stone is covered the counterweight gate rises.
 */
export interface PushPuzzleConfig {
  /** World position of cell (0, 0). Columns go +x, rows go -z. */
  origin: THREE.Vector2;
  cell: number;
  cols: number;
  rows: number;
  crates: [number, number][];
  plates: [number, number][];
}

export class PushPuzzle {
  readonly group = new THREE.Group();
  private crates: { col: number; row: number; mesh: THREE.Mesh; collider: Collider; target: THREE.Vector3 }[] = [];
  private plates: THREE.Mesh[] = [];
  private pushTimer = 0;
  private pushKey = '';
  solved = false;
  onSolved: (() => void) | null = null;

  constructor(
    private readonly cfg: PushPuzzleConfig,
    private readonly colliders: Collider[],
  ) {
    const crateMat = new THREE.MeshStandardMaterial({ map: wood(), color: '#c19a6b', roughness: 0.85 });
    const plateMat = new THREE.MeshStandardMaterial({ color: '#8a7a66', roughness: 0.9, emissive: '#000000' });
    for (const [c, r] of cfg.plates) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(cfg.cell * 0.42, cfg.cell * 0.46, 0.08, 20), plateMat.clone());
      plate.position.copy(this.world(c, r)).setY(0.04);
      plate.receiveShadow = true;
      this.group.add(plate);
      this.plates.push(plate);
    }
    // Faint grid markings so the puzzle reads as a puzzle.
    const lineMat = new THREE.MeshBasicMaterial({ color: '#5a4632', transparent: true, opacity: 0.25 });
    for (let c = 0; c < cfg.cols; c++) {
      for (let r = 0; r < cfg.rows; r++) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(cfg.cell * 0.94, cfg.cell * 0.94), lineMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.copy(this.world(c, r)).setY(0.035);
        this.group.add(tile);
      }
    }
    for (const [c, r] of cfg.crates) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.cell * 0.82, cfg.cell * 0.82, cfg.cell * 0.82), crateMat);
      mesh.castShadow = mesh.receiveShadow = true;
      const pos = this.world(c, r).setY(cfg.cell * 0.41);
      mesh.position.copy(pos);
      this.group.add(mesh);
      const collider: Collider = { min: new THREE.Vector2(), max: new THREE.Vector2(), id: 'crate' };
      colliders.push(collider);
      const crate = { col: c, row: r, mesh, collider, target: pos.clone() };
      this.setCollider(crate);
      this.crates.push(crate);
    }
  }

  private start = new Map<object, [number, number]>();

  world(col: number, row: number) {
    return new THREE.Vector3(this.cfg.origin.x + col * this.cfg.cell, 0, this.cfg.origin.y - row * this.cfg.cell);
  }

  private setCollider(c: { col: number; row: number; collider: Collider }) {
    const p = this.world(c.col, c.row);
    const h = this.cfg.cell * 0.41;
    c.collider.min.set(p.x - h, p.z - h);
    c.collider.max.set(p.x + h, p.z + h);
  }

  private occupied(col: number, row: number) {
    return this.crates.some((c) => c.col === col && c.row === row);
  }

  /**
   * Called each frame with the player's position and input direction (world space).
   * Pushing into a crate for a moment slides it one cell.
   */
  update(dt: number, player: THREE.Vector3, moveDir: THREE.Vector3) {
    for (const c of this.crates) c.mesh.position.lerp(c.target, Math.min(1, dt * 10));
    if (this.solved || moveDir.lengthSq() < 0.2) {
      this.pushTimer = 0;
      return;
    }
    const axis = Math.abs(moveDir.x) > Math.abs(moveDir.z) ? new THREE.Vector2(Math.sign(moveDir.x), 0) : new THREE.Vector2(0, Math.sign(moveDir.z));
    for (const c of this.crates) {
      const p = this.world(c.col, c.row);
      const dx = p.x - player.x;
      const dz = p.z - player.z;
      const reach = this.cfg.cell * 0.41 + 0.55;
      const touching = axis.x !== 0 ? Math.abs(dz) < 0.45 && dx * axis.x > 0 && Math.abs(dx) < reach : Math.abs(dx) < 0.45 && dz * axis.y > 0 && Math.abs(dz) < reach;
      if (!touching) continue;
      const key = `${c.col},${c.row},${axis.x},${axis.y}`;
      if (key !== this.pushKey) {
        this.pushKey = key;
        this.pushTimer = 0;
      }
      this.pushTimer += dt;
      if (this.pushTimer < 0.22) return;
      this.pushTimer = 0;
      // +x is +col; -z is +row.
      const nc = c.col + axis.x;
      const nr = c.row - axis.y;
      if (nc < 0 || nr < 0 || nc >= this.cfg.cols || nr >= this.cfg.rows || this.occupied(nc, nr)) return;
      if (!this.start.has(c)) this.start.set(c, [c.col, c.row]);
      c.col = nc;
      c.row = nr;
      c.target.copy(this.world(nc, nr)).setY(this.cfg.cell * 0.41);
      this.setCollider(c);
      this.checkPlates();
      return;
    }
  }

  private checkPlates() {
    let covered = 0;
    this.cfg.plates.forEach(([pc, pr], i) => {
      const on = this.occupied(pc, pr);
      const mat = this.plates[i]!.material as THREE.MeshStandardMaterial;
      mat.emissive.set(on ? '#ffb347' : '#000000');
      mat.emissiveIntensity = on ? 0.8 : 0;
      if (on) covered++;
    });
    if (covered === this.cfg.plates.length && !this.solved) {
      this.solved = true;
      this.onSolved?.();
    }
  }

  cratePositions(): [number, number][] {
    return this.crates.map((c) => [c.col, c.row]);
  }

  /** Put the crates back where they started (the reset lever). */
  reset() {
    if (this.solved) return;
    for (const c of this.crates) {
      const s = this.start.get(c);
      if (!s) continue;
      [c.col, c.row] = s;
      c.target.copy(this.world(c.col, c.row)).setY(this.cfg.cell * 0.41);
      this.setCollider(c);
    }
    this.start.clear();
    this.checkPlates();
  }

  /** Jump straight to the solved layout (progress restored from the server). */
  markSolved() {
    this.solved = true;
    this.cfg.plates.forEach(([pc, pr], i) => {
      const c = this.crates[i];
      if (!c) return;
      c.col = pc;
      c.row = pr;
      c.target.copy(this.world(pc, pr)).setY(this.cfg.cell * 0.41);
      c.mesh.position.copy(c.target);
      this.setCollider(c);
    });
    this.checkPlates();
  }
}

export type PickupKind = 'water' | 'provisions' | 'wood' | 'rope' | 'fragment' | 'merchant-bundle';

/** A collectible in the world: a small model with a soft glint that bobs in place. */
export class Pickup {
  readonly group = new THREE.Group();
  collected = false;
  private t = Math.random() * 6;
  private glint: THREE.Sprite;

  constructor(
    readonly id: string,
    readonly kind: PickupKind,
    at: THREE.Vector3,
  ) {
    this.group.position.copy(at);
    const m = (color: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    let model: THREE.Object3D;
    switch (kind) {
      case 'water': {
        // Leather water skin.
        model = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), m('#7a5032', 0.6));
        model.scale.set(1, 1.3, 0.8);
        break;
      }
      case 'provisions': {
        model = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 12), m('#c9a46a'));
        break;
      }
      case 'wood': {
        model = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 7), m('#6e4a2c'));
          log.rotation.z = Math.PI / 2;
          log.position.set(0, i * 0.09, (i - 1) * 0.06);
          model.add(log);
        }
        break;
      }
      case 'rope': {
        model = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 18), m('#b08a54'));
        model.rotation.x = Math.PI / 2;
        break;
      }
      case 'fragment': {
        // Rolled journal page.
        model = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), m('#efe2c2', 0.9));
        model.rotation.z = Math.PI / 2.4;
        break;
      }
      case 'merchant-bundle': {
        model = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), m('#8a3b2a'));
        model.scale.set(1, 0.75, 1);
        break;
      }
    }
    model.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    model.position.y = 0.35;
    this.group.add(model);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, kind === 'fragment' ? 'rgba(199,166,255,0.9)' : 'rgba(255,224,150,0.9)');
    g.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.glint.scale.setScalar(0.9);
    this.glint.position.y = 0.4;
    this.group.add(this.glint);
  }

  get position() {
    return this.group.position;
  }

  update(dt: number) {
    if (this.collected) return;
    this.t += dt;
    const model = this.group.children[0]!;
    model.position.y = 0.35 + Math.sin(this.t * 2.2) * 0.06;
    model.rotation.y += dt * 1.2;
    this.glint.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.3;
  }

  take() {
    this.collected = true;
    this.group.visible = false;
  }
}
