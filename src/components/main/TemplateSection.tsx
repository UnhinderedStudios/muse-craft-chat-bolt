import React from "react";
import { Dice5 } from "lucide-react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";

interface TemplateSectionProps {
  onApplyTemplate: (template: any) => void;
  lastDiceAt: React.MutableRefObject<number>;
}

const templates = [
  {
    title: "Love Ballad",
    style: "Pop ballad, emotional, 70 BPM, English, female vocals, piano driven, string arrangements",
    lyrics: `Intro:
Quiet whispers in the dark
Your hand reaching for my heart

Verse 1:
Every moment feels like magic when you're here
All my worries disappear
In your eyes I see forever
Nothing else could feel this right

Pre-Chorus:
When the world gets heavy
You're my light

Chorus:
This is love, this is real
Everything I'll ever need
In your arms I find my home
Never have to be alone
This is love, this is real
All the dreams we'll ever need

Verse 2:
Every sunrise brings new reasons to believe
In the love we've learned to weave
Through the storms we'll stand together
Nothing else could feel this true

Chorus:
This is love, this is real
Everything I'll ever need
In your arms I find my home
Never have to be alone
This is love, this is real
All the dreams we'll ever need

Bridge:
When tomorrow comes calling
We'll be ready to see
All the beautiful moments
Waiting for you and me

Outro:
In your arms I find my home
Never have to be alone`
  },
  {
    title: "Summer Anthem",
    style: "Electronic dance, uplifting, 128 BPM, English, mixed vocals, synth leads, driving bass",
    lyrics: `Intro:
Feel the beat drop
Summer never stops

Verse 1:
City lights are calling out our names tonight
Everything's electric, everything's bright
Dancing through the streets until the morning light
Nothing's gonna stop us, we're alive

Pre-Chorus:
Turn it up, turn it loud
We're unstoppable now

Chorus:
This is our summer anthem
Playing on repeat
Every moment magic
Feel it in the beat
This is our summer anthem
Nothing can compare
Living every second
Like we just don't care

Verse 2:
Golden days are lasting longer than before
Every single memory we're living for
Nothing in this world could ever give us more
Than the way we're feeling right now

Chorus:
This is our summer anthem
Playing on repeat
Every moment magic
Feel it in the beat
This is our summer anthem
Nothing can compare
Living every second
Like we just don't care

Bridge:
When the seasons change
We'll remember this
Every perfect day
Every perfect kiss

Outro:
Summer never stops
Feel the beat drop`
  },
  {
    title: "Midnight Drive",
    style: "Alternative rock, moody, 95 BPM, English, male vocals, electric guitar, atmospheric pads",
    lyrics: `Intro:
Empty roads and city lights
Driving through the endless night

Verse 1:
Windows down, the radio plays
Our favorite song from better days
The highway stretched like broken dreams
Nothing's quite the way it seems

Pre-Chorus:
But we keep moving on
Until we find where we belong

Chorus:
On this midnight drive
Feeling so alive
All our hopes and fears
Disappear tonight
On this midnight drive
Everything's alright
In the rearview mirror
We're leaving it behind

Verse 2:
Coffee shops and neon signs
Counting down these borrowed times
Every mile a memory made
Of the choices that we've weighed

Chorus:
On this midnight drive
Feeling so alive
All our hopes and fears
Disappear tonight
On this midnight drive
Everything's alright
In the rearview mirror
We're leaving it behind

Bridge:
When the sun comes up
We'll be somewhere new
All the roads we've traveled
Led me here to you

Outro:
Empty roads and city lights
Driving through the endless night`
  }
];

export const TemplateSection: React.FC<TemplateSectionProps> = ({ onApplyTemplate, lastDiceAt }) => {
  const handleApplyTemplate = (template: any) => {
    onApplyTemplate(template);
  };

  const handleRandomTemplate = () => {
    const now = Date.now();
    if (now - lastDiceAt.current < 1000) return; // Prevent rapid clicks
    lastDiceAt.current = now;
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    handleApplyTemplate(randomTemplate);
  };

  return (
    <CyberCard>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Templates</h2>
        <CyberButton 
          onClick={handleRandomTemplate}
          variant="secondary"
          className="gap-2"
        >
          <Dice5 className="w-4 h-4" />
          Random
        </CyberButton>
      </div>
      
      <div className="space-y-4">
        {templates.map((template, index) => (
          <CyberCard key={index} variant="alt" className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleApplyTemplate(template)}>
            <h3 className="font-medium text-white mb-2">{template.title}</h3>
            <p className="text-sm text-gray-400 mb-3 line-clamp-2">{template.style}</p>
            <div className="text-xs text-gray-500 line-clamp-3">
              {template.lyrics.substring(0, 120)}...
            </div>
          </CyberCard>
        ))}
      </div>
    </CyberCard>
  );
};