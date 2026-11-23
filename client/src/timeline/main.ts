/**
 * ATHAR Timeline — a pass-and-play history game for all ages. Players place events from
 * Abu Dharr's journey (and the world around it) on a shared timeline, then answer a
 * "why did it matter?" question. Every card shows its sources and how certain its date is.
 */
import './timeline.css';
import type { L, Tier, TimelineEvent } from '../../../backend/src/journey/content/timeline';
import { BONUS_POINTS, TURN_SECONDS, TimelineGame, eraOf, multiplierFor, type TurnResult } from './game';

type Lang = 'en' | 'ar';
const store = {
  get(k: string) { try { return localStorage.getItem('athar.timeline.' + k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem('athar.timeline.' + k, v); } catch { /* private mode */ } },
};

let lang: Lang = (store.get('lang') as Lang) || (navigator.language?.startsWith('ar') ? 'ar' : 'en');
let sound = store.get('sound') !== 'off';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const STR = {
  title: { en: 'ATHAR', ar: 'أثر' },
  subtitle: { en: 'The Timeline', ar: 'خط الزمن' },
  tagline: { en: 'Follow the footsteps of Abu Dharr al-Ghifari through the world of the 7th century. Put each moment in its place — and discover why it mattered.', ar: 'اتبع خطى أبي ذر الغفاري في عالم القرن السابع. ضع كل لحظة في مكانها، واكتشف لماذا كانت مهمّة.' },
  play: { en: 'Play', ar: 'العب' },
  howTo: { en: 'How to play', ar: 'طريقة اللعب' },
  howToBody: {
    en: 'Each turn you get an event card with a clue but no date. Tap the gap on the timeline where you think it belongs. Right answers build a streak multiplier. Then read “Did you know?” and answer a quick “Why did it matter?” question for bonus points. Some dates are uncertain — the game accepts any place the sources allow.',
    ar: 'في كل دور تحصل على بطاقة حدثٍ فيها تلميح بلا تاريخ. انقر الفراغ في خط الزمن حيث تظنّ أنها تنتمي. الإجابات الصحيحة المتتالية تضاعف نقاطك. ثم اقرأ «هل تعلم؟» وأجب عن سؤال «لماذا كان مهمًّا؟» لنقاطٍ إضافية. بعض التواريخ غير مؤكّدة، فتقبل اللعبة كل موضعٍ تسمح به المصادر.',
  },
  language: { en: 'العربية', ar: 'English' },
  soundOn: { en: 'Sound on', ar: 'الصوت مفعّل' },
  soundOff: { en: 'Sound off', ar: 'الصوت متوقّف' },
  players: { en: 'Players', ar: 'اللاعبون' },
  addPlayer: { en: 'Add player', ar: 'أضف لاعبًا' },
  remove: { en: 'Remove', ar: 'إزالة' },
  name: { en: 'Name', ar: 'الاسم' },
  playerN: { en: 'Player', ar: 'اللاعب' },
  turns: { en: 'Cards each', ar: 'بطاقات لكل لاعب' },
  timer: { en: 'Turn timer', ar: 'مؤقّت الدور' },
  on: { en: 'On', ar: 'مفعّل' },
  off: { en: 'Off', ar: 'متوقّف' },
  start: { en: 'Start', ar: 'ابدأ' },
  back: { en: 'Back', ar: 'رجوع' },
  passTo: { en: 'Pass the device to', ar: 'أعطِ الجهاز إلى' },
  ready: { en: 'I’m ready', ar: 'أنا جاهز' },
  round: { en: 'Round', ar: 'الجولة' },
  score: { en: 'Score', ar: 'النقاط' },
  streak: { en: 'Streak', ar: 'التتابع' },
  whereFits: { en: 'Where does this belong? Tap a gap on the timeline.', ar: 'أين مكان هذا الحدث؟ انقر فراغًا في خط الزمن.' },
  hint: { en: 'Hint', ar: 'تلميح' },
  placeBefore: { en: 'Place before', ar: 'ضعه قبل' },
  placeAfter: { en: 'Place after', ar: 'ضعه بعد' },
  placeBetween: { en: 'Place between', ar: 'ضعه بين' },
  and: { en: 'and', ar: 'و' },
  correct: { en: 'Right on time!', ar: 'في مكانه تمامًا!' },
  wrong: { en: 'Not quite — here is where it goes.', ar: 'ليس تمامًا، هذا مكانه الصحيح.' },
  timeUp: { en: 'Time’s up — here is where it goes.', ar: 'انتهى الوقت، هذا مكانه الصحيح.' },
  didYouKnow: { en: 'Did you know?', ar: 'هل تعلم؟' },
  whyMatter: { en: 'Why did it matter?', ar: 'لماذا كان مهمًّا؟' },
  sources: { en: 'Sources', ar: 'المصادر' },
  next: { en: 'Next', ar: 'التالي' },
  finish: { en: 'See results', ar: 'النتائج' },
  points: { en: 'points', ar: 'نقطة' },
  timeBonus: { en: 'speed', ar: 'سرعة' },
  bonus: { en: 'Bonus', ar: 'إضافية' },
  results: { en: 'Journey complete', ar: 'اكتملت الرحلة' },
  correctCount: { en: 'placed right', ar: 'في مكانها' },
  bestStreak: { en: 'best streak', ar: 'أفضل تتابع' },
  playAgain: { en: 'Play again', ar: 'العب مجددًا' },
  home: { en: 'Home', ar: 'الرئيسية' },
  yourTimeline: { en: 'Your timeline', ar: 'خط زمنكم' },
  fictionNote: { en: 'Only sourced history appears on these cards. The ATHAR adventure’s fictional traveler is not part of the timeline.', ar: 'لا تظهر على هذه البطاقات إلا الأحداث الموثّقة. أما المسافر الخيالي في مغامرة «أثر» فليس جزءًا من خط الزمن.' },
  certainty_sourced: { en: 'Sourced date', ar: 'تاريخ موثّق' },
  certainty_range: { en: 'Date range — exact year not recorded', ar: 'مدى زمني — السنة غير محدّدة' },
  certainty_tradition: { en: 'Reported tradition — needs corroboration', ar: 'رواية متوارثة — تحتاج إلى توثيق' },
  after_note: { en: 'After Abu Dharr’s time', ar: 'بعد زمن أبي ذر' },
  era_before: { en: 'Before the revelation (before 610)', ar: 'قبل بدء الوحي (قبل ٦١٠)' },
  era_mecca: { en: 'The Meccan years (610–622)', ar: 'السنوات المكية (٦١٠–٦٢٢)' },
  era_medina: { en: 'The Medina years (622–632)', ar: 'سنوات المدينة (٦٢٢–٦٣٢)' },
  era_caliphs: { en: 'After the Prophet, in Abu Dharr’s lifetime (632–652)', ar: 'بعد النبي ﷺ في حياة أبي ذر (٦٣٢–٦٥٢)' },
  era_after: { en: 'After Abu Dharr died (after 652)', ar: 'بعد وفاة أبي ذر (بعد ٦٥٢)' },
  tier_explorer: { en: 'Explorer', ar: 'مستكشف' },
  tier_scholar: { en: 'Scholar', ar: 'دارس' },
  tier_historian: { en: 'Historian', ar: 'مؤرّخ' },
  tierDesc_explorer: { en: 'Ages 7–11 · big moments, hints, a wider margin', ar: 'من ٧ إلى ١١ سنة، لحظات كبرى، تلميحات، هامش أوسع' },
  tierDesc_scholar: { en: 'Teens & adults · placement plus “why it mattered”', ar: 'اليافعون والكبار، الترتيب مع «لماذا كان مهمًّا»' },
  tierDesc_historian: { en: 'Experts · close dates, world events, later buildings', ar: 'الخبراء، تواريخ متقاربة، أحداث عالمية، مبانٍ لاحقة' },
  place_mecca: { en: 'Mecca', ar: 'مكة' },
  place_ghifar: { en: 'Among Ghifar', ar: 'ديار غِفار' },
  place_medina: { en: 'Medina', ar: 'المدينة' },
  place_tabuk: { en: 'Road to Tabuk', ar: 'طريق تبوك' },
  place_damascus: { en: 'Damascus, Sham', ar: 'دمشق، الشام' },
  'place_jabal-amil': { en: 'Jabal Amil', ar: 'جبل عامل' },
  place_rabadhah: { en: 'al-Rabadhah', ar: 'الربذة' },
  place_world: { en: 'The wider world', ar: 'العالم الأوسع' },
  badge_perfect: { en: 'Every card in its place', ar: 'كل بطاقة في مكانها' },
  badge_streak: { en: 'Five in a row', ar: 'خمسٌ متتالية' },
  badge_why: { en: 'Asked “why” every time', ar: 'أجاب عن كل «لماذا»' },
  winner: { en: 'Leads the caravan', ar: 'يتقدّم القافلة' },
} satisfies Record<string, L>;

type Key = keyof typeof STR;
const t = (k: Key) => STR[k][lang];
const tl = (v: L) => v[lang];
const sep = () => (lang === 'ar' ? '، ' : ' · ');
const num = (n: number) => (lang === 'ar' ? n.toLocaleString('ar-EG') : n.toLocaleString('en'));

const PLACE_ART: Record<string, string | null> = {
  mecca: 'mecca-kaaba', ghifar: 'ghifar', medina: 'medina', tabuk: 'tabuk-road', damascus: 'damascus',
  'jabal-amil': 'jabal-amil', rabadhah: 'rabadhah', world: null,
};
const CARD_ART: Record<string, string> = { unays: 'mecca-market', zamzam: 'mecca-kaaba', 'ali-host': 'mecca-market' };
const art = (e: TimelineEvent) => {
  const name = CARD_ART[e.id] ?? PLACE_ART[e.place];
  return name ? `${import.meta.env.BASE_URL}timeline/${name}.webp` : null;
};
const ICONS: Record<string, string> = {
  church: '⛪', dome: '🕌', kaaba: '🕋', light: '✨', pagoda: '🏯', road: '🛤️', well: '💧', lamp: '🪔', voice: '📣',
  tent: '⛺', camel: '🐪', trench: '⛏️', palm: '🌴', crown: '👑', footsteps: '👣', star: '⭐', moon: '🌙', columns: '🏛️',
  scroll: '📜', coins: '🪙', olive: '🫒', letter: '✉️', acacia: '🌳', caravan: '🐫', mosaic: '🎨',
};

// ------------------------------------------------------------------ tiny DOM helper
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const app = document.getElementById('app')!;
function mount(...nodes: Child[]) {
  app.replaceChildren(...(nodes.filter(Boolean) as Node[]));
  window.scrollTo(0, 0);
}
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = lang === 'ar' ? 'أثر · خط الزمن' : 'ATHAR Timeline';
}

