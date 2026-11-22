/**
 * Companion mode, chapter 1: "The Seeker". The player is a fictional young man of Ghifar who
 * travels with Abu Dharr. Narration of what Abu Dharr, Imam Ali (a), the Prophet ﷺ and
 * al-ʿAbbas say and do comes from Shia sources only (see docs/research/locations.md); the
 * player's own deeds are fiction and are labelled as such.
 *
 * Main source for this chapter: al-Shaykh Muhammad Jawad Al al-Faqih, Abu Dharr al-Ghifari:
 * Ramz al-Yaqaza fi al-Damir al-Insani (al-Arkan al-Arbaʿa 1, Muʾassasat al-Aʿlami), ch. 1,
 * pp. 31–37, which gives the account from Muhsin al-Amin, Aʿyan al-Shiʿa vol. 16, pp. 316–321.
 */

export interface L { en: string; ar: string }

export interface NarrationLine {
  id: string;
  text: L;
  /** true = historical narration from the sources; false = the game speaking (fiction / framing). */
  sourced: boolean;
  sources: L[];
}

const AL_FAQIH = { en: 'Al al-Faqih, Abu Dharr al-Ghifari: Ramz al-Yaqaza, ch. 1', ar: 'آل الفقيه، أبو ذر الغفاري رمز اليقظة، الفصل ١' };
const AYAN = { en: 'Muhsin al-Amin, Aʿyan al-Shiʿa, vol. 16, pp. 316–321', ar: 'محسن الأمين، أعيان الشيعة، ج ١٦، ص ٣١٦–٣٢١' };
const KHISAL = { en: 'al-Saduq, al-Khisal, p. 42', ar: 'الصدوق، الخصال، ص ٤٢' };
const AL_FAQIH_2 = { en: 'Al al-Faqih, Abu Dharr al-Ghifari: Ramz al-Yaqaza, pp. 38–43', ar: 'آل الفقيه، أبو ذر الغفاري رمز اليقظة، ص ٣٨–٤٣' };
const KHOEI = { en: 'al-Khoei, Muʿjam Rijal al-Hadith, vol. 4, p. 171 (from Imam al-Sadiq)', ar: 'الخوئي، معجم رجال الحديث، ج ٤، ص ١٧١ (عن الإمام الصادق)' };
const WARRAM = { en: 'Warram, Tanbih al-Khawatir, vol. 2, pp. 300–314', ar: 'ورّام، تنبيه الخواطر، ج ٢، ص ٣٠٠–٣١٤' };
const MAANI = { en: 'al-Saduq, Maʿani al-Akhbar (narrated from Imam al-Sadiq)', ar: 'الصدوق، معاني الأخبار (عن الإمام الصادق)' };
const KHARAIJ = { en: 'al-Majlisi, Bihar al-Anwar, vol. 22, p. 433 (from al-Rawandi, al-Khara’ij)', ar: 'المجلسي، بحار الأنوار، ج ٢٢، ص ٤٣٣ (عن الراوندي، الخرائج)' };
const MESSAGE = { en: 'Jaʿfar Subhani, The Message, ch. 53', ar: 'جعفر السبحاني، الرسالة، الفصل ٥٣' };

