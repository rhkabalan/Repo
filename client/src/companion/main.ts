/**
 * ATHAR — Companion. Travel with Abu Dharr al-Ghifari as his companion, with a narrator in
 * Arabic or English. Runs fully offline in the browser.
 */
import '../styles.css';
import './companion.css';
import { LOOKS, type Look } from '../game/character';
import { World } from '../game/world';
import { setLang } from '../i18n';
import { CompanionChapter } from './chapter';
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
  start: { ar: 'ابدأ الرحلة', en: 'Begin the journey' },
  lang: { ar: 'English', en: 'العربية' },
  controls: {
    ar: 'التحكّم: WASD أو العصا على الشاشة للمشي، E للتفاعل، نقرة أو J للضرب، زرّ الفأرة الأيمن أو K للصدّ، Space للتفادي، C للتخفّي، N لتخطّي الراوي.',
    en: 'Controls: WASD or the on-screen stick to move, E to interact, click or J to strike, right mouse or K to block, Space to dodge, C to sneak, N to skip narration.',
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
  screen.querySelector('[data-a="start"]')!.addEventListener('click', () => void begin());
}

async function begin() {
  screen.hidden = true;
  screen.innerHTML = '';
  world ??= new World(canvas, location.search.includes('low') ? 'low' : undefined);
  if (!narrator) {
    narrator = new Narrator(document.body, () => lang, voice);
    world.start();
  }
  narrator.voice = voice;
  const chapter = new CompanionChapter(world, hud, narrator, () => lang, LOOKS[look] as Look, () => title());
  // Test hook: ?debug exposes the chapter for automated walkthroughs.
  if (location.search.includes('debug')) (window as unknown as { __chapter: unknown }).__chapter = chapter;
  await chapter.start();
}

title();
