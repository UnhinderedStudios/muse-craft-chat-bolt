import { corsHeaders } from '../_shared/cors.ts';

console.log('Starting faceswap-image-v3 function');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing faceswap request...');
    
    // Get environment variables
    const magicApiKey = Deno.env.get('MAGICAPI_KEY');
    if (!magicApiKey) {
      throw new Error('MAGICAPI_KEY not found in environment');
    }

    // Parse the FormData from the request
    const formData = await req.formData();
    
    const prompt = formData.get('prompt') as string;
    const backgroundHex = formData.get('backgroundHex') as string;
    const characterCount = formData.get('characterCount') as string;
    const image = formData.get('image') as File; // This is the target image (reference frame)
    const facialReference = formData.get('facialReference') as File; // This is the source image (face to swap)

    console.log('Request parameters:', {
      prompt,
      backgroundHex,
      characterCount,
      hasImage: !!image,
      hasFacialReference: !!facialReference,
      imageType: image?.type,
      facialReferenceType: facialReference?.type
    });

    if (!image) {
      throw new Error('No target image provided');
    }

    if (!facialReference) {
      throw new Error('No facial reference provided for face swap');
    }

    // Prepare FormData for MagicAPI Face Swap v3
    const magicApiFormData = new FormData();
    
    // source_image: The face to extract (facial reference image)
    magicApiFormData.append('source_image', facialReference);
    
    // target_image: The image to apply face to (reference frame)
    magicApiFormData.append('target_image', image);

    console.log('Sending request to MagicAPI Face Swap v3...');
    
    // Call MagicAPI Face Swap v3
    const magicApiResponse = await fetch('https://api.market/store/magicapi/faceswap-image-v3', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': magicApiKey,
      },
      body: magicApiFormData
    });

    if (!magicApiResponse.ok) {
      const errorText = await magicApiResponse.text();
      console.error('MagicAPI error:', {
        status: magicApiResponse.status,
        statusText: magicApiResponse.statusText,
        error: errorText
      });
      throw new Error(`MagicAPI request failed: ${magicApiResponse.status} ${magicApiResponse.statusText}`);
    }

    // Get the response - MagicAPI returns the processed image directly
    const resultBlob = await magicApiResponse.blob();
    
    console.log('MagicAPI response received:', {
      type: resultBlob.type,
      size: resultBlob.size
    });

    // Convert blob to base64 for consistent response format
    const arrayBuffer = await resultBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = btoa(String.fromCharCode(...uint8Array));
    const base64Image = `data:${resultBlob.type || 'image/jpeg'};base64,${base64String}`;

    const response = {
      images: [base64Image],
      enhancedPrompt: `Face swap applied: ${prompt}`,
      debug: {
        source: 'MagicAPI Face Swap v3',
        originalPrompt: prompt,
        backgroundHex,
        characterCount,
        imageType: image.type,
        facialReferenceType: facialReference.type,
        resultType: resultBlob.type,
        resultSize: resultBlob.size
      }
    };

    console.log('Face swap completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('Face swap error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Face swap failed';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        images: []
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