export const narration: NarrationLine[] = [
  {
    id: 'n01', sourced: true, sources: [AYAN, KHISAL],
    text: {
      ar: 'في صحراء الحجاز، بين خيام بني غِفار، عاش جُندَبُ بنُ جُنادة، المعروفُ بأبي ذرّ. كان يعبدُ اللهَ وحدَه قبلَ الإسلام، ولا يسجدُ لصنم.',
      en: 'In the desert of the Hejaz, among the tents of the tribe of Ghifar, lived Jundab ibn Junada, known as Abu Dharr. Even before Islam he worshipped God alone, and bowed to no idol.',
    },
  },
  {
    id: 'n02', sourced: false, sources: [],
    text: {
      ar: 'وأنتَ فتىً من غِفار، رفيقُه في الطريق. ما تفعلُه في هذه القصة من صُنعِك، وما يفعلُه أبو ذرّ تاريخٌ تنقلُه المصادر.',
      en: 'And you are a young man of Ghifar, his companion on the road. What you do in this story is your own; what Abu Dharr does is history, as the sources tell it.',
    },
  },
  {
    id: 'n03', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'بلغَه خبرُ رجلٍ بمكّة يقولُ إنّه يأتيه الخبرُ من السماء، فأرسلَ أخاه أُنَيسًا ليأتيَه بعلمِه.',
      en: 'News reached him of a man in Mecca who said that tidings came to him from heaven. Abu Dharr sent his brother Unays to learn about him.',
    },
  },
  {
    id: 'n04', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'عادَ أُنَيس فقال: رأيتُه يأمرُ بالمعروف، وينهى عن المنكر، ويأمرُ بمكارم الأخلاق، وسمعتُ منه كلامًا ما هو بالشِّعر. فقال أبو ذرّ: ما شفيتَني فيما أردت.',
      en: 'Unays returned and said: "I saw him command what is right, forbid what is wrong, and call to noble character, and I heard words from him that are not poetry." Abu Dharr said: "You have not satisfied me."',
    },
  },
  {
    id: 'n05', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فتزوّدَ، وحملَ شَنّةً له فيها ماء، وخرجَ إلى مكّة.',
      en: 'So he took provisions and a waterskin, and set out for Mecca.',
    },
  },
  {
    id: 'n06', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'أتى المسجدَ يلتمسُ النبيَّ صلّى اللهُ عليه وآله وهو لا يعرفُه، وكرهَ أن يسألَ عنه، حتى أدركه الليلُ فاضطجع.',
      en: 'He came to the sanctuary seeking the Prophet, though he did not know him and would not ask about him, until night came and he lay down.',
    },
  },
  {
    id: 'n07', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فرآه عليُّ بنُ أبي طالب فقال: كأنّ الرجلَ غريب؟ قال: نعم. قال: انطلقْ إلى المنزل. فانطلقَ معه، لا يسألُه عن شيءٍ ولا يسألُه.',
      en: 'Ali ibn Abi Talib saw him and said: "The man seems a stranger." "Yes." "Come to the house." He went with him, and neither asked the other anything.',
    },
  },
  {
    id: 'n08', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'وفي اليوم التالي مرّ به عليٌّ فقال: أما آنَ للرجلِ أن يعرفَ منزلَه؟ فأقامَه وذهبَ به معه.',
      en: 'The next day Ali passed by him again: "Is it not time for the man to know his lodging?" And he took him home with him.',
    },
  },
  {
    id: 'n09', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'وفي اليوم الثالث قال له عليّ: ألا تحدّثُني ما الذي أقدمَك هذا البلد؟ فأخذَ عليه عهدًا ليُرشدنّه، فأخبرَه أنّه نبيّ، وأنّ ما جاءَ به حقّ.',
      en: 'On the third day Ali asked him: "Will you not tell me what brought you to this town?" Abu Dharr took his pledge to guide him, and Ali told him that he was a prophet, and that what he brought was the truth.',
    },
  },
  {
    id: 'n10', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'ثم قال: إذا أصبحتَ فاتّبعني، فإنّي إن رأيتُ شيئًا أخافُه عليك قمتُ كأنّي أُريقُ الماء، فإن مضيتُ فاتّبعني حتى تدخلَ مدخلي.',
      en: 'Then he said: "In the morning, follow me. If I see something I fear for you, I will stop as if pouring out water. If I walk on, follow me until you enter where I enter."',
    },
  },
  {
    id: 'n11', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فدخلَ على رسولِ الله فقال: السلامُ عليك يا رسولَ الله، فكان أوّلَ مَن حيّاه بتحيّة الإسلام. فعرضَ عليه الإسلام، فأسلمَ وشهدَ أن لا إلهَ إلّا الله، وأنّ محمّدًا رسولُ الله.',
      en: 'He entered upon the Messenger of God and said: "Peace be upon you, O Messenger of God", the first to greet him with the greeting of Islam. The Prophet offered him Islam, and he accepted, bearing witness that there is no god but God and that Muhammad is the Messenger of God.',
    },
  },
  {
    id: 'n12', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فقال له رسولُ الله: ارجعْ إلى قومِك فأخبرْهم، واكتمْ أمرَك عن أهل مكّة، فإنّي أخشاهم عليك. فقال: والذي نفسي بيده، لأُصوّتنّ بها بين ظهرانيهم.',
      en: 'The Prophet told him: "Return to your people and tell them, and keep your matter hidden from the people of Mecca, for I fear them for you." He replied: "By Him in whose hand is my soul, I will proclaim it among them."',
    },
  },
  {
    id: 'n13', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فأتى المسجدَ ونادى بأعلى صوتِه: أشهدُ أن لا إلهَ إلّا الله، وأشهدُ أنّ محمّدًا رسولُ الله. فثارَ إليه القوم.',
      en: 'He went to the sanctuary and called out at the top of his voice: "I bear witness that there is no god but God, and that Muhammad is the Messenger of God." The crowd rose against him.',
    },
  },
  {
    id: 'n14', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'فأتى العبّاسُ فأكبَّ عليه وقال: ويلَكم، ألستم تعلمون أنّه من غِفار، وأنّ طريقَ تجارتِكم إلى الشام عليهم؟ فأنقذَه منهم.',
      en: 'Al-Abbas came and threw himself over him: "Woe to you! Do you not know that he is of Ghifar, and that your trade road to Sham runs through their land?" And he saved him from them.',
    },
  },
  {
    id: 'n15', sourced: true, sources: [AL_FAQIH, AYAN],
    text: {
      ar: 'ثم لحقَ بقومِه، فكان أوّلَ مَن أسلمَ منهم أخوه أُنَيس، ثم أمُّهما، ثم أسلمَ نصفُ غِفار، وقال الباقون: إذا قدمَ رسولُ الله المدينةَ أسلمنا.',
      en: 'Then he returned to his people. The first of them to accept Islam was his brother Unays, then their mother; then half of Ghifar accepted, and the rest said: "When the Messenger of God comes to Medina, we will accept."',
    },
  },
  {
    id: 'n16', sourced: false, sources: [],
    text: {
      ar: 'هنا ينتهي الفصلُ الأوّل، وتمضي رحلتُك مع أبي ذرّ.',
      en: 'Here the first chapter ends, and your journey with Abu Dharr goes on.',
    },
  },
  // ---------------------------------------------------------------- chapter 2: Medina
  {
    id: 'm01', sourced: true, sources: [AL_FAQIH_2],
    text: {
      ar: 'بقيَ أبو ذرّ في قومِه زمنًا طويلًا يُعلّمُهم، ولم يشهدْ بدرًا ولا أُحُدًا ولا الخندق. ثم قدمَ المدينةَ ليصحبَ النبيَّ ويأخذَ عنه العلمَ والحكمة.',
      en: 'Abu Dharr stayed among his people for a long time, teaching them; he was not at Badr, Uhud or the Trench. Then he came to Medina to be near the Prophet and to learn knowledge and wisdom from him.',
    },
  },
  {
    id: 'm02', sourced: true, sources: [KHOEI, AL_FAQIH_2],
    text: {
      ar: 'طلبَ أبو ذرّ رسولَ الله، فقيل إنّه في بستانٍ، فوجدَه نائمًا، فأعظمَه أن يوقظَه. فكسرَ عودًا يابسًا ليعرفَ أنائمٌ هو أم مستيقظ. فرفعَ رسولُ الله رأسَه وقال: يا أبا ذرّ، أما علمتَ أنّي أرى أعمالَكم في منامي كما أراكم في يقظتي؟ إنّ عينيَّ تنامان ولا ينامُ قلبي.',
      en: 'Abu Dharr looked for the Messenger of God and was told he was in a garden. He found him asleep and held him in too much awe to wake him, so he snapped a dry stick to learn whether he slept. The Prophet raised his head and said: "Abu Dharr, do you not know that I see your deeds in my sleep as I see you awake? My eyes sleep, but my heart does not."',
    },
  },
  {
    id: 'm03', sourced: true, sources: [WARRAM, AL_FAQIH_2],
    text: {
      ar: 'قال أبو ذرّ: دخلتُ يومًا على رسولِ الله في مسجدِه، فلم أرَ فيه أحدًا إلّا هو وعليٌّ جالسٌ إلى جانبه، فاغتنمتُ خلوةَ المسجد فقلت: أوصِني بوصيّةٍ ينفعُني اللهُ بها. فقال: نعم، وأكرِمْ بك يا أبا ذرّ، إنّك منّا أهلَ البيت.',
      en: 'Abu Dharr said: One day I entered the mosque and found no one there but the Messenger of God, with Ali sitting beside him. I seized the quiet and said: "Give me counsel by which God will benefit me." He said: "Yes, and how honoured you are, Abu Dharr. You are one of us, the People of the House."',
    },
  },
  {
    id: 'm04', sourced: true, sources: [WARRAM],
    text: {
      ar: 'يا أبا ذرّ، اعبدِ اللهَ كأنّك تراه، فإن كنتَ لا تراه فإنّه يراك. يا أبا ذرّ، اغتنمْ خمسًا قبلَ خمس: شبابَك قبلَ هرمِك، وصحّتَك قبلَ سقمِك، وغناك قبلَ فقرِك، وفراغَك قبلَ شغلِك، وحياتَك قبلَ موتِك.',
      en: '"Abu Dharr, worship God as though you see Him; for if you do not see Him, He sees you. Abu Dharr, take five before five: your youth before your old age, your health before your illness, your wealth before your poverty, your free time before you are busy, and your life before your death."',
    },
  },
  {
    id: 'm05', sourced: true, sources: [MAANI, AL_FAQIH_2],
    text: {
      ar: 'وقال فيه رسولُ الله: ما أظلّتِ الخضراءُ ولا أقلّتِ الغبراءُ من ذي لهجةٍ أصدقَ من أبي ذرّ. وقد سُئلَ الإمامُ الصادقُ عن هذا الحديث فصدّقه.',
      en: 'And the Messenger of God said of him: "The sky has not shaded, nor the earth carried, anyone more truthful in speech than Abu Dharr." Imam al-Sadiq was asked about these words, and confirmed them.',
    },
  },
  // ---------------------------------------------------------------- chapter 3: the road to Tabuk
  {
    id: 't01', sourced: true, sources: [MESSAGE, AL_FAQIH],
    text: {
      ar: 'في السنةِ التاسعة للهجرة خرجَ النبيُّ إلى تبوك في حرٍّ شديد وطريقٍ طويل، وتخلّفَ بعضُ الناسِ عن المسير. وخرجَ أبو ذرّ مع الجيش على بعيرِه.',
      en: 'In the ninth year after the Hijra the Prophet set out for Tabuk, through fierce heat and a long road, and some people stayed behind. Abu Dharr set out with the army on his camel.',
    },
  },
  {
    id: 't02', sourced: true, sources: [KHARAIJ, AL_FAQIH],
    text: {
      ar: 'فتخلّفَ بأبي ذرّ جملُه، فعالجَه حتى أعياه أمرُه، فأخذَ رحلَه عنه وحملَه على ظهرِه، وتابعَ سيرَه ماشيًا على قدميه.',
      en: 'His camel fell behind and he struggled with it until it wore him out; so he took his baggage off it, carried it on his back, and went on walking on foot.',
    },
  },
  {
    id: 't03', sourced: true, sources: [KHARAIJ, AL_FAQIH],
    text: {
      ar: 'ونظرَ الناسُ فقالوا: يا رسولَ الله، هذا رجلٌ على الطريقِ وحدَه. فقال: كُنْ أبا ذرّ. فلمّا تأمّلوه قالوا: هو أبو ذرّ. فقال رسولُ الله: يرحمُ اللهُ أبا ذرّ، يمشي وحدَه، ويموتُ وحدَه، ويُبعثُ وحدَه.',
      en: 'People looked and said: "Messenger of God, there is a man on the road, alone." He said: "Let it be Abu Dharr." When they looked closer they said: "It is Abu Dharr." The Messenger of God said: "May God have mercy on Abu Dharr. He walks alone, he will die alone, and he will be raised alone."',
    },
  },
  {
    id: 't04', sourced: true, sources: [MESSAGE],
    text: {
      ar: 'وبلغَ الجيشُ تبوك، فلم يلقَ جيشًا للروم ولم يقعْ قتال، ثم عادَ إلى المدينة.',
      en: 'The army reached Tabuk. It met no Roman army, no battle was fought, and it returned to Medina.',
    },
  },
];

