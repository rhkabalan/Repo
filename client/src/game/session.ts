import * as THREE from 'three';
import type { Catalog, Chapter } from '../content';
import { getLang, t } from '../i18n';
import { api } from '../net/api';
import type { Award, MissionDriver, RemotePlayer, RunState } from '../net/driver';
import { esc, modal, modalOpen, toast, translate } from '../ui/ui';
import { castNpcs, designFor, type Design } from './cast';
import { Character, LOOKS, type Anim } from './character';
import { Effects, Enemy, Fight, PlayerCombat, statsFor, type CombatEvent } from './combat';
import { Controls } from './controls';
import { buildMecca, type Interactable } from './mecca';
import { PlayerController } from './player';
import { Pickup, PushPuzzle, type PickupKind } from './world-objects';
import type { World } from './world';

type L = { ar: string; en: string };
const tr = (s: L) => s[getLang()];

/** Dialogue for the fictional characters of the Mecca adventure. */
const LINES = {
  trainerName: { ar: 'معلّم الساحة', en: 'The yard master' },
  trainerIntro: {
    ar: 'أهلًا أيها المسافر. الطرق خطرة هذه الأيام. خذ هذه العصا وتعلّم: اضرب، وصُدّ قبل الضربة مباشرةً لتكسر هجوم خصمك، وتفادَ حين ترى الحلقة الحمراء.',
    en: 'Welcome, traveler. The roads are dangerous these days. Take this staff and learn: strike, block just before a blow lands to break your opponent’s attack, and dodge when you see the red ring.',
  },
  trainerDone: { ar: 'أحسنت. أنت جاهز للطريق. الساحة الكبرى في آخر السوق.', en: 'Well done. You are ready for the road. The great courtyard is at the end of the market.' },
  restIntro: { ar: 'استرح هنا، وحسّن عتادك بما جمعت من مواد.', en: 'Rest here, and improve your gear with the materials you have gathered.' },
  travelerName: { ar: 'مسافر مستريح', en: 'A resting traveler' },
  travelerThirsty: { ar: 'طال بي الطريق والحرّ شديد… هل معك ماء؟', en: 'The road was long and the heat is fierce… do you have any water?' },
  travelerThanks: { ar: 'جزاك الله خيرًا.', en: 'May God reward you.' },
  travelerNoWater: { ar: 'ليس معك ماء. ابحث عن قِرَب الماء في الأزقّة.', en: 'You have no water. Look for water skins in the alleys.' },
  merchantName: { ar: 'تاجر', en: 'A merchant' },
  merchantAsk: {
    ar: 'أضعتُ صرّة بضاعتي في الأزقّة الخلفية. إن أعدتَها أعطيتك مفتاح الباب الجانبي للساحة؛ فالعصابة تسدّ الطريق الرئيسي.',
    en: 'I lost my bundle of goods in the back alleys. Bring it back and I’ll give you the key to the courtyard’s side door; the gang is blocking the main way.',
  },
  merchantThanks: { ar: 'صرّتي! خذ المفتاح، الباب الجانبي في الجدار يسار البوابة.', en: 'My bundle! Take the key. The side door is in the wall left of the gate.' },
  merchantDone: { ar: 'بارك الله فيك. انتبه لنفسك.', en: 'Bless you. Take care of yourself.' },
} satisfies Record<string, L>;

const OBJECTIVES = {
  training: { ar: 'تحدّث إلى معلّم الساحة وأكمل التدريب بالعصا.', en: 'Talk to the yard master and complete your staff training.' },
  obstacle: {
    ar: 'عصابةٌ تسدّ الطريق إلى الساحة. واجههم، أو تسلّل عبر الأزقّة الخلفية، أو جد طريقًا آخر.',
    en: 'A gang blocks the way to the courtyard. Face them, sneak through the back alleys, or find another way.',
  },
  discover: { ar: 'ادخل ساحة اللقاء واكتشف ما جرى هنا.', en: 'Enter the Meeting Courtyard and discover what happened here.' },
  done: { ar: 'اكتملت رحلة مكة.', en: 'The Mecca journey is complete.' },
} satisfies Record<string, L>;

const ITEM_ICON: Record<string, string> = { water: '💧', provisions: '🫓', wood: '🪵', rope: '🧵', 'merchant-bundle': '🎒', 'side-gate-key': '🗝️' };

export interface PlayerProfile {
  name: string;
  characterId: string | null;
}

export interface SessionCallbacks {
  onExit(): void;
  onComplete(): void;
}

interface InventoryRow {
  itemId: string;
  name: string;
  count: number;
  capacity: number;
}
interface UpgradeRow {
  upgradeId: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  nextCost: Record<string, number> | null;
}

export class GameSession {
  private env = buildMecca();
  private player: PlayerController;
  private controls: Controls;
  private chapter: Chapter;
  private npcs: Character[] = [];
  private remote = new Map<string, { c: Character; target: THREE.Vector3 }>();
  private nearest: Interactable | null = null;
  private busy = false;
  private completedShown = false;
  private minimapCtx!: CanvasRenderingContext2D;
  private minimapTimer = 0;
  private disposers: (() => void)[] = [];

