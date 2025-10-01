import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface AlbumCoverResult {
  coverIds: string[];
  coverUrls: string[];
}

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  guidanceScale?: number;
  seed?: number;
  numInferenceSteps?: number;
  imageReferenceURL?: string;
  referenceFaceImageURL?: string;
  imageReferenceWeight?: number;
  faceReferenceWeight?: number;
}

export class ImageAPI {
  async generateAlbumCovers(
    details: { title?: string; style?: string; lyrics?: string },
    count: number = 3
  ): Promise<AlbumCoverResult> {
    const content = `Album: "${details.title || 'Untitled'}"\nStyle: ${details.style || 'N/A'}\nLyrics preview: ${(details.lyrics || '').slice(0, 200)}`;

    const requestParams = {
      content,
      count,
      aspectRatio: "1:1",
      source: "song_details"
    };

    const { data, error } = await supabase.functions.invoke('generate-album-cover', {
      body: requestParams
    });

    if (error) {
      logger.error("Album cover generation error:", error);
      throw new Error(error.message);
    }

    if (!data?.images || !Array.isArray(data.images) || data.images.length === 0) {
      logger.warn("No images returned from edge function");
      return { coverIds: [], coverUrls: [] };
    }

    return await this.uploadAndSaveCovers(data.images, details.title);
  }

  private async uploadAndSaveCovers(
    base64Images: string[],
    trackTitle?: string
  ): Promise<AlbumCoverResult> {
    const coverIds: string[] = [];
    const coverUrls: string[] = [];

    for (let i = 0; i < base64Images.length; i++) {
      const base64Image = base64Images[i];
      if (!base64Image) continue;

      try {
        const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const filename = `cover-${Date.now()}-${i + 1}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('album-covers')
          .upload(filename, blob);

        if (uploadError) {
          logger.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('album-covers')
          .getPublicUrl(filename);

        if (!urlData?.publicUrl) {
          logger.error("Failed to get public URL");
          continue;
        }

        const { data: dbData, error: dbError } = await supabase
          .from('album_covers')
          .insert({
            track_id: 'temp',
            image_url: urlData.publicUrl,
            image_type: 'album_cover',
            prompt_used: trackTitle || 'Generated',
            is_selected: false
          })
          .select('id')
          .single();

        if (dbError) {
          logger.error("Database error:", dbError);
          continue;
        }

        coverIds.push(dbData.id);
        coverUrls.push(urlData.publicUrl);
        logger.debug(`Uploaded cover ${i + 1}: ${dbData.id}`);
      } catch (error) {
        logger.error(`Error processing image ${i + 1}:`, error);
      }
    }

    return { coverIds, coverUrls };
  }

  async generateArtistImage(params: ImageGenerationParams): Promise<{ images: string[]; enhancedPrompt?: string }> {
    const { data, error } = await supabase.functions.invoke('generate-artist-image', {
      body: params
    });

    if (error) throw new Error(error.message);
    return { images: data.images || [], enhancedPrompt: data.enhancedPrompt };
  }

  async analyzeImage(imageBase64: string): Promise<{ analysis: string }> {
    const { data, error } = await supabase.functions.invoke('analyze-face', {
      body: { imageBase64 }
    });

    if (error) throw new Error(error.message);
    return data;
  }
}

export const imageAPI = new ImageAPI();