/** Good deeds the player can do. Each shows a Qur'an verse; the game never claims to know God's actual reward. */
export interface Deed { id: string; hasanat: number; title: L; verse: L; ref: L }

const Q6_160: L = { ar: 'سورة الأنعام ١٦٠', en: "Qur'an 6:160" };
export const hasanatRule = {
  text: { ar: '﴿مَن جَاءَ بِالْحَسَنَةِ فَلَهُ عَشْرُ أَمْثَالِهَا﴾', en: '"Whoever brings a good deed shall have ten times its like."' },
  ref: Q6_160,
};

export const deeds: Deed[] = [
  {
    id: 'water-herd', hasanat: 10,
    title: { ar: 'سقيتَ إبلَ الحيّ', en: 'You watered the camp’s camels' },
    verse: { ar: '﴿وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى﴾', en: '"Help one another in goodness and piety."' },
    ref: { ar: 'سورة المائدة ٢', en: "Qur'an 5:2" },
  },
  {
    id: 'raise-tent', hasanat: 10,
    title: { ar: 'أقمتَ خيمةَ أرملةٍ سقطت', en: 'You raised a widow’s fallen tent' },
    verse: { ar: '﴿وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى﴾', en: '"Help one another in goodness and piety."' },
    ref: { ar: 'سورة المائدة ٢', en: "Qur'an 5:2" },
  },
  {
    id: 'fill-waterskin', hasanat: 10,
    title: { ar: 'ملأتَ شَنّةَ أبي ذرّ للطريق', en: 'You filled Abu Dharr’s waterskin for the road' },
    verse: { ar: '﴿وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ﴾', en: '"Whatever good you send ahead for yourselves, you will find it with God."' },
    ref: { ar: 'سورة البقرة ١١٠', en: "Qur'an 2:110" },
  },
  {
    id: 'guard-camp', hasanat: 20,
    title: { ar: 'حرستَ القافلةَ من الذئاب', en: 'You guarded the camp from wolves' },
    verse: { ar: '﴿وَمَنْ أَحْيَاهَا فَكَأَنَّمَا أَحْيَا النَّاسَ جَمِيعًا﴾', en: '"Whoever saves a life, it is as if he saved all of mankind."' },
    ref: { ar: 'سورة المائدة ٣٢', en: "Qur'an 5:32" },
  },
  {
    id: 'repair-house', hasanat: 20,
    title: { ar: 'رمّمتَ جدارَ بيتِ فقير', en: 'You rebuilt a poor man’s wall' },
    verse: { ar: '﴿وَيُطْعِمُونَ الطَّعَامَ عَلَى حُبِّهِ مِسْكِينًا وَيَتِيمًا وَأَسِيرًا﴾', en: '"And they give food, despite their love for it, to the poor, the orphan and the captive."' },
    ref: { ar: 'سورة الإنسان ٨', en: "Qur'an 76:8" },
  },
  {
    id: 'give-water', hasanat: 10,
    title: { ar: 'سقيتَ عطشانَ عند البيت', en: 'You gave water to a thirsty man by the House' },
    verse: { ar: '﴿وَمَا تُنفِقُوا مِنْ خَيْرٍ فَإِنَّ اللَّهَ بِهِ عَلِيمٌ﴾', en: '"Whatever good you spend, God knows it well."' },
    ref: { ar: 'سورة البقرة ٢٧٣', en: "Qur'an 2:273" },
  },
  {
    id: 'secret-walk', hasanat: 30,
    title: { ar: 'كتمتَ السرَّ وتبعتَ عليًّا بحذر', en: 'You kept the secret and followed Ali with care' },
    verse: { ar: '﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾', en: '"God is with those who are patient."' },
    ref: { ar: 'سورة البقرة ١٥٣', en: "Qur'an 2:153" },
  },
  {
    id: 'irrigate', hasanat: 20,
    title: { ar: 'سقيتَ بستانَ نخيلٍ لأهل المدينة', en: 'You watered a palm garden for the people of Medina' },
    verse: { ar: '﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾', en: '"And We made every living thing from water."' },
    ref: { ar: 'سورة الأنبياء ٣٠', en: "Qur'an 21:30" },
  },
  {
    id: 'feed-poor', hasanat: 20,
    title: { ar: 'حملتَ التمرَ إلى فقراء المسجد', en: 'You carried dates to the poor at the mosque' },
    verse: { ar: '﴿وَيُطْعِمُونَ الطَّعَامَ عَلَى حُبِّهِ مِسْكِينًا وَيَتِيمًا وَأَسِيرًا﴾', en: '"And they give food, despite their love for it, to the poor, the orphan and the captive."' },
    ref: { ar: 'سورة الإنسان ٨', en: "Qur'an 76:8" },
  },
  {
    id: 'share-water', hasanat: 30,
    title: { ar: 'آثرتَ أبا ذرّ بالماء في الحرّ', en: 'You gave Abu Dharr your water in the heat' },
    verse: { ar: '﴿وَيُؤْثِرُونَ عَلَى أَنفُسِهِمْ وَلَوْ كَانَ بِهِمْ خَصَاصَةٌ﴾', en: '"And they prefer others over themselves, even when they are in need."' },
    ref: { ar: 'سورة الحشر ٩', en: "Qur'an 59:9" },
  },
  {
    id: 'carry-load', hasanat: 30,
    title: { ar: 'حملتَ بعضَ متاعِ أبي ذرّ', en: 'You carried part of Abu Dharr’s load' },
    verse: { ar: '﴿وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى﴾', en: '"Help one another in goodness and piety."' },
    ref: { ar: 'سورة المائدة ٢', en: "Qur'an 5:2" },
  },
  {
    id: 'shield', hasanat: 30,
    title: { ar: 'وقفتَ دونَ أبي ذرّ حين ثار عليه القوم', en: 'You stood by Abu Dharr when the crowd rose against him' },
    verse: { ar: '﴿وَمَا لَكُمْ لَا تُقَاتِلُونَ فِي سَبِيلِ اللَّهِ وَالْمُسْتَضْعَفِينَ﴾', en: '"And why should you not strive in the cause of God and of the oppressed?"' },
    ref: { ar: 'سورة النساء ٧٥', en: "Qur'an 4:75" },
  },
];