  private me: PlayerCombat;
  private training: Fight;
  private gang: Fight;
  private effects: Effects;
  private puzzle: PushPuzzle;
  private pickups: Pickup[] = [];
  private inventory: InventoryRow[] = [];
  private upgrades: UpgradeRow[] = [];
  private earnedXp = 0;
  private maxXp = 0;
  private hitStop = 0;
  private shake = 0;
  private resolving = new Set<string>();

  constructor(
    private readonly world: World,
    private readonly catalog: Catalog,
    private readonly driver: MissionDriver,
    private readonly hud: HTMLElement,
    private readonly profile: PlayerProfile,
    private readonly party: Map<string, PlayerProfile>,
    private readonly cb: SessionCallbacks,
  ) {
    this.chapter = catalog.chapters.find((c) => c.id === driver.chapterId)!;
    this.add(this.env.group);

    const mine = designFor(this.profile.characterId);
    const me = new Character(mine.look, mine.model, mine.clips);
    me.root.position.copy(this.env.spawn);
    me.root.rotation.y = Math.PI;
    me.equipStaff();
    this.add(me.root);

    this.buildHud();
    const ground = this.env.group.children[0]!;
    this.controls = new Controls(world.canvas, world.camera, ground, hud);
    this.player = new PlayerController(me, this.controls, world.camera, this.env.colliders);
    this.controls.on('interact', () => void this.interact());
    this.controls.on('attack', () => this.attack());
    this.controls.on('dodge', () => this.dodge());
    translate(hud);

    this.me = new PlayerCombat(statsFor({}));
    this.effects = new Effects(world.scene);
    this.disposers.push(() => this.effects.update(999));

    // NPCs take designs no player chose; the yard master and merchant are fictional.
    const taken = [this.profile.characterId, ...[...party.values()].map((p) => p.characterId)].filter((x): x is string => !!x);
    const npcCast = castNpcs(taken);
    this.spawnNpc(npcCast.guide, 'trainer', 'talk', Math.PI * 0.7);
    this.spawnNpc(npcCast.restingTraveler, 'traveler', 'sit', Math.PI / 2);
    this.spawnNpc({ look: LOOKS.townsman! }, 'merchant', 'idle', Math.PI / 2);

    // Encounters.
    this.training = new Fight('staff-training', (e) => this.onCombat(this.training, e));
    this.gang = new Fight('extortioners', (e) => this.onCombat(this.gang, e), true);
    for (const spawn of this.env.enemies) {
      const isTraining = spawn.encounterId === 'staff-training';
      const c = new Character(isTraining ? LOOKS.companion1! : LOOKS.wayfarer!);
      c.root.position.copy(spawn.position);
      this.add(c.root);
      const enemy = new Enemy(
        c,
        isTraining
          ? { name: 'sparring', health: 4, damage: 6, training: true, facing: spawn.facing }
          : { name: 'extortioner', health: 4, damage: 14, facing: spawn.facing, scan: spawn.scan, scanSpeed: 0.6, vision: { range: 9, fov: THREE.MathUtils.degToRad(70) } },
        world.scene,
      );
      (isTraining ? this.training : this.gang).add(enemy);
    }

    // Puzzle and pickups.
    this.puzzle = new PushPuzzle(this.env.puzzle, this.env.colliders);
    this.add(this.puzzle.group);
    this.puzzle.onSolved = () => void this.puzzleSolved();
    for (const c of this.chapter.mission.collectibles) {
      const at = this.env.pickups[c.id];
      if (!at) continue;
      const kind = (c.item === 'fragment' ? 'fragment' : c.item) as PickupKind;
      const p = new Pickup(c.id, kind, at);
      this.add(p.group);
      this.pickups.push(p);
    }

    driver.onChange((s) => this.applyRunState(s));
    driver.onAwards((a) => this.showAwards(a));
    driver.onPlayers?.((players) => this.syncRemote(players));
    this.applyRunState(driver.state);
    void this.refreshJourney();

    this.disposers.push(world.onUpdate((dt, time) => this.update(dt, time)));
    setTimeout(() => toast(t('fictionalNote')), 600);

    if (import.meta.env.DEV) {
      // Test hook for automated walkthroughs (stripped from production builds).
      (window as unknown as { __athar: object }).__athar = {
        teleport: (x: number, z: number) => {
          this.player.position.set(x, 0, z);
          this.player.snapCamera();
        },
        state: () => this.driver.state,
        combat: () => ({ health: this.me.health, stamina: this.me.stamina, gang: this.gang.enemies.map((e) => [e.state, e.health, +e.detection.toFixed(2)]), training: this.training.enemies.map((e) => [e.state, e.health]) }),
        inventory: () => this.inventory,
        defeatTraining: () => this.training.enemies.forEach((e) => (this.training.start(), e.takeHit(99, this.player.position))),
        defeatGang: () => this.gang.enemies.forEach((e) => (this.gang.start(), e.takeHit(99, this.player.position))),
        solvePuzzle: () => this.puzzle.markSolved(),
        crates: () => this.puzzle.cratePositions(),
      };
    }
  }

