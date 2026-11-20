using System.Collections.Generic;
using UnityEngine;

namespace Athar.Core
{
    public enum Lang { Ar, En }

    /// <summary>UI strings in Arabic and English. Game content comes from the catalog.</summary>
    public static class Loc
    {
        public static Lang Current { get; private set; } = Lang.Ar;
        public static bool Rtl => Current == Lang.Ar;
        public static event System.Action Changed;

        public static void Init()
        {
            var saved = PlayerPrefs.GetString("athar.lang", "");
            Current = saved == "en" ? Lang.En : saved == "ar" ? Lang.Ar
                : Application.systemLanguage == SystemLanguage.Arabic ? Lang.Ar : Lang.En;
        }

        public static void Set(Lang lang)
        {
            Current = lang;
            PlayerPrefs.SetString("athar.lang", lang == Lang.Ar ? "ar" : "en");
            Changed?.Invoke();
        }

        public static string T(string key) =>
            Strings.TryGetValue(key, out var s) ? (Current == Lang.Ar ? s.ar : s.en) : key;

        public static string Of(LText text) => text == null ? "" : text.Get(Current);

        static readonly Dictionary<string, (string ar, string en)> Strings = new()
        {
            ["title"] = ("أثر", "ATHAR"),
            ["subtitle"] = ("أبو ذرٍّ الغفاري — رحلة تفاعلية في التاريخ", "Abu Dharr al-Ghifari — an interactive historical journey"),
            ["play"] = ("ابدأ الرحلة", "Begin the journey"),
            ["continue"] = ("متابعة", "Continue"),
            ["close"] = ("إغلاق", "Close"),
            ["back"] = ("رجوع", "Back"),
            ["language"] = ("English", "العربية"),
            ["objective"] = ("المهمة", "Objective"),
            ["hint"] = ("تلميح", "Hint"),
            ["xp"] = ("نقطة خبرة", "XP"),
            ["attack"] = ("اضرب", "Attack"),
            ["block"] = ("صُدّ", "Block"),
            ["dodge"] = ("تفادَ", "Dodge"),
            ["sneak"] = ("تسلّل", "Sneak"),
            ["interact"] = ("تفاعل", "Interact"),
            ["parry"] = ("صدٌّ متقن!", "Parry!"),
            ["spotted"] = ("لقد رأوك!", "You’ve been spotted!"),
            ["overwhelmed"] = ("غُلبتَ هذه المرة. حاول مرة أخرى.", "You were overwhelmed. Try again."),
            ["sneakedPast"] = ("تسلّلتَ دون أن يراك أحد", "You slipped past unseen"),
            ["tookRoute"] = ("سلكتَ الطريق الجانبي", "You took the side way"),
            ["wonFight"] = ("تفرّقت العصابة", "The gang scattered"),
            ["fullBag"] = ("لا مكان لحمل المزيد", "No room to carry more"),
            ["collected"] = ("حصلتَ على", "Collected"),
            ["journal"] = ("اليوميات", "Journal"),
            ["restPoint"] = ("محطة الراحة", "Rest point"),
            ["restored"] = ("استعدتَ قواك", "You feel restored"),
            ["upgrade"] = ("حسّن", "Upgrade"),
            ["maxLevel"] = ("أعلى مستوى", "Max level"),
            ["historicalAccount"] = ("رواية تاريخية", "Historical account"),
            ["sources"] = ("المصادر", "Sources"),
            ["certainty_sourced"] = ("رواية موثّقة", "Sourced account"),
            ["certainty_uncertain"] = ("تفصيل غير محسوم", "Unresolved detail"),
            ["certainty_fictional"] = ("عنصر لعب متخيَّل", "Fictional gameplay element"),
            ["fictionalNote"] = ("هذه المغامرة من نسج اللعبة. الروايات التاريخية تظهر منفصلة ومعها مصادرها.", "This adventure is fictional. Historical accounts appear separately, with their sources."),
            ["needKey"] = ("الباب مقفل. ربما يملك أحدهم المفتاح.", "The door is locked. Someone may have the key."),
            ["leverReset"] = ("عادت الصناديق إلى أماكنها", "The crates slide back into place"),
            ["gateRaised"] = ("ارتفعت البوابة المعلّقة!", "The counterweight gate rises!"),
            ["trainingStart"] = ("ابدأ التدريب", "Start training"),
            ["missionComplete"] = ("اكتملت المهمة", "Mission complete"),
            ["nextChapter"] = ("إلى الفصل التالي", "Continue to the next chapter"),
            ["keepExploring"] = ("واصل الاستكشاف", "Keep exploring"),
            ["resolve"] = ("العزيمة", "Resolve"),
            ["stamina"] = ("الجَلَد", "Stamina"),
            ["controlsHelp"] = ("لوحة المفاتيح: WASD للحركة، Shift للركض، J أو النقر للضرب، K أو الزر الأيمن للصدّ، المسافة للتفادي، C للتسلّل، E للتفاعل.",
                "Keyboard: WASD to move, Shift to run, J or click to attack, K or right-click to block, Space to dodge, C to sneak, E to interact."),
            // Fictional characters' lines.
            ["trainer.name"] = ("معلّم الساحة", "The yard master"),
            ["trainer.intro"] = ("أهلًا أيها المسافر. الطرق خطرة هذه الأيام. خذ هذه العصا وتعلّم: اضرب، وصُدّ قبل الضربة مباشرةً لتكسر هجوم خصمك، وتفادَ حين ترى الحلقة الحمراء.",
                "Welcome, traveler. The roads are dangerous these days. Take this staff and learn: strike, block just before a blow lands to break your opponent’s attack, and dodge when you see the red ring."),
            ["trainer.done"] = ("أحسنت. أنت جاهز للطريق. الساحة الكبرى في آخر السوق.", "Well done. You are ready for the road. The great courtyard is at the end of the market."),
            ["rest.intro"] = ("استرح هنا، وحسّن عتادك بما جمعت من مواد.", "Rest here, and improve your gear with the materials you have gathered."),
            ["traveler.name"] = ("مسافر مستريح", "A resting traveler"),
            ["traveler.thirsty"] = ("طال بي الطريق والحرّ شديد… هل معك ماء؟", "The road was long and the heat is fierce… do you have any water?"),
            ["traveler.thanks"] = ("جزاك الله خيرًا.", "May God reward you."),
            ["merchant.name"] = ("تاجر", "A merchant"),
            ["merchant.ask"] = ("أضعتُ صرّة بضاعتي في الأزقّة الخلفية. إن أعدتَها أعطيتك مفتاح الباب الجانبي للساحة؛ فالعصابة تسدّ الطريق الرئيسي.",
                "I lost my bundle of goods in the back alleys. Bring it back and I’ll give you the key to the courtyard’s side door; the gang is blocking the main way."),
            ["merchant.thanks"] = ("صرّتي! خذ المفتاح، الباب الجانبي في الجدار يسار البوابة.", "My bundle! Take the key. The side door is in the wall left of the gate."),
            ["merchant.done"] = ("بارك الله فيك. انتبه لنفسك.", "Bless you. Take care of yourself."),
            ["obj.training"] = ("تحدّث إلى معلّم الساحة وأكمل التدريب بالعصا.", "Talk to the yard master and complete your staff training."),
            ["obj.obstacle"] = ("عصابةٌ تسدّ الطريق إلى الساحة. واجههم، أو تسلّل عبر الأزقّة الخلفية، أو جد طريقًا آخر.",
                "A gang blocks the way to the courtyard. Face them, sneak through the back alleys, or find another way."),
            ["obj.discover"] = ("ادخل ساحة اللقاء واكتشف ما جرى هنا.", "Enter the Meeting Courtyard and discover what happened here."),
            ["obj.done"] = ("اكتملت رحلة مكة.", "The Mecca journey is complete."),
            ["label.lever"] = ("الرافعة", "Lever"),
            ["label.sideDoor"] = ("الباب الجانبي", "Side door"),
        };
    }
}
