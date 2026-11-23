using System.Collections.Generic;
using System.Text;

namespace Athar.Core
{
    /// <summary>
    /// Arabic shaping and right-to-left ordering for Unity text that doesn't do it natively:
    /// letters take their joined forms (Unicode presentation forms), lam-alef becomes a
    /// ligature, and each line is laid out right to left while Latin words and numbers keep
    /// their own order. Wrap first (logical order), then shape each line.
    /// </summary>
    public static class ArabicText
    {
        // isolated, final, initial, medial (0 = form doesn't exist: right-joining letters)
        static readonly Dictionary<char, int[]> Forms = new()
        {
            ['ء'] = new[] { 0xFE80, 0, 0, 0 },
            ['آ'] = new[] { 0xFE81, 0xFE82, 0, 0 },
            ['أ'] = new[] { 0xFE83, 0xFE84, 0, 0 },
            ['ؤ'] = new[] { 0xFE85, 0xFE86, 0, 0 },
            ['إ'] = new[] { 0xFE87, 0xFE88, 0, 0 },
            ['ئ'] = new[] { 0xFE89, 0xFE8A, 0xFE8B, 0xFE8C },
            ['ا'] = new[] { 0xFE8D, 0xFE8E, 0, 0 },
            ['ب'] = new[] { 0xFE8F, 0xFE90, 0xFE91, 0xFE92 },
            ['ة'] = new[] { 0xFE93, 0xFE94, 0, 0 },
            ['ت'] = new[] { 0xFE95, 0xFE96, 0xFE97, 0xFE98 },
            ['ث'] = new[] { 0xFE99, 0xFE9A, 0xFE9B, 0xFE9C },
            ['ج'] = new[] { 0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0 },
            ['ح'] = new[] { 0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4 },
            ['خ'] = new[] { 0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8 },
            ['د'] = new[] { 0xFEA9, 0xFEAA, 0, 0 },
            ['ذ'] = new[] { 0xFEAB, 0xFEAC, 0, 0 },
            ['ر'] = new[] { 0xFEAD, 0xFEAE, 0, 0 },
            ['ز'] = new[] { 0xFEAF, 0xFEB0, 0, 0 },
            ['س'] = new[] { 0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4 },
            ['ش'] = new[] { 0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8 },
            ['ص'] = new[] { 0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC },
            ['ض'] = new[] { 0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0 },
            ['ط'] = new[] { 0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4 },
            ['ظ'] = new[] { 0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8 },
            ['ع'] = new[] { 0xFEC9, 0xFECA, 0xFECB, 0xFECC },
            ['غ'] = new[] { 0xFECD, 0xFECE, 0xFECF, 0xFED0 },
            ['ـ'] = new[] { 0x0640, 0x0640, 0x0640, 0x0640 },
            ['ف'] = new[] { 0xFED1, 0xFED2, 0xFED3, 0xFED4 },
            ['ق'] = new[] { 0xFED5, 0xFED6, 0xFED7, 0xFED8 },
            ['ك'] = new[] { 0xFED9, 0xFEDA, 0xFEDB, 0xFEDC },
            ['ل'] = new[] { 0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0 },
            ['م'] = new[] { 0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4 },
            ['ن'] = new[] { 0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8 },
            ['ه'] = new[] { 0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC },
            ['و'] = new[] { 0xFEED, 0xFEEE, 0, 0 },
            ['ى'] = new[] { 0xFEEF, 0xFEF0, 0, 0 },
            ['ي'] = new[] { 0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4 },
        };

        // lam + alef variant -> isolated ligature (final form is +1)
        static readonly Dictionary<char, int> LamAlef = new()
        {
            ['آ'] = 0xFEF5, ['أ'] = 0xFEF7, ['إ'] = 0xFEF9, ['ا'] = 0xFEFB,
        };

