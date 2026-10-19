export const LOCALES = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "ja", label: "日本語" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

export const isLocale = (value: unknown): value is Locale => LOCALES.some((l) => l.id === value);

export function detectLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}
