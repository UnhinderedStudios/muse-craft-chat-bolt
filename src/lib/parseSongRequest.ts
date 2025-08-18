import { SongDetails } from "@/types/song";

export interface ParsedSongRequest {
  title: string;
  style: string;
  lyrics: string;
}

export function parseSongRequest(text: string): ParsedSongRequest | null {
  try {
    // Look for JSON in code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1];
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.song_request) {
        return {
          title: parsed.song_request.title || "Untitled",
          style: parsed.song_request.style || "",
          lyrics: parsed.song_request.lyrics || ""
        };
      }
    }
    
    // Fallback: look for plain JSON object
    const jsonMatch = text.match(/\{"song_request"[\s\S]*?\}\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.song_request) {
        return {
          title: parsed.song_request.title || "Untitled",
          style: parsed.song_request.style || "",
          lyrics: parsed.song_request.lyrics || ""
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