// ------------------------------------------------------------------ sound
let audio: AudioContext | null = null;
function tone(freqs: number[], dur = 0.12, type: OscillatorType = 'sine', gain = 0.08) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    let at = audio.currentTime;
    for (const f of freqs) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(audio.destination);
      o.start(at); o.stop(at + dur);
      at += dur * 0.8;
    }
  } catch { /* audio unavailable */ }
}
const sfx = {
  tap: () => tone([520], 0.06, 'triangle', 0.05),
  right: () => tone([523, 659, 784], 0.13, 'triangle'),
  wrong: () => tone([330, 247], 0.18, 'sine'),
  bonus: () => tone([784, 988, 1175], 0.1, 'triangle'),
  tick: () => tone([880], 0.04, 'square', 0.02),
};

function topBar(extra?: Child) {
  return h('header', { class: 'topbar' },
    h('button', { class: 'brand', onclick: () => home(), 'aria-label': t('home') }, h('span', { class: 'brand-mark' }, t('title')), h('span', { class: 'brand-sub' }, t('subtitle'))),
    h('div', { class: 'topbar-actions' },
      extra,
      h('button', { class: 'chip', onclick: () => { sound = !sound; store.set('sound', sound ? 'on' : 'off'); rerender(); }, 'aria-pressed': String(sound) }, sound ? '🔊' : '🔇', h('span', { class: 'sr' }, sound ? t('soundOn') : t('soundOff'))),
      h('button', { class: 'chip', onclick: () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('lang', lang); applyLang(); rerender(); } }, t('language')),
    ));
}

