import * as THREE from 'three';
import type { Catalog, Chapter } from '../content';
import { getLang, t } from '../i18n';
import type { Award, MissionDriver, RemotePlayer, RunState } from '../net/driver';
import { esc, modal, modalOpen, sequencePuzzle, toast, translate } from '../ui/ui';
import { Character, LOOKS, type Anim, type Look } from './character';
import { CAST, PARTY_LOOKS, type Design } from './cast';
import { Controls } from './controls';
import { buildMecca, type Interactable } from './mecca';
import { PlayerController } from './player';
import type { World } from './world';

type L = { ar: string; en: string };
const tr = (s: L) => s[getLang()];

/** Gameplay dialogue for Mecca. The guide, riddle and traveler are fictional gameplay. */
const LINES = {
  guideName: { ar: 'الدليل', en: 'The guide' },
  guideIntro: {
    ar: 'أهلًا بك يا ابن السفر. أعرف أنك تبحث عن الحكاية. للممرّ المغلق في آخر الزقاق ثلاثة رموز، ولا يُفتح إلا بترتيبها الصحيح.',
    en: 'Welcome, traveler. I know you are searching for the story. The closed passage at the end of the lane has three symbols, and it opens only in the right order.',
  },
  riddle: {
    ar: 'احفظ قولي: ابدأ من حيث يبدأ النهار، ثم حيث يجد الغريب مأواه، وأخيرًا ما يطلبه العطشان.',
    en: 'Remember my words: begin where the day begins, then where a stranger finds rest, and last what the thirsty seek.',
  },
  boardPointer: { ar: 'ستجد لوحة الطريق قرب البوابة، اقرأها جيدًا.', en: 'You will find a route board near the gate. Read it carefully.' },
  boardWorn: { ar: 'اللوحة باهتة لا تُقرأ. اعتمد على ما قاله لك الدليل.', en: 'The board is too worn to read. Rely on what the guide told you.' },
  boardTitle: { ar: 'لوحة الطريق', en: 'Route board' },
  gateTitle: { ar: 'بوابة الممرّ', en: 'The passage gate' },
  travelerName: { ar: 'مسافر مستريح', en: 'A resting traveler' },
  travelerThirsty: { ar: 'طال بي الطريق والحرّ شديد… ليت أحدًا يأتيني بشربة ماء.', en: 'The road was long and the heat is fierce… if only someone could bring me some water.' },
  travelerThanks: { ar: 'جزاك الله خيرًا، أرويتَ عطشي.', en: 'May God reward you — you have quenched my thirst.' },
  wellTake: { ar: 'ملأتَ الجرّة من البئر.', en: 'You fill the jar at the well.' },
  needAccounts: { ar: 'اجمع الروايتين أولًا ثم عُد إلى هنا.', en: 'Gather both accounts first, then come back here.' },
  gateOpen: { ar: 'انفتح الممرّ!', en: 'The passage opens!' },
  waterDone: { ar: 'لقد سقيتَ المسافر بما يكفي.', en: 'You have already brought the traveler enough water.' },
} satisfies Record<string, L>;

const OBJECTIVES = {
  guide: { ar: 'تحدّث إلى الدليل في أول الزقاق.', en: 'Speak with the guide at the start of the lane.' },
  account1: { ar: 'ابحث عن الرواية الأولى في زقاق الضيافة.', en: 'Find the first account in Hospitality Lane.' },
  passage: { ar: 'افتح بوابة الممرّ في آخر الزقاق.', en: 'Open the passage gate at the end of the lane.' },
  account2: { ar: 'ابحث عن الرواية الثانية في ساحة اللقاء.', en: 'Find the second account in the Meeting Courtyard.' },
  order: { ar: 'رتّب أحداث القصة عند المنصّة.', en: 'Put the story in order at the lectern.' },
  journal: { ar: 'اختر ما تبرزه في يومياتك عند المنصّة.', en: 'Choose your journal emphasis at the lectern.' },
  done: { ar: 'اكتملت مهمة مكة.', en: 'The Mecca mission is complete.' },
} satisfies Record<string, L>;

