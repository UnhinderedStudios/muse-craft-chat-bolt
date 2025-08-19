import { SongDetails } from "@/types/song";

export interface ParsedSongRequest {
  title: string;
  style: string;
  lyrics: string;
}

export function parseSongRequest(text: string): ParsedSongRequest | null {
  try {
    // Handle language-tagged fenced blocks like ```json { ... } ```
    const fenceJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (fenceJson) {
      const obj = JSON.parse(fenceJson[1]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return {
          title: obj.song_request.title || "Untitled",
          style: obj.song_request.style || "",
          lyrics: obj.song_request.lyrics || ""
        };
      }
    }
    
    // Fallback: look for plain JSON object anywhere in the text
    const jsonMatch = text.match(/\{"song_request"[\s\S]*?\}\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return {
          title: obj.song_request.title || "Untitled",
          style: obj.song_request.style || "",
          lyrics: obj.song_request.lyrics || ""
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to parse song request:", error);
    return null;
  }
}

export function convertToSongDetails(songRequest: ParsedSongRequest): SongDetails {
  return {
    title: songRequest.title,
    style: songRequest.style,
    lyrics: songRequest.lyrics
  };
}