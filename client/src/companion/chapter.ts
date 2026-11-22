/**
 * Companion chapter 1, "The Seeker". You are a young man of Ghifar travelling with Abu Dharr:
 * camp work among Ghifar, the road to Mecca, three nights as Ali's guests, the careful walk
 * behind Ali, the meeting with the Prophet ﷺ, standing by Abu Dharr when Quraysh rise against
 * him, and the return home. Narration carries the sourced history; your deeds are fiction.
 */
import * as THREE from 'three';
import { deeds, hasanatRule, objectives, type L } from '../../../backend/src/journey/content/companion';
import { Character, LOOKS, type Look } from '../game/character';
import { Effects, Enemy, Fight, PlayerCombat, statsFor, type CombatEvent } from '../game/combat';
import { Controls } from '../game/controls';
import type { Collider } from '../game/mecca';
import { PlayerController } from '../game/player';
import type { World } from '../game/world';
import { esc, modal, modalOpen, toast } from '../ui/ui';
import { buildGhifar, buildMeccaValley, type GhifarScene, type MeccaValley } from './env';
import type { Narrator } from './narrator';

type Lang = 'ar' | 'en';
interface Interaction {
  pos: () => THREE.Vector3;
  radius: number;
  label: () => string;
  when: () => boolean;
  run: () => void | Promise<void>;
}

const LOOK_ALI: Look = { robe: '#e9e2d0', robeStripe: '#ded6c2', cloak: '#3d4a3a', turban: '#efe8d8', skin: '#a87a55', beard: '#1d1611', beardLength: 'full', cloakLength: 0.9 };
const LOOK_PROPHET: Look = { robe: '#f4efe2', robeStripe: '#ebe5d6', cloak: '#efe7d6', turban: '#f6f1e6', skin: '#b08560', beard: '#1d1611', beardLength: 'full', cloakLength: 1 };
const LOOK_ABBAS: Look = { robe: '#7a5a3a', robeStripe: '#6d5034', cloak: '#3e2a1c', turban: '#d8ccb2', skin: '#a77b58', beard: '#6b625a', beardLength: 'full', cloakLength: 1 };
const LOOK_QURAYSH = ['#8c3b2a', '#5b4a7a', '#6a5a3a', '#7a2f3f', '#3f5a6a'].map(
  (robe): Look => ({ robe, robeStripe: robe, cloak: '#2e241c', turban: '#cfc2a6', skin: '#a77b58', beard: '#2a211b', beardLength: 'short', cloakLength: 0.7 }),
);

export class CompanionChapter {
  private controls: Controls;
  private player: PlayerController;
  private me = new PlayerCombat(statsFor({}));
  private effects: Effects;
  private colliders: Collider[] = [];
  private ghifar: GhifarScene;
  private mecca: MeccaValley;
  private scene: 'ghifar' | 'mecca' = 'ghifar';
  private abuDharr: Character;
  private unays: Character;
  private actors: Character[] = [];
  private interactions: Interaction[] = [];
  private nearest: Interaction | null = null;
  private cutscene = false;
  private camShot: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private carried: { kind: string; mesh: THREE.Object3D } | null = null;
  private hasanat = 0;
  private done = new Set<string>();
  private objective: L | null = null;
  private tickers: ((dt: number) => void)[] = [];
  private hitStop = 0;
  private disposers: (() => void)[] = [];
  /** Abu Dharr walks toward this point when set. */
  private adTarget: THREE.Vector3 | null = null;
  private adSpeed = 1.7;

  constructor(
    private readonly world: World,
    private readonly hud: HTMLElement,
    private readonly narrator: Narrator,
    private readonly lang: () => Lang,
    private readonly look: Look,
    private readonly onExit: () => void,
  ) {
    this.ghifar = buildGhifar();
    this.mecca = buildMeccaValley();
    this.buildHud();
    const me = new Character(look);
    me.equipStaff();
    world.scene.add(me.root);
    this.controls = new Controls(world.canvas, world.camera, this.ghifar.ground, hud);
    this.player = new PlayerController(me, this.controls, world.camera, this.colliders);
    this.controls.on('interact', () => void this.interact());
    this.controls.on('attack', () => this.attack());
    this.controls.on('dodge', () => this.dodge());
    this.effects = new Effects(world.scene);

    this.abuDharr = this.actor(LOOKS.abuDharr!);
    this.unays = this.actor(LOOKS.companion1!);
    this.unays.root.visible = false;

    this.disposers.push(world.onUpdate((dt, t) => this.update(dt, t)));
  }

  private tr(v: L) {
    return v[this.lang()];
  }

