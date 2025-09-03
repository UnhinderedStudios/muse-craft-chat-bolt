import { SongDetails } from "@/types/song";

function getParam(block: string, key: string): string | undefined {
  const re = new RegExp(`^-\\s*${key}\\s*:\\s*(.+)$`, "gmi");
  const m = re.exec(block);
  return m?.[1]?.trim();
}

export function parseRandomMusicForgeOutput(text: string): SongDetails | null {
  try {
    if (!text || typeof text !== "string") return null;

    // Title
    const titleMatch = text.match(/^\s*Title:\s*(.+)\s*$/mi);
    const title = titleMatch?.[1]?.trim();

    // Parameters: single line of comma-separated codes after "Parameters:"
    const paramsMatch = text.match(/Parameters:\s*(.+)/i);
    const paramsLine = paramsMatch?.[1]?.trim() || "";
    
    // Use the codes directly as the style
    const style = paramsLine;

    // Lyrics: from Intro: to end
    const lyricsMatch = text.match(/Intro:\s*[\s\S]*$/i);
    const lyrics = lyricsMatch?.[0]?.trim();

    const result: SongDetails = {};
    if (title) result.title = title;
    if (style) result.style = style;
    if (lyrics) result.lyrics = lyrics;

    if (result.title || result.style || result.lyrics) return result;
    return null;
  } catch (e) {
    console.error("Failed to parse RandomMusicForge output", e);
    return null;
  }
}

export default parseRandomMusicForgeOutput;
