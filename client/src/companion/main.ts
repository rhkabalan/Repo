/**
 * ATHAR — Companion. Travel with Abu Dharr al-Ghifari as his companion, with a narrator in
 * Arabic or English. Runs fully offline in the browser.
 */
import '../styles.css';
import './companion.css';
import { LOOKS, type Look } from '../game/character';
import { World } from '../game/world';
import { setLang } from '../i18n';
import { journey, type JourneyStop } from '../../../backend/src/journey/content/companion';
import { CompanionChapter, completedChapters } from './chapter';
import { Narrator, type Voice } from './narrator';

type Lang = 'ar' | 'en';
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
let lang: Lang = (store.get('athar.lang') as Lang) || (navigator.language?.startsWith('ar') ? 'ar' : 'en');
let voice: Voice = (store.get('athar.voice') as Voice) || lang;
let look: keyof typeof LOOKS = (store.get('athar.look') as keyof typeof LOOKS) || 'traveler';

const screen = document.getElementById('screen')!;
const hud = document.getElementById('hud')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
let world: World | null = null;
let narrator: Narrator | null = null;

function applyLang() {
  setLang(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = lang === 'ar' ? 'أثر · الرفيق' : 'ATHAR Companion';
}

const T = {
  title: { ar: 'أثر', en: 'ATHAR' },
  sub: { ar: 'الرفيق — في صحبة أبي ذرّ الغفاري', en: 'The Companion — on the road with Abu Dharr al-Ghifari' },
  chapter: { ar: 'الفصل الأوّل: الباحث عن الحقّ', en: 'Chapter one: The Seeker' },
  blurb: {
    ar: 'أنت فتىً من غِفار ترافق أبا ذرّ: تسقي وتبني، تحرس القافلة، تتبع عليًّا في أزقّة مكّة سرًّا، وتقف إلى جانب أبي ذرّ حين يعلن إسلامه. الأحداث التاريخية من المصادر الشيعية، يرويها راوٍ بالعربية أو الإنجليزية.',
    en: 'You are a young man of Ghifar travelling with Abu Dharr: draw water and build, guard the caravan, follow Ali through the lanes of Mecca in secret, and stand by Abu Dharr when he proclaims his faith. The history comes from Shia sources, told by a narrator in Arabic or English.',
  },
  voice: { ar: 'صوت الراوي', en: 'Narrator voice' },
  arabic: { ar: 'العربية', en: 'Arabic' },
  english: { ar: 'الإنجليزية', en: 'English' },
  off: { ar: 'بلا صوت (نصّ فقط)', en: 'Off (text only)' },
  you: { ar: 'شخصيتك', en: 'Your character' },
  start: { ar: 'خريطة الرحلة', en: 'Open the journey map' },
  mapTitle: { ar: 'طريق أبي ذرّ', en: 'The Path of Abu Dharr' },
  mapSub: { ar: 'سِرْ معه من صحراء غِفار إلى الربذة. كلّ محطّة فصلٌ تلعبه.', en: 'Travel with him from the desert of Ghifar to al-Rabadhah. Each stop is a chapter you play.' },
  play: { ar: 'العب هذا الفصل', en: 'Play this chapter' },
  replay: { ar: 'العب مجدّدًا', en: 'Play again' },
  soon: { ar: 'قيد الإنتاج', en: 'In production' },
  back: { ar: 'رجوع', en: 'Back' },
  chapterN: { ar: 'الفصل', en: 'Chapter' },
  tradition: { ar: 'رواية متوارثة', en: 'Reported tradition' },
  done: { ar: 'تمّ', en: 'Done' },
  lang: { ar: 'English', en: 'العربية' },
  controls: {
    ar: 'التحكّم: WASD أو العصا على الشاشة للمشي. اسحب على الشاشة لتنظر حولك، وقرّب أو أبعد بإصبعين أو بعجلة الفأرة (Q وR لتدوير الكاميرا). E للتفاعل، نقرة أو J للضرب، زرّ الفأرة الأيمن أو K للصدّ، Space للتفادي، C للتخفّي، N لتخطّي الراوي.',
    en: 'Controls: WASD or the on-screen stick to move. Drag on the screen to look around; pinch or scroll to zoom (Q and R turn the camera). E to interact, click or J to strike, right mouse or K to block, Space to dodge, C to sneak, N to skip narration.',
  },
  traveler: { ar: 'المسافر', en: 'The Traveler' },
  steadfast: { ar: 'الثابت', en: 'The Steadfast' },
  elder: { ar: 'الشيخ', en: 'The Elder' },
} as const;
const t = (k: keyof typeof T) => T[k][lang];

function title() {
  applyLang();
  hud.hidden = true;
  screen.hidden = false;
  screen.innerHTML = `
    <div class="comp-title">
      <div class="comp-hero" style="background-image:url(${import.meta.env.BASE_URL}timeline/ghifar.webp)"></div>
      <div class="comp-card">
        <button class="btn comp-lang" data-a="lang">${t('lang')}</button>
        <h1>${t('title')}</h1>
        <p class="comp-sub">${t('sub')}</p>
        <p class="comp-chapter">${t('chapter')}</p>
        <p class="comp-blurb">${t('blurb')}</p>
        <div class="comp-field"><span>${t('voice')}</span>
          <div class="seg">${(['ar', 'en', 'off'] as const).map((v) => `<button data-voice="${v}" class="${voice === v ? 'on' : ''}" aria-pressed="${voice === v}">${t(v === 'ar' ? 'arabic' : v === 'en' ? 'english' : 'off')}</button>`).join('')}</div>
        </div>
        <div class="comp-field"><span>${t('you')}</span>
          <div class="seg">${(['traveler', 'steadfast', 'elder'] as const).map((l) => `<button data-look="${l}" class="${look === l ? 'on' : ''}" aria-pressed="${look === l}">${t(l)}</button>`).join('')}</div>
        </div>
        <button class="btn btn-primary comp-start" data-a="start">${t('start')}</button>
        <p class="comp-controls">${t('controls')}</p>
      </div>
    </div>`;
  screen.querySelector('[data-a="lang"]')!.addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    store.set('athar.lang', lang);
    title();
  });
  screen.querySelectorAll<HTMLElement>('[data-voice]').forEach((b) =>
    b.addEventListener('click', () => {
      voice = b.dataset.voice as Voice;
      store.set('athar.voice', voice);
      title();
      // Let them hear the voice they picked.
      if (voice !== 'off') new Audio(`${import.meta.env.BASE_URL}companion/voice/n02.${voice}.mp3`).play().catch(() => {});
    }),
  );
  screen.querySelectorAll<HTMLElement>('[data-look]').forEach((b) =>
    b.addEventListener('click', () => {
      look = b.dataset.look as keyof typeof LOOKS;
      store.set('athar.look', look);
      title();
    }),
  );
  screen.querySelector('[data-a="start"]')!.addEventListener('click', () => journeyMap());
}

