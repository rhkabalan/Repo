import type { Catalog, Chapter, ContentMeta, Mission, SourceRef } from './types.js';

/**
 * ATHAR — Abu Dharr al-Ghifari and the Interactive Historical Journey.
 *
 * Design rule: the player is a FICTIONAL traveler following Abu Dharr's journey. All
 * action (training, fights, stealth, obstacles) belongs to that traveler and to clearly
 * fictional characters. Abu Dharr appears only in sourced historical scenes, and no battle
 * or violent act is invented for him.
 *
 * Editorial rules (from the project brief):
 * - Historical accounts point to identifiable sources. Missing details are not invented.
 * - Gameplay inventions are marked `fictional`; reported traditions needing corroboration
 *   are marked `uncertain`.
 * - Arabic reads naturally and suits voiceover. Everything is `draft` until reviewed.
 * - Choices change rewards, resources and routes, never the documented history.
 */

const draft = (certainty: ContentMeta['certainty'], editorNote?: string): ContentMeta => ({
  certainty,
  review: 'draft',
  ...(editorNote ? { editorNote } : {}),
});

const fictional = (note = 'Original gameplay content for the fictional traveler; not historical.') => draft('fictional', note);

/** Primary research sources supplied by the project team. */
export const SOURCES = {
  greatCompanion: {
    id: 'great-companion',
    citation: {
      ar: 'الصحابي الجليل أبو ذر — منشورات المعهد الإسلامي (Islamic Seminary Publications)',
      en: 'The Great Companion of the Prophet — Abu Dharr (Islamic Seminary Publications)',
    },
    note: {
      ar: 'تجميع متأخر؛ تُراجَع التفاصيل على المراجع التي يستند إليها.',
      en: 'A later compilation; details are checked against the references it cites.',
    },
  },
} satisfies Record<string, SourceRef>;