  private actor(look: Look) {
    const c = new Character(look);
    this.world.scene.add(c.root);
    this.actors.push(c);
    return c;
  }

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    this.hud.hidden = false;
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <div class="objective"><div class="label"></div><div class="text"></div></div>
          <div class="vitals"><div class="bar bar-health"><span></span></div><div class="bar bar-stamina"><span></span></div></div>
          <div class="carry-chip" hidden></div>
        </div>
        <div class="hud-right">
          <div class="row"><button class="btn icon-btn" data-hud="menu" aria-label="menu">☰</button></div>
          <button class="hasanat-pill" data-hud="hasanat"><b>0</b> <span></span></button>
        </div>
      </div>
      <div class="meter" hidden><span></span><em></em></div>
      <button class="prompt-chip" hidden></button>
      <div class="cine-bars" hidden><i></i><i></i></div>
      <div class="fade" hidden></div>`;
    this.hud.querySelector('[data-hud="menu"]')!.addEventListener('click', () => void this.menu());
    this.hud.querySelector('[data-hud="hasanat"]')!.addEventListener('click', () => void this.showHasanat());
    this.hud.querySelector('.prompt-chip')!.addEventListener('click', () => void this.interact());
    this.refreshHud();
  }

  private el<T extends HTMLElement = HTMLElement>(sel: string) {
    return this.hud.querySelector(sel) as T;
  }

  refreshHud() {
    const ar = this.lang() === 'ar';
    this.el('.objective .label').textContent = ar ? 'المهمّة' : 'Objective';
    this.el('.objective .text').textContent = this.objective ? this.tr(this.objective) : '';
    this.el('.objective').hidden = !this.objective;
    this.el('.hasanat-pill b').textContent = String(this.hasanat);
    this.el('.hasanat-pill span').textContent = ar ? 'حسنة' : 'hasanat';
  }

  private setObjective(o: L | null) {
    this.objective = o;
    this.refreshHud();
  }

  private setMeter(label: string | null, value = 0, warn = false) {
    const m = this.el('.meter');
    m.hidden = label === null;
    if (label === null) return;
    (m.firstElementChild as HTMLElement).style.width = `${Math.round(THREE.MathUtils.clamp(value, 0, 1) * 100)}%`;
    m.classList.toggle('warn', warn);
    (m.querySelector('em') as HTMLElement).textContent = label;
  }

  private async fade(out: boolean, ms = 700) {
    const f = this.el('.fade');
    f.hidden = false;
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = out ? '0' : '1';
    void f.offsetWidth;
    f.style.opacity = out ? '1' : '0';
    await wait(ms);
    if (!out) f.hidden = true;
  }

  private async titleCard(text: L) {
    const f = this.el('.fade');
    f.innerHTML = `<p>${esc(this.tr(text))}</p>`;
    await wait(1700);
    f.innerHTML = '';
  }

  private cine(on: boolean) {
    this.cutscene = on;
    this.controls.enabled = !on;
    this.el('.cine-bars').hidden = !on;
    if (!on) this.camShot = null;
  }

  private shot(pos: THREE.Vector3, look: THREE.Vector3) {
    this.camShot = { pos: pos.clone(), look: look.clone() };
  }

  /** Award a good deed once: hasanat plus its Qur'an verse. */
  private deed(id: string) {
    if (this.done.has(id)) return;
    const d = deeds.find((x) => x.id === id);
    if (!d) return;
    this.done.add(id);
    this.hasanat += d.hasanat;
    this.refreshHud();
    const card = document.createElement('div');
    card.className = 'deed-card';
    card.innerHTML = `<b>+${d.hasanat} ${this.lang() === 'ar' ? 'حسنة' : 'hasanat'}</b><span>${esc(this.tr(d.title))}</span><q>${esc(this.tr(d.verse))}</q><small>${esc(this.tr(d.ref))}</small>`;
    this.hud.appendChild(card);
    setTimeout(() => card.classList.add('out'), 5200);
    setTimeout(() => card.remove(), 5900);
    this.el('.hasanat-pill').classList.add('pulse');
    setTimeout(() => this.el('.hasanat-pill').classList.remove('pulse'), 900);
  }

  private async showHasanat() {
    const ar = this.lang() === 'ar';
    const rows = deeds
      .filter((d) => this.done.has(d.id))
      .map((d) => `<li><b>+${d.hasanat}</b> ${esc(this.tr(d.title))}<q>${esc(this.tr(d.verse))}</q><small>${esc(this.tr(d.ref))}</small></li>`)
      .join('');
    await modal({
      eyebrow: ar ? 'الحسنات' : 'Hasanat',
      title: `${this.hasanat}`,
      body: `<p class="rule">${esc(this.tr(hasanatRule.text))} <small>${esc(this.tr(hasanatRule.ref))}</small></p>
        <ul class="deeds">${rows || `<li>${ar ? 'لم تُسجَّل حسنات بعد.' : 'No good deeds yet.'}</li>`}</ul>
        <p class="note">${ar ? 'العدد طريقة اللعبة في تسجيل أعمالك الصالحة، أمّا الجزاء الحقّ فعند الله.' : 'The count is the game’s way of marking your good deeds; the true reward is with God.'}</p>`,
      className: 'hasanat-modal',
    });
  }

  private async menu() {
    const ar = this.lang() === 'ar';
    const id = await modal({
      title: ar ? 'القائمة' : 'Menu',
      body: `<p>${ar ? 'صوت الراوي' : 'Narrator voice'}: <b>${{ ar: 'العربية', en: 'English', off: ar ? 'متوقّف' : 'Off' }[this.narrator.voice]}</b></p>`,
      actions: [
        { id: 'voice', label: ar ? 'تغيير صوت الراوي' : 'Change narrator voice' },
        { id: 'deeds', label: ar ? 'الحسنات' : 'Hasanat' },
        { id: 'exit', label: ar ? 'الخروج' : 'Exit' },
        { id: 'close', label: ar ? 'متابعة' : 'Continue', primary: true },
      ],
    });
    if (id === 'voice') {
      this.narrator.voice = ({ ar: 'en', en: 'off', off: 'ar' } as const)[this.narrator.voice];
      try { localStorage.setItem('athar.voice', this.narrator.voice); } catch { /* ignore */ }
      toast(`${ar ? 'صوت الراوي' : 'Narrator'}: ${{ ar: 'العربية', en: 'English', off: ar ? 'متوقّف' : 'Off' }[this.narrator.voice]}`);
    }
    if (id === 'deeds') await this.showHasanat();
    if (id === 'exit') this.dispose(), this.onExit();
  }

  // ------------------------------------------------------------------ scene switching
  private useScene(name: 'ghifar' | 'mecca', spawn: THREE.Vector3, facing = Math.PI) {
    this.scene = name;
    this.world.scene.remove(this.ghifar.group, this.mecca.group);
    const s = name === 'ghifar' ? this.ghifar : this.mecca;
    this.world.scene.add(s.group);
    this.colliders.length = 0;
    this.colliders.push(...s.colliders);
    this.controls.setGround(s.ground);
    this.player.position.copy(spawn);
    this.player.character.root.rotation.y = facing;
    this.player.snapCamera();
    this.interactions = [];
  }

  // ------------------------------------------------------------------ the story
  async start() {
    this.world.setTimeOfDay('day');
    this.useScene('ghifar', this.ghifar.points.spawn!);
    this.place(this.abuDharr, this.ghifar.points.abuDharr!, 0);
    this.abuDharr.setAnim('sit');
    this.narrator.preload(['n01', 'n02', 'n03']);
    await this.fade(false, 1200);

    // Opening shot over the camp.
    this.cine(true);
    this.shot(new THREE.Vector3(26, 12, 26), new THREE.Vector3(0, 1, -4));
    await this.narrator.say('n01');
    this.shot(this.ghifar.points.abuDharr!.clone().add(new THREE.Vector3(5, 2.6, 6)), this.ghifar.points.abuDharr!.clone().setY(1.3));
    await this.narrator.say('n02', 'n03');
    this.cine(false);
    this.narrator.preload(['n04', 'n05']);
    await this.campTasks();
  }

  private place(c: Character, p: THREE.Vector3, ry: number) {
    c.root.position.copy(p);
    c.root.rotation.y = ry;
    c.root.visible = true;
  }

  /** Ghifar: water the camels (required), raise the widow's tent (optional), then Unays returns. */
  private async campTasks() {
    const g = this.ghifar;
    let poured = 0;
    let poles = 0;
    this.setObjective(objectives.herd);
    const ar = () => this.lang() === 'ar';
    this.interactions.push(
      {
        pos: () => g.points.well!, radius: 2.4, when: () => !this.carried && poured < 3,
        label: () => (ar() ? 'املأ الدلو' : 'Fill the bucket'),
        run: () => this.carry('bucket'),
      },
      {
        pos: () => g.points.trough!, radius: 2.2, when: () => this.carried?.kind === 'bucket',
        label: () => (ar() ? 'اسكب في الحوض' : 'Pour into the trough'),
        run: () => {
          this.drop();
          poured++;
          g.setTrough(poured / 3);
          this.effects.burst(g.points.trough!.clone().setY(0.6), '#8fd3ff', 0.6);
          if (poured >= 3) {
            this.deed('water-herd');
            void this.unaysReturns();
          } else toast(`${poured}/3`);
        },
      },
    );
    for (const key of ['pole1', 'pole2', 'pole3']) {
      let taken = false;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#5a4029' }));
      pole.rotation.z = Math.PI / 2;
      pole.position.copy(g.points[key]!).setY(0.08);
      g.group.add(pole);
      this.interactions.push({
        pos: () => g.points[key]!, radius: 1.8, when: () => !taken && !this.carried,
        label: () => (ar() ? 'احمل عمود الخيمة' : 'Pick up the tent pole'),
        run: () => {
          taken = true;
          pole.visible = false;
          this.carry('pole');
        },
      });
    }
    this.interactions.push({
      pos: () => g.points.widowTent!, radius: 3, when: () => this.carried?.kind === 'pole',
      label: () => (ar() ? 'ثبّت العمود' : 'Set the pole'),
      run: () => {
        this.drop();
        poles++;
        if (poles >= 3) {
          g.raiseTent();
          this.colliders.length = 0;
          this.colliders.push(...g.colliders);
          this.deed('raise-tent');
        } else toast(`${poles}/3`);
      },
    });
    toast(ar() ? 'خيمةٌ سقطت في طرف الحيّ. يمكنك إقامتها أيضًا.' : 'A tent has fallen at the edge of the camp. You can raise it too.');
  }

  private async unaysReturns() {
    const g = this.ghifar;
    this.setObjective(objectives.unays);
    this.place(this.unays, g.points.unaysStart!, Math.PI);
    this.abuDharr.setAnim('idle');
    await this.walk(this.unays, [g.points.unaysEnd!], 2.4);
    this.unays.setAnim('talk');
    this.interactions.push({
      pos: () => g.points.unaysEnd!, radius: 4, when: () => !this.cutscene && !this.done.has('heard-unays'),
      label: () => (this.lang() === 'ar' ? 'استمع إلى أُنيس' : 'Listen to Unays'),
      run: async () => {
        this.done.add('heard-unays');
        this.cine(true);
        this.shot(g.points.unaysEnd!.clone().add(new THREE.Vector3(-4, 2.2, 4)), g.points.unaysEnd!.clone().setY(1.4));
        this.abuDharr.root.lookAt(this.unays.root.position.x, 0, this.unays.root.position.z);
        await this.narrator.say('n04');
        this.unays.setAnim('idle');
        this.cine(false);
        this.setObjective(objectives.skin);
        this.narrator.preload(['n05', 'n06']);
        this.interactions.push(
          {
            pos: () => g.points.well!, radius: 2.4, when: () => !this.done.has('fill-waterskin') && !this.carried,
            label: () => (this.lang() === 'ar' ? 'املأ الشَّنّة' : 'Fill the waterskin'),
            run: () => {
              this.effects.burst(g.points.well!.clone().setY(1), '#8fd3ff', 0.5);
              this.deed('fill-waterskin');
            },
          },
          {
            pos: () => this.abuDharr.root.position, radius: 2.6, when: () => this.done.has('fill-waterskin') && !this.done.has('departed'),
            label: () => (this.lang() === 'ar' ? 'أعطِه الشَّنّة وانطلقا' : 'Give him the waterskin and set out'),
            run: () => void this.road(),
          },
        );
      },
    });
  }

  /** The road: walk with Abu Dharr to the night camp, then drive off the wolves. */
  private async road() {
    const g = this.ghifar;
    this.done.add('departed');
    this.interactions = [];
    this.cine(true);
    this.shot(this.abuDharr.root.position.clone().add(new THREE.Vector3(4, 3, 5)), this.abuDharr.root.position.clone().setY(1.3));
    await this.narrator.say('n05');
    this.cine(false);
    this.setObjective(objectives.road);
    this.world.setTimeOfDay('dusk');
    const path = [g.points.roadStart!, new THREE.Vector3(0, 0, -60), new THREE.Vector3(0.5, 0, -95), g.points.nightCamp!];
    await this.escort(path);
    // Night camp.
    this.world.setTimeOfDay('night');
    g.fire.intensity = 26;
    this.abuDharr.setAnim('sit');
    this.setObjective(objectives.wolves);
    await this.wolves(g.points.nightCamp!);
    this.deed('guard-camp');
    await wait(800);
    await this.fade(true, 1200);
    await this.titleCard({ ar: 'وبعد أيّامٍ من المسير… مكّة', en: 'Days later… Mecca' });
    await this.meccaDays();
  }

  /** Abu Dharr leads along the path; he waits if you fall behind. */
  private escort(path: THREE.Vector3[]) {
    return new Promise<void>((resolve) => {
      let i = 0;
      this.adTarget = path[0]!.clone();
      this.adSpeed = 1.8;
      const tick = () => {
        const far = this.player.position.distanceTo(this.abuDharr.root.position) > 13;
        this.setMeter(far ? (this.lang() === 'ar' ? 'أبو ذرّ ينتظرك' : 'Abu Dharr is waiting for you') : null, 0.2, true);
        this.adSpeed = far ? 0 : 1.8;
        if (this.adTarget && this.abuDharr.root.position.distanceTo(this.adTarget) < 0.6) {
          i++;
          if (i >= path.length) {
            this.adTarget = null;
            this.setMeter(null);
            this.tickers = this.tickers.filter((t) => t !== tick);
            resolve();
            return;
          }
          this.adTarget = path[i]!.clone();
        }
      };
      this.tickers.push(tick);
    });
  }

  /** Wolves circle the camp; strike each one until it runs off. */
  private wolves(center: THREE.Vector3) {
    return new Promise<void>((resolve) => {
      const wolves = [0, 1, 2].map((i) => {
        const w = makeWolf();
        const a = (i / 3) * Math.PI * 2 + 0.6;
        w.position.set(center.x + Math.cos(a) * 16, 0, center.z + Math.sin(a) * 16);
        this.ghifar.group.add(w);
        return { mesh: w, hp: 3, fleeing: false, gone: false, a, t: 0, hurt: 0 };
      });
      const tick = (dt: number) => {
        const p = this.player.position;
        let left = 0;
        for (const w of wolves) {
          if (w.gone) continue;
          left++;
          w.t += dt;
          w.hurt = Math.max(0, w.hurt - dt);
          const pos = w.mesh.position;
          let target: THREE.Vector3;
          if (w.fleeing) {
            target = pos.clone().sub(center).setY(0).normalize().multiplyScalar(60).add(center);
            if (pos.distanceTo(center) > 40) {
              w.gone = true;
              w.mesh.visible = false;
            }
          } else {
            // Circle closer, darting in at the camp.
            w.a += dt * 0.45;
            const rad = Math.max(3.5, 14 - w.t * 0.9);
            target = new THREE.Vector3(center.x + Math.cos(w.a) * rad, 0, center.z + Math.sin(w.a) * rad);
          }
          const dir = target.sub(pos).setY(0);
          const speed = w.fleeing ? 7 : 3.2;
          if (dir.length() > 0.1) {
            pos.addScaledVector(dir.normalize(), speed * dt);
            w.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          }
          w.mesh.position.y = Math.abs(Math.sin(w.t * 9)) * 0.06;
          (w.mesh.userData.body as THREE.Mesh).material = w.hurt > 0 ? WOLF_HURT : WOLF_MAT;
        }
        if (this.me.swingConnects(dt)) {
          const facing = this.player.facing();
          for (const w of wolves) {
            if (w.fleeing || w.gone) continue;
            const to = w.mesh.position.clone().sub(p).setY(0);
            if (to.length() < 2.6 && to.normalize().dot(facing) > 0.2) {
              w.hp--;
              w.hurt = 0.2;
              w.mesh.position.addScaledVector(to, 0.8);
              this.effects.burst(w.mesh.position.clone().setY(0.6), '#fff1d6', 0.5);
              this.hitStop = 0.05;
              if (w.hp <= 0) w.fleeing = true;
            }
          }
        }
        if (left === 0) {
          this.tickers = this.tickers.filter((t) => t !== tick);
          resolve();
        }
      };
      this.tickers.push(tick);
    });
  }

  /** Mecca: the first evening, three nights as Ali's guests. */
  private async meccaDays() {
    const m = this.mecca;
    this.world.setTimeOfDay('dusk');
    this.useScene('mecca', m.points.arrive!, Math.PI);
    this.place(this.abuDharr, m.points.arrive!.clone().add(new THREE.Vector3(1.5, 0, -1.5)), Math.PI);
    await this.fade(false, 1200);
    this.adTarget = m.points.abuDharrRest!.clone();
    this.adSpeed = 1.6;
    this.setObjective(objectives.meccaDay);
    this.narrator.preload(['n06', 'n07', 'n08']);
    this.meccaHelpTasks();
    await new Promise<void>((resolve) => {
      this.interactions.push({
        pos: () => this.abuDharr.root.position, radius: 2.6, when: () => !this.adTarget && !this.carried,
        label: () => (this.lang() === 'ar' ? 'اجلس مع أبي ذرّ حتى يحلّ الليل' : 'Sit with Abu Dharr until nightfall'),
        run: () => resolve(),
      });
    });
    this.interactions = [];
    this.setObjective(null);

    // Night one: Ali finds the stranger.
    const ali = this.actor(LOOK_ALI);
    ali.veil();
    const night = async (lines: string[], first: boolean) => {
      this.world.setTimeOfDay('night');
      for (const l of m.lamps) l.intensity = 14;
      this.abuDharr.root.position.copy(m.points.abuDharrRest!);
      this.abuDharr.setAnim('sit');
      this.player.position.copy(m.points.abuDharrRest!.clone().add(new THREE.Vector3(1.4, 0, 1.2)));
      this.place(ali, new THREE.Vector3(24, 0, -2), -Math.PI / 2);
      this.cine(true);
      this.shot(m.points.abuDharrRest!.clone().add(new THREE.Vector3(7, 3, 7)), m.points.abuDharrRest!.clone().setY(1));
      await this.fade(false, 900);
      if (first) await this.narrator.say('n06');
      await this.walk(ali, [m.points.abuDharrRest!.clone().add(new THREE.Vector3(1.6, 0, -0.4))], 1.5);
      ali.setAnim('talk');
      this.abuDharr.setAnim('idle');
      await this.narrator.say(...lines);
      ali.setAnim('walk');
      this.abuDharr.setAnim('walk');
      const home = m.points.aliHouse!;
      void this.walk(this.abuDharr, [new THREE.Vector3(24, 0, -1), home.clone().add(new THREE.Vector3(-2, 0, 0.5))], 1.5);
      await this.walk(ali, [new THREE.Vector3(24, 0, -2), home], 1.5);
      await this.fade(true, 900);
    };
    await night(['n07'], true);
    await this.titleCard({ ar: 'اليوم التالي', en: 'The next day' });
    await night(['n08'], false);
    await this.titleCard({ ar: 'اليوم الثالث', en: 'The third day' });

    // Third day: Ali asks, and gives the plan.
    this.world.setTimeOfDay('day');
    for (const l of m.lamps) l.intensity = 0;
    this.place(ali, m.points.aliHouse!.clone().add(new THREE.Vector3(-1.5, 0, 0)), -Math.PI / 2);
    this.place(this.abuDharr, m.points.aliHouse!.clone().add(new THREE.Vector3(-3.5, 0, 0.6)), Math.PI / 2);
    this.player.position.copy(m.points.aliHouse!.clone().add(new THREE.Vector3(-4.5, 0, -1.8)));
    this.shot(m.points.aliHouse!.clone().add(new THREE.Vector3(-8, 2.6, 5)), m.points.aliHouse!.clone().add(new THREE.Vector3(-2.5, 1.3, 0)));
    ali.setAnim('talk');
    this.narrator.preload(['n09', 'n10', 'n11', 'n12']);
    await this.fade(false, 900);
    await this.narrator.say('n09', 'n10');
    ali.setAnim('idle');
    this.cine(false);
    await this.secretWalk(ali);
  }

  /** Optional good deeds in Mecca: rebuild a poor man's wall, give Zamzam water to a thirsty man. */
  private meccaHelpTasks() {
    const m = this.mecca;
    const ar = () => this.lang() === 'ar';
    const poor = this.actor({ ...LOOKS.elder!, staff: true });
    this.place(poor, m.points.poorMan!, Math.PI);
    poor.setAnim('idle');
    const thirsty = this.actor(LOOKS.wayfarer!);
    this.place(thirsty, m.points.thirsty!, Math.PI / 2);
    thirsty.setAnim('sit');
    let placed = 0;
    const stoneMeshes = m.stones.map((p) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), new THREE.MeshStandardMaterial({ color: '#9c8a72', roughness: 0.95 }));
      s.position.copy(p).setY(0.2);
      s.castShadow = true;
      m.group.add(s);
      return s;
    });
    stoneMeshes.forEach((s, i) => {
      this.interactions.push({
        pos: () => m.stones[i]!, radius: 1.6, when: () => s.visible && !this.carried,
        label: () => (ar() ? 'احمل الحجر' : 'Pick up the stone'),
        run: () => {
          s.visible = false;
          this.carry('stone');
        },
      });
    });
    this.interactions.push(
      {
        pos: () => m.wallSlots[2]!.clone().setZ(31.6), radius: 3.2, when: () => this.carried?.kind === 'stone',
        label: () => (ar() ? 'ضع الحجر في الجدار' : 'Set the stone in the wall'),
        run: () => {
          this.drop();
          m.placeStone(placed++);
          if (placed >= 5) {
            this.deed('repair-house');
            poor.setAnim('talk');
            toast(ar() ? 'الفقير: جزاك الله خيرًا يا بُنيّ.' : 'The poor man: May God reward you, my son.');
          } else toast(`${placed}/5`);
        },
      },
      {
        pos: () => m.points.zamzam!, radius: 2.4, when: () => !this.carried && !this.done.has('give-water'),
        label: () => (ar() ? 'املأ قِربةً من زمزم' : 'Fill a waterskin at Zamzam'),
        run: () => this.carry('water'),
      },
      {
        pos: () => m.points.thirsty!, radius: 2.4, when: () => this.carried?.kind === 'water',
        label: () => (ar() ? 'اسقِ الرجل العطشان' : 'Give the thirsty man water'),
        run: () => {
          this.drop();
          thirsty.setAnim('talk');
          this.deed('give-water');
        },
      },
    );
    toast(ar() ? 'في السوق رجلٌ فقير تهدّم جداره، وقرب البيت رجلٌ عطشان.' : 'In the market a poor man’s wall has fallen, and near the House a man is thirsty.');
  }

  /**
   * Follow Ali at a distance. When he stops "as if pouring out water" a watcher is near: stop,
   * keep out of the watcher's sight. Too close or too far and you must start again.
   */
  private async secretWalk(ali: Character) {
    const m = this.mecca;
    this.setObjective(objectives.follow);
    const watchers = m.watchers.map((w, i) => {
      const c = this.actor(LOOK_QURAYSH[i % LOOK_QURAYSH.length]!);
      c.root.position.copy(w.pos);
      return new Enemy(c, { name: 'watcher', health: 1, damage: 0, facing: w.facing, scan: 1.1, scanSpeed: 0.6, vision: { range: 12, fov: 1.2 } }, m.group);
    });
    const ar = () => this.lang() === 'ar';
    for (;;) {
      // Start (or restart) at Ali's door.
      const route = m.route;
      this.place(ali, route[0]!, -2.4);
      this.place(this.abuDharr, route[0]!.clone().add(new THREE.Vector3(2, 0, 2.5)), -2.4);
      this.player.position.copy(route[0]!.clone().add(new THREE.Vector3(5, 0, 5)));
      this.player.snapCamera();
      const result = await new Promise<'ok' | 'seen' | 'lost' | 'close'>((resolve) => {
        let seg = 1;
        let pause = 0;
        let pausedAt = -1;
        let detect = 0;
        let farFor = 0;
        let closeFor = 0;
        const tick = (dt: number) => {
          const ap = ali.root.position;
          const p = this.player.position;
          // Ali walks; near a watcher he stops as if pouring out water.
          const nearW = watchers.findIndex((w) => w.position.distanceTo(ap) < 9);
          if (nearW >= 0 && pausedAt !== nearW) {
            pausedAt = nearW;
            pause = 4.5;
            toast(ar() ? 'عليٌّ توقّف كأنّه يُريق الماء… قِفْ واختبئ!' : 'Ali stops as if pouring out water… stop and hide!', 'warn');
          }
          if (pause > 0) {
            pause -= dt;
            ali.setAnim('interact');
          } else {
            const target = route[seg]!;
            const d = target.clone().sub(ap).setY(0);
            if (d.length() < 0.4) {
              seg++;
              if (seg >= route.length) {
                this.tickers = this.tickers.filter((t) => t !== tick);
                resolve('ok');
                return;
              }
            } else {
              ap.addScaledVector(d.normalize(), 1.45 * dt);
              ali.root.rotation.y = Math.atan2(d.x, d.z);
              ali.setAnim('walk');
            }
          }
          // Abu Dharr follows Ali a few steps behind.
          const behind = ap.clone().sub(this.abuDharr.root.position).setY(0);
          if (behind.length() > 5) {
            this.abuDharr.root.position.addScaledVector(behind.normalize(), 1.6 * dt);
            this.abuDharr.root.rotation.y = Math.atan2(behind.x, behind.z);
            this.abuDharr.setAnim('walk');
          } else this.abuDharr.setAnim('idle');
          // Watchers look around; while Ali is "pouring water" they must not see you.
          let seen = 0;
          for (const w of watchers) {
            w.update(dt, p, { mayAttack: false, colliders: this.colliders });
            w.character.update(dt);
            seen = Math.max(seen, w.sees(p, this.colliders));
          }
          const still = !this.player.moving;
          const rate = seen > 0 ? (pause > 0 && !still ? 1.4 : pause > 0 ? 0.35 : 0.5) * (this.controls.sneaking ? 0.5 : 1) * (0.5 + seen) : -0.4;
          detect = THREE.MathUtils.clamp(detect + rate * dt, 0, 1);
          const dist = p.distanceTo(ap);
          farFor = dist > 24 ? farFor + dt : 0;
          closeFor = dist < 3.5 ? closeFor + dt : 0;
          const label = detect > 0.05 ? (ar() ? 'انتباه الرقباء' : 'Watchers’ attention') : dist > 20 ? (ar() ? 'إنّك تبتعد عن عليّ' : 'You are falling behind Ali') : dist < 4.5 ? (ar() ? 'أنت قريبٌ جدًّا' : 'You are too close') : null;
          this.setMeter(label, detect > 0.05 ? detect : dist > 20 ? (dist - 20) / 6 : 0.5, detect > 0.05 || dist < 4.5 || dist > 20);
          if (detect >= 1) finish('seen');
          else if (farFor > 6) finish('lost');
          else if (closeFor > 3) finish('close');
        };
        const finish = (r: 'seen' | 'lost' | 'close') => {
          this.tickers = this.tickers.filter((t) => t !== tick);
          resolve(r);
        };
        this.tickers.push(tick);
      });
      this.setMeter(null);
      if (result === 'ok') break;
      toast(
        {
          seen: ar() ? 'رآك أحدُ رجال قريش. نعود إلى باب عليّ.' : 'A man of Quraysh noticed you. Back to Ali’s door.',
          lost: ar() ? 'فقدتَ أثرهما. نعود إلى باب عليّ.' : 'You lost them. Back to Ali’s door.',
          close: ar() ? 'اقتربتَ أكثر مما ينبغي فلفتّ الأنظار. نعود.' : 'You came too close and drew attention. Back again.',
        }[result],
        'warn',
      );
      await this.fade(true, 500);
      await this.fade(false, 500);
    }
    for (const w of watchers) w.character.root.visible = false;
    this.deed('secret-walk');
    await this.meeting(ali);
  }

  /** The meeting with the Prophet ﷺ, shown with his face veiled in light. */
  private async meeting(ali: Character) {
    const m = this.mecca;
    this.setObjective(null);
    await this.fade(true, 800);
    const prophet = this.actor(LOOK_PROPHET);
    prophet.veil();
    this.place(prophet, m.points.prophetSeat!, Math.PI * 0.25);
    prophet.setAnim('sit');
    this.place(ali, m.points.prophetSeat!.clone().add(new THREE.Vector3(1.8, 0, 0.6)), Math.PI * 0.1);
    ali.setAnim('idle');
    this.place(this.abuDharr, m.points.prophetSeat!.clone().add(new THREE.Vector3(0.6, 0, 2.6)), Math.PI * 1.15);
    this.player.position.copy(m.points.prophetSeat!.clone().add(new THREE.Vector3(3, 0, 4)));
    this.cine(true);
    this.shot(m.points.prophetSeat!.clone().add(new THREE.Vector3(6, 3.2, 7.5)), m.points.prophetSeat!.clone().add(new THREE.Vector3(0.6, 1.1, 1)));
    await this.fade(false, 1100);
    this.abuDharr.setAnim('talk');
    await this.narrator.say('n11');
    this.abuDharr.setAnim('idle');
    await this.narrator.say('n12');
    this.narrator.preload(['n13', 'n14']);
    await this.fade(true, 900);
    prophet.root.visible = false;
    ali.root.visible = false;
    await this.declaration();
  }

  /** Abu Dharr proclaims his faith at the House; stand by him until al-Abbas comes. */
  private async declaration() {
    const m = this.mecca;
    this.world.setTimeOfDay('day');
    this.place(this.abuDharr, m.points.kaabaFront!, Math.PI * 0.5);
    this.abuDharr.setAnim('talk');
    this.player.position.copy(m.points.kaabaFront!.clone().add(new THREE.Vector3(2.5, 0, 2)));
    this.player.character.root.rotation.y = Math.PI * 0.5;
    this.shot(m.points.kaabaFront!.clone().add(new THREE.Vector3(12, 4, 10)), new THREE.Vector3(2, 3, 2));
    await this.fade(false, 900);
    await this.narrator.say('n13');
    this.cine(false);
    this.setObjective(objectives.shield);

    const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(m.points.kaabaFront!).setY(0.05);
    m.group.add(ring);

    for (;;) {
      this.me.health = this.me.stats.maxHealth;
      this.me.stamina = this.me.stats.maxStamina;
      const outcome = await new Promise<'held' | 'down' | 'left'>((resolve) => {
        const fight = new Fight('crowd', (e: CombatEvent) => this.onCombat(e, finish), false);
        const crowd: Character[] = [];
        for (let i = 0; i < 5; i++) {
          const c = this.actor(LOOK_QURAYSH[i]!);
          const a = -0.9 + i * 0.45;
          c.root.position.set(m.points.kaabaFront!.x + Math.cos(a) * 16, 0, m.points.kaabaFront!.z + Math.sin(a) * 16);
          crowd.push(c);
          fight.add(new Enemy(c, { name: 'crowd', health: 3, damage: 9, facing: Math.PI }, m.group));
        }
        fight.start();
        let t = 0;
        let away = 0;
        const tick = (dt: number) => {
          t += dt;
          const p = this.player.position;
          fight.update(dt, p, this.me, this.colliders, false);
          for (const e of fight.enemies) e.character.update(dt);
          if (this.me.swingConnects(dt)) fight.playerSwing(p, this.player.facing(), this.me);
          away = p.distanceTo(m.points.kaabaFront!) > 7 ? away + dt : 0;
          this.setMeter(this.lang() === 'ar' ? 'ابقَ قرب أبي ذرّ' : 'Stay by Abu Dharr', Math.max(0, 1 - t / 45), away > 0);
          if (away > 4) finish('left');
          if (t > 45) finish('held');
        };
        const finish = (r: 'held' | 'down' | 'left') => {
          this.tickers = this.tickers.filter((x) => x !== tick);
          fight.over = true;
          this.setMeter(null);
          setTimeout(() => crowd.forEach((c) => (c.root.visible = false)), r === 'held' ? 2500 : 300);
          resolve(r);
        };
        this.tickers.push(tick);
      });
      if (outcome === 'held') break;
      toast(
        outcome === 'down'
          ? this.lang() === 'ar' ? 'غُلبتَ. حاول مرّةً أخرى.' : 'You were overwhelmed. Try again.'
          : this.lang() === 'ar' ? 'ابتعدتَ عن أبي ذرّ. عُدْ إليه.' : 'You left Abu Dharr’s side. Try again.',
        'warn',
      );
      await this.fade(true, 400);
      this.player.position.copy(m.points.kaabaFront!.clone().add(new THREE.Vector3(2.5, 0, 2)));
      await this.fade(false, 400);
    }
    ring.visible = false;
    this.deed('shield');

    // Al-Abbas comes.
    const abbas = this.actor(LOOK_ABBAS);
    this.place(abbas, m.points.kaabaFront!.clone().add(new THREE.Vector3(10, 0, 12)), -2.3);
    this.cine(true);
    this.shot(m.points.kaabaFront!.clone().add(new THREE.Vector3(9, 3.2, 8)), m.points.kaabaFront!.clone().setY(1.2));
    this.abuDharr.setAnim('yield');
    void this.walk(abbas, [m.points.kaabaFront!.clone().add(new THREE.Vector3(1.2, 0, 1))], 2.6).then(() => abbas.setAnim('talk'));
    this.narrator.preload(['n15', 'n16']);
    await this.narrator.say('n14');
    await this.fade(true, 1100);
    abbas.root.visible = false;
    await this.titleCard({ ar: 'العودة إلى غِفار', en: 'Back to Ghifar' });
    await this.homecoming();
  }

  private onCombat(e: CombatEvent, finish: (r: 'held' | 'down' | 'left') => void) {
    switch (e.type) {
      case 'hit':
        this.effects.burst(e.enemy.position, e.finisher ? '#ffd27a' : '#fff1d6', e.finisher ? 0.9 : 0.6);
        this.hitStop = e.finisher ? 0.09 : 0.05;
        break;
      case 'parry':
        this.effects.burst(this.player.position.clone().lerp(e.enemy.position, 0.5), '#8fd3ff', 1);
        this.hitStop = 0.12;
        break;
      case 'blocked':
        this.effects.burst(this.player.position, '#cdb999', 0.4);
        break;
      case 'overwhelmed':
        finish('down');
        break;
      case 'victory':
        finish('held');
        break;
      default:
        break;
    }
  }

  private async homecoming() {
    const g = this.ghifar;
    this.world.setTimeOfDay('day');
    this.useScene('ghifar', g.points.spawn!);
    g.fire.intensity = 0;
    this.place(this.abuDharr, g.points.well!.clone().add(new THREE.Vector3(-3, 0, 2)), 0.6);
    this.abuDharr.setAnim('talk');
    this.place(this.unays, g.points.well!.clone().add(new THREE.Vector3(-1.2, 0, 4)), Math.PI + 0.5);
    this.unays.setAnim('idle');
    const listeners = [0, 1, 2, 3, 4].map((i) => {
      const c = this.actor([LOOKS.wayfarer!, LOOKS.townsman!, LOOKS.companion2!, LOOKS.guide!, LOOKS.wayfarer!][i]!);
      const a = 0.4 + i * 0.5;
      this.place(c, g.points.well!.clone().add(new THREE.Vector3(Math.cos(a) * 5 - 3, 0, Math.sin(a) * 5 + 2)), -a - Math.PI / 2);
      c.setAnim('sit');
      return c;
    });
    this.cine(true);
    this.shot(g.points.well!.clone().add(new THREE.Vector3(6, 4, 10)), g.points.well!.clone().add(new THREE.Vector3(-3, 1, 2)));
    await this.fade(false, 1200);
    await this.narrator.say('n15');
    this.setObjective(objectives.done);
    await this.narrator.say('n16');
    void listeners;
    const ar = this.lang() === 'ar';
    const id = await modal({
      eyebrow: ar ? 'الفصل الأوّل' : 'Chapter one',
      title: ar ? 'الباحث عن الحقّ' : 'The Seeker',
      body: `<p class="big">${this.hasanat} <small>${ar ? 'حسنة' : 'hasanat'}</small></p>
        <ul class="deeds">${deeds.map((d) => `<li class="${this.done.has(d.id) ? '' : 'missed'}">${this.done.has(d.id) ? '✓' : '○'} ${esc(this.tr(d.title))}</li>`).join('')}</ul>
        <p class="note">${ar ? 'الفصل التالي: المدينة — بناء المسجد مع الصحابة.' : 'Next chapter: Medina — building the mosque with the companions.'}</p>`,
      actions: [
        { id: 'replay', label: ar ? 'أعد الفصل' : 'Replay chapter' },
        { id: 'exit', label: ar ? 'القائمة الرئيسية' : 'Main menu', primary: true },
      ],
      className: 'end-modal',
    });
    this.dispose();
    if (id === 'replay') location.reload();
    else this.onExit();
  }

  // ------------------------------------------------------------------ helpers
  private walk(c: Character, path: THREE.Vector3[], speed: number) {
    return new Promise<void>((resolve) => {
      let i = 0;
      c.setAnim('walk');
      const tick = (dt: number) => {
        const target = path[i]!;
        const d = target.clone().sub(c.root.position).setY(0);
        if (d.length() < 0.25) {
          i++;
          if (i >= path.length) {
            c.setAnim('idle');
            this.tickers = this.tickers.filter((t) => t !== tick);
            resolve();
            return;
          }
          return;
        }
        c.root.position.addScaledVector(d.normalize(), Math.min(speed * dt, d.length()));
        c.root.rotation.y = Math.atan2(d.x, d.z);
      };
      this.tickers.push(tick);
    });
  }

  private carry(kind: string) {
    const meshes: Record<string, () => THREE.Object3D> = {
      bucket: () => new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 10), new THREE.MeshStandardMaterial({ color: '#5a3a22' })),
      pole: () => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#5a4029' }));
        p.rotation.x = Math.PI / 2.4;
        return p;
      },
      stone: () => new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.42), new THREE.MeshStandardMaterial({ color: '#9c8a72', roughness: 0.95 })),
      water: () => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: '#7a5032', roughness: 0.5 }));
        s.scale.set(1, 1.2, 0.8);
        return s;
      },
    };
    const mesh = meshes[kind]!();
    mesh.position.set(0, 1.15, 0.42);
    mesh.castShadow = true;
    this.player.character.root.add(mesh);
    this.carried = { kind, mesh };
    const chip = this.el('.carry-chip');
    chip.hidden = false;
    chip.textContent = { bucket: '🪣', pole: '🪵', stone: '🪨', water: '💧' }[kind] ?? '•';
  }

  private drop() {
    if (!this.carried) return;
    this.player.character.root.remove(this.carried.mesh);
    this.carried = null;
    this.el('.carry-chip').hidden = true;
  }

  private async interact() {
    if (this.cutscene || modalOpen() || this.narrator.speaking || !this.nearest) return;
    const it = this.nearest;
    this.nearest = null;
    await it.run();
  }

  private attack() {
    if (this.cutscene || modalOpen() || this.carried) return;
    if (this.me.tryAttack()) this.effects.swing(this.player.position, this.player.character.root.rotation.y, this.me.combo);
  }

  private dodge() {
    if (this.cutscene || modalOpen()) return;
    const dir = this.player.inputDirection();
    if (dir.lengthSq() === 0) this.player.facing(dir).negate();
    if (this.me.tryDodge(dir)) this.player.faceTowards(dir);
  }

  private update(dt: number, t: number) {
    const slow = this.hitStop > 0 ? 0.08 : 1;
    if (this.hitStop > 0) this.hitStop -= dt;
    const gdt = dt * slow;
    this.controls.update();
    const me = this.me;
    if (!this.cutscene) {
      const offset = me.update(gdt, this.controls.blocking, this.player.moving, this.controls.running);
      this.player.push(offset);
      this.player.speedScale = me.attacking ? 0.25 : me.blockHeldFor >= 0 ? 0.4 : this.controls.sneaking ? 0.5 : this.carried ? 0.75 : 1;
      this.player.canTurn = !me.attacking;
      this.player.animOverride = me.dodging ? 'dodge' : me.attacking ? 'attack' : me.hurtT > 0 ? 'hit' : me.blockHeldFor >= 0 ? 'block' : this.controls.sneaking ? 'crouch' : this.carried && this.player.moving ? 'carry' : null;
      this.player.update(gdt);
    } else if (this.camShot) {
      const cam = this.world.camera;
      cam.position.lerp(this.camShot.pos, Math.min(1, dt * 2.2));
      cam.lookAt(this.camShot.look);
    }
    this.player.character.update(gdt);

    // Abu Dharr walking to a target.
    if (this.adTarget) {
      const d = this.adTarget.clone().sub(this.abuDharr.root.position).setY(0);
      if (d.length() < 0.3) {
        this.adTarget = null;
        this.abuDharr.setAnim(this.scene === 'mecca' ? 'sit' : 'idle');
      } else if (this.adSpeed > 0) {
        this.abuDharr.root.position.addScaledVector(d.normalize(), Math.min(this.adSpeed * gdt, d.length()));
        this.abuDharr.root.rotation.y = Math.atan2(d.x, d.z);
        this.abuDharr.setAnim('walk');
      } else {
        this.abuDharr.setAnim('idle');
        const look = this.player.position.clone().sub(this.abuDharr.root.position);
        this.abuDharr.root.rotation.y = Math.atan2(look.x, look.z);
      }
    }
    for (const fn of [...this.tickers]) fn(gdt);
    for (const a of this.actors) if (a.root.visible) a.update(gdt);
    (this.scene === 'ghifar' ? this.ghifar : this.mecca).update(dt, t);
    this.effects.update(dt);
    this.world.followSun(this.player.position);

    // Vitals.
    (this.el('.bar-health').firstElementChild as HTMLElement).style.width = `${(me.health / me.stats.maxHealth) * 100}%`;
    (this.el('.bar-stamina').firstElementChild as HTMLElement).style.width = `${(me.stamina / me.stats.maxStamina) * 100}%`;

    // Nearest interaction.
    this.nearest = null;
    if (!this.cutscene && !this.narrator.speaking) {
      let best = Infinity;
      for (const it of this.interactions) {
        if (!it.when()) continue;
        const d = it.pos().distanceTo(this.player.position);
        if (d < it.radius && d < best) {
          best = d;
          this.nearest = it;
        }
      }
    }
    const chip = this.el<HTMLButtonElement>('.prompt-chip');
    chip.hidden = !this.nearest;
    if (this.nearest) chip.textContent = `${matchMedia('(pointer: coarse)').matches ? '👆' : 'E'} · ${this.nearest.label()}`;
  }

  dispose() {
    this.disposers.forEach((d) => d());
    this.tickers = [];
    this.controls.dispose();
    this.world.scene.remove(this.ghifar.group, this.mecca.group, this.player.character.root, ...this.actors.map((a) => a.root));
    this.hud.innerHTML = '';
    this.hud.hidden = true;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WOLF_MAT = new THREE.MeshStandardMaterial({ color: '#6b6258', roughness: 1 });
const WOLF_HURT = new THREE.MeshStandardMaterial({ color: '#c9b8a0', roughness: 1, emissive: '#5a3a2a' });
function makeWolf() {
  const w = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 6, 10), WOLF_MAT);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.55;
  w.add(body);
  w.userData.body = body;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), WOLF_MAT);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 0.68, 0.58);
  w.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 5), WOLF_MAT);
    ear.position.set(s * 0.08, 0.84, 0.45);
    w.add(ear);
  }
  for (const [x, z] of [[0.12, 0.3], [-0.12, 0.3], [0.12, -0.3], [-0.12, -0.3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.45, 5), WOLF_MAT);
    leg.position.set(x!, 0.22, z!);
    w.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), WOLF_MAT);
  tail.rotation.x = -Math.PI / 1.6;
  tail.position.set(0, 0.6, -0.55);
  w.add(tail);
  w.traverse((c) => ((c as THREE.Mesh).castShadow = true));
  return w;
}