let rerender: () => void = () => home();

// ------------------------------------------------------------------ home
function home() {
  rerender = home;
  stopTimer();
  mount(
    h('section', { class: 'hero', style: { backgroundImage: `url(${import.meta.env.BASE_URL}timeline/mecca-kaaba.webp)` } },
      topBar(),
      h('div', { class: 'hero-body' },
        h('h1', { class: 'hero-title' }, t('title'), h('span', {}, t('subtitle'))),
        h('p', { class: 'hero-tag' }, t('tagline')),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-primary btn-lg', onclick: () => { sfx.tap(); setup(); } }, t('play')),
          h('button', { class: 'btn', onclick: () => howTo() }, t('howTo')),
        ),
      ),
    ),
    h('section', { class: 'places' },
      ...(['mecca', 'ghifar', 'medina', 'tabuk', 'damascus', 'jabal-amil', 'rabadhah'] as const).map((p) =>
        h('figure', { class: 'place' },
          h('img', { src: `${import.meta.env.BASE_URL}timeline/${PLACE_ART[p]}.webp`, alt: '', loading: 'lazy' }),
          h('figcaption', {}, t(`place_${p}` as Key)))),
    ),
    h('p', { class: 'footnote' }, t('fictionNote')),
  );
}

function howTo() {
  const dlg = h('dialog', { class: 'dialog' },
    h('h2', {}, t('howTo')),
    h('p', {}, t('howToBody')),
    h('ul', { class: 'tiers-list' }, ...(['explorer', 'scholar', 'historian'] as Tier[]).map((tier) =>
      h('li', {}, h('strong', {}, t(`tier_${tier}` as Key)), ' — ', t(`tierDesc_${tier}` as Key)))),
    h('form', { method: 'dialog' }, h('button', { class: 'btn btn-primary' }, t('back'))));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}