/** Objectives shown on screen; fiction unless marked. */
export const objectives = {
  herd: { ar: 'اسقِ إبلَ الحيّ من البئر.', en: 'Water the camp’s camels from the well.' },
  tent: { ar: 'خيمةُ أرملةٍ سقطت. احمل الأعمدةَ الثلاثة وأقمها.', en: 'A widow’s tent has fallen. Carry the three poles and raise it.' },
  unays: { ar: 'استقبلْ أُنيسًا عند مدخل الحيّ.', en: 'Meet Unays at the edge of the camp.' },
  skin: { ar: 'املأ شَنّةَ أبي ذرّ من البئر، ثم كلّمه لتنطلقا.', en: 'Fill Abu Dharr’s waterskin at the well, then speak to him to set out.' },
  road: { ar: 'سِرْ مع أبي ذرّ إلى مكّة ولا تبتعد عنه.', en: 'Walk with Abu Dharr to Mecca and stay close to him.' },
  wolves: { ar: 'ذئابٌ تحومُ حول المخيّم ليلًا. اطرُدها بعصاك.', en: 'Wolves are circling the night camp. Drive them off with your staff.' },
  meccaDay: { ar: 'أبو ذرّ ينتظرُ عند البيت. ساعدْ أهلَ مكّة حتى يحلّ الليل، ثم عُدْ إليه.', en: 'Abu Dharr waits by the House. Help the people of Mecca until nightfall, then return to him.' },
  follow: { ar: 'اتبعْ عليًّا من بعيد. إذا توقّف كأنّه يريق الماء فقِفْ واختبئ. لا تقترب كثيرًا ولا تتأخّر.', en: 'Follow Ali at a distance. If he stops as if pouring out water, stop and take cover. Don’t get too close or fall behind.' },
  shield: { ar: 'القومُ يثورون على أبي ذرّ. قِفْ دونه وادفعهم عنه حتى يصل العبّاس.', en: 'The crowd is rising against Abu Dharr. Stand by him and push them back until al-Abbas arrives.' },
  done: { ar: 'اكتمل الفصل الأوّل.', en: 'Chapter one complete.' },
  medinaArrive: { ar: 'ساعدْ أهلَ المدينة: اسقِ بستانَ النخيل، واحملِ التمرَ إلى فقراء المسجد.', en: 'Help the people of Medina: water the palm garden and carry dates to the poor at the mosque.' },
  medinaGarden: { ar: 'أبو ذرّ يبحثُ عن النبيّ. قيل إنّه في البستان الشماليّ.', en: 'Abu Dharr is looking for the Prophet. He was told he is in the northern garden.' },
  medinaMosque: { ar: 'في الصباح: ادخلْ مع أبي ذرّ إلى المسجد.', en: 'Morning: go with Abu Dharr into the mosque.' },
  tabukMarch: { ar: 'سِرْ مع أبي ذرّ خلف الجيش. راقبِ الماءَ والحرّ، واملأ القِربَ من الآبار.', en: 'March behind the army with Abu Dharr. Watch your water and the heat; refill at the wells.' },
  tabukStorm: { ar: 'عاصفةٌ رملية! ابقَ قريبًا من أبي ذرّ ولا تضلّ الطريق.', en: 'Sandstorm! Stay close to Abu Dharr and don’t lose the road.' },
  tabukCarry: { ar: 'تعبَ بعيرُ أبي ذرّ. احملْ بعضَ متاعه وأدركا الجيش.', en: 'Abu Dharr’s camel is worn out. Carry part of his load and catch up with the army.' },
  medinaDone: { ar: 'اكتمل فصل المدينة.', en: 'The Medina chapter is complete.' },
  tabukDone: { ar: 'اكتمل فصل طريق تبوك.', en: 'The road to Tabuk is complete.' },
} satisfies Record<string, L>;

