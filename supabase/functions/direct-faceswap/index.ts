import { corsHeaders } from '../_shared/cors.ts';
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://afsyxzxwxszujnsmukff.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('Starting direct-faceswap function');

async function uploadToArtistImages(path: string, data: ArrayBuffer | Blob, contentType: string) {
  const payload = data instanceof Blob ? await data.arrayBuffer() : data;
  const { error } = await supabase.storage.from('artist-images').upload(path, payload, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const pub = supabase.storage.from('artist-images').getPublicUrl(path);
  return pub.data.publicUrl;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing direct face swap request...');

    const magicApiKey = Deno.env.get('MAGICAPI_KEY');
    if (!magicApiKey) {
      throw new Error('MAGICAPI_KEY not found in environment');
    }

    const formData = await req.formData();
    const targetImage = formData.get('targetImage') as File; // Locked image
    const facialReference = formData.get('facialReference') as File; // Face to swap in
    const requestId = `directswap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📋 [${requestId}] Params:`, {
      hasTargetImage: !!targetImage,
      targetType: targetImage?.type,
      hasFacial: !!facialReference,
      facialType: facialReference?.type,
    });

    if (!targetImage) throw new Error('No target image (locked image) provided');
    if (!facialReference) throw new Error('No facial reference provided');

    // Upload both images to public storage
    const folder = `direct-faceswap/${requestId}`;
    const targetExt = (targetImage.type || 'image/png').split('/')[1] || 'png';
    const facialExt = (facialReference.type || 'image/jpeg').split('/')[1] || 'jpg';

    const targetPath = `${folder}/target.${targetExt}`;
    const facialPath = `${folder}/swap.${facialExt}`;

    const targetUrl = await uploadToArtistImages(targetPath, targetImage, targetImage.type || 'image/png');
    const swapUrl = await uploadToArtistImages(facialPath, facialReference, facialReference.type || 'image/jpeg');

    console.log(`🌐 [${requestId}] Calling MagicAPI with URLs`, { targetUrl, swapUrl });

    const apiPayload = {
      input: {
        swap_image: swapUrl,
        target_image: targetUrl,
        enhance_image: true,
      }
    } as const;

    // Start prediction
    const startResp = await fetch('https://prod.api.market/api/v1/magicapi/faceswap-image-v3/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-market-key': magicApiKey,
      },
      body: JSON.stringify(apiPayload)
    });

    if (!startResp.ok) {
      const text = await startResp.text();
      console.error(`❌ [${requestId}] MagicAPI /run error`, startResp.status, text);
      throw new Error(`Failed to start MagicAPI prediction: ${startResp.status}`);
    }

    const startData = await startResp.json();
    const predictionId = startData.id;
    if (!predictionId) throw new Error('No prediction ID returned from MagicAPI');

    console.log(`📋 [${requestId}] Prediction ID: ${predictionId}`);

    // Poll for completion
    const maxAttempts = 120; // 10 minutes
    const intervalMs = 5000;
    let attempts = 0;
    let resultImageUrl: string | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      const statusResp = await fetch(`https://prod.api.market/api/v1/magicapi/faceswap-image-v3/status/${predictionId}`, {
        headers: { 'accept': 'application/json', 'x-api-market-key': magicApiKey }
      });

      if (!statusResp.ok) {
        console.error(`❌ [${requestId}] Status check failed`, statusResp.status, statusResp.statusText);
        throw new Error(`Failed to check prediction status: ${statusResp.status}`);
      }

      const statusData = await statusResp.json();
      console.log(`📊 [${requestId}] Status: ${statusData.status}`);

      if (statusData.status === 'COMPLETED') {
        if (statusData.output?.image_url) {
          resultImageUrl = statusData.output.image_url;
          break;
        } else {
          throw new Error('No image URL in completed prediction');
        }
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Prediction failed: ${statusData.error || 'Unknown error'}`);
      }

      if (attempts < maxAttempts) await new Promise(r => setTimeout(r, intervalMs));
    }

    if (!resultImageUrl) throw new Error('Prediction timed out or no result');

    // Fetch final image and return base64
    const imageResp = await fetch(resultImageUrl);
    if (!imageResp.ok) throw new Error(`Failed to fetch result image: ${imageResp.status}`);
    const resultBlob = await imageResp.blob();
    const arrayBuffer = await resultBlob.arrayBuffer();
    const base64String = encodeBase64(new Uint8Array(arrayBuffer));
    const base64Image = `data:${resultBlob.type || 'image/jpeg'};base64,${base64String}`;

    const response = {
      images: [base64Image],
      debug: {
        source: 'MagicAPI Face Swap v3 (direct)',
        resultType: resultBlob.type,
        resultSize: resultBlob.size,
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Direct face swap error:', error);
    const message = error instanceof Error ? error.message : 'Direct face swap failed';
    return new Response(JSON.stringify({ error: message, images: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});