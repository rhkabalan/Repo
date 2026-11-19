import type { Lang } from './net/api';

const strings = {
  title: { ar: 'أثر', en: 'ATHAR' },
  subtitle: { ar: 'أبو ذرٍّ الغفاري — رحلة تفاعلية في التاريخ', en: 'Abu Dharr al-Ghifari — an interactive historical journey' },
  play: { ar: 'ابدأ الرحلة', en: 'Begin the journey' },
  playTogether: { ar: 'العب مع الأصدقاء', en: 'Play with friends' },
  chapters: { ar: 'خريطة الفصول', en: 'Chapter map' },
  achievements: { ar: 'الإنجازات', en: 'Achievements' },
  journal: { ar: 'اليوميات', en: 'Journal' },
  language: { ar: 'English', en: 'العربية' },
  locked: { ar: 'مقفل', en: 'Locked' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  inProgress: { ar: 'قيد التقدم', en: 'In progress' },
  available: { ar: 'متاح', en: 'Available' },
  interact: { ar: 'تفاعل', en: 'Interact' },
  run: { ar: 'ركض', en: 'Run' },
  hint: { ar: 'تلميح', en: 'Hint' },
  close: { ar: 'إغلاق', en: 'Close' },
  continue: { ar: 'متابعة', en: 'Continue' },
  retry: { ar: 'حاول مجددًا', en: 'Try again' },
  confirm: { ar: 'تأكيد', en: 'Confirm' },
  reset: { ar: 'إعادة', en: 'Reset' },
  back: { ar: 'رجوع', en: 'Back' },
  xp: { ar: 'نقطة خبرة', en: 'XP' },
  level: { ar: 'المستوى', en: 'Level' },
  badges: { ar: 'الأوسمة', en: 'Badges' },
  skills: { ar: 'المهارات', en: 'Skills' },
  clues: { ar: 'الاكتشافات', en: 'Discoveries' },
  sources: { ar: 'المصادر', en: 'Sources' },
  sourcesPending: { ar: 'المصادر قيد المراجعة العلمية.', en: 'Sources are pending scholarly review.' },
  certainty_sourced: { ar: 'رواية موثّقة', en: 'Sourced account' },
  certainty_uncertain: { ar: 'تفصيل غير محسوم', en: 'Unresolved detail' },
  certainty_fictional: { ar: 'عنصر لعب متخيَّل', en: 'Fictional gameplay element' },
  objective: { ar: 'المهمة', en: 'Objective' },
  wrongAnswer: { ar: 'ليس هذا الترتيب. حاول مرة أخرى.', en: 'Not quite. Try again.' },
  correctSoFar: { ar: 'صحيح حتى الرمز', en: 'Correct up to symbol' },
  missionComplete: { ar: 'اكتملت المهمة', en: 'Mission complete' },
  nextChapter: { ar: 'إلى الفصل التالي', en: 'Continue to the next chapter' },
  keepExploring: { ar: 'واصل الاستكشاف', en: 'Keep exploring' },
  replay: { ar: 'أعد الفصل باختيار آخر', en: 'Replay with another choice' },
  partySize: { ar: 'عدد اللاعبين', en: 'Number of players' },
  players: { ar: 'لاعبين', en: 'players' },
  onePlayer: { ar: 'لاعب واحد', en: '1 player' },
  twoPlayers: { ar: 'لاعبان', en: '2 players' },
  threePlayers: { ar: 'ثلاثة لاعبين', en: '3 players' },
  createRoom: { ar: 'أنشئ غرفة', en: 'Create a room' },
  joinRoom: { ar: 'انضمّ برمز', en: 'Join with a code' },
  roomCode: { ar: 'رمز الغرفة', en: 'Room code' },
  shareCode: { ar: 'شارك هذا الرمز مع أصدقائك', en: 'Share this code with your friends' },
  ready: { ar: 'جاهز', en: 'Ready' },
  start: { ar: 'ابدأ', en: 'Start' },
  waiting: { ar: 'بانتظار اللاعبين…', en: 'Waiting for players…' },
  host: { ar: 'المضيف', en: 'Host' },
  carryingWater: { ar: 'تحمل الماء — امشِ بهدوء', en: 'Carrying water — walk gently' },
  spilled: { ar: 'انسكب الماء! عُد إلى البئر.', en: 'The water spilled! Go back to the well.' },
  delivered: { ar: 'أوصلتَ الماء', en: 'Water delivered' },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  offline: { ar: 'تعذّر الاتصال بالخادم', en: "Couldn't reach the server" },
  you: { ar: 'أنت', en: 'You' },
  waitingForParty: { ar: 'بانتظار اختيارات بقية الفريق', en: 'Waiting for the rest of the party to choose' },
} as const;

export type StringKey = keyof typeof strings;

let current: Lang = 'ar';

export const t = (key: StringKey) => strings[key][current];
export const getLang = () => current;

export function setLang(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem('athar.lang', lang);
  } catch {
    /* ignore */
  }
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('athar.lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ar';
}
