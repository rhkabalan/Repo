import type { Catalog, Chapter, ContentMeta, Mission } from './types.js';

/**
 * ATHAR — Abu Dharr al-Ghifari and the Interactive Historical Journey.
 *
 * Editorial rules (from the project brief):
 * - Historical accounts must point to identifiable sources. Missing details are not invented.
 * - Gameplay inventions (puzzles, the resting traveler) are marked `fictional`.
 * - Arabic must read naturally rather than follow English sentence structure, and be
 *   suitable for voiceover. Everything here is `draft` until it has had scholarly and
 *   language review.
 * - Choices shape gameplay and the journal's interpretation, never the historical events.
 */

const draft = (certainty: ContentMeta['certainty'], editorNote?: string): ContentMeta => ({
  certainty,
  review: 'draft',
  ...(editorNote ? { editorNote } : {}),
});

const SOURCES_PENDING =
  'Copy the source references used by the prototype discovery panel here before release.';

const mecca: Mission = {
  id: 'mecca-searching-for-the-story',
  title: { ar: 'البحث عن الحكاية', en: 'Searching for the story' },
  summary: {
    ar: 'يصل أبو ذرٍّ إلى مكة باحثًا عن النبي ﷺ. استكشف الأزقّة، واجمع الروايات، ورتّب أحداث القصة.',
    en: 'Abu Dharr arrives in Mecca searching for the Prophet. Explore, gather the accounts, and put the story in order.',
  },
  areas: [
    {
      id: 'hospitality-lane',
      name: { ar: 'زقاق الضيافة', en: 'Hospitality Lane' },
      meta: draft('fictional', 'Gameplay space, not a reconstruction of a specific historical location.'),
    },
    {
      id: 'meeting-courtyard',
      name: { ar: 'ساحة اللقاء', en: 'Meeting Courtyard' },
      unlockedBy: 'passage',
      meta: draft('fictional', 'Gameplay space, not a reconstruction of a specific historical location.'),
    },
  ],
  discoveries: [
    {
      id: 'ali-hospitality',
      areaId: 'hospitality-lane',
      title: { ar: 'ضيافة عليٍّ لأبي ذرّ', en: "Ali's hospitality toward Abu Dharr" },
      body: {
        ar: 'قبل أن يلتقي أبو ذرٍّ بالنبي ﷺ، استضافه عليٌّ وآواه، ثم دلّه على الطريق إليه.',
        en: 'Before Abu Dharr met the Prophet, Ali took him in as a guest and then guided him on the way.',
      },
      sources: [],
      xp: 20,
      meta: draft('sourced', SOURCES_PENDING),
    },
    {
      id: 'public-declaration',
      areaId: 'meeting-courtyard',
      title: { ar: 'إعلان أبي ذرٍّ إسلامه جهرًا', en: "Abu Dharr's public declaration of faith" },
      body: {
        ar: 'أعلن أبو ذرٍّ إسلامه على الملأ، فنالَه في سبيل ذلك أذىً شديد.',
        en: 'Abu Dharr declared his faith in public, and suffered harm for doing so.',
      },
      sources: [],
      xp: 20,
      meta: draft('sourced', SOURCES_PENDING),
    },
  ],
  puzzles: [
    {
      id: 'passage',
      kind: 'sequence',
      areaId: 'hospitality-lane',
      prompt: {
        ar: 'اختر الرموز الثلاثة بالترتيب الصحيح لتفتح الممرّ.',
        en: 'Choose the three symbols in the right order to open the passage.',
      },
      options: [
        { id: 'sun', label: { ar: 'الشمس', en: 'Sun' } },
        { id: 'shelter', label: { ar: 'المأوى', en: 'Shelter' } },
        { id: 'water', label: { ar: 'الماء', en: 'Water' } },
      ],
      solution: ['sun', 'shelter', 'water'],
      requiresDiscoveries: [],
      xp: 20,
      meta: draft('fictional', 'Gameplay puzzle; not presented as a historical event.'),
    },
    {
      id: 'story-order',
      kind: 'sequence',
      areaId: 'meeting-courtyard',
      prompt: {
        ar: 'رتّب أحداث القصة كما وقعت.',
        en: 'Put the events of the story in the order they happened.',
      },
      options: [
        { id: 'arrival', label: { ar: 'يصل أبو ذرٍّ إلى مكة', en: 'Abu Dharr arrives in Mecca' } },
        {
          id: 'ali-welcome',
          label: { ar: 'يستضيفه عليٌّ ويدلّه على النبي ﷺ', en: 'Ali welcomes him and guides him to the Prophet' },
        },
        {
          id: 'declaration',
          label: { ar: 'يعلن أبو ذرٍّ إسلامه عند الكعبة', en: 'Abu Dharr publicly declares his faith at the Kaaba' },
        },
      ],
      solution: ['arrival', 'ali-welcome', 'declaration'],
      requiresDiscoveries: ['ali-hospitality', 'public-declaration'],
      xp: 0,
      meta: draft('sourced', 'Event order follows the two accounts above.'),
    },
  ],
  choices: [
    {
      id: 'guide-approach',
      prompt: { ar: 'كيف تريد أن يساعدك الدليل؟', en: 'How would you like the guide to help you?' },
      options: [
        {
          id: 'route-board',
          label: { ar: 'أتّبع إشارة لوحة الطريق', en: 'Follow the route-board clue' },
          skills: { observation: 1 },
        },
        {
          id: 'verbal-clue',
          label: { ar: 'أسمع الإشارة وأعتمد على ذاكرتي', en: 'Hear a spoken clue and rely on memory' },
          skills: { memory: 1 },
        },
      ],
      requiredForCompletion: false,
      meta: draft('fictional', 'Changes the help available in the passage puzzle.'),
    },
    {
      id: 'journal-emphasis',
      prompt: {
        ar: 'أيُّ جانبٍ من القصة تريد أن تبرزه في يومياتك؟',
        en: 'Which part of the story do you want your journal to emphasise?',
      },
      requiresPuzzle: 'story-order',
      options: [
        {
          id: 'hospitality',
          label: { ar: 'الضيافة والإيواء', en: 'Hospitality and shelter' },
          journal: {
            ar: 'بدأت رحلة أبي ذرٍّ ببابٍ فُتح لغريب.',
            en: "Abu Dharr's journey began with a door opened to a stranger.",
          },
          skills: { empathy: 1 },
        },
        {
          id: 'courage',
          label: { ar: 'الجرأة في قول الحق', en: 'Courage to speak the truth' },
          journal: {
            ar: 'لم يُخفِ أبو ذرٍّ ما آمن به، بل أعلنه أمام الناس.',
            en: 'Abu Dharr did not hide what he believed; he declared it in front of everyone.',
          },
          skills: { courage: 1 },
        },
        {
          id: 'steadfastness',
          label: { ar: 'الثبات رغم الأذى', en: 'Steadfastness despite harm' },
          journal: {
            ar: 'لقي أبو ذرٍّ الأذى، فثبت على ما آمن به.',
            en: 'Abu Dharr met with harm and held firm to his faith.',
          },
          skills: { steadfastness: 1 },
        },
      ],
      requiredForCompletion: true,
      meta: draft('sourced', 'Options are interpretive emphases of the sourced accounts, not alternative events.'),
    },
  ],
  tasks: [
    {
      id: 'water-delivery',
      title: { ar: 'سقاية المسافر', en: 'Water for the traveler' },
      description: {
        ar: 'احمل الماء إلى المسافر المستريح. امشِ بهدوء، فالركض يُريق الماء.',
        en: 'Carry water to the resting traveler. Walk carefully — running spills it.',
      },
      goal: 3,
      xp: 20,
      badge: 'compassion',
      meta: draft('fictional', 'The traveler and task are invented gameplay. Goal of 3 deliveries to be confirmed against the prototype.'),
    },
  ],
  completionRequiresPuzzles: ['passage', 'story-order'],
  completionXp: 40,
  completionBadge: 'chapter-mecca',
};