/** Abu Dharr's path, in order. Positions are latitude/longitude for the journey map. */
export interface JourneyStop {
  id: string;
  chapter: number;
  title: L;
  place: L;
  date: L;
  summary: L;
  lat: number;
  lon: number;
  playable: boolean;
  /** Reported tradition rather than a sourced event. */
  tradition?: boolean;
}

export const journey: JourneyStop[] = [
  {
    id: 'seeker', chapter: 1, playable: true, lat: 22.6, lon: 39.2,
    title: { ar: 'الباحث عن الحقّ', en: 'The Seeker' },
    place: { ar: 'ديار غِفار ← مكّة ← غِفار', en: 'Ghifar → Mecca → Ghifar' },
    date: { ar: 'نحو ٦١٠–٦١٣ م', en: 'c. 610–613 CE' },
    summary: { ar: 'يسمع بالنبيّ، فيقصد مكّة، ويستضيفه عليّ ثلاث ليال، فيُسلم ويعلن إسلامه عند البيت، ثم يدعو قومه.', en: 'He hears of the Prophet, travels to Mecca, is Ali’s guest for three nights, accepts Islam and proclaims it at the House, then calls his people.' },
  },
  {
    id: 'medina', chapter: 2, playable: true, lat: 24.47, lon: 39.61,
    title: { ar: 'في صحبة النبيّ', en: 'Near the Prophet' },
    place: { ar: 'المدينة', en: 'Medina' },
    date: { ar: 'بعد الخندق، نحو ٦٢٧–٦٣٠ م', en: 'after the Trench, c. 627–630 CE' },
    summary: { ar: 'يلازم النبيّ ويتعلّم منه: قصة البستان، والوصيّة في المسجد: «إنّك منّا أهلَ البيت».', en: 'He stays close to the Prophet and learns: the garden, and the counsel in the mosque: “You are one of us, the People of the House.”' },
  },
  {
    id: 'tabuk', chapter: 3, playable: true, lat: 28.38, lon: 36.57,
    title: { ar: 'وحيدًا على طريق تبوك', en: 'Alone on the Road to Tabuk' },
    place: { ar: 'طريق تبوك', en: 'The road to Tabuk' },
    date: { ar: '٩ هـ / ٦٣٠ م', en: '9 AH / 630 CE' },
    summary: { ar: 'يعيا بعيرُه فيحمل متاعه ويمشي وحده، فيقول النبيّ: «يمشي وحده، ويموت وحده».', en: 'His camel gives out, he carries his load and walks alone, and the Prophet says: “He walks alone, and will die alone.”' },
  },
  {
    id: 'sham', chapter: 4, playable: false, lat: 33.51, lon: 36.29,
    title: { ar: 'صوتُ الفقراء في الشام', en: 'A Voice for the Poor in Sham' },
    place: { ar: 'دمشق', en: 'Damascus' },
    date: { ar: 'نحو ٦٤٥–٦٥١ م', en: 'c. 645–651 CE' },
    summary: { ar: 'ينكر كنز الذهب والفضة، ويردّ عطايا معاوية، فيكتب معاوية إلى عثمان.', en: 'He speaks against hoarding gold and silver and refuses Mu‘awiya’s gifts; Mu‘awiya writes to ‘Uthman.' },
  },
  {
    id: 'amil', chapter: 5, playable: false, tradition: true, lat: 33.3, lon: 35.4,
    title: { ar: 'في قرى جبل عامل', en: 'In the Villages of Jabal Amil' },
    place: { ar: 'الصرفند وميس الجبل', en: 'Sarafand and Mays al-Jabal' },
    date: { ar: 'نحو ٦٤٥–٦٥١ م (رواية متوارثة)', en: 'c. 645–651 CE (reported tradition)' },
    summary: { ar: 'يتوارث أهل جبل عامل أنّ تشيّعهم كان على يده، وله مقامان في الصرفند وميس.', en: 'The people of Jabal Amil hold that their love for the Ahl al-Bayt began with him; shrines at Sarafand and Mays carry his name.' },
  },
  {
    id: 'rabadhah', chapter: 6, playable: false, lat: 24.64, lon: 41.3,
    title: { ar: 'الوداع في الربذة', en: 'Farewell at al-Rabadhah' },
    place: { ar: 'الربذة', en: 'al-Rabadhah' },
    date: { ar: 'نحو ٦٥١–٦٥٣ م', en: 'c. 651–653 CE' },
    summary: { ar: 'يودّعه عليّ والحسن والحسين وعقيل وعمّار، ويموت وحيدًا، فيدفنه مالك الأشتر وأصحابه.', en: 'Ali, al-Hasan, al-Husayn, ‘Aqil and ‘Ammar bid him farewell; he dies alone, and Malik al-Ashtar and his companions bury him.' },
  },
];