async function begin(chapterId: string) {
  screen.hidden = true;
  screen.innerHTML = '';
  world ??= new World(canvas, location.search.includes('low') ? 'low' : undefined);
  if (!narrator) {
    narrator = new Narrator(document.body, () => lang, voice);
    world.start();
  }
  narrator.voice = voice;
  const chapter = new CompanionChapter(world, hud, narrator, () => lang, LOOKS[look] as Look, () => journeyMap(), chapterId);
  // Test hook: ?debug exposes the chapter for automated walkthroughs.
  if (location.search.includes('debug')) (window as unknown as { __chapter: unknown }).__chapter = chapter;
  await chapter.start();
}

// ------------------------------------------------------------------ the journey map
// Equirectangular projection of the Hejaz and Sham (lat 20–35°N, lon 33.5–43.5°E).
const MAP = { w: 600, h: 820, lon0: 33.5, lon1: 43.5, lat0: 35, lat1: 20 };
const px = (lon: number, lat: number) => [((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * MAP.w, ((MAP.lat0 - lat) / (MAP.lat0 - MAP.lat1)) * MAP.h] as const;
const poly = (pts: [number, number][]) => pts.map(([lat, lon]) => px(lon, lat).join(',')).join(' ');
// Rough coastlines: the Red Sea with the Gulf of Aqaba, and the eastern Mediterranean.
const RED_SEA: [number, number][] = [[29.55, 34.95], [28.6, 34.75], [27.9, 34.45], [27.6, 35.2], [26.8, 35.9], [25.5, 36.8], [24.2, 37.6], [23.0, 38.6], [21.8, 39.05], [20.0, 39.9], [20.0, 33.5], [27.9, 33.5], [28.1, 34.4], [28.6, 34.6]];
const MED: [number, number][] = [[35, 33.5], [35, 35.9], [34.4, 35.85], [33.9, 35.5], [33.3, 35.2], [32.8, 34.95], [32.0, 34.7], [31.4, 34.3], [31.2, 33.5]];
// Abu Dharr's road, in order (stops plus the returns between them).
const ROUTE: [number, number][] = [[22.6, 39.2], [21.42, 39.83], [22.6, 39.2], [24.47, 39.61], [28.38, 36.57], [24.47, 39.61], [33.51, 36.29], [33.45, 35.3], [33.17, 35.52], [33.51, 36.29], [24.47, 39.61], [24.64, 41.3]];
const CITIES: [string, string, number, number][] = [['مكّة', 'Mecca', 21.42, 39.83], ['المدينة', 'Medina', 24.47, 39.61], ['تبوك', 'Tabuk', 28.38, 36.57], ['دمشق', 'Damascus', 33.51, 36.29], ['الربذة', 'al-Rabadhah', 24.64, 41.3]];

let selected = 'seeker';
function journeyMap() {
  applyLang();
  hud.hidden = true;
  screen.hidden = false;
  const done = completedChapters();
  const next = journey.find((j) => j.playable && !done.has(j.id))?.id ?? 'seeker';
  if (!journey.some((j) => j.id === selected)) selected = next;
  const tr = (v: { ar: string; en: string }) => v[lang];
  const routeLine = poly(ROUTE);
  screen.innerHTML = `
    <div class="jmap">
      <header class="jmap-head">
        <button class="btn" data-a="back">${t('back')}</button>
        <div><h2>${t('mapTitle')}</h2><p>${t('mapSub')}</p></div>
      </header>
      <div class="jmap-body">
        <svg class="jmap-svg" viewBox="0 0 ${MAP.w} ${MAP.h}" role="img" aria-label="${t('mapTitle')}">
          <defs>
            <pattern id="dunes" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 30 Q10 22 20 30 T40 30" fill="none" stroke="rgba(120,80,40,0.18)" stroke-width="1.5"/></pattern>
          </defs>
          <rect width="${MAP.w}" height="${MAP.h}" fill="#e3c894"/>
          <rect width="${MAP.w}" height="${MAP.h}" fill="url(#dunes)"/>
          <polygon points="${poly(RED_SEA)}" fill="#7fa7b3" stroke="#5d8693" stroke-width="2"/>
          <polygon points="${poly(MED)}" fill="#7fa7b3" stroke="#5d8693" stroke-width="2"/>
          <text x="${px(37.2, 23.7)[0]}" y="${px(37.2, 23.7)[1]}" class="sea" transform="rotate(-52 ${px(37.2, 23.7).join(' ')})">${lang === 'ar' ? 'البحر الأحمر' : 'Red Sea'}</text>
          <text x="${px(34.1, 34.2)[0]}" y="${px(34.1, 34.2)[1]}" class="sea">${lang === 'ar' ? 'بحر الروم' : 'Mediterranean'}</text>
          <text x="${px(39.6, 31.5)[0]}" y="${px(39.6, 31.5)[1]}" class="region">${lang === 'ar' ? 'بلاد الشام' : 'SHAM'}</text>
          <text x="${px(40.6, 26.8)[0]}" y="${px(40.6, 26.8)[1]}" class="region">${lang === 'ar' ? 'الحجاز' : 'HEJAZ'}</text>
          <polyline points="${routeLine}" class="route-bg"/>
          <polyline points="${routeLine}" class="route"/>
          ${CITIES.map(([a, e, lat, lon]) => { const [x, y] = px(lon, lat); return `<circle cx="${x}" cy="${y}" r="3.5" fill="#3a2a1a"/><text x="${x + 8}" y="${y - 8}" class="city">${lang === 'ar' ? a : e}</text>`; }).join('')}
          ${journey.map((j) => { const [x, y] = px(j.lon, j.lat); const st = done.has(j.id) ? 'done' : j.playable ? 'open' : 'soon'; return `<g class="stop ${st} ${j.id === selected ? 'sel' : ''}" data-stop="${j.id}" tabindex="0" role="button" aria-label="${tr(j.title)}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 6}" text-anchor="middle">${j.chapter}</text></g>`; }).join('')}
          <g class="traveller"><text font-size="26" text-anchor="middle">🐪</text></g>
        </svg>
        <aside class="jmap-card"></aside>
      </div>
    </div>`;
  const card = screen.querySelector('.jmap-card') as HTMLElement;
  const camelG = screen.querySelector('.traveller') as SVGGElement;
  const putCamel = (j: JourneyStop) => { const [x, y] = px(j.lon, j.lat); camelG.setAttribute('transform', `translate(${x} ${y - 22})`); };
  const show = (id: string) => {
    selected = id;
    const j = journey.find((x) => x.id === id)!;
    screen.querySelectorAll('.stop').forEach((s) => s.classList.toggle('sel', (s as HTMLElement).dataset.stop === id));
    putCamel(j);
    const isDone = done.has(j.id);
    card.innerHTML = `
      <div class="eyebrow">${t('chapterN')} ${j.chapter} · ${tr(j.date)}${isDone ? ` · ✓ ${t('done')}` : ''}</div>
      <h3>${tr(j.title)}</h3>
      <p class="place">${tr(j.place)}</p>
      ${j.tradition ? `<span class="badge-trad">${t('tradition')}</span>` : ''}
      <p>${tr(j.summary)}</p>
      ${j.playable ? `<button class="btn btn-primary" data-a="play">${isDone ? t('replay') : t('play')}</button>` : `<button class="btn" disabled>${t('soon')}</button>`}`;
    card.querySelector('[data-a="play"]')?.addEventListener('click', () => void begin(j.id));
  };
  screen.querySelectorAll<SVGGElement>('.stop').forEach((g) => {
    const go = () => show(g.dataset.stop!);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') go(); });
  });
  screen.querySelector('[data-a="back"]')!.addEventListener('click', () => title());
  show(selected === 'seeker' ? next : selected);
}

title();