// ------------------------------------------------------------------ setup
interface SetupPlayer { name: string; tier: Tier }
let setupPlayers: SetupPlayer[] = JSON.parse(store.get('players') ?? 'null') ?? [{ name: '', tier: 'scholar' }];
let setupTurns = Number(store.get('turns') ?? 6);
let setupTimed = store.get('timed') !== 'off';

function setup() {
  rerender = setup;
  const list = h('div', { class: 'players' });
  setupPlayers.forEach((p, i) => {
    const tiers = h('div', { class: 'tiers', role: 'radiogroup', 'aria-label': t('players') });
    (['explorer', 'scholar', 'historian'] as Tier[]).forEach((tier) => {
      tiers.append(h('button', {
        class: 'tier' + (p.tier === tier ? ' on' : ''), role: 'radio', 'aria-checked': String(p.tier === tier),
        onclick: () => { p.tier = tier; sfx.tap(); setup(); },
      }, h('strong', {}, t(`tier_${tier}` as Key)), h('small', {}, t(`tierDesc_${tier}` as Key))));
    });
    list.append(h('div', { class: 'player-card' },
      h('div', { class: 'player-head' },
        h('span', { class: 'player-num' }, num(i + 1)),
        h('input', {
          class: 'input', value: p.name, maxlength: 20, placeholder: `${t('playerN')} ${num(i + 1)}`, 'aria-label': t('name'),
          oninput: (e: Event) => { p.name = (e.target as HTMLInputElement).value; },
        }),
        setupPlayers.length > 1 && h('button', { class: 'chip', onclick: () => { setupPlayers.splice(i, 1); setup(); } }, t('remove')),
      ),
      tiers));
  });
  mount(
    topBar(),
    h('section', { class: 'panel setup' },
      h('h2', {}, t('players')),
      list,
      setupPlayers.length < 4 && h('button', { class: 'btn', onclick: () => { setupPlayers.push({ name: '', tier: 'explorer' }); setup(); } }, '+ ', t('addPlayer')),
      h('div', { class: 'options' },
        h('label', { class: 'option' }, t('turns'),
          h('div', { class: 'seg' }, ...[4, 6, 8].map((n) =>
            h('button', { class: setupTurns === n ? 'on' : '', 'aria-pressed': String(setupTurns === n), onclick: () => { setupTurns = n; setup(); } }, num(n))))),
        h('label', { class: 'option' }, t('timer'),
          h('div', { class: 'seg' },
            h('button', { class: setupTimed ? 'on' : '', 'aria-pressed': String(setupTimed), onclick: () => { setupTimed = true; setup(); } }, t('on')),
            h('button', { class: !setupTimed ? 'on' : '', 'aria-pressed': String(!setupTimed), onclick: () => { setupTimed = false; setup(); } }, t('off')))),
      ),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => home() }, t('back')),
        h('button', { class: 'btn btn-primary btn-lg', onclick: () => startGame() }, t('start'))),
    ),
  );
}