const HINTS = {
  account1: { ar: 'ابحث عن الباب المضاء بالقنديل على يسار الزقاق.', en: 'Look for the lantern-lit doorway on the left side of the lane.' },
  passageBoard: { ar: 'اقرأ لوحة الطريق قرب البوابة.', en: 'Read the route board near the gate.' },
  passageRiddle: { ar: 'تذكّر قول الدليل: يبدأ الأمر بالنهار…', en: "Remember the guide's words: it begins with the day…" },
  account2: { ar: 'اللوح الحجري في صدر الساحة.', en: 'The stone tablet at the far end of the courtyard.' },
  order: { ar: 'المنصّة على يمين الساحة.', en: 'The lectern is on the right side of the courtyard.' },
} satisfies Record<string, L>;

const SYMBOL_ICONS: Record<string, string> = { sun: '☀️', shelter: '⛺', water: '💧' };

export interface SessionCallbacks {
  onExit(): void;
  onComplete(): void;
}

export class GameSession {
  private env = buildMecca();
  private player: PlayerController;
  private controls: Controls;
  private chapter: Chapter;
  private npcs: Character[] = [];
  private remote = new Map<string, { c: Character; target: THREE.Vector3; yaw: number }>();
  private nearest: Interactable | null = null;
  private carryingWater = false;
  private runWhileCarrying = 0;
  private jar: THREE.Mesh;
  private gateOpened = false;
  private talkedToGuide = false;
  private busy = false;
  private completedShown = false;
  private minimapCtx!: CanvasRenderingContext2D;
  private minimapTimer = 0;
  private disposers: (() => void)[] = [];

