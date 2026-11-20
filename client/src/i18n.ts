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
  chooseCharacter: { ar: 'اختر شخصيتك', en: 'Choose your character' },
  yourCharacter: { ar: 'شخصيتك', en: 'Your character' },
  characterName: { ar: 'اسم شخصيتك', en: 'Your character’s name' },
  nameHint: { ar: 'من ٣ إلى ٢٤ حرفًا', en: '3 to 24 characters' },
  nameLength: { ar: 'يجب أن يكون الاسم من ٣ إلى ٢٤ حرفًا.', en: 'The name must be 3 to 24 characters.' },
  nameChars: { ar: 'استخدم الحروف والأرقام والمسافات فقط.', en: 'Use only letters, numbers and spaces.' },
  chooseThis: { ar: 'اختر هذه الشخصية', en: 'Choose this character' },
  selected: { ar: 'مختارة', en: 'Selected' },
  char_traveler: { ar: 'المسافر', en: 'The Traveler' },
  char_steadfast: { ar: 'الثابت', en: 'The Steadfast' },
  char_elder: { ar: 'الشيخ', en: 'The Elder' },
  tag_traveler: { ar: 'شابٌّ خرج يبحث عن الحقيقة، خفيف الزاد قويّ العزم.', en: 'A young seeker on the road, travelling light and resolute.' },
  tag_steadfast: { ar: 'صلبٌ في الحق، لا تلين له عزيمة.', en: 'Firm in truth; his resolve does not bend.' },
  tag_elder: { ar: 'حكيمٌ أنضجته السنون، يتّكئ على عصاه ويتأمّل.', en: 'Wise with years; he leans on his staff and reflects.' },
  attack: { ar: 'اضرب', en: 'Attack' },
  block: { ar: 'صُدّ', en: 'Block' },
  dodge: { ar: 'تفادَ', en: 'Dodge' },
  sneak: { ar: 'تسلّل', en: 'Sneak' },
  resolve: { ar: 'العزيمة', en: 'Resolve' },
  stamina: { ar: 'الجَلَد', en: 'Stamina' },
  parry: { ar: 'صدٌّ متقن!', en: 'Parry!' },
  blocked: { ar: 'صدَدتَ الضربة', en: 'Blocked' },
  spotted: { ar: 'لقد رأوك!', en: 'You’ve been spotted!' },
  overwhelmed: { ar: 'غُلبتَ هذه المرة. حاول مرة أخرى.', en: 'You were overwhelmed. Try again.' },
  yielded: { ar: 'استسلم وانسحب', en: 'yielded and left' },
  sneakedPast: { ar: 'تسلّلتَ دون أن يراك أحد', en: 'You slipped past unseen' },
  tookRoute: { ar: 'سلكتَ الطريق الجانبي', en: 'You took the side way' },
  wonFight: { ar: 'تفرّقت العصابة', en: 'The gang scattered' },
  fullBag: { ar: 'لا مكان لحمل المزيد', en: 'No room to carry more' },
  collected: { ar: 'حصلتَ على', en: 'Collected' },
  inventory: { ar: 'الأمتعة', en: 'Supplies' },
  upgrades: { ar: 'التحسينات', en: 'Upgrades' },
  upgrade: { ar: 'حسّن', en: 'Upgrade' },
  maxLevel: { ar: 'أعلى مستوى', en: 'Max level' },
  needs: { ar: 'تحتاج', en: 'Needs' },
  restPoint: { ar: 'محطة الراحة', en: 'Rest point' },
  restored: { ar: 'استعدتَ قواك', en: 'You feel restored' },
  historicalAccount: { ar: 'رواية تاريخية', en: 'Historical account' },
  fictionalNote: { ar: 'هذه المغامرة من نسج اللعبة. الروايات التاريخية تظهر منفصلة ومعها مصادرها.', en: 'This adventure is fictional. Historical accounts appear separately, with their sources.' },
  locked: { ar: 'مقفل', en: 'Locked' },
  needKey: { ar: 'الباب مقفل. ربما يملك أحدهم المفتاح.', en: 'The door is locked. Someone may have the key.' },
  pushHint: { ar: 'ادفع الصناديق بالمشي نحوها.', en: 'Walk into a crate to push it.' },
  leverReset: { ar: 'عادت الصناديق إلى أماكنها', en: 'The crates slide back into place' },
  gateRaised: { ar: 'ارتفعت البوابة المعلّقة!', en: 'The counterweight gate rises!' },
  trainingStart: { ar: 'ابدأ التدريب', en: 'Start training' },
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