function startGame() {
  store.set('players', JSON.stringify(setupPlayers));
  store.set('turns', String(setupTurns));
  store.set('timed', setupTimed ? 'on' : 'off');
  const players = setupPlayers.map((p, i) => ({ name: p.name.trim() || `${t('playerN')} ${num(i + 1)}`, tier: p.tier }));
  game = new TimelineGame(players, setupTurns, setupTimed);
  sfx.tap();
  handoff();
}

// ------------------------------------------------------------------ play
let game: TimelineGame;
let timerId = 0, secondsLeft = 0, hintShown = false;

function stopTimer() { if (timerId) clearInterval(timerId); timerId = 0; }

function handoff(): void {
  rerender = handoff;
  stopTimer();
  if (game.players.length === 1) return turn();
  const p = game.player;
  mount(
    topBar(),
    h('section', { class: 'panel handoff' },
      h('p', { class: 'eyebrow' }, `${t('round')} ${num(game.round)} / ${num(game.turnsPerPlayer)}`),
      h('h2', {}, t('passTo')),
      h('p', { class: 'handoff-name' }, p.name),
      h('p', { class: 'tier-chip' }, t(`tier_${p.tier}` as Key)),
      h('button', { class: 'btn btn-primary btn-lg', autofocus: true, onclick: () => { sfx.tap(); turn(); } }, t('ready'))),
  );
}

function turn(): void {
  if (!game.card && !game.draw()) { game.advance(); return game.over ? results() : handoff(); }
  hintShown = false;
  secondsLeft = TURN_SECONDS[game.player.tier];
  renderBoard();
  stopTimer();
  if (game.timed) {
    timerId = window.setInterval(() => {
      secondsLeft--;
      const ring = document.querySelector<HTMLElement>('.timer');
      if (ring) {
        ring.style.setProperty('--p', String(secondsLeft / TURN_SECONDS[game.player.tier]));
        ring.querySelector('span')!.textContent = num(Math.max(0, secondsLeft));
        ring.classList.toggle('low', secondsLeft <= 5);
      }
      if (secondsLeft <= 5 && secondsLeft > 0) sfx.tick();
      if (secondsLeft <= 0) { stopTimer(); reveal(game.timeout()); }
    }, 1000);
  }
}

function certaintyBadge(e: TimelineEvent) {
  return h('span', { class: `badge c-${e.certainty}` }, t(`certainty_${e.certainty}` as Key));
}

function cardFace(e: TimelineEvent, opts: { revealed?: boolean; big?: boolean } = {}) {
  const img = art(e);
  return h('article', { class: `card ${opts.big ? 'card-big' : ''} ${e.category === 'after' ? 'card-after' : ''}` },
    h('div', { class: 'card-art', style: img ? { backgroundImage: `url(${img})` } : {} },
      !img && h('span', { class: 'card-icon', 'aria-hidden': 'true' }, ICONS[e.iconName] ?? '•'),
      h('span', { class: 'card-place' }, ICONS[e.iconName] ?? '', ' ', t(`place_${e.place}` as Key)),
      h('span', { class: 'card-year' + (opts.revealed ? ' shown' : '') }, opts.revealed ? tl(e.displayDate) : '?'),
    ),
    h('div', { class: 'card-body' },
      h('h3', {}, tl(e.title)),
      opts.big && h('p', { class: 'card-clue' }, tl(e.clue)),
      opts.big && opts.revealed && e.category === 'after' && h('span', { class: 'badge c-after' }, t('after_note')),
    ));
}

