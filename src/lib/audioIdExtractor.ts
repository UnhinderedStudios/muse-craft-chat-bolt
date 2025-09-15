/**
 * Audio ID Extraction Utilities
 * 
 * Helps extract valid audioId from MP3 URLs when the provider's audioId is missing or invalid
 */

import { isValidSunoAudioId } from './wavRegistry';

/**
 * Extracts a valid audioId from an MP3 URL
 * @param url The MP3 URL from Suno
 * @returns A valid audioId or null if extraction fails
 */
export function extractAudioIdFromUrl(url?: string): string | null {
  if (!url) return null;
  
  try {
    // Suno URLs typically follow patterns like:
    // https://cdn1.suno.ai/audio/12345678-1234-1234-1234-123456789012.mp3
    // Extract the UUID-like pattern before .mp3
    const match = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.mp3$/i);
    
    if (match && match[1]) {
      const extractedId = match[1];
      console.log(`[AudioId] Extracted from URL: ${extractedId}`);
      return extractedId;
    }
    
    console.warn(`[AudioId] Could not extract valid audioId from URL: ${url}`);
    return null;
  } catch (error) {
    console.error(`[AudioId] Error extracting audioId from URL:`, error);
    return null;
  }
}

/**
 * Gets the best available audioId for timestamped lyrics requests
 * Prioritizes valid provider audioId, falls back to URL extraction
 */
export function getBestAudioId(params: {
  providerAudioId?: string;
  url?: string;
}): string | null {
  const { providerAudioId, url } = params;
  
  console.log(`[AudioId] Getting best audioId for provider=${providerAudioId}, url=${url?.substring(0, 80)}...`);
  
  // First, try the provider's audioId if it's valid
  if (isValidSunoAudioId(providerAudioId)) {
    console.log(`[AudioId] ✅ Using valid provider audioId: ${providerAudioId}`);
    return providerAudioId;
  }
  
  // Log why provider audioId was rejected
  if (providerAudioId) {
    console.log(`[AudioId] ❌ Provider audioId rejected (${providerAudioId}), trying URL extraction`);
  }
  
  // Fallback to URL extraction
  const extractedId = extractAudioIdFromUrl(url);
  if (extractedId) {
    console.log(`[AudioId] ✅ Using extracted audioId: ${extractedId}`);
    return extractedId;
  }
  
  console.warn(`[AudioId] ⚠️ No valid audioId available for lyrics request - provider: ${providerAudioId}, url: ${url}`);
  return null;
}