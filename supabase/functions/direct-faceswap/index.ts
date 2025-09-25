import { corsHeaders } from '../_shared/cors.ts';

const MAGICAPI_KEY = Deno.env.get('MAGICAPI_KEY');

function encodeBase64(uint8Array: Uint8Array): string {
  const chunks = [];
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...uint8Array.slice(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestId = `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 [${requestId}] Starting direct face swap`);

    if (!MAGICAPI_KEY) {
      throw new Error('MAGICAPI_KEY environment variable is not set');
    }

    // Parse the FormData
    const formData = await req.formData();
    const lockedImage = formData.get('lockedImage') as File;
    const facialReference = formData.get('facialReference') as File;

    if (!lockedImage || !facialReference) {
      throw new Error('Both lockedImage and facialReference are required');
    }

    console.log(`📤 [${requestId}] Preparing MagicAPI request with:`, {
      lockedImageType: lockedImage.type,
      lockedImageSize: lockedImage.size,
      facialRefType: facialReference.type,
      facialRefSize: facialReference.size
    });

    // Convert files to ArrayBuffers for MagicAPI
    const [lockedImageBuffer, facialRefBuffer] = await Promise.all([
      lockedImage.arrayBuffer(),
      facialReference.arrayBuffer()
    ]);

    // Create FormData for MagicAPI
    const magicFormData = new FormData();
    magicFormData.append('target_image', new Blob([lockedImageBuffer], { type: lockedImage.type }), 'locked-image.jpg');
    magicFormData.append('swap_image', new Blob([facialRefBuffer], { type: facialReference.type }), 'facial-reference.jpg');

    console.log(`🔄 [${requestId}] Calling MagicAPI /run endpoint...`);
    
    // Call MagicAPI /run endpoint
    const runResponse = await fetch('https://prod.api.market/api/v1/magicapi/faceswap-image-v3/run', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-market-key': MAGICAPI_KEY,
      },
      body: magicFormData
    });

    if (!runResponse.ok) {
      console.error(`❌ [${requestId}] MagicAPI /run failed:`, runResponse.status, runResponse.statusText);
      const errorText = await runResponse.text().catch(() => 'Unknown error');
      throw new Error(`MagicAPI /run failed (${runResponse.status}): ${errorText}`);
    }

    const runData = await runResponse.json();
    const predictionId = runData.id;

    if (!predictionId) {
      console.error(`❌ [${requestId}] No prediction ID returned:`, runData);
      throw new Error('No prediction ID returned from MagicAPI');
    }

    console.log(`✅ [${requestId}] MagicAPI prediction started: ${predictionId}`);

    // Poll for prediction completion using /status endpoint
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    const pollInterval = 5000; // 5 seconds
    let attempts = 0;
    let resultImageUrl: string | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      
      console.log(`🔍 [${requestId}] Checking prediction status... (attempt ${attempts}/${maxAttempts})`);
      
      const statusResponse = await fetch(`https://prod.api.market/api/v1/magicapi/faceswap-image-v3/status/${predictionId}`, {
        headers: {
          'accept': 'application/json',
          'x-api-market-key': MAGICAPI_KEY,
        }
      });

      if (!statusResponse.ok) {
        console.error(`❌ [${requestId}] Status check failed:`, statusResponse.status, statusResponse.statusText);
        throw new Error(`Failed to check prediction status: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log(`📊 [${requestId}] Prediction status: ${statusData.status}`);

      if (statusData.status === 'COMPLETED') {
        // Get the final result image URL
        if (statusData.output?.image_url) {
          resultImageUrl = statusData.output.image_url;
          console.log(`✅ [${requestId}] Prediction completed successfully`);
          break;
        } else {
          throw new Error('No image URL in completed prediction');
        }
      } else if (statusData.status === 'FAILED') {
        console.error(`❌ [${requestId}] Prediction failed:`, statusData.error || 'Unknown error');
        throw new Error(`Prediction failed: ${statusData.error || 'Unknown error'}`);
      }

      // Wait before next poll (IN_QUEUE, PROCESSING, etc.)
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    if (attempts >= maxAttempts) {
      throw new Error('Prediction timed out after 10 minutes');
    }

    if (!resultImageUrl) {
      throw new Error('No result image URL obtained from prediction');
    }

    // Fetch the final result image
    console.log(`📥 [${requestId}] Downloading result image from: ${resultImageUrl}`);
    const imageResponse = await fetch(resultImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch result image: ${imageResponse.status}`);
    }
    const resultBlob = await imageResponse.blob();
    
    console.log(`✅ [${requestId}] MagicAPI response received:`, {
      type: resultBlob.type,
      size: resultBlob.size
    });

    // Convert blob to base64 for consistent response format
    const arrayBuffer = await resultBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = encodeBase64(uint8Array);
    const base64Image = `data:${resultBlob.type || 'image/jpeg'};base64,${base64String}`;

    const response = {
      images: [base64Image],
      enhancedPrompt: `Direct face swap applied to locked image`,
      debug: {
        source: 'Direct MagicAPI Face Swap',
        resultType: resultBlob.type,
        resultSize: resultBlob.size,
        pipeline: 'Locked Image → MagicAPI Face Swap'
      }
    };

    console.log(`🎉 [${requestId}] Direct face swap completed successfully`);

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('Direct face swap error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Direct face swap failed';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        images: [],
        debug: {
          pipeline: 'Locked Image → MagicAPI Face Swap',
          error: errorMessage
        }
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});