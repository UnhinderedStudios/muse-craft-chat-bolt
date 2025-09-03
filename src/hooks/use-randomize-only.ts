import { useState } from "react";
import { RANDOM_STYLES, RANDOM_TITLES } from "@/utils/constants";
import { api, type ChatMessage } from "@/lib/api";
import { parseSongRequest, convertToSongDetails } from "@/lib/parseSongRequest";
import { SongDetails } from "@/types";
import { sanitizeStyle } from "@/lib/styleSanitizer";
import { toast } from "sonner";

function sanitizeStyleSafe(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = sanitizeStyle(input);
  const finalVal = (cleaned || "").trim();
  return finalVal || input.trim();
}

function extractDetails(text: string): SongDetails | null {
  // Handle language-tagged fenced blocks like ```json { ... } ```
  try {
    const fenceJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (fenceJson) {
      const obj = JSON.parse(fenceJson[1]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    console.debug("[Parse] Fenced JSON parse failed:", e);
  }

  // Fallback: look for plain JSON object anywhere in the text
  try {
    const jsonMatch = text.match(/\{"song_request"[\s\S]*?\}\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    console.debug("[Parse] Inline JSON parse failed:", e);
  }

  return null;
}

function mergeNonEmpty(...items: (SongDetails | undefined)[]): SongDetails {
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

const systemPrompt = `You are Melody Muse, a friendly creative assistant for songwriting.
Your goal is to chat naturally and quickly gather two things only: (1) a unified Style description and (2) Lyrics.
IMPORTANT: Never include artist names in Style. If the user mentions an artist (e.g., "like Ed Sheeran"), translate that into neutral descriptors (timbre, instrumentation, tempo/BPM, mood, era) and DO NOT name the artist. Style must combine: genre/subgenre, mood/energy, tempo or BPM, language, vocal type (male/female/duet/none), and production notes.

Ask concise questions one at a time. When you have enough info, output ONLY a compact JSON with key song_request and fields: title, style, lyrics. The style must not contain artist names. The lyrics MUST ALWAYS be a complete song with the following sections in order: Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, Outro. Do not ask if the user wants more verses; always deliver the full structure.

Example JSON:
{"song_request": {"title": "Neon Skies", "style": "synthpop, uplifting, 120 BPM, English, female vocals, bright analog synths, sidechain bass, shimmering pads", "lyrics": "Full song with labeled sections: Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, Outro"}}

Continue the conversation after the JSON if needed.`;

export function useRandomizeOnly() {
  const [isRandomizing, setIsRandomizing] = useState(false);

  const randomizeAll = async (): Promise<SongDetails | null> => {
    if (isRandomizing) return null;
    
    const content = "Please generate a completely randomized song_request and output ONLY the JSON in a JSON fenced code block (```json ... ```). The lyrics must be a complete song containing Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, and Outro. No extra text.";
    
    setIsRandomizing(true);
    
    try {
      // Use a minimal, stateless prompt so we don't get follow-ups that could override fields
      const minimal: ChatMessage[] = [{ role: "user", content }];
      console.debug("[Dice] Sending randomize prompt");
      
      const [r1, r2] = await Promise.allSettled([
        api.chat(minimal, systemPrompt),
        api.chat(minimal, systemPrompt),
      ]);
      
      const msgs: string[] = [];
      if (r1.status === "fulfilled") msgs.push(r1.value.content);
      if (r2.status === "fulfilled") msgs.push(r2.value.content);
      
      console.debug("[Dice] Received responses:", msgs.map(m => m.slice(0, 160)));
      
      const extractions = msgs.map((m) => {
        const parsed = parseSongRequest(m);
        if (parsed) return convertToSongDetails(parsed);
        return extractDetails(m);
      }).filter(Boolean) as SongDetails[];
      
      if (extractions.length === 0) {
        console.debug("[Dice] Failed to parse any random song. First response preview:", msgs[0]?.slice(0, 300));
        toast.message("Couldn't parse random song", { description: "Try again in a moment." });
        return null;
      } else {
        const cleanedList = extractions.map((ex) => {
          const finalStyle = sanitizeStyleSafe(ex.style);
          return { ...ex, ...(finalStyle ? { style: finalStyle } : {}) } as SongDetails;
        });
        
        const merged = mergeNonEmpty(...cleanedList);
        toast.success("Randomized song details ready");
        return merged;
      }
    } catch (e: any) {
      toast.error(e.message || "Randomize failed");
      return null;
    } finally {
      setIsRandomizing(false);
    }
  };

  return {
    randomizeAll,
    isRandomizing
  };
}