/** Chapters still in the earlier prototype format: explore, collect clues, make a choice. */
function legacyChapter(
  order: number,
  id: string,
  setting: Chapter['setting'],
  title: Chapter['title'],
): Chapter {
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
      areas: [{ id: `${id}-main`, name: setting, meta: draft('fictional') }],
      discoveries: [],
      puzzles: [],
      choices: [],
      tasks: [],
      completionRequiresPuzzles: [],
      completionXp: 40,
      completionBadge: `chapter-${id}`,
    },
  };
}

export const catalog: Catalog = {
  version: 1,
  chapters: [
    {
      id: 'mecca',
      order: 1,
      setting: { ar: 'مكة', en: 'Mecca' },
      title: { ar: 'البحث عن الحكاية', en: 'Searching for the story' },
      format: 'expanded',
      mission: mecca,
    },
    legacyChapter(2, 'medina', { ar: 'المدينة', en: 'Medina' }, { ar: 'سؤالٌ في المسجد', en: 'A question in the mosque' }),
    legacyChapter(3, 'tabuk', { ar: 'الطريق إلى تبوك', en: 'Road to Tabuk' }, { ar: 'خطى في الصحراء', en: 'Steps through the desert' }),
    legacyChapter(4, 'sham', { ar: 'الشام', en: 'Al-Sham' }, { ar: 'تساؤلات حول المال', en: 'Questions about wealth' }),
    legacyChapter(5, 'rabadhah', { ar: 'الربذة', en: 'Al-Rabadhah' }, { ar: 'وداعٌ وتأمّل', en: 'Farewell and reflection' }),
  ],
  skills: [
    { id: 'observation', name: { ar: 'الملاحظة', en: 'Observation' }, description: { ar: 'قراءة الإشارات والعلامات من حولك.', en: 'Reading the signs around you.' } },
    { id: 'memory', name: { ar: 'الذاكرة', en: 'Memory' }, description: { ar: 'حفظ ما تسمعه والعودة إليه.', en: 'Remembering what you hear.' } },
    { id: 'empathy', name: { ar: 'التعاطف', en: 'Empathy' }, description: { ar: 'الإحساس بحاجة الآخرين.', en: 'Sensing what others need.' } },
    { id: 'courage', name: { ar: 'الشجاعة', en: 'Courage' }, description: { ar: 'قول الحق دون تردّد.', en: 'Speaking the truth without hesitation.' } },
    { id: 'steadfastness', name: { ar: 'الثبات', en: 'Steadfastness' }, description: { ar: 'الصبر على المبدأ رغم الصعاب.', en: 'Holding to principle through hardship.' } },
  ],
  badges: [
    { id: 'compassion', name: { ar: 'وسام الرحمة', en: 'Compassion' }, description: { ar: 'أوصلتَ الماء إلى المسافر المتعب.', en: 'You brought water to the weary traveler.' } },
    { id: 'chapter-mecca', name: { ar: 'وسام مكة', en: 'Mecca' }, description: { ar: 'أتممتَ فصل مكة.', en: 'Completed the Mecca chapter.' } },
    { id: 'chapter-medina', name: { ar: 'وسام المدينة', en: 'Medina' }, description: { ar: 'أتممتَ فصل المدينة.', en: 'Completed the Medina chapter.' } },
    { id: 'chapter-tabuk', name: { ar: 'وسام تبوك', en: 'Tabuk' }, description: { ar: 'أتممتَ فصل الطريق إلى تبوك.', en: 'Completed the Road to Tabuk chapter.' } },
    { id: 'chapter-sham', name: { ar: 'وسام الشام', en: 'Al-Sham' }, description: { ar: 'أتممتَ فصل الشام.', en: 'Completed the Al-Sham chapter.' } },
    { id: 'chapter-rabadhah', name: { ar: 'وسام الربذة', en: 'Al-Rabadhah' }, description: { ar: 'أتممتَ فصل الربذة.', en: 'Completed the Al-Rabadhah chapter.' } },
  ],
};
