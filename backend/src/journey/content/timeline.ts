/**
 * Timeline game cards: events from Abu Dharr's journey and the world around it.
 *
 * Shia sources only. Every date is a CE range [start, end]. Where the sources give no exact year the range is
 * wide and `certainty` says so; scoring accepts any placement the range allows. Cards marked
 * `after` are later than Abu Dharr (d. 652). See docs/research/locations.md.
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
  greatCompanion: { en: 'The Great Companion of the Prophet — Abu Dharr (Islamic Seminary Publications)', ar: 'الصحابي الجليل أبو ذر (منشورات المعهد الإسلامي)' },
  greatCompanion3: { en: 'The Great Companion of the Prophet — Abu Dharr, ch. 3', ar: 'الصحابي الجليل أبو ذر، الفصل ٣' },
  greatCompanion4: { en: 'The Great Companion of the Prophet — Abu Dharr, ch. 4', ar: 'الصحابي الجليل أبو ذر، الفصل ٤' },
  greatCompanion14: { en: 'The Great Companion of the Prophet — Abu Dharr, ch. 14', ar: 'الصحابي الجليل أبو ذر، الفصل ١٤' },
  bihar22: { en: 'al-Majlisi, Bihar al-Anwar, vol. 22, chapter on Abu Dharr (from al-Saduq’s Amali)', ar: 'المجلسي، بحار الأنوار، ج ٢٢، باب أبي ذر (عن أمالي الصدوق)' },
  biharTabuk: { en: 'al-Majlisi, Bihar al-Anwar, vol. 22, p. 433 (from al-Rawandi, al-Kharaʾij, from Imam al-Sadiq)', ar: 'المجلسي، بحار الأنوار، ج ٢٢، ص ٤٣٣ (عن الراوندي، الخرائج، عن الإمام الصادق)' },
  hayat: { en: 'al-Majlisi, Hayat al-Qulub, vol. 2', ar: 'المجلسي، حياة القلوب، ج ٢' },
  maani: { en: 'al-Saduq, Maʿani al-Akhbar (narrated from Imam al-Sadiq)', ar: 'الصدوق، معاني الأخبار (عن الإمام الصادق)' },
  kashshi: { en: 'al-Kashshi, Rijal (entry on Abu Dharr)', ar: 'الكشي، الرجال (ترجمة أبي ذر)' },
  kafi8: { en: 'al-Kulayni, al-Kafi, vol. 8 (al-Rawda), p. 207, no. 251', ar: 'الكليني، الكافي، ج ٨ (الروضة)، ص ٢٠٧، ح ٢٥١' },
  faqih: { en: 'al-Saduq, Man la Yahduruhu al-Faqih, no. 2428', ar: 'الصدوق، من لا يحضره الفقيه، ح ٢٤٢٨' },
  nahj130: { en: 'Nahj al-Balagha, Sermon 130', ar: 'نهج البلاغة، الخطبة ١٣٠' },
  yaqubi: { en: 'al-Yaʿqubi, Tarikh al-Yaʿqubi', ar: 'اليعقوبي، تاريخ اليعقوبي' },
  masudi: { en: 'al-Masʿudi, Muruj al-Dhahab', ar: 'المسعودي، مروج الذهب' },
  ayan: { en: 'Muhsin al-Amin, Aʿyan al-Shiʿa, vol. 4', ar: 'محسن الأمين، أعيان الشيعة، ج ٤' },
  message: { en: 'Jaʿfar Subhani, The Message', ar: 'جعفر السبحاني، الرسالة' },
  message53: { en: 'Jaʿfar Subhani, The Message, ch. 53', ar: 'جعفر السبحاني، الرسالة، الفصل ٥٣' },
  irshad: { en: 'al-Shaykh al-Mufid, al-Irshad', ar: 'الشيخ المفيد، الإرشاد' },
  quran30: { en: "Qur'an 30:2–4", ar: 'القرآن الكريم، الروم ٢–٤' },
  majma: { en: 'al-Tabrisi, Majmaʿ al-Bayan (on 30:2–4)', ar: 'الطبرسي، مجمع البيان (الروم ٢–٤)' },
} as const;

export const timelineEvents: TimelineEvent[] = [
  // ------------------------------------------------------------------ the world before
  {
    id: 'kaaba-rebuilt', iconName: 'kaaba', place: 'mecca', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'Quraysh rebuild the Kaaba', ar: 'قريش تعيد بناء الكعبة' },
    start: 603, end: 607, displayDate: { en: 'c. 605 CE', ar: 'نحو ٦٠٥ م' },
    clue: { en: 'After a flood damages it, the clans of Mecca rebuild the House in stone and timber.', ar: 'بعد أن أضرّ بها السيل، تعيد عشائر مكة بناء البيت بالحجارة والخشب.' },
    takeaway: { en: 'This is the Kaaba Abu Dharr saw: smaller than today, built in courses of stone and wood, with no mosque around it.', ar: 'هذه هي الكعبة التي رآها أبو ذر: أصغر مما هي اليوم، مبنيّة بمداميك من الحجر والخشب، ولا مسجد حولها.' },
    certainty: 'range', sources: [S.message],
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
    certainty: 'sourced', sources: [S.message],
  },

  // ------------------------------------------------------------------ Abu Dharr in Mecca
  {
    id: 'unays', iconName: 'road', place: 'mecca', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'Unays goes to Mecca', ar: 'أُنيس يذهب إلى مكة' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'Abu Dharr’s brother returns from Mecca: “I met a man who says God has sent him.”', ar: 'يعود أخو أبي ذر من مكة: «لقيتُ رجلًا يزعم أن الله أرسله».' },
    takeaway: { en: 'News of the Prophet reached Ghifar on the caravan roads, and Abu Dharr set out for Mecca to see for himself.', ar: 'بلغ خبرُ النبي ﷺ غِفارَ عبر طرق القوافل، فخرج أبو ذر إلى مكة ليرى بنفسه.' },
    certainty: 'range', sources: [S.greatCompanion],
  },
  {
    id: 'zamzam', iconName: 'well', place: 'mecca', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Living on Zamzam water', ar: 'العيش على ماء زمزم' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'A stranger stays by the Kaaba with no food, drinking only from the well.', ar: 'غريبٌ يقيم عند الكعبة بلا طعام، لا يشرب إلا من البئر.' },
    takeaway: { en: 'He stayed by the House, a stranger in a hostile town, waiting for the chance to meet the Prophet.', ar: 'أقام عند البيت غريبًا في بلدٍ معادٍ، ينتظر فرصة لقاء النبي ﷺ.' },
    certainty: 'range', sources: [S.greatCompanion],
  },
  {
    id: 'ali-host', iconName: 'lamp', place: 'mecca', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Ali hosts the stranger', ar: 'عليٌّ يستضيف الغريب' },
    start: 610, end: 613, displayDate: { en: 'c. 610–613 CE', ar: 'نحو ٦١٠–٦١٣ م' },
    clue: { en: 'A young man notices a traveler sleeping by the Kaaba and takes him home.', ar: 'شابٌّ يرى مسافرًا نائمًا عند الكعبة فيأخذه إلى بيته.' },
    takeaway: { en: 'Ali hosted Abu Dharr and then quietly led him to the Prophet, where he accepted Islam.', ar: 'استضاف عليٌّ أبا ذر ثم قاده سرًّا إلى النبي ﷺ، فأسلم.' },
    certainty: 'range', sources: [S.greatCompanion, S.bihar22],
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
    certainty: 'range', sources: [S.greatCompanion, S.bihar22],
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
    certainty: 'range', sources: [S.greatCompanion3],
  },
  {
    id: 'hijra', iconName: 'camel', place: 'medina', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'The Hijra to Medina', ar: 'الهجرة إلى المدينة' },
    start: 622, end: 622, displayDate: { en: '622 CE · 1 AH', ar: '٦٢٢ م، ١ هـ' },
    clue: { en: 'The Prophet leaves Mecca for the oasis of Yathrib.', ar: 'يخرج النبي ﷺ من مكة إلى واحة يثرب.' },
    takeaway: { en: 'The Islamic calendar counts its years from this journey.', ar: 'يبدأ التقويم الهجري من هذه الرحلة.' },
    certainty: 'sourced', sources: [S.message],
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
    takeaway: { en: 'Abu Dharr’s patient teaching brought his whole tribe to Islam.', ar: 'أثمرت دعوة أبي ذر الصابرة إسلامَ قبيلته كلّها.' },
    certainty: 'range', sources: [S.greatCompanion3],
  },

  // ------------------------------------------------------------------ Medina
  {
    id: 'badr', iconName: 'well', place: 'medina', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'The Battle of Badr', ar: 'غزوة بدر' },
    start: 624, end: 624, displayDate: { en: '624 CE · 2 AH', ar: '٦٢٤ م، ٢ هـ' },
    clue: { en: 'At the wells of Badr, the Muslims of Medina meet the army of Quraysh.', ar: 'عند آبار بدر، يلتقي مسلمو المدينة بجيش قريش.' },
    takeaway: { en: 'Abu Dharr was not at Badr — that is why ATHAR never shows him there.', ar: 'لم يشهد أبو ذر بدرًا، ولذلك لا تُظهره «أثر» هناك أبدًا.' },
    certainty: 'sourced', sources: [S.irshad, S.greatCompanion4],
  },
  {
    id: 'trench', iconName: 'trench', place: 'medina', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'The Trench', ar: 'غزوة الخندق' },
    start: 627, end: 627, displayDate: { en: '627 CE · 5 AH', ar: '٦٢٧ م، ٥ هـ' },
    clue: { en: 'Medina digs a ditch across its open northern side against a great alliance.', ar: 'المدينة تحفر خندقًا على جهتها الشمالية المكشوفة في وجه الأحزاب.' },
    takeaway: { en: 'The biography used here says Abu Dharr had not yet joined these campaigns.', ar: 'تذكر السيرة المعتمدة هنا أن أبا ذر لم يكن قد شهد هذه الغزوات بعد.' },
    certainty: 'sourced', sources: [S.irshad, S.greatCompanion4],
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
    certainty: 'sourced', sources: [S.quran30, S.majma],
  },
  {
    id: 'mecca-opened', iconName: 'kaaba', place: 'mecca', category: 'prophet', difficultyTier: 'scholar',
    title: { en: 'Mecca is opened', ar: 'فتح مكة' },
    start: 630, end: 630, displayDate: { en: 'Jan 630 CE · 8 AH', ar: 'يناير ٦٣٠ م، ٨ هـ' },
    clue: { en: 'The Prophet returns to the city he left, almost without fighting.', ar: 'يعود النبي ﷺ إلى المدينة التي خرج منها، دون قتالٍ يُذكر.' },
    takeaway: { en: 'This happened in the same year as Tabuk — about nine months earlier.', ar: 'وقع هذا في العام نفسه الذي كانت فيه تبوك، قبلها بنحو تسعة أشهر.' },
    certainty: 'sourced', sources: [S.message, S.irshad],
  },
  {
    id: 'tabuk', iconName: 'footsteps', place: 'tabuk', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Walking alone to Tabuk', ar: 'وحيدًا على طريق تبوك' },
    start: 630, end: 630, displayDate: { en: 'autumn 630 CE · 9 AH', ar: 'خريف ٦٣٠ م، ٩ هـ' },
    clue: { en: 'His camel is too slow, so a traveler lifts his bags onto his own back and follows the army on foot.', ar: 'بعيره بطيء، فيحمل المسافر متاعه على ظهره ويتبع الجيش ماشيًا.' },
    takeaway: { en: 'Seeing him, the Prophet said: “May God have mercy on Abu Dharr: he walks alone, dies alone, and will be raised alone.” No battle was fought at Tabuk.', ar: 'لمّا رآه النبي ﷺ قال: «رحم الله أبا ذر، يمشي وحده، ويموت وحده، ويُبعث وحده». ولم يقع قتالٌ في تبوك.' },
    certainty: 'sourced', sources: [S.biharTabuk, S.message53, S.hayat],
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
    certainty: 'range', sources: [S.maani, S.kashshi],
  },
  {
    id: 'prophet-death', iconName: 'moon', place: 'medina', category: 'prophet', difficultyTier: 'explorer',
    title: { en: 'The Prophet passes away', ar: 'وفاة النبي ﷺ' },
    start: 632, end: 632, displayDate: { en: '632 CE · 11 AH', ar: '٦٣٢ م، ١١ هـ' },
    clue: { en: 'In Medina, the community loses its Prophet.', ar: 'في المدينة، تفقد الأمّة نبيّها.' },
    takeaway: { en: 'Abu Dharr lived on for about twenty years, holding to what he had learned.', ar: 'عاش أبو ذر بعده نحو عشرين عامًا ثابتًا على ما تعلّم.' },
    certainty: 'sourced', sources: [S.message, S.irshad],
  },

  // ------------------------------------------------------------------ the caliphate and Sham
  {
    id: 'damascus', iconName: 'columns', place: 'damascus', category: 'caliphate', difficultyTier: 'historian',
    title: { en: 'Damascus comes under Muslim rule', ar: 'دمشق تدخل في حكم المسلمين' },
    start: 634, end: 636, displayDate: { en: 'c. 634–636 CE', ar: 'نحو ٦٣٤–٦٣٦ م' },
    clue: { en: 'An old Roman city of columns and churches opens its gates to a new government.', ar: 'مدينة رومانية قديمة ذات أعمدة وكنائس تفتح أبوابها لحكم جديد.' },
    takeaway: { en: 'The city kept its Roman streets and its great church for decades — that is the Damascus Abu Dharr knew.', ar: 'حافظت المدينة على شوارعها الرومانية وكنيستها الكبرى عقودًا، وتلك هي دمشق التي عرفها أبو ذر.' },
    certainty: 'range', sources: [S.yaqubi],
  },
  {
    id: 'uthman', iconName: 'scroll', place: 'medina', category: 'caliphate', difficultyTier: 'scholar',
    title: { en: 'ʿUthman becomes caliph', ar: 'عثمان يتولّى الخلافة' },
    start: 644, end: 644, displayDate: { en: '644 CE · 23–24 AH', ar: '٦٤٤ م، ٢٣–٢٤ هـ' },
    clue: { en: 'After ʿUmar is killed, a council chooses the third caliph.', ar: 'بعد مقتل عمر، تختار الشورى الخليفة الثالث.' },
    takeaway: { en: 'Abu Dharr’s time in Sham and al-Rabadhah falls in these years.', ar: 'تقع إقامة أبي ذر في الشام والربذة في هذه السنوات.' },
    certainty: 'sourced', sources: [S.yaqubi],
  },
  {
    id: 'sham-dispute', iconName: 'coins', place: 'damascus', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'The dispute over hoarded gold', ar: 'الخلاف على كنز الذهب والفضة' },
    start: 645, end: 651, displayDate: { en: 'c. 645–651 CE', ar: 'نحو ٦٤٥–٦٥١ م' },
    clue: { en: 'In Sham, a companion insists a verse about hoarding gold and silver applies to Muslims too.', ar: 'في الشام، يصرّ صحابيٌّ على أن آية كنز الذهب والفضة تشمل المسلمين أيضًا.' },
    takeaway: { en: 'He recited Qur’an 9:34 against those who hoarded wealth while the poor went without. Muʿawiya wrote to ʿUthman that Abu Dharr had “stirred up Sham against him”.', ar: 'كان يتلو آية الكنز (التوبة ٣٤) على من يكنزون المال والفقراء محرومون، فكتب معاوية إلى عثمان أن أبا ذر قد أفسد عليه الشام.' },
    certainty: 'range', sources: [S.greatCompanion14, S.yaqubi, S.masudi],
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
    certainty: 'tradition', sources: [S.greatCompanion14, S.ayan],
  },
  {
    id: 'recalled', iconName: 'letter', place: 'medina', category: 'journey', difficultyTier: 'historian',
    title: { en: 'Called back to Medina', ar: 'الاستدعاء إلى المدينة' },
    start: 649, end: 652, displayDate: { en: 'c. 650 CE', ar: 'نحو ٦٥٠ م' },
    clue: { en: 'A letter from the caliph summons an outspoken companion home from Sham.', ar: 'رسالة من الخليفة تستدعي صحابيًّا صريحًا من الشام.' },
    takeaway: { en: 'He was brought back from Sham to Medina, and from there sent on to al-Rabadhah.', ar: 'أُعيد من الشام إلى المدينة، ومنها سُيِّر إلى الربذة.' },
    certainty: 'range', sources: [S.yaqubi, S.masudi],
  },
  {
    id: 'rabadhah', iconName: 'acacia', place: 'rabadhah', category: 'journey', difficultyTier: 'scholar',
    title: { en: 'To al-Rabadhah, and Ali’s farewell', ar: 'إلى الربذة، ووداع علي' },
    start: 650, end: 652, displayDate: { en: 'c. 650–652 CE', ar: 'نحو ٦٥٠–٦٥٢ م' },
    clue: { en: 'A companion leaves Medina for a lonely plain; a few friends walk out to say goodbye.', ar: 'صحابيٌّ يغادر المدينة إلى سهلٍ موحش، ويخرج بعض أصحابه لوداعه.' },
    takeaway: { en: 'Imam Ali, al-Hasan, al-Husayn, ʿAqil, ʿAbdullah ibn Jaʿfar and ʿAmmar walked out to bid him farewell. Ali told him: “You became angry for God, so place your hope in Him.”', ar: 'خرج لوداعه أمير المؤمنين والحسن والحسين وعقيل وعبد الله بن جعفر وعمار، وقال له علي: «إنك غضبتَ لله فارجُ مَن غضبتَ له».' },
    certainty: 'range', sources: [S.nahj130, S.kafi8, S.faqih],
  },
  {
    id: 'death', iconName: 'caravan', place: 'rabadhah', category: 'journey', difficultyTier: 'explorer',
    title: { en: 'Dying alone, as foretold', ar: 'يموت وحده كما أُخبر' },
    start: 651, end: 653, displayDate: { en: '652 CE · 31–32 AH', ar: '٦٥٢ م، ٣١–٣٢ هـ' },
    clue: { en: 'In the desert, passing travelers find a dying man with only his family beside him, and no cloth for his shroud.', ar: 'في البادية، يجد مسافرون عابرون رجلًا يحتضر ليس معه إلا أهله، ولا كفن له.' },
    takeaway: { en: 'Malik al-Ashtar and his companions shrouded and buried him — fulfilling the words spoken on the road to Tabuk: “he dies alone.”', ar: 'كفّنه مالك الأشتر وأصحابه ودفنوه، فتحقّق ما قيل على طريق تبوك: «ويموت وحده».' },
    certainty: 'range', sources: [S.biharTabuk, S.kashshi],
    question: {
      prompt: { en: 'Which earlier moment did his lonely death fulfil?', ar: 'أيّ لحظةٍ سابقة تحقّقت بموته وحيدًا؟' },
      options: [
        { en: 'The walk alone to Tabuk', ar: 'المشي وحيدًا إلى تبوك' },
        { en: 'The Hijra', ar: 'الهجرة' },
        { en: 'The dispute in Sham', ar: 'الخلاف في الشام' },
      ],
      answer: 0,
      explain: { en: 'Two moments twenty years apart are joined by one saying — cause and fulfilment.', ar: 'لحظتان بينهما عشرون عامًا يجمعهما قولٌ واحد.' },
    },
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
