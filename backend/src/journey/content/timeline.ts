/**
 * Timeline game cards: events from Abu Dharr's journey and the world around it.
 *
 * Every date is a CE range [start, end]. Where the sources give no exact year the range is
 * wide and `certainty` says so; scoring accepts any placement the range allows. Cards marked
 * `after` are deliberately later than Abu Dharr (d. 652) — they teach players why the game
 * shows no domes, minarets or bell towers. See docs/research/locations.md.
 */

export type Tier = 'explorer' | 'scholar' | 'historian';
export type Category = 'journey' | 'prophet' | 'caliphate' | 'world' | 'after';
export type Certainty = 'sourced' | 'range' | 'tradition';
export type Place = 'mecca' | 'ghifar' | 'medina' | 'tabuk' | 'damascus' | 'jabal-amil' | 'rabadhah' | 'world';

export interface L { en: string; ar: string }

export interface TimelineQuestion {
  prompt: L;
  options: L[];
  answer: number;
  explain: L;
}

export interface TimelineEvent {
  id: string;
  title: L;
  start: number;
  end: number;
  displayDate: L;
  category: Category;
  difficultyTier: Tier;
  place: Place;
  clue: L;
  takeaway: L;
  certainty: Certainty;
  sources: L[];
  iconName: string;
  question?: TimelineQuestion;
}

const S = {
  bukhari3861: { en: 'Sahih al-Bukhari 3861 (also 3522)', ar: 'صحيح البخاري ٣٨٦١ (وانظر ٣٥٢٢)' },
  muslim2473: { en: 'Sahih Muslim 2473–2474', ar: 'صحيح مسلم ٢٤٧٣–٢٤٧٤' },
  bukhari1406: { en: 'Sahih al-Bukhari 1406 and 4660', ar: 'صحيح البخاري ١٤٠٦ و٤٦٦٠' },
  ibnHisham: { en: 'Ibn Hisham, al-Sira al-Nabawiyya (from Ibn Ishaq)', ar: 'ابن هشام، السيرة النبوية (عن ابن إسحاق)' },
  ibnHishamTabuk: { en: 'Ibn Hisham, al-Sira, "The affair of Abu Dharr" (Tabuk)', ar: 'ابن هشام، السيرة، «أمر أبي ذر» (تبوك)' },
  tirmidhi3801: { en: 'Jamiʿ al-Tirmidhi 3801', ar: 'جامع الترمذي ٣٨٠١' },
  nahj130: { en: 'Nahj al-Balagha, Sermon 130', ar: 'نهج البلاغة، الخطبة ١٣٠' },
  greatCompanion4: { en: 'The Great Companion of the Prophet — Abu Dharr, ch. 4', ar: 'الصحابي الجليل أبو ذر، الفصل ٤' },
  greatCompanion14: { en: 'The Great Companion of the Prophet — Abu Dharr, ch. 14', ar: 'الصحابي الجليل أبو ذر، الفصل ١٤' },
  message53: { en: 'Subhani, The Message, ch. 53', ar: 'السبحاني، الرسالة، الفصل ٥٣' },
  bukhari3: { en: 'Sahih al-Bukhari 3', ar: 'صحيح البخاري ٣' },
  tabari: { en: 'al-Tabari, Tarikh al-Rusul wa al-Muluk', ar: 'الطبري، تاريخ الرسل والملوك' },
  quran30: { en: "Qur'an 30:2–4", ar: 'القرآن الكريم، الروم ٢–٤' },
  britannica: { en: 'Encyclopaedia Britannica', ar: 'الموسوعة البريطانية' },
  creswell: { en: 'K. A. C. Creswell, Early Muslim Architecture', ar: 'كريزويل، العمارة الإسلامية المبكرة' },
} as const;