const mecca: Mission = {
  id: 'mecca-arrival',
  title: { ar: 'الطريق إلى الحكاية', en: 'The road to the story' },
  summary: {
    ar: 'تصل مسافرًا إلى مكة، فتتدرّب، وتستكشف الأحياء، وتجد طريقك إلى الساحة حيث تبدأ حكاية أبي ذر.',
    en: 'You arrive in Mecca as a traveler: train, explore the district, and find your way to the courtyard where Abu Dharr’s story begins.',
  },
  areas: [
    { id: 'training-yard', name: { ar: 'ساحة التدريب', en: 'Training Yard' }, meta: fictional() },
    { id: 'market-lane', name: { ar: 'زقاق السوق', en: 'Market Lane' }, meta: fictional('Gameplay space, not a reconstruction of a specific location.') },
    { id: 'back-alley', name: { ar: 'الزقاق الخلفي', en: 'Back Alley' }, meta: fictional() },
    { id: 'back-route', name: { ar: 'الممرّ المنهار', en: 'Collapsed Passage' }, unlockedBy: 'collapsed-passage', meta: fictional() },
    {
      id: 'meeting-courtyard',
      name: { ar: 'ساحة اللقاء', en: 'Meeting Courtyard' },
      unlockedByEncounter: 'extortioners',
      meta: fictional('Gameplay space framing the sourced scene; not a reconstruction.'),
    },
  ],
  discoveries: [
    {
      id: 'arrival-hospitality',
      areaId: 'meeting-courtyard',
      title: { ar: 'وصول أبي ذرّ وضيافة عليّ', en: 'Abu Dharr’s arrival and Ali’s hospitality' },
      body: {
        ar: 'جاء أبو ذرٍّ إلى مكة باحثًا عن النبي ﷺ. رآه عليٌّ غريبًا فاستضافه، ثم دلّه على الطريق إليه.',
        en: 'Abu Dharr came to Mecca searching for the Prophet. Ali saw that he was a stranger, took him in as a guest, and later guided him on the way.',
      },
      sources: [SOURCES.greatCompanion],
      xp: 30,
      badge: 'history-arrival',
      meta: draft('sourced', 'Confirm the exact chapter and passage, and check it against the references the biography cites.'),
    },
  ],
  puzzles: [
    {
      id: 'collapsed-passage',
      kind: 'mechanism',
      areaId: 'back-alley',
      prompt: {
        ar: 'ادفع الصناديق فوق الحجرين لترتفع البوابة المعلّقة.',
        en: 'Push the crates onto both pressure stones to raise the counterweight gate.',
      },
      requiresDiscoveries: [],
      xp: 20,
      meta: fictional('Environmental puzzle.'),
    },
  ],
  choices: [
    {
      id: 'journal-emphasis',
      prompt: { ar: 'ماذا تكتب في يومياتك عن هذه الحكاية؟', en: 'What will you write in your journal about this story?' },
      options: [
        {
          id: 'hospitality',
          label: { ar: 'ضيافة الغريب', en: 'Welcoming a stranger' },
          journal: { ar: 'رأيتُ كيف يُفتح البيت لغريبٍ لا يعرفه أحد.', en: 'I saw how a home can open to a stranger no one knows.' },
          skills: { empathy: 1 },
        },
        {
          id: 'seeking',
          label: { ar: 'البحث عن الحقيقة', en: 'Searching for the truth' },
          journal: { ar: 'قطع أبو ذرٍّ الطريق بحثًا عمّا آمن أنه الحق.', en: 'Abu Dharr crossed the desert to find what he believed was the truth.' },
          skills: { courage: 1 },
        },
      ],
      requiredForCompletion: false,
      meta: draft('sourced', 'Interpretive emphases of the sourced account, not alternative events.'),
    },
  ],
  tasks: [
    {
      id: 'merchant-goods',
      title: { ar: 'بضاعة التاجر', en: 'The merchant’s goods' },
      description: {
        ar: 'أضاع تاجرٌ صرّة بضاعته في الأزقّة. أعِدها إليه.',
        en: 'A merchant lost a bundle of goods in the alleys. Bring it back to him.',
      },
      goal: 1,
      xp: 15,
      consumes: { 'merchant-bundle': 1 },
      rewards: { 'side-gate-key': 1 },
      meta: fictional(),
    },
    {
      id: 'water-delivery',
      title: { ar: 'سقاية المسافر', en: 'Water for the traveler' },
      description: {
        ar: 'مسافرٌ متعبٌ يستريح في الظل. أعطه من مائك.',
        en: 'A weary traveler rests in the shade. Share your water with him.',
      },
      goal: 2,
      xp: 20,
      badge: 'compassion',
      consumes: { water: 1 },
      meta: fictional(),
    },
  ],
  collectibles: [
    { id: 'water-1', areaId: 'market-lane', item: 'water', amount: 1, xp: 2, meta: fictional() },
    { id: 'water-2', areaId: 'back-alley', item: 'water', amount: 1, xp: 2, meta: fictional() },
    { id: 'water-3', areaId: 'training-yard', item: 'water', amount: 1, xp: 2, meta: fictional() },
    { id: 'provisions-1', areaId: 'market-lane', item: 'provisions', amount: 1, xp: 2, meta: fictional() },
    { id: 'provisions-2', areaId: 'back-route', item: 'provisions', amount: 1, xp: 2, meta: fictional() },
    { id: 'wood-1', areaId: 'back-alley', item: 'wood', amount: 2, xp: 2, meta: fictional() },
    { id: 'wood-2', areaId: 'training-yard', item: 'wood', amount: 1, xp: 2, meta: fictional() },
    { id: 'rope-1', areaId: 'market-lane', item: 'rope', amount: 1, xp: 2, meta: fictional() },
    { id: 'rope-2', areaId: 'back-route', item: 'rope', amount: 1, xp: 2, meta: fictional() },
    { id: 'merchant-bundle', areaId: 'back-alley', item: 'merchant-bundle', amount: 1, xp: 0, meta: fictional() },
    {
      id: 'fragment-1',
      areaId: 'market-lane',
      item: 'fragment',
      amount: 1,
      title: { ar: 'من يومياتي: وصول', en: 'From my journal: arrival' },
      text: {
        ar: 'وصلتُ مكة مع القافلة. الأسواق مزدحمة، والناس يتحدّثون همسًا عن أمرٍ جديد.',
        en: 'I reached Mecca with the caravan. The markets are crowded, and people speak in whispers about something new.',
      },
      xp: 5,
      meta: fictional('The traveler’s own notes; atmosphere only, not a historical claim.'),
    },
    {
      id: 'fragment-2',
      areaId: 'back-alley',
      item: 'fragment',
      amount: 1,
      title: { ar: 'من يومياتي: الغريب', en: 'From my journal: the stranger' },
      text: {
        ar: 'سمعتُ أن رجلًا من غِفار جاء يسأل بهدوءٍ عن رجلٍ في مكة. سأتبع الحكاية.',
        en: 'I heard that a man from Ghifar has come, quietly asking about someone in Mecca. I will follow the story.',
      },
      xp: 5,
      meta: fictional('Framing for the sourced scene; points the player toward it.'),
    },
    {
      id: 'fragment-3',
      areaId: 'back-route',
      item: 'fragment',
      amount: 1,
      title: { ar: 'من يومياتي: الطرق الخفية', en: 'From my journal: hidden ways' },
      text: {
        ar: 'لكل حيٍّ طرقٌ لا يعرفها إلا أهله. من صبر وجد طريقًا.',
        en: 'Every district has paths only its people know. Whoever is patient finds a way through.',
      },
      xp: 5,
      meta: fictional(),
    },
  ],
  encounters: [
    {
      id: 'staff-training',
      areaId: 'training-yard',
      title: { ar: 'التدريب بالعصا', en: 'Staff training' },
      description: {
        ar: 'تدرّب مع معلّم الساحة: اضرب، وصُدّ، وتفادَ.',
        en: 'Spar with the yard master: strike, block and dodge.',
      },
      methods: ['fight'],
      rewards: { fight: { xp: 20 } },
      requiredForCompletion: true,
      meta: fictional('Training sparring; nobody is hurt.'),
    },
    {
      id: 'extortioners',
      areaId: 'market-lane',
      title: { ar: 'قُطّاع الزقاق', en: 'The lane extortioners' },
      description: {
        ar: 'عصابةٌ تسدّ الطريق إلى الساحة وتفرض الإتاوات. واجههم، أو تسلّل من ورائهم، أو جد طريقًا آخر.',
        en: 'A gang blocks the way to the courtyard, demanding payment. Face them, slip past them, or find another way.',
      },
      methods: ['fight', 'sneak', 'route'],
      rewards: {
        fight: { xp: 30, items: { wood: 1 } },
        sneak: { xp: 30 },
        route: { xp: 30, items: { provisions: 1 } },
      },
      requires: { route: { 'side-gate-key': 1 } },
      requiredForCompletion: true,
      meta: fictional('Fictional obstacle for the traveler; non-graphic: opponents yield and flee.'),
    },
  ],
  completionRequiresPuzzles: [],
  completionRequiresDiscoveries: ['arrival-hospitality'],
  completionXp: 40,
  completionBadge: 'chapter-mecca',
};

