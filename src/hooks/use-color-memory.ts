import { useState, useEffect } from 'react';

const STORAGE_KEY = 'artist-generator-color-memory';
const MAX_COLORS = 12;

export const useColorMemory = () => {
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Load colors from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const colors = JSON.parse(saved);
        setRecentColors(Array.isArray(colors) ? colors : []);
      }
    } catch (error) {
      console.warn('Failed to load color memory:', error);
    }
  }, []);

  // Save colors to localStorage when recentColors changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentColors));
    } catch (error) {
      console.warn('Failed to save color memory:', error);
    }
  }, [recentColors]);

  const addColor = (color: string) => {
    if (!color || color === '#ffffff' || color === '#000000') return; // Skip default colors
    
    setRecentColors(prev => {
      // Remove if already exists
      const filtered = prev.filter(c => c !== color);
      // Add to front and limit to MAX_COLORS
      return [color, ...filtered].slice(0, MAX_COLORS);
    });
  };

  const clearColors = () => {
    setRecentColors([]);
  };

  return {
    recentColors,
    addColor,
    clearColors
  };
};