  constructor(
    private readonly world: World,
    private readonly catalog: Catalog,
    private readonly driver: MissionDriver,
    private readonly hud: HTMLElement,
    private readonly names: Map<string, string>,
    private readonly cb: SessionCallbacks,
  ) {
    this.chapter = catalog.chapters.find((c) => c.id === driver.chapterId)!;
    this.add(this.env.group);

    const me = new Character(CAST.player.look, CAST.player.model);
    me.root.position.copy(this.env.spawn);
    me.root.rotation.y = Math.PI;
    this.add(me.root);

    this.buildHud();
    const ground = this.env.group.children[0]!;
    this.controls = new Controls(world.canvas, world.camera, ground, hud);
    this.player = new PlayerController(me, this.controls, world.camera, this.env.colliders);
    this.controls.onInteract(() => void this.interact());
    translate(hud);
    if (import.meta.env.DEV) {
      // Test hook for automated walkthroughs (stripped from production builds).
      (window as unknown as { __athar: object }).__athar = {
        teleport: (x: number, z: number) => {
          this.player.position.set(x, 0, z);
          this.player.snapCamera();
        },
        state: () => this.driver.state,
      };
    }

    // Water jar carried in both hands.
    this.jar = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0], [0.12, 0.02], [0.17, 0.14], [0.14, 0.26], [0.07, 0.32], [0.08, 0.36], [0, 0.36]].map(([x, y]) => new THREE.Vector2(x!, y!)), 16),
      new THREE.MeshStandardMaterial({ color: '#a8643c', roughness: 0.8 }),
    );
    this.jar.position.set(0, 0.95, 0.42);
    this.jar.castShadow = true;
    this.jar.visible = false;
    me.root.add(this.jar);

    this.spawnNpc(CAST.guide, 'guide', 'talk', Math.PI * 0.75);
    this.spawnNpc(CAST.restingTraveler, 'traveler', 'sit', Math.PI / 2);
    for (const [x, z, yaw] of [[-2.4, -40, 1], [2.8, -11, -2], [-11, -72, 0.6]] as const) {
      const c = new Character(LOOKS.townsman!);
      c.root.position.set(x, 0, z);
      c.root.rotation.y = yaw;
      this.add(c.root);
      this.npcs.push(c);
    }

    driver.onChange((s) => this.applyRunState(s));
    driver.onAwards((a) => this.showAwards(a));
    driver.onPlayers?.((players) => this.syncRemote(players));
    this.applyRunState(driver.state);

    this.disposers.push(world.onUpdate((dt, time) => this.update(dt, time)));
  }

  private spawnNpc(design: Design, id: string, anim: Anim, yaw: number) {
    const it = this.env.interactables.find((i) => i.id === id)!;
    const c = new Character(design.look, design.model);
    c.root.position.copy(it.position);
    c.root.rotation.y = yaw;
    c.setAnim(anim);
    this.add(c.root);
    this.npcs.push(c);
  }

  // ---------------------------------------------------------------- HUD
  private el = <T extends HTMLElement>(sel: string) => this.hud.querySelector(sel) as T;

  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="objective"><div class="label">${esc(t('objective'))}</div><div class="text"></div></div>
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
      <div class="prompt-chip" hidden></div>
      <div class="pill status-line" hidden></div>`;
    this.hud.hidden = false;
    this.minimapCtx = (this.el<HTMLCanvasElement>('#minimap')).getContext('2d')!;
    this.el('[data-hud="hint"]').addEventListener('click', () => this.hint());
    this.el('[data-hud="menu"]').addEventListener('click', () => void this.menu());
  }

  private setStatus(text: string | null) {
    const s = this.el('.status-line');
    s.hidden = !text;
    s.textContent = text ?? '';
  }

  private objectiveKey(): keyof typeof OBJECTIVES {
    const s = this.driver.state;
    if (s.completed) return 'done';
    if (!this.talkedToGuide && !s.choices['guide-approach'] && !s.discoveries.length) return 'guide';
    if (!s.discoveries.includes('ali-hospitality')) return 'account1';
    if (!s.puzzles.passage?.solved) return 'passage';
    if (!s.discoveries.includes('public-declaration')) return 'account2';
    if (!s.puzzles['story-order']?.solved) return 'order';
    return 'journal';
  }

  private refreshHud() {
    this.el('.objective .text').textContent = tr(OBJECTIVES[this.objectiveKey()]);
    this.el('.xp').textContent = String(this.driver.earnedXp);
  }

  private hint() {
    const s = this.driver.state;
    const k = this.objectiveKey();
    let h: L | undefined;
    if (k === 'guide') h = OBJECTIVES.guide;
    else if (k === 'account1') h = HINTS.account1;
    else if (k === 'passage') h = s.choices['guide-approach'] === 'route-board' ? HINTS.passageBoard : HINTS.passageRiddle;
    else if (k === 'account2') h = HINTS.account2;
    else if (k === 'order' || k === 'journal') h = HINTS.order;
    if (h) toast(tr(h));
  }

  private showAwards(awards: Award[]) {
    for (const a of awards) {
      if (a.type === 'xp') toast(`+${a.amount} ${t('xp')}`, 'xp');
      else if (a.type === 'badge') toast(`🏅 ${a.name ?? this.catalog.badges.find((b) => b.id === a.badgeId)?.name ?? a.badgeId}`, 'badge');
    }
    this.refreshHud();
  }

  // ---------------------------------------------------------------- state
  private applyRunState(s: RunState) {
    if (s.openAreas.includes('meeting-courtyard') && !this.gateOpened) {
      this.gateOpened = true;
      this.env.openGate();
    }
    for (const it of this.env.interactables) {
      if (!it.marker) continue;
      const done =
        (it.kind === 'discovery' && s.discoveries.includes(it.id)) ||
        (it.kind === 'gate' && this.gateOpened) ||
        (it.kind === 'lectern' && !!s.choices['journal-emphasis'] && s.completed);
      it.marker.visible = !done;
    }
    this.refreshHud();
    if (s.completed && !this.completedShown && this.driver.mode === 'party') void this.showCompletion();
  }

  private syncRemote(players: RemotePlayer[]) {
    const looks: Look[] = PARTY_LOOKS;
    for (const p of players) {
      let r = this.remote.get(p.id);
      if (!r) {
        const c = new Character(looks[this.remote.size % looks.length]!);
        c.setLabel(this.names.get(p.id) ?? '…');
        c.root.position.set(p.x, 0, p.y);
        this.add(c.root);
        r = { c, target: new THREE.Vector3(p.x, 0, p.y), yaw: 0 };
        this.remote.set(p.id, r);
      }
      r.target.set(p.x, 0, p.y);
      r.c.root.visible = p.active;
      r.c.setAnim((p.anim as Anim) ?? 'idle');
    }
    this.el('.party-list').innerHTML = players
      .map((p) => `<div class="pill">${p.active ? '●' : '○'} ${esc(this.names.get(p.id) ?? '…')}</div>`)
      .join('');
  }

  // ---------------------------------------------------------------- interactions
  private async interact() {
    if (this.busy || modalOpen() || !this.nearest) return;
    this.busy = true;
    this.controls.enabled = false;
    try {
      const it = this.nearest;
      switch (it.kind) {
        case 'npc':
          await this.talkToGuide();
          break;
        case 'board':
          await this.readBoard();
          break;
        case 'gate':
          await this.passagePuzzle();
          break;
        case 'discovery':
          await this.discover(it.id);
          break;
        case 'well':
          this.takeWater();
          break;
        case 'traveler':
          await this.traveler();
          break;
        case 'lectern':
          await this.lectern();
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

  private async talkToGuide() {
    this.talkedToGuide = true;
    const choice = this.chapter.mission.choices.find((c) => c.id === 'guide-approach')!;
    let picked = this.driver.state.choices[choice.id];
    if (!picked) {
      picked = await modal({
        body: `<div class="speaker">${esc(tr(LINES.guideName))}</div><p>${esc(tr(LINES.guideIntro))}</p><p><b>${esc(choice.prompt)}</b></p>`,
        actions: choice.options.map((o) => ({ id: o.id, label: o.label, primary: true })),
      });
      if (picked === 'close') return;
      const res = await this.driver.act({ type: 'choice.make', choiceId: choice.id, optionId: picked });
      if (!res.ok) return void toast(res.message, 'warn');
    }
    await this.say(LINES.guideName, picked === 'verbal-clue' ? LINES.riddle : LINES.boardPointer);
  }

  private async readBoard() {
    const approach = this.driver.state.choices['guide-approach'];
    if (approach !== 'route-board') return this.say(LINES.boardTitle, LINES.boardWorn);
    const puzzle = this.chapter.mission.puzzles.find((p) => p.id === 'passage')!;
    const order = ['sun', 'shelter', 'water'];
    await modal({
      title: tr(LINES.boardTitle),
      body: `<div class="board-symbols">${order.map((id) => `<span title="${esc(puzzle.options.find((o) => o.id === id)?.label ?? id)}">${SYMBOL_ICONS[id]}</span>`).join('<span>→</span>')}</div>`,
    });
  }

  private async passagePuzzle() {
    if (this.driver.state.puzzles.passage?.solved) return;
    const p = this.chapter.mission.puzzles.find((x) => x.id === 'passage')!;
    const outcome = await sequencePuzzle({
      title: tr(LINES.gateTitle),
      prompt: p.prompt,
      options: p.options.map((o) => ({ id: o.id, label: o.label, icon: SYMBOL_ICONS[o.id] })),
      hint: this.driver.state.choices['guide-approach'] === 'verbal-clue' ? tr(LINES.riddle) : undefined,
      submit: async (answer) => {
        const res = await this.driver.act({ type: 'puzzle.attempt', puzzleId: 'passage', answer });
        if (!res.ok) return res.message;
        if (res.result.correct) return null;
        return `${t('wrongAnswer')}${res.result.correctPrefix ? ` (${t('correctSoFar')} ${res.result.correctPrefix})` : ''}`;
      },
    });
    if (outcome === 'solved') toast(tr(LINES.gateOpen));
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
    await modal({
      eyebrow: t('journal'),
      title: d.title,
      body: `<span class="certainty ${d.meta.certainty}">${esc(t(`certainty_${d.meta.certainty}`))}</span><p>${esc(d.body)}</p><div class="sources"><b>${esc(t('sources'))}</b>${sources}</div>`,
      actions: [{ id: 'ok', label: t('continue'), primary: true }],
    });
  }

  private takeWater() {
    const task = this.chapter.mission.tasks.find((x) => x.id === 'water-delivery');
    if (!task) return;
    if ((this.driver.state.tasks[task.id] ?? 0) >= task.goal) return void toast(tr(LINES.waterDone));
    this.carryingWater = true;
    this.runWhileCarrying = 0;
    this.jar.visible = true;
    toast(tr(LINES.wellTake));
    this.setStatus(t('carryingWater'));
  }

  private async traveler() {
    const task = this.chapter.mission.tasks.find((x) => x.id === 'water-delivery')!;
    if (!this.carryingWater) {
      const done = (this.driver.state.tasks[task.id] ?? 0) >= task.goal;
      return this.say(LINES.travelerName, done ? LINES.travelerThanks : LINES.travelerThirsty);
    }
    this.carryingWater = false;
    this.jar.visible = false;
    this.setStatus(null);
    const res = await this.driver.act({ type: 'task.progress', taskId: task.id, amount: 1 });
    if (!res.ok) return void toast(res.message, 'warn');
    toast(`${t('delivered')} ${res.result.count}/${res.result.goal}`);
    if (res.result.complete) await this.say(LINES.travelerName, LINES.travelerThanks);
  }

  private async lectern() {
    const s = this.driver.state;
    if (s.completed) return this.showCompletion();
    const order = this.chapter.mission.puzzles.find((p) => p.id === 'story-order')!;
    if (order.requiresDiscoveries.some((d) => !s.discoveries.includes(d))) return void toast(tr(LINES.needAccounts));
    if (!s.puzzles['story-order']?.solved) {
      const outcome = await sequencePuzzle({
        title: order.prompt,
        prompt: '',
        options: order.options.map((o) => ({ id: o.id, label: o.label })),
        submit: async (answer) => {
          const res = await this.driver.act({ type: 'puzzle.attempt', puzzleId: 'story-order', answer });
          if (!res.ok) return res.message;
          return res.result.correct ? null : t('wrongAnswer');
        },
      });
      if (outcome !== 'solved') return;
    }
    const choice = this.chapter.mission.choices.find((c) => c.id === 'journal-emphasis')!;
    if (!this.driver.state.choices[choice.id]) {
      const picked = await modal({
        eyebrow: t('journal'),
        title: choice.prompt,
        body: '',
        actions: choice.options.map((o) => ({ id: o.id, label: o.label, primary: true })),
      });
      if (picked === 'close') return;
      const res = await this.driver.act({ type: 'choice.make', choiceId: choice.id, optionId: picked });
      if (!res.ok) return void toast(res.message, 'warn');
    }
    const done = await this.driver.act({ type: 'mission.complete' });
    if (!done.ok) {
      if (done.code === 'prerequisites_missing' && this.driver.mode === 'party') return void toast(t('waitingForParty'));
      return void toast(done.message, 'warn');
    }
    if (this.driver.mode === 'solo') await this.showCompletion();
  }

  private async showCompletion() {
    if (this.completedShown) return;
    this.completedShown = true;
    const choice = this.chapter.mission.choices.find((c) => c.id === 'journal-emphasis');
    const option = choice?.options.find((o) => o.id === this.driver.state.choices['journal-emphasis']);
    const maxXp = 120;
    const pick = await modal({
      eyebrow: this.chapter.setting,
      title: t('missionComplete'),
      body: `<div class="score">${this.driver.earnedXp} / ${maxXp}</div><p style="text-align:center">${esc(t('xp'))}</p>${option?.journal ? `<div class="journal-entry"><h3>${esc(t('journal'))}</h3><p>${esc(option.journal)}</p></div>` : ''}`,
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

  // ---------------------------------------------------------------- loop
  private update(dt: number, time: number) {
    this.controls.update();
    this.player.update(dt);
    this.player.character.update(dt);
    for (const n of this.npcs) n.update(dt);
    for (const r of this.remote.values()) {
      const pos = r.c.root.position;
      const delta = r.target.clone().sub(pos);
      if (delta.lengthSq() > 0.0004) r.c.root.rotation.y = Math.atan2(delta.x, delta.z);
      pos.lerp(r.target, Math.min(1, dt * 8));
      r.c.update(dt);
    }
    this.env.update(dt, time);
    this.world.followSun(this.player.position);

    // Carrying water: walking keeps it, running spills it.
    const me = this.player.character;
    if (this.carryingWater) {
      me.setAnim(this.player.moving ? (this.controls.running ? 'run' : 'carry') : 'idle');
      if (this.player.moving && this.controls.running) {
        this.runWhileCarrying += dt;
        if (this.runWhileCarrying > 0.6) {
          this.carryingWater = false;
          this.jar.visible = false;
          this.setStatus(null);
          toast(t('spilled'), 'warn');
        }
      } else this.runWhileCarrying = Math.max(0, this.runWhileCarrying - dt);
    }

    // Nearest interactable within reach.
    let best: Interactable | null = null;
    let bestD = Infinity;
    const area = this.env.areaAt(this.player.position);
    for (const it of this.env.interactables) {
      const d = it.position.distanceTo(this.player.position);
      if (d < it.radius && d < bestD && (it.areaId === area || it.kind === 'gate')) {
        best = it;
        bestD = d;
      }
    }
    this.nearest = best;
    const chip = this.el('.prompt-chip');
    chip.hidden = !best || modalOpen();
    if (best) chip.textContent = `${t('interact')} — ${this.labelFor(best)}`;

    this.driver.sendMove?.({ areaId: area, x: this.player.position.x, y: this.player.position.z, facing: 'down', anim: me.anim });

    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.15;
      this.drawMinimap();
    }
  }

  private labelFor(it: Interactable): string {
    const m = this.chapter.mission;
    switch (it.kind) {
      case 'npc': return tr(LINES.guideName);
      case 'traveler': return tr(LINES.travelerName);
      case 'discovery': return m.discoveries.find((d) => d.id === it.id)?.title ?? '';
      case 'well': return m.tasks[0]?.title ?? '';
      case 'board': return tr(LINES.boardTitle);
      case 'gate': return tr(LINES.gateTitle);
      case 'lectern': return m.puzzles.find((p) => p.id === 'story-order')?.prompt ?? '';
    }
  }

  private drawMinimap() {
    const ctx = this.minimapCtx;
    const W = 240, H = 300;
    // World window: x ∈ [-20, 20], z ∈ [5, -100]
    const sx = (x: number) => ((x + 20) / 40) * W;
    const sz = (z: number) => ((5 - z) / 105) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(201,166,120,0.25)';
    ctx.fillRect(sx(-3.6), sz(4), sx(3.6) - sx(-3.6), sz(-58) - sz(4));
    ctx.fillRect(sx(-17), sz(-61), sx(17) - sx(-17), sz(-99) - sz(-61));
    ctx.fillStyle = this.gateOpened ? 'rgba(143,211,255,0.8)' : 'rgba(255,143,122,0.8)';
    ctx.fillRect(sx(-2), sz(-57.5), sx(2) - sx(-2), 4);
    for (const it of this.env.interactables) {
      if (!it.marker?.visible) continue;
      ctx.fillStyle = it.kind === 'discovery' ? '#ffd27a' : it.kind === 'lectern' ? '#c7a6ff' : '#9fd6ff';
      ctx.beginPath();
      ctx.arc(sx(it.position.x), sz(it.position.z), 6, 0, Math.PI * 2);
      ctx.fill();
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
    this.hud.hidden = true;
    this.hud.innerHTML = '';
  }
}