export const timelineEvents: TimelineEvent[] = [
  // ------------------------------------------------------------------ the world before
  {
    id: 'hagia-sophia', iconName: 'church', place: 'world', category: 'world', difficultyTier: 'explorer',
    title: { en: 'Hagia Sophia is completed', ar: 'اكتمال بناء آيا صوفيا' },
    start: 537, end: 537, displayDate: { en: '537 CE', ar: '٥٣٧ م' },
    clue: { en: 'In Constantinople, Emperor Justinian finishes a church with a vast dome.', ar: 'في القسطنطينية، يُتمّ الإمبراطور جستنيان كنيسةً بقبّةٍ هائلة.' },
    takeaway: { en: 'The Roman (Byzantine) empire that ruled Sham in Abu Dharr’s day was already centuries old.', ar: 'كانت الإمبراطورية الرومانية (البيزنطية) التي حكمت الشام في زمن أبي ذر قائمةً منذ قرون.' },
    certainty: 'sourced', sources: [S.britannica],
  },
  {
    id: 'kaaba-rebuilt', iconName: 'kaaba', place: 'mecca', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'Quraysh rebuild the Kaaba', ar: 'قريش تعيد بناء الكعبة' },
    start: 603, end: 607, displayDate: { en: 'c. 605 CE', ar: 'نحو ٦٠٥ م' },
    clue: { en: 'After a flood damages it, the clans of Mecca rebuild the House in stone and timber.', ar: 'بعد أن أضرّ بها السيل، تعيد عشائر مكة بناء البيت بالحجارة والخشب.' },
    takeaway: { en: 'This is the Kaaba Abu Dharr saw: smaller than today, built in courses of stone and wood, with no mosque around it.', ar: 'هذه هي الكعبة التي رآها أبو ذر: أصغر مما هي اليوم، مبنيّة بمداميك من الحجر والخشب، ولا مسجد حولها.' },
    certainty: 'range', sources: [S.ibnHisham],
    question: {
      prompt: { en: 'What surrounded the Kaaba when Abu Dharr arrived?', ar: 'ماذا كان يحيط بالكعبة حين وصل أبو ذر؟' },
      options: [
        { en: 'Houses and an open court', ar: 'بيوت وساحة مكشوفة' },
        { en: 'A marble mosque with minarets', ar: 'مسجد من الرخام بمآذن' },
        { en: 'Palm groves', ar: 'بساتين نخيل' },
      ],
      answer: 0,
      explain: { en: 'The great mosque and its minarets came much later; Mecca’s valley had no palm groves.', ar: 'جاء المسجد الكبير ومآذنه بعد ذلك بكثير، ولم يكن في وادي مكة نخيل.' },
    },
  },
  {
    id: 'revelation', iconName: 'light', place: 'mecca', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'The first revelation', ar: 'بدء الوحي' },
    start: 610, end: 610, displayDate: { en: '610 CE', ar: '٦١٠ م' },
    clue: { en: 'In the cave of Hira above Mecca, the message of Islam begins.', ar: 'في غار حراء فوق مكة، تبدأ رسالة الإسلام.' },
    takeaway: { en: 'News of a new prophet in Mecca spread along the caravan roads — that is how it reached Ghifar.', ar: 'انتشر خبر النبي الجديد في مكة على طرق القوافل، وهكذا بلغ غِفار.' },
    certainty: 'sourced', sources: [S.bukhari3],
  },
  {
    id: 'tang', iconName: 'pagoda', place: 'world', category: 'world', difficultyTier: 'historian',
    title: { en: 'The Tang dynasty is founded in China', ar: 'قيام أسرة تانغ في الصين' },
    start: 618, end: 618, displayDate: { en: '618 CE', ar: '٦١٨ م' },
    clue: { en: 'Far to the east, a new dynasty takes power in Chang’an.', ar: 'في أقصى الشرق، تتولّى أسرة جديدة الحكم في تشانغآن.' },
    takeaway: { en: 'While Abu Dharr was teaching his tribe, China was entering one of its great ages.', ar: 'بينما كان أبو ذر يدعو قومه، كانت الصين تدخل أحد عصورها الكبرى.' },
    certainty: 'sourced', sources: [S.britannica],
  },

  // ------------------------------------------------------------------ Abu Dharr in Mecca
  {
    id: 'unays', iconName: 'road', place: 'mecca', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'Unays goes to Mecca', ar: 'أُنيس يذهب إلى مكة' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'Abu Dharr’s brother returns from Mecca: “I met a man who says God has sent him.”', ar: 'يعود أخو أبي ذر من مكة: «لقيتُ رجلًا يزعم أن الله أرسله».' },
    takeaway: { en: 'Abu Dharr tells it himself: Unays went first, and his report made Abu Dharr set out.', ar: 'يرويها أبو ذر بنفسه: ذهب أُنيس أولًا، فدفعه خبره إلى الرحيل.' },
    certainty: 'range', sources: [S.muslim2473],
  },
  {
    id: 'zamzam', iconName: 'well', place: 'mecca', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Living on Zamzam water', ar: 'العيش على ماء زمزم' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'A stranger stays by the Kaaba with no food, drinking only from the well.', ar: 'غريبٌ يقيم عند الكعبة بلا طعام، لا يشرب إلا من البئر.' },
    takeaway: { en: 'In his own account he stayed many days with nothing but Zamzam water.', ar: 'في روايته أقام أيامًا كثيرة لا زاد له إلا ماء زمزم.' },
    certainty: 'range', sources: [S.muslim2473],
  },
  {
    id: 'ali-host', iconName: 'lamp', place: 'mecca', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Ali hosts the stranger', ar: 'عليٌّ يستضيف الغريب' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'A young man notices a traveler sleeping by the Kaaba and takes him home.', ar: 'شابٌّ يرى مسافرًا نائمًا عند الكعبة فيأخذه إلى بيته.' },
    takeaway: { en: 'Ali hosted Abu Dharr and then quietly led him to the Prophet, where he accepted Islam.', ar: 'استضاف عليٌّ أبا ذر ثم قاده سرًّا إلى النبي ﷺ، فأسلم.' },
    certainty: 'range', sources: [S.bukhari3861, S.muslim2473],
    question: {
      prompt: { en: 'Why did Ali lead him to the Prophet in secret?', ar: 'لماذا قاده عليٌّ إلى النبي سرًّا؟' },
      options: [
        { en: 'Early Muslims in Mecca faced danger', ar: 'كان المسلمون الأوائل في مكة في خطر' },
        { en: 'It was a game', ar: 'كانت لعبة' },
        { en: 'The road was closed', ar: 'كان الطريق مغلقًا' },
      ],
      answer: 0,
      explain: { en: 'Quraysh opposed the new faith; strangers asking about the Prophet could be harmed.', ar: 'كانت قريش تعادي الدين الجديد، وقد يُؤذى الغريب الذي يسأل عن النبي.' },
    },
  },
  {
    id: 'declaration', iconName: 'voice', place: 'mecca', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'Declared aloud at the Kaaba', ar: 'إعلانٌ جهرًا عند الكعبة' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'A new Muslim proclaims his faith before Quraysh. A crowd turns on him — until a man of Quraysh speaks up.', ar: 'مسلمٌ جديد يعلن إيمانه أمام قريش، فيثور عليه الجمع، حتى يتكلّم رجلٌ من قريش.' },
    takeaway: { en: 'Al-ʿAbbas stopped them: “He is from Ghifar, and your trade road to Sham runs through Ghifar.”', ar: 'أوقفهم العباس: «إنه من غِفار، وطريق تجارتكم إلى الشام عليهم».' },
    certainty: 'range', sources: [S.bukhari3861],
    question: {
      prompt: { en: 'Why did al-ʿAbbas’s words stop the crowd?', ar: 'لماذا أوقفت كلمات العباس الجمع؟' },
      options: [
        { en: 'Their caravans to Sham crossed Ghifar’s land', ar: 'قوافلهم إلى الشام تمرّ بأرض غِفار' },
        { en: 'Ghifar had a large army', ar: 'كان لغِفار جيش كبير' },
        { en: 'It was a holy month', ar: 'كان شهرًا حرامًا' },
      ],
      answer: 0,
      explain: { en: 'Mecca lived on trade. Harming a man of Ghifar could endanger every caravan north.', ar: 'كانت مكة تعيش على التجارة، وإيذاء رجلٍ من غِفار قد يعرّض كل قافلة إلى الشمال للخطر.' },
    },
  },

  // ------------------------------------------------------------------ Ghifar
  {
    id: 'ghifar-half', iconName: 'tent', place: 'ghifar', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'Half of Ghifar accept Islam', ar: 'نصف غِفار يُسلمون' },
    start: 611, end: 622, displayDate: { en: 'between c. 611 and 622 CE', ar: 'بين نحو ٦١١ و٦٢٢ م' },
    clue: { en: 'A man returns to his desert tribe with a message. His brother and mother believe first.', ar: 'رجلٌ يعود إلى قبيلته في البادية برسالة، فيؤمن أخوه وأمّه أولًا.' },
    takeaway: { en: 'Half the tribe accepted Islam through Abu Dharr before the Hijra; the rest waited for the Prophet to come to Medina.', ar: 'أسلم نصف القبيلة على يد أبي ذر قبل الهجرة، وانتظر الباقون قدوم النبي إلى المدينة.' },
    certainty: 'range', sources: [S.muslim2473],
  },
  {
    id: 'hijra', iconName: 'camel', place: 'medina', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'The Hijra to Medina', ar: 'الهجرة إلى المدينة' },
    start: 622, end: 622, displayDate: { en: '622 CE · 1 AH', ar: '٦٢٢ م، ١ هـ' },
    clue: { en: 'The Prophet leaves Mecca for the oasis of Yathrib.', ar: 'يخرج النبي ﷺ من مكة إلى واحة يثرب.' },
    takeaway: { en: 'The Islamic calendar counts its years from this journey.', ar: 'يبدأ التقويم الهجري من هذه الرحلة.' },
    certainty: 'sourced', sources: [S.ibnHisham],
    question: {
      prompt: { en: 'Why does the Hijri calendar start in 622?', ar: 'لماذا يبدأ التقويم الهجري سنة ٦٢٢؟' },
      options: [
        { en: 'It marks the Hijra to Medina', ar: 'لأنه عام الهجرة إلى المدينة' },
        { en: 'It is the Prophet’s birth year', ar: 'لأنه عام مولد النبي' },
        { en: 'It is the year of Tabuk', ar: 'لأنه عام تبوك' },
      ],
      answer: 0,
      explain: { en: 'The community in Medina began here, so the years are counted from it.', ar: 'من هنا بدأ مجتمع المدينة، فعُدّت السنون منها.' },
    },
  },
  {
    id: 'ghifar-rest', iconName: 'tent', place: 'ghifar', category: 'journey', difficultyTier: 'historian',
    title: { en: 'The rest of Ghifar accept Islam', ar: 'بقية غِفار يُسلمون' },
    start: 622, end: 623, displayDate: { en: 'c. 622 CE', ar: 'نحو ٦٢٢ م' },
    clue: { en: 'The other half of a tribe keep their word: “When he comes to Medina, we will accept.”', ar: 'النصف الآخر من القبيلة يفي بوعده: «إذا قدم المدينة أسلمنا».' },
    takeaway: { en: 'Neighbouring Aslam followed, and the Prophet prayed for both tribes.', ar: 'وتبعتهم قبيلة أسلم، فدعا النبي ﷺ للقبيلتين.' },
    certainty: 'range', sources: [S.muslim2473],
  },

  // ------------------------------------------------------------------ Medina
  {
    id: 'badr', iconName: 'well', place: 'medina', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'The Battle of Badr', ar: 'غزوة بدر' },
    start: 624, end: 624, displayDate: { en: '624 CE · 2 AH', ar: '٦٢٤ م، ٢ هـ' },
    clue: { en: 'At the wells of Badr, the Muslims of Medina meet the army of Quraysh.', ar: 'عند آبار بدر، يلتقي مسلمو المدينة بجيش قريش.' },
    takeaway: { en: 'Abu Dharr was not at Badr — that is why ATHAR never shows him there.', ar: 'لم يشهد أبو ذر بدرًا، ولذلك لا تُظهره «أثر» هناك أبدًا.' },
    certainty: 'sourced', sources: [S.ibnHisham, S.greatCompanion4],
  },
  {
    id: 'trench', iconName: 'trench', place: 'medina', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'The Trench', ar: 'غزوة الخندق' },
    start: 627, end: 627, displayDate: { en: '627 CE · 5 AH', ar: '٦٢٧ م، ٥ هـ' },
    clue: { en: 'Medina digs a ditch across its open northern side against a great alliance.', ar: 'المدينة تحفر خندقًا على جهتها الشمالية المكشوفة في وجه الأحزاب.' },
    takeaway: { en: 'The biography used here says Abu Dharr had not yet joined these campaigns.', ar: 'تذكر السيرة المعتمدة هنا أن أبا ذر لم يكن قد شهد هذه الغزوات بعد.' },
    certainty: 'sourced', sources: [S.ibnHisham, S.greatCompanion4],
  },
  {
    id: 'to-medina', iconName: 'palm', place: 'medina', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Abu Dharr settles in Medina', ar: 'أبو ذر يستقرّ في المدينة' },
    start: 622, end: 628, displayDate: { en: 'between 622 and c. 628 CE', ar: 'بين ٦٢٢ ونحو ٦٢٨ م' },
    clue: { en: 'A man of the desert comes to live among the palm groves of the oasis.', ar: 'رجلٌ من البادية يأتي ليعيش بين نخيل الواحة.' },
    takeaway: { en: 'The exact year is not recorded in the sources used here, so the game accepts the whole range.', ar: 'لا تذكر المصادر المعتمدة هنا السنة بالضبط، لذلك تقبل اللعبة المدى كلّه.' },
    certainty: 'range', sources: [S.greatCompanion4],
  },
  {
    id: 'heraclius', iconName: 'crown', place: 'world', category: 'world', difficultyTier: 'historian',
    title: { en: 'Rome defeats Persia', ar: 'الروم تغلب فارس' },
    start: 627, end: 628, displayDate: { en: '627–628 CE', ar: '٦٢٧–٦٢٨ م' },
    clue: { en: 'Emperor Heraclius ends a long war, as a Qur’anic verse had foretold.', ar: 'الإمبراطور هرقل يُنهي حربًا طويلة، كما أخبرت آيةٌ في القرآن.' },
    takeaway: { en: 'Sūrat al-Rūm speaks of the Romans being defeated and then, within a few years, victorious.', ar: 'تتحدّث سورة الروم عن غَلَب الروم ثم غَلَبهم في بضع سنين.' },
    certainty: 'sourced', sources: [S.quran30, S.britannica],
  },
  {
    id: 'mecca-opened', iconName: 'kaaba', place: 'mecca', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'Mecca is opened', ar: 'فتح مكة' },
    start: 630, end: 630, displayDate: { en: 'Jan 630 CE · 8 AH', ar: 'يناير ٦٣٠ م، ٨ هـ' },
    clue: { en: 'The Prophet returns to the city he left, almost without fighting.', ar: 'يعود النبي ﷺ إلى المدينة التي خرج منها، دون قتالٍ يُذكر.' },
    takeaway: { en: 'This happened in the same year as Tabuk — about nine months earlier.', ar: 'وقع هذا في العام نفسه الذي كانت فيه تبوك، قبلها بنحو تسعة أشهر.' },
    certainty: 'sourced', sources: [S.ibnHisham],
  },
  {
    id: 'tabuk', iconName: 'footsteps', place: 'tabuk', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Walking alone to Tabuk', ar: 'وحيدًا على طريق تبوك' },
    start: 630, end: 630, displayDate: { en: 'autumn 630 CE · 9 AH', ar: 'خريف ٦٣٠ م، ٩ هـ' },
    clue: { en: 'His camel is too slow, so a traveler lifts his bags onto his own back and follows the army on foot.', ar: 'بعيره بطيء، فيحمل المسافر متاعه على ظهره ويتبع الجيش ماشيًا.' },
    takeaway: { en: 'Seeing him, the Prophet said: “May God have mercy on Abu Dharr: he walks alone, dies alone, and will be raised alone.” No battle was fought at Tabuk.', ar: 'لمّا رآه النبي ﷺ قال: «رحم الله أبا ذر، يمشي وحده، ويموت وحده، ويُبعث وحده». ولم يقع قتالٌ في تبوك.' },
    certainty: 'sourced', sources: [S.ibnHishamTabuk, S.message53],
    question: {
      prompt: { en: 'What happened when the army reached Tabuk?', ar: 'ماذا حدث حين بلغ الجيش تبوك؟' },
      options: [
        { en: 'No battle took place', ar: 'لم تقع معركة' },
        { en: 'A great battle with Rome', ar: 'معركة كبرى مع الروم' },
        { en: 'The army turned back halfway', ar: 'عاد الجيش من منتصف الطريق' },
      ],
      answer: 0,
      explain: { en: 'The army waited at Tabuk and returned without meeting a Roman army.', ar: 'أقام الجيش في تبوك ثم عاد دون أن يلقى جيشًا للروم.' },
    },
  },
  {
    id: 'truthful', iconName: 'star', place: 'medina', category: 'journey', difficultyTier: 'scholar',
    title: { en: '“None more truthful”', ar: '«ما أظلّت الخضراء…»' },
    start: 622, end: 632, displayDate: { en: 'Medina years, 622–632 CE', ar: 'سنوات المدينة، ٦٢٢–٦٣٢ م' },
    clue: { en: 'The Prophet describes one companion: no one under the sky speaks more truly.', ar: 'يصف النبي ﷺ أحد أصحابه: ما تحت السماء أصدق لهجةً منه.' },
    takeaway: { en: '“The sky has not shaded, nor the earth carried, anyone more truthful than Abu Dharr.”', ar: '«ما أظلّت الخضراء، ولا أقلّت الغبراء، من ذي لهجةٍ أصدقَ من أبي ذر».' },
    certainty: 'range', sources: [S.tirmidhi3801],
  },
  {
    id: 'prophet-death', iconName: 'moon', place: 'medina', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'The Prophet passes away', ar: 'وفاة النبي ﷺ' },
    start: 632, end: 632, displayDate: { en: '632 CE · 11 AH', ar: '٦٣٢ م، ١١ هـ' },
    clue: { en: 'In Medina, the community loses its Prophet.', ar: 'في المدينة، تفقد الأمّة نبيّها.' },
    takeaway: { en: 'Abu Dharr lived on for about twenty years, holding to what he had learned.', ar: 'عاش أبو ذر بعده نحو عشرين عامًا ثابتًا على ما تعلّم.' },
    certainty: 'sourced', sources: [S.ibnHisham],
  },

  // ------------------------------------------------------------------ the caliphate and Sham
  {
    id: 'damascus', iconName: 'columns', place: 'damascus', category: 'caliphate', difficultyTier: 'historian',
    title: { en: 'Damascus comes under Muslim rule', ar: 'دمشق تدخل في حكم المسلمين' },
    start: 634, end: 636, displayDate: { en: 'c. 634–636 CE', ar: 'نحو ٦٣٤–٦٣٦ م' },
    clue: { en: 'An old Roman city of columns and churches opens its gates to a new government.', ar: 'مدينة رومانية قديمة ذات أعمدة وكنائس تفتح أبوابها لحكم جديد.' },
    takeaway: { en: 'The city kept its Roman streets and its great church for decades — that is the Damascus Abu Dharr knew.', ar: 'حافظت المدينة على شوارعها الرومانية وكنيستها الكبرى عقودًا، وتلك هي دمشق التي عرفها أبو ذر.' },
    certainty: 'range', sources: [S.tabari],
  },
  {
    id: 'uthman', iconName: 'scroll', place: 'medina', category: 'caliphate', difficultyTier: 'scholar',
    title: { en: 'ʿUthman becomes caliph', ar: 'عثمان يتولّى الخلافة' },
    start: 644, end: 644, displayDate: { en: '644 CE · 23–24 AH', ar: '٦٤٤ م، ٢٣–٢٤ هـ' },
    clue: { en: 'After ʿUmar is killed, a council chooses the third caliph.', ar: 'بعد مقتل عمر، تختار الشورى الخليفة الثالث.' },
    takeaway: { en: 'Abu Dharr’s time in Sham and al-Rabadhah falls in these years.', ar: 'تقع إقامة أبي ذر في الشام والربذة في هذه السنوات.' },
    certainty: 'sourced', sources: [S.tabari],
  },
  {
    id: 'sham-dispute', iconName: 'coins', place: 'damascus', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'The dispute over hoarded gold', ar: 'الخلاف على كنز الذهب والفضة' },
    start: 645, end: 651, displayDate: { en: 'c. 645–651 CE', ar: 'نحو ٦٤٥–٦٥١ م' },
    clue: { en: 'In Sham, a companion insists a verse about hoarding gold and silver applies to Muslims too.', ar: 'في الشام، يصرّ صحابيٌّ على أن آية كنز الذهب والفضة تشمل المسلمين أيضًا.' },
    takeaway: { en: 'Muʿawiya said the verse (Qur’an 9:34) meant the People of the Book; Abu Dharr said it meant everyone. Muʿawiya wrote to ʿUthman.', ar: 'قال معاوية إن الآية (التوبة ٣٤) في أهل الكتاب، وقال أبو ذر إنها فينا وفيهم. فكتب معاوية إلى عثمان.' },
    certainty: 'range', sources: [S.bukhari1406],
    question: {
      prompt: { en: 'What was the disagreement about?', ar: 'علامَ كان الخلاف؟' },
      options: [
        { en: 'Who a verse about hoarding wealth applies to', ar: 'على مَن تنطبق آية كنز المال' },
        { en: 'Where to build a mosque', ar: 'أين يُبنى مسجد' },
        { en: 'The route of a caravan', ar: 'طريق قافلة' },
      ],
      answer: 0,
      explain: { en: 'Abu Dharr spoke for the poor’s share in wealth — with words, never weapons.', ar: 'دافع أبو ذر عن حقّ الفقراء في المال، بالكلمة لا بالسلاح.' },
    },
  },
  {
    id: 'jabal-amil', iconName: 'olive', place: 'jabal-amil', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Teaching in Jabal Amil', ar: 'الدعوة في جبل عامل' },
    start: 645, end: 651, displayDate: { en: 'c. 645–651 CE (tradition)', ar: 'نحو ٦٤٥–٦٥١ م (رواية متوارثة)' },
    clue: { en: 'In the hills above the coast, villages remember a companion who taught there.', ar: 'في التلال المطلّة على الساحل، تذكر القرى صحابيًّا علّم فيها.' },
    takeaway: { en: 'Shrines at Sarafand and Mays al-Jabal carry his name. This is a reported tradition that still needs corroboration.', ar: 'تحمل مقاماتٌ في الصرفند وميس الجبل اسمه. وهذه رواية متوارثة ما زالت تحتاج إلى توثيق.' },
    certainty: 'tradition', sources: [S.greatCompanion14],
  },
  {
    id: 'recalled', iconName: 'letter', place: 'medina', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Called back to Medina', ar: 'الاستدعاء إلى المدينة' },
    start: 649, end: 652, displayDate: { en: 'c. 650 CE', ar: 'نحو ٦٥٠ م' },
    clue: { en: 'A letter from the caliph summons an outspoken companion home from Sham.', ar: 'رسالة من الخليفة تستدعي صحابيًّا صريحًا من الشام.' },
    takeaway: { en: 'He told Zayd ibn Wahb: “Even if an Ethiopian slave were put over me, I would hear and obey.”', ar: 'قال لزيد بن وهب: «لو أُمِّر عليّ عبدٌ حبشيٌّ لسمعتُ وأطعت».' },
    certainty: 'range', sources: [S.bukhari1406],
  },
  {
    id: 'rabadhah', iconName: 'acacia', place: 'rabadhah', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'To al-Rabadhah, and Ali’s farewell', ar: 'إلى الربذة، ووداع علي' },
    start: 650, end: 652, displayDate: { en: 'c. 650–652 CE', ar: 'نحو ٦٥٠–٦٥٢ م' },
    clue: { en: 'A companion leaves Medina for a lonely plain; a few friends walk out to say goodbye.', ar: 'صحابيٌّ يغادر المدينة إلى سهلٍ موحش، ويخرج بعض أصحابه لوداعه.' },
    takeaway: { en: 'Ali told him: “You became angry for God, so place your hope in Him.” Whether this was exile or his own choice is disputed; the game shows both views.', ar: 'قال له علي: «إنك غضبتَ لله فارجُ مَن غضبتَ له». واختُلف: أكان نفيًا أم اختيارًا؟ واللعبة تعرض القولين.' },
    certainty: 'range', sources: [S.nahj130, S.bukhari1406],
  },
  {
    id: 'death', iconName: 'caravan', place: 'rabadhah', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Dying alone, as foretold', ar: 'يموت وحده كما أُخبر' },
    start: 651, end: 653, displayDate: { en: '652 CE · 31–32 AH', ar: '٦٥٢ م، ٣١–٣٢ هـ' },
    clue: { en: 'In the desert, a caravan from Iraq finds a dying man with only his wife beside him.', ar: 'في البادية، تجد قافلةٌ من العراق رجلًا يحتضر ليس معه إلا زوجته.' },
    takeaway: { en: 'ʿAbdullah ibn Masʿud wept and remembered the words spoken on the road to Tabuk: “he dies alone.”', ar: 'بكى عبد الله بن مسعود وتذكّر ما قيل على طريق تبوك: «ويموت وحده».' },
    certainty: 'range', sources: [S.ibnHishamTabuk],
    question: {
      prompt: { en: 'Which earlier moment did Ibn Masʿud remember?', ar: 'أيّ لحظةٍ سابقة تذكّرها ابن مسعود؟' },
      options: [
        { en: 'The walk alone to Tabuk', ar: 'المشي وحيدًا إلى تبوك' },
        { en: 'The Hijra', ar: 'الهجرة' },
        { en: 'The dispute in Sham', ar: 'الخلاف في الشام' },
      ],
      answer: 0,
      explain: { en: 'Two moments twenty years apart are joined by one saying — cause and fulfilment.', ar: 'لحظتان بينهما عشرون عامًا يجمعهما قولٌ واحد.' },
    },
  },

  // ------------------------------------------------------------------ after his time
  {
    id: 'dome-rock', iconName: 'dome', place: 'world', category: 'after', difficultyTier: 'historian',
    title: { en: 'The Dome of the Rock is built', ar: 'بناء قبّة الصخرة' },
    start: 691, end: 692, displayDate: { en: '691–692 CE', ar: '٦٩١–٦٩٢ م' },
    clue: { en: 'In Jerusalem, a golden-domed building rises over a sacred rock.', ar: 'في القدس، يرتفع بناءٌ ذو قبّة ذهبية فوق صخرةٍ مقدّسة.' },
    takeaway: { en: 'Built about forty years after Abu Dharr died — great domes belong to a later age.', ar: 'بُنيت بعد وفاة أبي ذر بنحو أربعين عامًا؛ القباب الكبرى من عصرٍ لاحق.' },
    certainty: 'sourced', sources: [S.creswell],
  },
  {
    id: 'umayyad-mosque', iconName: 'mosaic', place: 'damascus', category: 'after', difficultyTier: 'historian',
    title: { en: 'The Umayyad Mosque of Damascus', ar: 'الجامع الأموي بدمشق' },
    start: 705, end: 715, displayDate: { en: '705–715 CE', ar: '٧٠٥–٧١٥ م' },
    clue: { en: 'Golden mosaics cover the walls of a great mosque built on the site of a church.', ar: 'فسيفساء ذهبية تكسو جدران جامعٍ كبير بُني في موضع كنيسة.' },
    takeaway: { en: 'Abu Dharr never saw it — which is why the game’s Damascus shows the old church precinct instead.', ar: 'لم يره أبو ذر قط، ولهذا تُظهر دمشق في اللعبة ساحة الكنيسة القديمة بدلًا منه.' },
    certainty: 'sourced', sources: [S.creswell],
    question: {
      prompt: { en: 'Should a scene of Abu Dharr in Damascus show this mosque?', ar: 'هل يصحّ أن يظهر هذا الجامع في مشهدٍ لأبي ذر في دمشق؟' },
      options: [
        { en: 'No — it was built about 50 years after his death', ar: 'لا، بُني بعد وفاته بنحو خمسين عامًا' },
        { en: 'Yes — it is the oldest building there', ar: 'نعم، فهو أقدم بناءٍ هناك' },
      ],
      answer: 0,
      explain: { en: 'Placing later buildings in earlier times is called an anachronism.', ar: 'وضع مبانٍ لاحقة في زمنٍ سابق يُسمّى مفارقةً تاريخية.' },
    },
  },
  {
    id: 'green-dome', iconName: 'dome', place: 'medina', category: 'after', difficultyTier: 'scholar',
    title: { en: 'A dome over the Prophet’s Mosque', ar: 'قبّة فوق المسجد النبوي' },
    start: 1279, end: 1279, displayDate: { en: '1279 CE (painted green in 1837)', ar: '١٢٧٩ م (طُليت بالأخضر سنة ١٨٣٧)' },
    clue: { en: 'A wooden dome is raised over the Prophet’s resting place, centuries later turned green.', ar: 'تُرفع قبّة خشبية فوق مرقد النبي ﷺ، وبعد قرون تُطلى بالأخضر.' },
    takeaway: { en: 'In Abu Dharr’s Medina the mosque had mud-brick walls and a roof of palm fronds — no dome at all.', ar: 'في مدينة أبي ذر كان المسجد بجدرانٍ من اللَّبِن وسقفٍ من جريد النخل، بلا قبّة.' },
    certainty: 'sourced', sources: [S.britannica],
  },
];

/** The card every game starts with, already on the board. */
export const timelineAnchorId = 'hijra';

/** Cards each tier can draw. Explorers see the clearest moments; historians see everything. */
export function cardsForTier(tier: Tier): TimelineEvent[] {
  const allowed: Record<Tier, Tier[]> = {
    explorer: ['explorer', 'scholar'],
    scholar: ['explorer', 'scholar', 'historian'],
    historian: ['scholar', 'historian'],
  };
  return timelineEvents.filter((e) => e.id !== timelineAnchorId && allowed[tier].includes(e.difficultyTier));
}

/**
 * Is `card` correctly placed between `before` and `after` (either may be missing)?
 * Ranges overlap-based, so disputed dates accept every placement the sources allow.
 * Explorers get a ten-year margin. Cards dated to the same year fit in either order.
 */
export function isPlacementCorrect(card: TimelineEvent, before: TimelineEvent | undefined, after: TimelineEvent | undefined, tier: Tier): boolean {
  const margin = tier === 'explorer' ? 10 : 0;
  if (before && card.end + margin < before.start) return false;
  if (after && card.start - margin > after.end) return false;
  return true;
}
