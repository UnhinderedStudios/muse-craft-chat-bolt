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

    // Parameters block: between 'Parameters:' and the next major section (Intro:)
    const paramsBlockMatch = text.match(/Parameters:\s*([\s\S]*?)\n\s*Intro:/i);
    const paramsBlock = paramsBlockMatch?.[1] || "";

    const genre = getParam(paramsBlock, "Genre");
    const bpm = getParam(paramsBlock, "BPM");
    const keyMode = getParam(paramsBlock, "Key/Mode");
    const timeSig = getParam(paramsBlock, "Time Signature");
    const leadVocal = getParam(paramsBlock, "Lead Vocal");
    const backing = getParam(paramsBlock, "Backing Vocals");
    const energy = getParam(paramsBlock, "Energy");
    const instrumentation = getParam(paramsBlock, "Instrumentation");
    const productionNotes = getParam(paramsBlock, "Production Notes");
    const hookTwist = getParam(paramsBlock, "Hook Twist");

    // Build a compact, producer-friendly style string
    const parts: string[] = [];
    if (genre) parts.push(genre);
    if (bpm) parts.push(`${bpm} BPM`);
    if (keyMode) parts.push(keyMode);
    if (leadVocal) parts.push(leadVocal);
    if (backing) parts.push(backing);
    if (energy) parts.push(energy);
    if (timeSig && timeSig !== "4/4") parts.push(timeSig);
    if (hookTwist) parts.push(`hook: ${hookTwist}`);
    if (instrumentation) parts.push(instrumentation);
    if (productionNotes) parts.push(productionNotes);
    const style = parts.join(", ");

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
