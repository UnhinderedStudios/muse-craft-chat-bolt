import { SongDetails } from "@/types/song";

export interface DiceRoll {
  title?: string;
  genre?: string;
  leadVoice?: string;
  bpm?: number;
  parameterTags: string[];
  timestamp: number;
}

class DiceMemoryManager {
  private history: DiceRoll[] = [];
  private maxHistory = 3;

  extractGenre(parameters: string): string | undefined {
    const tags = parameters.split(',').map(t => t.trim());
    const genres = ['Pop', 'R&B', 'Hip-Hop', 'Rock', 'Afrobeats', 'Amapiano', 'Reggaeton', 'Country', 'Indie', 'Folk', 'Latin Pop', 'EDM', 'House', 'Techno', 'Trance', 'Dubstep', 'DnB', 'Trap', 'Drill', 'Boom-Bap', 'Alt Rock', 'Pop-Punk'];
    return tags.find(tag => genres.some(genre => tag.includes(genre)));
  }

  extractLeadVoice(parameters: string): string | undefined {
    const tags = parameters.split(',').map(t => t.trim().toLowerCase());
    for (const tag of tags) {
      if (tag.includes('female') || tag.includes('male') || tag.includes('nonbinary') || tag.includes('duet') || tag.includes('rap lead')) {
        return tag;
      }
    }
    return undefined;
  }

  extractBPM(parameters: string): number | undefined {
    const tags = parameters.split(',').map(t => t.trim());
    const bpmTag = tags.find(tag => tag.toLowerCase().includes('bpm'));
    if (bpmTag) {
      const match = bpmTag.match(/(\d+)bpm/i);
      return match ? parseInt(match[1]) : undefined;
    }
    return undefined;
  }

  addRoll(songDetails: SongDetails): void {
    if (!songDetails.style) return;

    const roll: DiceRoll = {
      title: songDetails.title,
      genre: this.extractGenre(songDetails.style),
      leadVoice: this.extractLeadVoice(songDetails.style),
      bpm: this.extractBPM(songDetails.style),
      parameterTags: songDetails.style.split(',').map(t => t.trim()),
      timestamp: Date.now()
    };

    this.history.unshift(roll);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
  }

  generateConstraints(): string {
    if (this.history.length === 0) return "";

    const constraints: string[] = [];
    const recentGenres = this.history.map(r => r.genre).filter(Boolean);
    const recentVoices = this.history.map(r => r.leadVoice).filter(Boolean);
    const recentTitles = this.history.map(r => r.title).filter(Boolean);
    const recentBPMs = this.history.map(r => r.bpm).filter(Boolean);
    const recentTags = this.history.flatMap(r => r.parameterTags);

    if (recentGenres.length > 0) {
      constraints.push(`AVOID these recent genres: ${recentGenres.join(', ')}`);
    }

    if (recentVoices.length > 0) {
      constraints.push(`AVOID these recent lead voices: ${recentVoices.join(', ')}`);
    }

    if (recentTitles.length > 0) {
      constraints.push(`AVOID titles similar to: ${recentTitles.join(', ')}`);
    }

    if (recentBPMs.length > 0) {
      const bpmRanges = recentBPMs.map(bpm => `${bpm-10}-${bpm+10}bpm`);
      constraints.push(`AVOID these BPM ranges: ${bpmRanges.join(', ')}`);
    }

    if (recentTags.length > 0) {
      // Only avoid exact matches for the most recent roll
      const mostRecentTags = this.history[0]?.parameterTags || [];
      if (mostRecentTags.length > 0) {
        constraints.push(`AVOID these exact parameter tags: ${mostRecentTags.slice(0, 5).join(', ')}`);
      }
    }

    return constraints.length > 0 ? `\n\nDIVERSITY CONSTRAINTS:\n${constraints.join('\n')}` : "";
  }

  scoresDiversity(songDetails: SongDetails): number {
    if (!songDetails.style || this.history.length === 0) return 1;

    let score = 1;
    const currentGenre = this.extractGenre(songDetails.style);
    const currentVoice = this.extractLeadVoice(songDetails.style);
    const currentBPM = this.extractBPM(songDetails.style);
    const currentTags = songDetails.style.split(',').map(t => t.trim());

    // Check against most recent roll
    const recent = this.history[0];
    
    if (currentGenre && recent.genre && currentGenre.includes(recent.genre)) {
      score *= 0.5;
    }
    
    if (currentVoice && recent.leadVoice && currentVoice === recent.leadVoice) {
      score *= 0.5;
    }

    if (currentBPM && recent.bpm && Math.abs(currentBPM - recent.bpm) < 15) {
      score *= 0.7;
    }

    // Check tag overlap
    const tagOverlap = currentTags.filter(tag => recent.parameterTags.includes(tag)).length;
    if (tagOverlap > 3) {
      score *= 0.6;
    }

    return score;
  }

  clear(): void {
    this.history = [];
  }
}

export const diceMemory = new DiceMemoryManager();