/** Chapters still waiting for their adventure build. */
function shellChapter(order: number, id: string, setting: Chapter['setting'], title: Chapter['title'], note: string): Chapter {
  return {
    id,
    order,
    setting,
    title,
    format: 'legacy',
    mission: {
      id: `${id}-journey`,
      title,
      summary: title,
      areas: [{ id: `${id}-main`, name: setting, meta: draft('fictional', note) }],
      discoveries: [],
      puzzles: [],
      choices: [],
      tasks: [],
      collectibles: [],
      encounters: [],
      completionRequiresPuzzles: [],
      completionRequiresDiscoveries: [],
      completionXp: 40,
      completionBadge: `chapter-${id}`,
    },
  };
}

export const catalog: Catalog = {
  version: 2,
  chapters: [
    { id: 'mecca', order: 1, setting: { ar: 'مكة', en: 'Mecca' }, title: mecca.title, format: 'expanded', mission: mecca },
    shellChapter(2, 'ghifar', { ar: 'ديار غِفار', en: 'Among Ghifar' }, { ar: 'العودة إلى القوم', en: 'Return to his people' },
      'Research: The Great Companion, ch. 3 (return from Mecca and teaching among Ghifar).'),
    shellChapter(3, 'medina', { ar: 'المدينة', en: 'Medina' }, { ar: 'سؤالٌ في المسجد', en: 'A question in the mosque' },
      'Research: The Great Companion, ch. 4 (move to Medina).'),
    shellChapter(4, 'tabuk', { ar: 'الطريق إلى تبوك', en: 'Road to Tabuk' }, { ar: 'خطى في الصحراء', en: 'Steps through the desert' },
      'Survival/endurance chapter. No battle took place at Tabuk (The Message, ch. 53): no Roman battle may be depicted.'),
    shellChapter(5, 'sham', { ar: 'الشام وجبل عامل', en: 'Al-Sham and Jabal Amil' }, { ar: 'تساؤلات حول المال', en: 'Questions about wealth' },
      'Research: The Great Companion, ch. 14. Jabal Amil (Sarfand, Mays) is a reported tradition requiring corroboration.'),
    shellChapter(6, 'rabadhah', { ar: 'الربذة', en: 'Al-Rabadhah' }, { ar: 'وداعٌ وتأمّل', en: 'Farewell and reflection' },
      'Research: Nahj al-Balagha, Sermon 130 (keep the sermon separate from later footnotes).'),
  ],
  skills: [
    { id: 'empathy', name: { ar: 'التعاطف', en: 'Empathy' }, description: { ar: 'الإحساس بحاجة الآخرين.', en: 'Sensing what others need.' } },
    { id: 'courage', name: { ar: 'الشجاعة', en: 'Courage' }, description: { ar: 'المضيّ في طلب الحق.', en: 'Pressing on in search of the truth.' } },
  ],
  badges: [
    { id: 'compassion', category: 'adventure', name: { ar: 'وسام الرحمة', en: 'Compassion' }, description: { ar: 'سقيتَ المسافر المتعب.', en: 'You shared water with a weary traveler.' } },
    { id: 'chapter-mecca', category: 'adventure', name: { ar: 'وسام مكة', en: 'Mecca' }, description: { ar: 'أتممتَ رحلة مكة.', en: 'Completed the Mecca journey.' } },
    { id: 'chapter-ghifar', category: 'adventure', name: { ar: 'وسام غِفار', en: 'Ghifar' }, description: { ar: 'أتممتَ رحلة ديار غِفار.', en: 'Completed the Ghifar journey.' } },
    { id: 'chapter-medina', category: 'adventure', name: { ar: 'وسام المدينة', en: 'Medina' }, description: { ar: 'أتممتَ رحلة المدينة.', en: 'Completed the Medina journey.' } },
    { id: 'chapter-tabuk', category: 'adventure', name: { ar: 'وسام تبوك', en: 'Tabuk' }, description: { ar: 'أتممتَ الطريق إلى تبوك.', en: 'Completed the road to Tabuk.' } },
    { id: 'chapter-sham', category: 'adventure', name: { ar: 'وسام الشام', en: 'Al-Sham' }, description: { ar: 'أتممتَ رحلة الشام.', en: 'Completed the Al-Sham journey.' } },
    { id: 'chapter-rabadhah', category: 'adventure', name: { ar: 'وسام الربذة', en: 'Al-Rabadhah' }, description: { ar: 'أتممتَ رحلة الربذة.', en: 'Completed the Al-Rabadhah journey.' } },
    { id: 'history-arrival', category: 'history', name: { ar: 'فهم: الوصول إلى مكة', en: 'Understanding: arrival in Mecca' }, description: { ar: 'اكتشفتَ رواية وصول أبي ذرٍّ وضيافة عليّ.', en: 'You discovered the account of Abu Dharr’s arrival and Ali’s hospitality.' } },
  ],
  items: [
    { id: 'water', kind: 'water', name: { ar: 'قربة ماء', en: 'Water skin' }, baseCapacity: 3, capacityPerLevel: 2 },
    { id: 'provisions', kind: 'provisions', name: { ar: 'زاد', en: 'Provisions' }, baseCapacity: 3, capacityPerLevel: 2 },
    { id: 'wood', kind: 'material', name: { ar: 'خشب', en: 'Wood' }, baseCapacity: 10, capacityPerLevel: 5 },
    { id: 'rope', kind: 'material', name: { ar: 'حبل', en: 'Rope' }, baseCapacity: 10, capacityPerLevel: 5 },
    { id: 'merchant-bundle', kind: 'key', name: { ar: 'صرّة التاجر', en: 'Merchant’s bundle' }, baseCapacity: 1, capacityPerLevel: 0 },
    { id: 'side-gate-key', kind: 'key', name: { ar: 'مفتاح الباب الجانبي', en: 'Side-gate key' }, baseCapacity: 1, capacityPerLevel: 0 },
  ],
  upgrades: [
    {
      id: 'stamina',
      name: { ar: 'الجَلَد', en: 'Stamina' },
      description: { ar: 'تركض وتتفادى أطول.', en: 'Run and dodge for longer.' },
      costs: [{ provisions: 2 }, { provisions: 3 }, { provisions: 4 }],
    },
    {
      id: 'defense',
      name: { ar: 'الدفاع', en: 'Defense' },
      description: { ar: 'تتحمّل الضربات أكثر.', en: 'Take blows better.' },
      costs: [{ wood: 2, rope: 1 }, { wood: 3, rope: 2 }, { wood: 4, rope: 3 }],
    },
    {
      id: 'exploration',
      name: { ar: 'الاستكشاف', en: 'Exploration' },
      description: { ar: 'تكشف الخريطة الأشياء المخفية القريبة.', en: 'Your map reveals nearby hidden items.' },
      costs: [{ rope: 1, wood: 1 }, { rope: 2, wood: 2 }],
    },
    {
      id: 'capacity',
      name: { ar: 'السعة', en: 'Capacity' },
      description: { ar: 'تحمل ماءً وزادًا ومواد أكثر.', en: 'Carry more water, provisions and materials.' },
      costs: [{ rope: 2 }, { rope: 3, wood: 2 }],
    },
  ],
};