        static bool IsMark(char c) => (c >= 'ً' && c <= 'ٟ') || c == 'ٰ';
        static bool Joins(char c) => Forms.TryGetValue(c, out var f) && f[1] != 0;            // can join to the previous letter
        static bool JoinsNext(char c) => Forms.TryGetValue(c, out var f) && f[2] != 0;        // can join to the next letter

        public static bool HasArabic(string s)
        {
            foreach (var c in s) if ((c >= '؀' && c <= 'ۿ') || (c >= 'ﭐ' && c <= '﻿')) return true;
            return false;
        }

        /// <summary>Contextual shaping in logical order.</summary>
        public static string Shape(string s)
        {
            var sb = new StringBuilder(s.Length);
            for (int i = 0; i < s.Length; i++)
            {
                var c = s[i];
                if (!Forms.TryGetValue(c, out var forms)) { sb.Append(c); continue; }
                int p = i - 1; while (p >= 0 && IsMark(s[p])) p--;
                int n = i + 1; while (n < s.Length && IsMark(s[n])) n++;
                bool prev = p >= 0 && JoinsNext(s[p]) && Joins(c);
                if (c == 'ل' && n < s.Length && LamAlef.TryGetValue(s[n], out var lig))
                {
                    sb.Append((char)(lig + (prev ? 1 : 0)));
                    for (int k = i + 1; k < n; k++) sb.Append(s[k]); // keep marks on the lam
                    i = n;
                    continue;
                }
                bool next = n < s.Length && JoinsNext(c) && Joins(s[n]);
                int form = prev && next ? 3 : prev ? 1 : next ? 2 : 0;
                sb.Append((char)(forms[form] != 0 ? forms[form] : forms[0]));
            }
            return sb.ToString();
        }

        static bool IsLtr(char c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (c >= '٠' && c <= '٩');

        /// <summary>Visual right-to-left order for one line; Latin and number runs keep their order.</summary>
        public static string Visual(string line)
        {
            var chars = line.ToCharArray();
            System.Array.Reverse(chars);
            for (int i = 0; i < chars.Length; i++)
            {
                // Mirror paired punctuation inside right-to-left text.
                chars[i] = chars[i] switch { '(' => ')', ')' => '(', '[' => ']', ']' => '[', '«' => '»', '»' => '«', _ => chars[i] };
            }
            int r = 0;
            while (r < chars.Length)
            {
                if (!IsLtr(chars[r])) { r++; continue; }
                int start = r;
                // A run of Latin/digits, allowing inner separators like "6.0" or "J/K".
                while (r < chars.Length && (IsLtr(chars[r]) || ((chars[r] == '.' || chars[r] == ':' || chars[r] == '/' || chars[r] == '-' || chars[r] == ' ') && r + 1 < chars.Length && IsLtr(chars[r + 1]) && r > start)))
                    r++;
                System.Array.Reverse(chars, start, r - start);
            }
            return new string(chars);
        }

        /// <summary>
        /// Ready-to-render text: in Arabic, wraps at about <paramref name="maxChars"/> characters per
        /// line, then shapes and orders each line. Non-Arabic text is returned unchanged.
        /// </summary>
        public static string Prepare(string text, int maxChars = 0)
        {
            if (string.IsNullOrEmpty(text) || !HasArabic(text)) return text;
            var output = new List<string>();
            foreach (var para in text.Split('\n'))
            {
                foreach (var line in Wrap(para, maxChars)) output.Add(Visual(Shape(line)));
            }
            return string.Join("\n", output);
        }

        static IEnumerable<string> Wrap(string para, int maxChars)
        {
            if (maxChars <= 0 || para.Length <= maxChars) { yield return para; yield break; }
            var line = new StringBuilder();
            foreach (var word in para.Split(' '))
            {
                if (line.Length > 0 && line.Length + 1 + word.Length > maxChars)
                {
                    yield return line.ToString();
                    line.Clear();
                }
                if (line.Length > 0) line.Append(' ');
                line.Append(word);
            }
            if (line.Length > 0) yield return line.ToString();
        }
    }
}
