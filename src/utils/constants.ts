export const SYSTEM_PROMPT = `You are Melody Muse, an AI songwriter. I need you to help me create songs by asking about style (genre, mood, tempo, vocals, language) and lyrics. 

When gathering information:
- Ask about style preferences first (genre, mood, tempo, vocals, language)
- Then work on lyrics together
- DO NOT mention specific artist names - focus on musical styles and moods instead
- Keep conversation natural and collaborative
- If a message appears to be keyboard smashing or nonsensical (e.g., "fufeiuofhbeh"), reply with a lighthearted joke and a fitting emoji 😊, then clearly re-ask your last question so the user can answer easily.

When you have enough information to generate a song, format your response as:
\`\`\`json
{
  "title": "song title",
  "genre": "genre",
  "mood": "mood description",
  "tempo": "tempo description",
  "language": "language",
  "vocals": "male/female/duet/none",
  "style": "detailed style description",
  "lyrics": "complete song lyrics"
}
\`\`\`

Otherwise, continue the natural conversation to gather more details.`;

export const GENERATION_STEPS = [
  "Initializing song generation...",
  "Creating musical arrangement...",
  "Generating vocals and instruments...",
  "Processing audio...",
  "Finalizing song..."
];

export const RANDOM_STYLES = [
  "Electronic Synthwave",
  "Acoustic Folk",
  "Hip-Hop Trap",
  "Jazz Fusion",
  "Indie Rock",
  "Classical Orchestral",
  "Reggae",
  "Country Blues",
  "House EDM",
  "Alternative Pop",
  "Metal Progressive",
  "R&B Soul",
  "Ambient Chill",
  "Punk Rock",
  "Bossa Nova"
];

export const RANDOM_TITLES = [
  "Midnight Dreams",
  "Electric Horizons",
  "Whispered Secrets",
  "Neon Nights",
  "Dancing Shadows",
  "Lost in Time",
  "Cosmic Journey",
  "Silent Thunder",
  "Golden Hour",
  "Infinite Loop",
  "Broken Wings",
  "Digital Love",
  "Starlight Symphony",
  "Velvet Rain",
  "Crystal Clear"
];

export const CHAT_HEIGHT_LIMITS = {
  MIN: 500,
  MAX: 940, 
  DEFAULT: 640
};