function renderBoard() {
  rerender = renderBoard;
  const p = game.player;
  const card = game.card!;
  const strip = h('ol', { class: 'strip', 'aria-label': t('yourTimeline') });
  const slot = (i: number) => {
    const before = game.board[i - 1], after = game.board[i];
    const label = !before ? `${t('placeBefore')} ${after ? tl(after.title) : ''}` : !after ? `${t('placeAfter')} ${tl(before.title)}` : `${t('placeBetween')} ${tl(before.title)} ${t('and')} ${tl(after.title)}`;
    return h('li', { class: 'slot-wrap' }, h('button', {
      class: 'slot', 'aria-label': label, 'data-slot': i,
      onclick: () => { stopTimer(); reveal(game.place(i, secondsLeft)); },
    }, h('span', { 'aria-hidden': 'true' }, '+')));
  };
  strip.append(slot(0));
  game.board.forEach((e, i) => {
    strip.append(h('li', { class: 'placed' }, cardFace(e, { revealed: true })));
    strip.append(slot(i + 1));
  });

  const stats = h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('small', {}, t('score')), h('strong', {}, num(p.score))),
    h('div', { class: 'stat' }, h('small', {}, t('streak')), h('strong', {}, num(p.streak), p.streak >= 2 ? ` ×${multiplierFor(p.streak + 1)}` : '')),
    game.timed && h('div', { class: 'timer', style: { '--p': '1' } as unknown as Record<string, string> }, h('span', {}, num(secondsLeft))),
  );

  mount(
    topBar(),
    h('section', { class: 'play' },
      h('div', { class: 'turn-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, `${t('round')} ${num(game.round)} / ${num(game.turnsPerPlayer)}`),
          h('h2', { class: 'turn-name' }, p.name, ' ', h('span', { class: 'tier-chip' }, t(`tier_${p.tier}` as Key)))),
        stats),
      h('div', { class: 'draw' + (reducedMotion ? '' : ' deal') },
        cardFace(card, { big: true }),
        h('div', { class: 'draw-side' },
          h('p', { class: 'prompt' }, t('whereFits')),
          certaintyBadge(card),
          p.tier !== 'historian' && h('button', {
            class: 'btn btn-sm', disabled: hintShown,
            onclick: (ev: Event) => { hintShown = true; (ev.currentTarget as HTMLButtonElement).replaceWith(h('p', { class: 'hint' }, '💡 ', t(`era_${eraOf(card)}` as Key))); },
          }, '💡 ', t('hint')),
        ),
      ),
      h('div', { class: 'strip-scroll' }, strip),
    ),
  );
  // Keep the newest area in view and support arrow keys between gaps.
  const slots = [...document.querySelectorAll<HTMLButtonElement>('.slot')];
  slots.forEach((s, i) => s.addEventListener('keydown', (ev) => {
    const fwd = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight', back = lang === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    if (ev.key === fwd) { ev.preventDefault(); slots[Math.min(slots.length - 1, i + 1)]?.focus(); }
    if (ev.key === back) { ev.preventDefault(); slots[Math.max(0, i - 1)]?.focus(); }
  }));
  const anchor = document.querySelector('.placed');
  anchor?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' as ScrollBehavior });
}

