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

export const RANDOM_LYRICS = [
  `[Verse 1]
Walking down this empty street tonight
City lights are fading out of sight
Every step I take feels so unclear
Wondering if you'll ever reappear

[Chorus]
Take me higher, higher than before
Show me something worth fighting for
In the darkness, be my guiding light
Everything will be alright

[Verse 2]
Memories are dancing in my mind
Leaving all the past we left behind
Future's calling out my name so loud
Standing tall above the restless crowd

[Chorus]
Take me higher, higher than before
Show me something worth fighting for
In the darkness, be my guiding light
Everything will be alright`,

  `[Verse 1]
Coffee's getting cold on the table
Morning light streams through the window
Yesterday feels like a fable
Time moves fast, but hearts move slow

[Pre-Chorus]
And I've been thinking 'bout you lately
All the words we never said
Maybe love isn't that crazy
Maybe it's all in my head

[Chorus]
But I'm dreaming in color again
Painting pictures of where we've been
Every moment feels like the end
And the beginning all over again

[Verse 2]
Rain is tapping rhythms on the glass
Summer turned to autumn way too fast
Holding onto moments as they pass
Nothing good was ever meant to last

[Chorus]
But I'm dreaming in color again
Painting pictures of where we've been
Every moment feels like the end
And the beginning all over again`,

  `[Verse 1]
Electric pulse beneath my skin
Digital love is closing in
Neon signs light up the way
To a bright new yesterday

[Chorus]
We're dancing in the cyber rain
Breaking free from all the pain
Tomorrow's calling out our names
Nothing will ever be the same

[Verse 2]
Synthesizers tell our story
Bass drops heavy, full of glory
Lost inside this cosmic sound
Feet don't even touch the ground

[Bridge]
Turn it up, turn it loud
Music moves the restless crowd
Feel the beat inside your soul
Let the rhythm take control

[Chorus]
We're dancing in the cyber rain
Breaking free from all the pain
Tomorrow's calling out our names
Nothing will ever be the same`
];

export const CHAT_HEIGHT_LIMITS = {
  MIN: 440,
  MAX: 940, 
  DEFAULT: 640
};