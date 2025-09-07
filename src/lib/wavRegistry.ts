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