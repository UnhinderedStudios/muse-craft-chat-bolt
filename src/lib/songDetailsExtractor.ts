import { SongDetails } from "@/lib/api";
import { parseSongRequest, convertToSongDetails } from "@/lib/parseSongRequest";

export function extractDetails(text: string): SongDetails | null {
  try {
    const parsed = parseSongRequest(text);
    if (parsed) {
      return convertToSongDetails(parsed);
    }
  } catch (e) {
    // Silently fail and try next method
  }

  try {
    const fenceJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (fenceJson) {
      const obj = JSON.parse(fenceJson[1]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    // Silently fail and try next method
  }

  try {
    const jsonMatch = text.match(/\{"song_request"[\s\S]*?\}\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    // All methods failed
  }

  return null;
}

export function mergeNonEmpty(...items: (SongDetails | undefined)[]): SongDetails {
  const out: SongDetails = {};
  for (const item of items) {
    if (!item) continue;
    const t = typeof item.title === "string" ? item.title.trim() : "";
    const s = typeof item.style === "string" ? item.style.trim() : "";
    const l = typeof item.lyrics === "string" ? item.lyrics.trim() : "";
    if (t) out.title = t;
    if (s) out.style = s;
    if (l) out.lyrics = l;
  }
  return out;
}
