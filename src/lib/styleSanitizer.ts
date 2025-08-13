export function sanitizeStyle(style: string): string {
  try {
    let s = String(style || "");

    // Known artist mappings -> neutral descriptors
    const MAP: Record<string, string> = {
      "ed sheeran": "acoustic pop, warm intimate male vocals, fingerpicked acoustic guitar, minimal production, 70-90 BPM",
      "taylor swift": "modern pop, storytelling vocals, bright acoustic + subtle synths, radio-friendly production",
      "adele": "soulful pop ballad, powerful female vocals, piano-led, rich reverb, emotional delivery",
      "drake": "contemporary hip-hop/R&B, melodic rap vocals, sparse atmospheric synths, deep 808s",
      "the weeknd": "synthwave-infused R&B, airy falsetto male vocals, glossy 80s-inspired synths",
      "beyonce": "contemporary R&B/pop, dynamic powerful female vocals, polished modern production",
    };

    for (const [name, desc] of Object.entries(MAP)) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
      s = s.replace(re, desc);
    }

    // Remove reference phrases like "like X", "in the style of X", "sounds like X", "similar to X", "inspired by X"
    s = s.replace(/\b(in the style of|like|sounds like|similar to|inspired by)\b[^,;.]+/gi, "");
    // Remove trailing "by X" phrases (e.g., "ballad by Adele")
    s = s.replace(/\bby\s+[A-Za-z0-9 .,'-]+\b/gi, "");

    // Clean up punctuation/spaces
    s = s.replace(/\s{2,}/g, " ")
         .replace(/\s*,\s*/g, ", ")
         .replace(/,\s*,/g, ", ")
         .replace(/^,|,$/g, "")
         .trim();

    return s;
  } catch {
    return String(style || "");
  }
}
