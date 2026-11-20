import type { Lang, LocalizedText } from './content/types.js';

/** Fields that must never be sent to players. */
const PRIVATE_KEYS = new Set(['solution', 'editorNote']);

const isLocalized = (v: unknown): v is LocalizedText =>
  typeof v === 'object' &&
  v !== null &&
  Object.keys(v).length === 2 &&
  typeof (v as LocalizedText).ar === 'string' &&
  typeof (v as LocalizedText).en === 'string';

/** Replace every {ar, en} pair with the chosen language and strip private fields. */
export function localize<T>(value: T, lang: Lang): unknown {
  if (isLocalized(value)) return value[lang];
  if (Array.isArray(value)) return value.map((v) => localize(v, lang));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !PRIVATE_KEYS.has(k))
        .map(([k, v]) => [k, localize(v, lang)]),
    );
  }
  return value;
}

export function pickLang(query: unknown, acceptLanguage: string | undefined): Lang {
  const q = (query as { lang?: string } | undefined)?.lang;
  if (q === 'ar' || q === 'en') return q;
  return acceptLanguage?.trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