function reveal(result: TurnResult) {
  rerender = () => reveal(result);
  const p = game.player;
  result.correct ? sfx.right() : sfx.wrong();
  const e = result.card;
  const body = h('div', { class: 'reveal-body' });
  const after = h('div', { class: 'row end' });
  const nextBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => next() }, game.players.every((x) => x.turns >= game.turnsPerPlayer) ? t('finish') : t('next'));

  body.append(
    h('p', { class: 'eyebrow' }, t('didYouKnow')),
    h('p', { class: 'takeaway' }, tl(e.takeaway)),
    h('div', { class: 'meta' }, certaintyBadge(e), e.category === 'after' && h('span', { class: 'badge c-after' }, t('after_note'))),
    h('details', { class: 'sources' }, h('summary', {}, t('sources')), h('ul', {}, ...e.sources.map((s) => h('li', {}, tl(s))))),
  );

  if (e.question) {
    const q = e.question;
    const opts = h('div', { class: 'options-q' });
    // Explorers get two choices; everyone else gets them all.
    const shown = p.tier === 'explorer' ? q.options.map((o, i) => ({ o, i })).filter(({ i }) => i === q.answer || i === (q.answer + 1) % q.options.length) : q.options.map((o, i) => ({ o, i }));
    for (const { o, i } of shown) {
      opts.append(h('button', {
        class: 'btn opt', onclick: () => {
          const right = i === q.answer;
          const gained = game.answerBonus(right);
          right ? sfx.bonus() : sfx.wrong();
          opts.querySelectorAll('button').forEach((b, bi) => {
            b.disabled = true;
            if (shown[bi]?.i === q.answer) b.classList.add('opt-right');
            else if (shown[bi]?.i === i) b.classList.add('opt-wrong');
          });
          opts.after(h('p', { class: 'explain' }, right ? `+${num(gained)} ${t('bonus')}${sep()}` : '', tl(q.explain)));
          nextBtn.disabled = false;
          nextBtn.focus();
        },
      }, tl(o)));
    }
    body.append(h('div', { class: 'question' }, h('p', { class: 'eyebrow' }, t('whyMatter')), h('p', { class: 'q' }, tl(q.prompt)), opts));
    nextBtn.disabled = true;
  }
  after.append(nextBtn);

  mount(
    topBar(),
    h('section', { class: `panel reveal ${result.correct ? 'ok' : 'miss'}` },
      h('div', { class: 'verdict' },
        h('span', { class: 'verdict-icon', 'aria-hidden': 'true' }, result.correct ? '✓' : '✗'),
        h('div', {},
          h('h2', {}, result.correct ? t('correct') : result.timedOut ? t('timeUp') : t('wrong')),
          result.correct && h('p', { class: 'gain' },
            `+${num(result.points)} ${t('points')}`,
            result.multiplier > 1 ? `${sep()}×${result.multiplier}` : '',
            result.timeBonus ? `${sep()}${t('timeBonus')} +${num(result.timeBonus)}` : ''))),
      h('div', { class: 'reveal-grid' }, h('div', { class: reducedMotion ? '' : 'flip' }, cardFace(e, { big: true, revealed: true })), body),
      after,
      h('div', { class: 'strip-scroll mini' }, h('ol', { class: 'strip' }, ...game.board.map((b) =>
        h('li', { class: 'placed' + (b === e ? (result.correct ? ' just-ok' : ' just-miss') : '') }, cardFace(b, { revealed: true }))))),
    ),
  );
  document.querySelector('.just-ok, .just-miss')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion ? 'instant' as ScrollBehavior : 'smooth' });
}

function next() {
  sfx.tap();
  game.advance();
  if (game.over) return results();
  handoff();
}

// ------------------------------------------------------------------ results
function results() {
  rerender = results;
  stopTimer();
  const ranking = game.ranking();
  mount(
    topBar(),
    h('section', { class: 'panel results' },
      h('h2', {}, t('results')),
      h('ol', { class: 'ranking' }, ...ranking.map((pl, i) => {
        const badges: Key[] = [];
        if (pl.turns > 0 && pl.correct === pl.turns) badges.push('badge_perfect');
        if (pl.bestStreak >= 5) badges.push('badge_streak');
        if (pl.asked > 0 && pl.bonus >= pl.asked * BONUS_POINTS) badges.push('badge_why');
        return h('li', { class: i === 0 ? 'first' : '' },
          h('span', { class: 'rank' }, num(i + 1)),
          h('div', { class: 'rank-main' },
            h('strong', {}, pl.name, ' ', h('span', { class: 'tier-chip' }, t(`tier_${pl.tier}` as Key))),
            h('small', {}, `${num(pl.correct)}/${num(pl.turns)} ${t('correctCount')}${sep()}${t('bestStreak')} ${num(pl.bestStreak)}`),
            i === 0 && ranking.length > 1 && h('small', { class: 'lead' }, '🐪 ', t('winner')),
            badges.length > 0 && h('div', { class: 'badges' }, ...badges.map((b) => h('span', { class: 'badge c-gold' }, t(b))))),
          h('span', { class: 'rank-score' }, num(pl.score)));
      })),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => home() }, t('home')),
        h('button', { class: 'btn btn-primary btn-lg', onclick: () => setup() }, t('playAgain'))),
      h('h3', { class: 'review-title' }, t('yourTimeline')),
      h('ol', { class: 'review' }, ...game.board.map((e) =>
        h('li', {},
          h('span', { class: 'review-date' }, tl(e.displayDate)),
          h('div', {}, h('strong', {}, ICONS[e.iconName] ?? '', ' ', tl(e.title)), h('p', {}, tl(e.takeaway)), certaintyBadge(e))))),
      h('p', { class: 'footnote' }, t('fictionNote')),
    ),
  );
}

applyLang();
home();