  private spawnNpc(design: Design, id: string, anim: Anim, yaw: number) {
    const it = this.env.interactables.find((i) => i.id === id)!;
    const c = new Character(design.look, design.model, design.clips);
    c.root.position.copy(it.position);
    c.root.rotation.y = yaw;
    c.setAnim(anim);
    if (id === 'trainer') c.equipStaff();
    this.add(c.root);
    this.npcs.push(c);
  }

  // ---------------------------------------------------------------- HUD
  private el = <T extends HTMLElement>(sel: string) => this.hud.querySelector(sel) as T;

  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <div class="objective"><div class="label">${esc(t('objective'))}</div><div class="text"></div></div>
          <div class="vitals">
            <div class="bar bar-health" title="${esc(t('resolve'))}"><span></span></div>
            <div class="bar bar-stamina" title="${esc(t('stamina'))}"><span></span></div>
          </div>
          <div class="inv"></div>
        </div>
        <div class="hud-right">
          <div class="row">
            <button class="btn icon-btn" data-hud="hint">${esc(t('hint'))}</button>
            <button class="btn icon-btn" data-hud="menu">☰</button>
          </div>
          <div class="pill"><b class="xp">0</b> ${esc(t('xp'))}</div>
          <div class="party-list"></div>
          <canvas id="minimap" width="240" height="300"></canvas>
        </div>
      </div>
      <div class="detect" hidden><span></span></div>
      <button class="prompt-chip" hidden></button>`;
    this.hud.hidden = false;
    this.minimapCtx = this.el<HTMLCanvasElement>('#minimap').getContext('2d')!;
    this.el('[data-hud="hint"]').addEventListener('click', () => this.hint());
    this.el('[data-hud="menu"]').addEventListener('click', () => void this.menu());
    this.el('.prompt-chip').addEventListener('click', () => void this.interact());
  }

  private objectiveKey(): keyof typeof OBJECTIVES {
    const s = this.driver.state;
    if (s.completed) return 'done';
    if (!s.encounters['staff-training']) return 'training';
    if (!s.encounters.extortioners) return 'obstacle';
    return 'discover';
  }

  private refreshHud() {
    this.el('.objective .text').textContent = tr(OBJECTIVES[this.objectiveKey()]);
    this.el('.xp').textContent = String(this.earnedXp);
    this.el('.inv').innerHTML = this.inventory
      .filter((i) => i.count > 0)
      .map((i) => `<span class="chip" title="${esc(i.name)}">${ITEM_ICON[i.itemId] ?? '•'} ${i.count}${i.capacity > 1 ? `<small>/${i.capacity}</small>` : ''}</span>`)
      .join('');
  }

  private count(itemId: string) {
    return this.inventory.find((i) => i.itemId === itemId)?.count ?? 0;
  }

  /** Reload inventory, upgrades and XP from the journey (server or offline store). */
  private async refreshJourney() {
    try {
      const j = await api.get<{ inventory: InventoryRow[]; upgrades: UpgradeRow[]; chapters: { chapterId: string; earnedXp: number; maxXp: number }[] }>('/v1/journey');
      this.inventory = j.inventory;
      this.upgrades = j.upgrades;
      const c = j.chapters.find((x) => x.chapterId === this.chapter.id);
      this.earnedXp = c?.earnedXp ?? 0;
      this.maxXp = c?.maxXp ?? 0;
      this.me.setStats(statsFor(Object.fromEntries(j.upgrades.map((u) => [u.upgradeId, u.level]))));
      this.refreshHud();
    } catch {
      /* offline hiccup: keep the last known values */
    }
  }

  private hint() {
    const s = this.driver.state;
    const k = this.objectiveKey();
    const hints: Record<string, L> = {
      training: { ar: 'معلّم الساحة يقف قرب أعمدة التدريب.', en: 'The yard master stands by the training posts.' },
      obstacle: s.puzzles['collapsed-passage']?.solved
        ? { ar: 'من آخر الممرّ المنهار، تسلّل خلف العصابة إلى البوابة دون أن يراك المراقب.', en: 'From the end of the collapsed passage, sneak behind the gang to the gate without the lookout seeing you.' }
        : this.count('side-gate-key') > 0
          ? { ar: 'الباب الجانبي في الجدار يسار البوابة.', en: 'The side door is in the wall left of the gate.' }
          : { ar: 'الزقاق الجانبي يمين السوق يقود إلى طرق خلفية. والتاجر قد يساعدك.', en: 'The side alley on the right of the market leads to back streets. The merchant may help you.' },
      discover: { ar: 'اللوح الحجري في صدر الساحة.', en: 'The stone tablet at the far end of the courtyard.' },
      done: OBJECTIVES.done,
    };
    toast(tr(hints[k]!));
  }

  private showAwards(awards: Award[]) {
    for (const a of awards) {
      if (a.type === 'xp') toast(`+${a.amount} ${t('xp')}`, 'xp');
      else if (a.type === 'badge') toast(`🏅 ${a.name ?? a.badgeId}`, 'badge');
      else if (a.type === 'item') toast(`${ITEM_ICON[a.itemId] ?? '+'} ${a.name ?? a.itemId} +${a.amount}`);
    }
    void this.refreshJourney();
  }

  // ---------------------------------------------------------------- state
  private applyRunState(s: RunState) {
    if (s.encounters.extortioners || s.openAreas.includes('meeting-courtyard')) this.env.openGate();
    if (s.encounters.extortioners) {
      this.gang.over = true;
      if (!this.gang.started) for (const e of this.gang.enemies) e.cone && (e.cone.visible = false);
    }
    if (s.encounters.extortioners === 'route') this.env.openSideDoor();
    if (s.encounters['staff-training']) this.training.over = true;
    if (s.puzzles['collapsed-passage']?.solved && !this.puzzle.solved) {
      this.puzzle.markSolved();
      this.env.raiseBackGate();
    }
    for (const p of this.pickups) if (s.collectibles.includes(p.id) && !p.collected) p.take();
    for (const it of this.env.interactables) {
      if (it.kind === 'discovery' && it.marker) it.marker.visible = !s.discoveries.includes(it.id);
    }
    this.refreshHud();
    if (s.completed && !this.completedShown && this.driver.mode === 'party') void this.showCompletion();
  }

  private syncRemote(players: RemotePlayer[]) {
    for (const p of players) {
      let r = this.remote.get(p.id);
      if (!r) {
        const profile = this.party.get(p.id);
        const design = designFor(profile?.characterId);
        const c = new Character(design.look, design.model, design.clips);
        c.setLabel(profile?.name ?? '…');
        c.equipStaff();
        c.root.position.set(p.x, 0, p.y);
        this.world.scene.add(c.root);
        r = { c, target: new THREE.Vector3(p.x, 0, p.y) };
        this.remote.set(p.id, r);
      }
      r.target.set(p.x, 0, p.y);
      r.c.root.visible = p.active;
      r.c.setAnim((p.anim as Anim) ?? 'idle');
    }
    this.el('.party-list').innerHTML = players.map((p) => `<div class="pill">${p.active ? '●' : '○'} ${esc(this.party.get(p.id)?.name ?? '…')}</div>`).join('');
  }

  // ---------------------------------------------------------------- combat
  private activeFights() {
    return [this.training, this.gang].filter((f) => !f.over);
  }

  private attack() {
    if (modalOpen() || this.busy) return;
    if (!this.me.tryAttack()) return;
    // Snap toward the nearest opponent in reach, so swings feel responsive on touch.
    const target = this.activeFights()
      .flatMap((f) => f.enemies.filter((e) => e.active))
      .sort((a, b) => a.position.distanceTo(this.player.position) - b.position.distanceTo(this.player.position))[0];
    if (target && target.position.distanceTo(this.player.position) < 3.2) this.player.faceTowards(target.position.clone().sub(this.player.position));
    this.effects.swing(this.player.position, this.player.character.root.rotation.y, this.me.combo);
  }

  private dodge() {
    if (modalOpen() || this.busy) return;
    const dir = this.player.inputDirection();
    if (dir.lengthSq() === 0) this.player.facing(dir).negate(); // no input: hop back
    if (this.me.tryDodge(dir)) this.player.faceTowards(dir);
  }

  private onCombat(fight: Fight, e: CombatEvent) {
    switch (e.type) {
      case 'hit':
        this.effects.burst(e.enemy.position, e.finisher ? '#ffd27a' : '#fff1d6', e.finisher ? 0.9 : 0.6);
        this.hitStop = e.finisher ? 0.09 : 0.05;
        if (e.finisher) this.shake = 0.15;
        break;
      case 'parry':
        this.effects.burst(this.player.position.clone().lerp(e.enemy.position, 0.5), '#8fd3ff', 1);
        this.hitStop = 0.12;
        toast(t('parry'));
        break;
      case 'blocked':
        this.effects.burst(this.player.position, '#cdb999', 0.4);
        break;
      case 'hurt':
        this.shake = 0.2;
        break;
      case 'yielded':
        break;
      case 'detected':
        toast(t('spotted'), 'warn');
        break;
      case 'overwhelmed':
        void this.overwhelmed(fight);
        break;
      case 'victory':
        if (fight === this.training) void this.trainingDone();
        else void this.resolveGang('fight');
        break;
    }
  }

  private async overwhelmed(fight: Fight) {
    this.busy = true;
    this.controls.enabled = false;
    toast(t('overwhelmed'), 'warn');
    await new Promise((r) => setTimeout(r, 1200));
    fight.reset();
    this.me.health = this.me.stats.maxHealth;
    this.me.stamina = this.me.stats.maxStamina;
    const cp = this.env.checkpoints[fight.id];
    if (cp) {
      this.player.position.copy(cp);
      this.player.snapCamera();
    }
    this.controls.enabled = true;
    this.busy = false;
  }

  private async trainingDone() {
    const res = await this.driver.act({ type: 'encounter.resolve', encounterId: 'staff-training', method: 'fight' });
    if (!res.ok) return void toast(res.message, 'warn');
    // Sparring partners just step back; no one is hurt in training.
    for (const e of this.training.enemies) {
      e.state = 'idle';
      e.character.root.visible = true;
      e.character.setAnim('idle');
      e.position.copy(e.home);
    }
    await this.say(LINES.trainerName, LINES.trainerDone);
  }

  private async resolveGang(method: 'fight' | 'sneak' | 'route') {
    if (this.resolving.has('extortioners') || this.driver.state.encounters.extortioners) return;
    this.resolving.add('extortioners');
    const res = await this.driver.act({ type: 'encounter.resolve', encounterId: 'extortioners', method });
    this.resolving.delete('extortioners');
    if (!res.ok) return void toast(res.message, 'warn');
    this.gang.over = true;
    for (const e of this.gang.enemies) if (e.cone) e.cone.visible = false;
    this.env.openGate();
    toast({ fight: t('wonFight'), sneak: t('sneakedPast'), route: t('tookRoute') }[method]);
  }

  private async puzzleSolved() {
    this.env.raiseBackGate();
    toast(t('gateRaised'));
    const res = await this.driver.act({ type: 'puzzle.attempt', puzzleId: 'collapsed-passage', answer: ['solved'] });
    if (!res.ok) toast(res.message, 'warn');
  }

  // ---------------------------------------------------------------- interactions
  private async interact() {
    if (this.busy || modalOpen() || !this.nearest) return;
    this.busy = true;
    this.controls.enabled = false;
    try {
      const it = this.nearest;
      switch (it.kind) {
        case 'trainer':
          await this.talkToTrainer();
          break;
        case 'rest':
          await this.rest();
          break;
        case 'traveler':
          await this.traveler();
          break;
        case 'merchant':
          await this.merchant();
          break;
        case 'lever':
          this.puzzle.reset();
          toast(this.puzzle.solved ? t('gateRaised') : t('leverReset'));
          break;
        case 'sideDoor':
          await this.sideDoor();
          break;
        case 'discovery':
          await this.discover(it.id);
          break;
      }
    } finally {
      this.busy = false;
      this.controls.enabled = true;
      this.refreshHud();
    }
  }

  private async say(speaker: L, text: L) {
    await modal({ body: `<div class="speaker">${esc(tr(speaker))}</div><p>${esc(tr(text))}</p>`, actions: [{ id: 'ok', label: t('continue'), primary: true }] });
  }

  private async talkToTrainer() {
    if (this.driver.state.encounters['staff-training']) return this.say(LINES.trainerName, LINES.trainerDone);
    const pick = await modal({
      body: `<div class="speaker">${esc(tr(LINES.trainerName))}</div><p>${esc(tr(LINES.trainerIntro))}</p>
        <p class="controls-help">${getLang() === 'ar' ? 'لوحة المفاتيح: J أو النقر للضرب، K أو الزر الأيمن للصدّ، المسافة للتفادي، C للتسلّل، E للتفاعل.' : 'Keyboard: J or click to attack, K or right-click to block, Space to dodge, C to sneak, E to interact.'}</p>`,
      actions: [
        { id: 'later', label: t('close') },
        { id: 'go', label: t('trainingStart'), primary: true },
      ],
    });
    if (pick === 'go') this.training.start();
  }

  private async rest() {
    this.me.health = this.me.stats.maxHealth;
    this.me.stamina = this.me.stats.maxStamina;
    await this.refreshJourney();
    const costText = (cost: Record<string, number>) =>
      Object.entries(cost)
        .map(([id, n]) => `${ITEM_ICON[id] ?? ''} ${n}`)
        .join(' · ');
    const rows = this.upgrades
      .map((u) => {
        const affordable = u.nextCost && Object.entries(u.nextCost).every(([id, n]) => this.count(id) >= n);
        return `<div class="upgrade">
          <div><b>${esc(u.name)}</b> <span class="lvl">${'●'.repeat(u.level)}${'○'.repeat(u.maxLevel - u.level)}</span><br/><small>${esc(u.description)}</small></div>
          ${u.nextCost ? `<button class="btn ${affordable ? 'btn-primary' : ''}" data-up="${u.upgradeId}" ${affordable ? '' : 'disabled'}>${esc(t('upgrade'))} · ${costText(u.nextCost)}</button>` : `<span class="lvl">${esc(t('maxLevel'))}</span>`}
        </div>`;
      })
      .join('');
    toast(t('restored'));
    await modal({
      title: t('restPoint'),
      body: `<p>${esc(tr(LINES.restIntro))}</p><div class="inv big">${this.el('.inv').innerHTML || '—'}</div><div class="upgrades">${rows}</div>`,
      onMount: (el, done) => {
        el.querySelectorAll<HTMLElement>('[data-up]').forEach((b) =>
          b.addEventListener('click', async () => {
            try {
              await api.post('/v1/journey/events', { type: 'upgrade.buy', upgradeId: b.dataset.up, chapterId: this.chapter.id });
              await this.refreshJourney();
              toast(`${t('upgrade')} ✓`);
              done('close');
              void this.rest();
            } catch (err) {
              toast((err as { message?: string }).message ?? 'Error', 'warn');
            }
          }),
        );
      },
    });
  }

  private async traveler() {
    const task = this.chapter.mission.tasks.find((x) => x.id === 'water-delivery')!;
    const done = (this.driver.state.tasks[task.id] ?? 0) >= task.goal;
    if (done) return this.say(LINES.travelerName, LINES.travelerThanks);
    if (this.count('water') === 0) {
      await this.say(LINES.travelerName, LINES.travelerThirsty);
      return void toast(tr(LINES.travelerNoWater));
    }
    const res = await this.driver.act({ type: 'task.progress', taskId: task.id, amount: 1 });
    if (!res.ok) return void toast(res.message, 'warn');
    toast(`💧 ${res.result.count}/${res.result.goal}`);
    await this.refreshJourney();
    if (res.result.complete) await this.say(LINES.travelerName, LINES.travelerThanks);
  }

  private async merchant() {
    const task = this.chapter.mission.tasks.find((x) => x.id === 'merchant-goods')!;
    if ((this.driver.state.tasks[task.id] ?? 0) >= task.goal) return this.say(LINES.merchantName, LINES.merchantDone);
    if (this.count('merchant-bundle') === 0) return this.say(LINES.merchantName, LINES.merchantAsk);
    const res = await this.driver.act({ type: 'task.progress', taskId: task.id, amount: 1 });
    if (!res.ok) return void toast(res.message, 'warn');
    await this.refreshJourney();
    await this.say(LINES.merchantName, LINES.merchantThanks);
  }

  private async sideDoor() {
    if (this.driver.state.encounters.extortioners) return;
    if (this.count('side-gate-key') === 0) return void toast(t('needKey'));
    this.env.openSideDoor();
  }

  private async discover(id: string) {
    const d = this.chapter.mission.discoveries.find((x) => x.id === id)!;
    if (!this.driver.state.discoveries.includes(id)) {
      const res = await this.driver.act({ type: 'discovery.find', discoveryId: id });
      if (!res.ok) return void toast(res.message, 'warn');
    }
    const sources = d.sources.length
      ? `<ul>${d.sources.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.citation)}</a>` : esc(s.citation)}</li>`).join('')}</ul>`
      : `<p>${esc(t('sourcesPending'))}</p>`;
    // Historical scenes use their own framing, separate from the fictional adventure.
    await modal({
      className: 'history',
      eyebrow: t('historicalAccount'),
      title: d.title,
      body: `<span class="certainty ${d.meta.certainty}">${esc(t(`certainty_${d.meta.certainty}`))}</span><p class="history-text">${esc(d.body)}</p><div class="sources"><b>${esc(t('sources'))}</b>${sources}</div>`,
      actions: [{ id: 'ok', label: t('continue'), primary: true }],
    });
    const choice = this.chapter.mission.choices.find((c) => c.id === 'journal-emphasis');
    if (choice && !this.driver.state.choices[choice.id]) {
      const picked = await modal({ eyebrow: t('journal'), title: choice.prompt, body: '', actions: choice.options.map((o) => ({ id: o.id, label: o.label, primary: true })) });
      if (picked !== 'close') await this.driver.act({ type: 'choice.make', choiceId: choice.id, optionId: picked });
    }
    const done = await this.driver.act({ type: 'mission.complete' });
    if (!done.ok) return void toast(done.message, 'warn');
    if (this.driver.mode === 'solo') await this.showCompletion();
  }

  private async showCompletion() {
    if (this.completedShown) return;
    this.completedShown = true;
    await this.refreshJourney();
    const choice = this.chapter.mission.choices.find((c) => c.id === 'journal-emphasis');
    const option = choice?.options.find((o) => o.id === this.driver.state.choices['journal-emphasis']);
    const method = this.driver.state.encounters.extortioners;
    const pick = await modal({
      eyebrow: this.chapter.setting,
      title: t('missionComplete'),
      body: `<div class="score">${this.earnedXp} / ${this.maxXp}</div><p style="text-align:center">${esc(t('xp'))}${method ? ` · ${esc({ fight: t('wonFight'), sneak: t('sneakedPast'), route: t('tookRoute') }[method])}` : ''}</p>${option?.journal ? `<div class="journal-entry"><h3>${esc(t('journal'))}</h3><p>${esc(option.journal)}</p></div>` : ''}`,
      actions: [
        { id: 'replay', label: t('replay') },
        { id: 'explore', label: t('keepExploring') },
        { id: 'next', label: t('nextChapter'), primary: true },
      ],
    });
    if (pick === 'next') this.cb.onComplete();
    else if (pick === 'replay' && this.driver.mode === 'solo') {
      await (this.driver as import('../net/driver').SoloDriver).replay();
      this.completedShown = false;
      this.cb.onExit();
    }
  }

  private async menu() {
    const pick = await modal({ body: '', actions: [{ id: 'exit', label: t('back') }, { id: 'close', label: t('continue'), primary: true }] });
    if (pick === 'exit') this.cb.onExit();
  }

  private async collect(p: Pickup) {
    if (this.resolving.has(p.id)) return;
    this.resolving.add(p.id);
    const res = await this.driver.act({ type: 'item.collect', collectibleId: p.id });
    this.resolving.delete(p.id);
    if (!res.ok) return void toast(res.message, 'warn');
    if (res.result.full) return void toast(t('fullBag'), 'warn');
    p.take();
    if (res.result.fragment) {
      // Don't interrupt play: the fragment goes into the journal to read any time.
      const c = this.chapter.mission.collectibles.find((x) => x.id === p.id);
      toast(`📜 ${t('journal')}: ${c?.title ?? ''}`);
    } else {
      const item = this.catalog.items.find((i) => i.id === res.result.itemId);
      toast(`${ITEM_ICON[res.result.itemId] ?? '+'} ${t('collected')}: ${item?.name ?? res.result.itemId}`);
    }
    void this.refreshJourney();
  }

  // ---------------------------------------------------------------- loop
  private update(dt: number, time: number) {
    const slow = this.hitStop > 0 ? 0.08 : 1;
    if (this.hitStop > 0) this.hitStop -= dt;
    const gdt = dt * slow;

    this.controls.update();
    const inFight = this.activeFights().some((f) => f.started);
    this.controls.allowTapMove = !inFight;

    // Combat state drives speed and animation.
    const me = this.me;
    const pos = this.player.position;
    const dodgeOffset = me.update(gdt, this.controls.blocking, this.player.moving, this.controls.running);
    this.player.push(dodgeOffset);
    this.player.speedScale = me.attacking ? 0.25 : me.blockHeldFor >= 0 ? 0.4 : this.controls.sneaking ? 0.5 : 1;
    this.player.canTurn = !me.attacking;
    this.player.animOverride = me.dodging ? 'dodge' : me.attacking ? 'attack' : me.hurtT > 0 ? 'hit' : me.blockHeldFor >= 0 ? 'block' : this.controls.sneaking ? 'crouch' : null;
    this.player.update(gdt);
    this.player.character.update(gdt);

    if (me.swingConnects(gdt)) {
      const facing = this.player.facing();
      for (const f of this.activeFights()) f.playerSwing(pos, facing, me);
    }

    // Encounters.
    if (!this.training.over && this.training.started) this.training.update(gdt, pos, me, this.env.colliders, this.controls.sneaking);
    const gangResolved = !!this.driver.state.encounters.extortioners;
    this.gang.update(gdt, pos, me, this.env.colliders, this.controls.sneaking);
    if (!gangResolved && !this.gang.started) {
      const z = this.env.sneakGoal;
      if (pos.x > z.min.x && pos.x < z.max.x && pos.z > z.min.y && pos.z < z.max.y) void this.resolveGang('sneak');
      const r = this.env.routeGoal;
      if (pos.x > r.min.x && pos.x < r.max.x && pos.z > r.min.y && pos.z < r.max.y) void this.resolveGang('route');
    }
    for (const e of [...this.training.enemies, ...this.gang.enemies]) e.character.update(gdt);

    // Detection meter.
    const watch = this.gang.started || gangResolved ? 0 : Math.max(0, ...this.gang.enemies.map((e) => e.detection));
    const detect = this.el('.detect');
    detect.hidden = watch < 0.02;
    (detect.firstElementChild as HTMLElement).style.width = `${Math.round(watch * 100)}%`;

    // Vitals.
    (this.el('.bar-health').firstElementChild as HTMLElement).style.width = `${(me.health / me.stats.maxHealth) * 100}%`;
    (this.el('.bar-stamina').firstElementChild as HTMLElement).style.width = `${(me.stamina / me.stats.maxStamina) * 100}%`;
    this.el('.vitals').classList.toggle('hurt', me.hurtT > 0);

    // World objects.
    this.puzzle.update(gdt, pos, this.player.moving ? this.player.velocity.clone().normalize() : new THREE.Vector3());
    const area = this.env.areaAt(pos);
    for (const p of this.pickups) {
      p.update(dt);
      if (!p.collected && p.position.distanceTo(pos) < 1.1) {
        const c = this.chapter.mission.collectibles.find((x) => x.id === p.id);
        if (c && (c.areaId === area || this.driver.state.openAreas.includes(c.areaId))) void this.collect(p);
      }
    }
    for (const n of this.npcs) n.update(gdt);
    for (const r of this.remote.values()) {
      const rp = r.c.root.position;
      const delta = r.target.clone().sub(rp);
      if (delta.lengthSq() > 0.0004) r.c.root.rotation.y = Math.atan2(delta.x, delta.z);
      rp.lerp(r.target, Math.min(1, dt * 8));
      r.c.update(dt);
    }
    this.effects.update(dt);
    this.env.update(dt, time);
    this.world.followSun(pos);

    if (this.shake > 0) {
      this.shake -= dt;
      const k = this.shake * 0.5;
      this.world.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
    }

    // Nearest interactable within reach.
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.env.interactables) {
      const d = it.position.distanceTo(pos);
      const reachable = it.areaId === area || (it.kind === 'sideDoor' && area === 'market-lane');
      if (d < it.radius && d < bestD && reachable && !inFight) {
        best = it;
        bestD = d;
      }
    }
    this.nearest = best;
    const chip = this.el('.prompt-chip');
    chip.hidden = !best || modalOpen();
    if (best) chip.textContent = `${t('interact')} — ${this.labelFor(best)}`;

    this.driver.sendMove?.({ areaId: area, x: pos.x, y: pos.z, facing: 'down', anim: this.player.character.anim });

    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.15;
      this.drawMinimap();
    }
  }

  private labelFor(it: Interactable): string {
    const m = this.chapter.mission;
    switch (it.kind) {
      case 'trainer': return tr(LINES.trainerName);
      case 'rest': return t('restPoint');
      case 'traveler': return tr(LINES.travelerName);
      case 'merchant': return tr(LINES.merchantName);
      case 'lever': return getLang() === 'ar' ? 'الرافعة' : 'Lever';
      case 'sideDoor': return getLang() === 'ar' ? 'الباب الجانبي' : 'Side door';
      case 'discovery': return m.discoveries.find((d) => d.id === it.id)?.title ?? '';
    }
  }

  private drawMinimap() {
    const ctx = this.minimapCtx;
    const W = 240, H = 300;
    // World window: x ∈ [-20, 20], z ∈ [18, -100]
    const sx = (x: number) => ((x + 20) / 40) * W;
    const sz = (z: number) => ((18 - z) / 118) * H;
    const rect = (x0: number, z0: number, x1: number, z1: number) => ctx.fillRect(sx(x0), sz(z0), sx(x1) - sx(x0), sz(z1) - sz(z0));
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(201,166,120,0.28)';
    rect(-9.5, 16.5, 9.5, 2.9); // yard
    rect(-3.6, 2.9, 3.6, -58); // lane
    rect(3.6, -23.2, 10.6, -29.2); // side alley
    rect(10.6, -6, 16.5, -56); // back alley
    rect(-10, -47.4, 16.5, -58); // plaza
    rect(-17, -61, 17, -99); // courtyard
    const exploration = this.upgrades.find((u) => u.upgradeId === 'exploration')?.level ?? 0;
    for (const p of this.pickups) {
      if (p.collected) continue;
      // The exploration upgrade reveals supplies on the map; fragments always show.
      if (p.kind !== 'fragment' && exploration === 0) continue;
      ctx.fillStyle = p.kind === 'fragment' ? '#c7a6ff' : '#ffe096';
      ctx.beginPath();
      ctx.arc(sx(p.position.x), sz(p.position.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const it of this.env.interactables) {
      if (it.kind === 'discovery' && !it.marker?.visible) continue;
      ctx.fillStyle = it.kind === 'discovery' ? '#ffd27a' : it.kind === 'rest' ? '#ffb347' : '#9fd6ff';
      ctx.beginPath();
      ctx.arc(sx(it.position.x), sz(it.position.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of this.gang.enemies) {
      if (!e.active || this.driver.state.encounters.extortioners) continue;
      ctx.fillStyle = '#ff6a3d';
      ctx.fillRect(sx(e.position.x) - 3, sz(e.position.z) - 3, 6, 6);
    }
    for (const r of this.remote.values()) {
      ctx.fillStyle = '#b6e3a8';
      ctx.beginPath();
      ctx.arc(sx(r.c.root.position.x), sz(r.c.root.position.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = this.player.position;
    ctx.fillStyle = '#fff3dc';
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1a0c';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private add(o: THREE.Object3D) {
    this.world.scene.add(o);
    this.disposers.push(() => this.world.scene.remove(o));
  }

  dispose() {
    this.driver.dispose();
    this.controls.dispose();
    for (const d of this.disposers) d();
    for (const r of this.remote.values()) this.world.scene.remove(r.c.root);
    this.hud.hidden = true;
    this.hud.innerHTML = '';
  }
}
