/**
 * WAV Registry - Sidecar storage for WAV conversion metadata
 * 
 * Stores WAV-specific identifiers (audioId, taskId, musicIndex) keyed by track.id
 * This allows WAV conversion to work even when the main audioId fails
 */

export interface WavRefs {
  audioId?: string;
  taskId?: string;
  musicIndex?: number;
}

// Helper to detect if an audioId is a valid Suno ID vs a fallback
export function isValidSunoAudioId(audioId?: string): boolean {
  if (!audioId) return false;
  
  // Detect fallback patterns
  if (audioId.startsWith('missing_id_')) return false;
  if (audioId.includes('-') && audioId.split('-').length === 6) return false; // taskId-index pattern
  
  // Valid Suno audioIds are UUIDs (36 chars with hyphens)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(audioId);
}

const STORAGE_KEY = 'wavRegistry';

class WavRegistry {
  private isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  set(trackId: string, refs: WavRefs): void {
    if (!this.isClient) return;
    
    try {
      const existing = this.getAll();
      existing[trackId] = refs;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to store WAV refs:', error);
    }
  }

  get(trackId: string): WavRefs | null {
    if (!this.isClient) return null;
    
    try {
      const all = this.getAll();
      return all[trackId] || null;
    } catch (error) {
      console.warn('Failed to get WAV refs:', error);
      return null;
    }
  }

  setMany(entries: Array<{ trackId: string; refs: WavRefs }>): void {
    if (!this.isClient) return;
    
    try {
      const existing = this.getAll();
      entries.forEach(({ trackId, refs }) => {
        existing[trackId] = refs;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to store multiple WAV refs:', error);
    }
  }

  remove(trackId: string): void {
    if (!this.isClient) return;
    
    try {
      const existing = this.getAll();
      delete existing[trackId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to remove WAV refs:', error);
    }
  }

  clear(): void {
    if (!this.isClient) return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear WAV registry:', error);
    }
  }

  private getAll(): Record<string, WavRefs> {
    if (!this.isClient) return {};
    
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to parse WAV registry:', error);
      return {};
    }
  }
}

export const wavRegistry = new WavRegistry();