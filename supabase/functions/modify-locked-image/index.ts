import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found');
    }

    const contentType = req.headers.get('content-type') || '';
    let imageUrl, modification, clothingReference, primaryClothingType;

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData for clothing mode
      const formData = await req.formData();
      imageUrl = formData.get('imageUrl') as string;
      modification = formData.get('modification') as string;
      clothingReference = formData.get('clothingReference') as File;
      primaryClothingType = formData.get('primaryClothingType') as string;
    } else {
      // Handle JSON for regular mode
      const body = await req.json();
      imageUrl = body.imageUrl;
      modification = body.modification;
    }
    
    if (!imageUrl || !modification) {
      throw new Error('Missing imageUrl or modification in request');
    }

    console.log('Modifying locked image with:', { 
      imageUrl: imageUrl.substring(0, 50) + '...', 
      modification, 
      hasClothingReference: !!clothingReference,
      primaryClothingType 
    });

    // Prepare image as base64 and mime type (supports data URLs)
    let mimeType = "image/jpeg";
    let base64Image = "";
    
    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
      const match = imageUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) {
        throw new Error('Invalid data URL provided for imageUrl');
      }
      mimeType = match[1] || "image/png";
      base64Image = match[2];
    } else {
      // Fetch remote image and convert to base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      // Convert ArrayBuffer to base64 using chunk-based approach to avoid stack overflow
      const uint8Array = new Uint8Array(imageBuffer);
      let binary = '';
      const chunkSize = 8192; // Process in chunks to avoid stack overflow
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64Image = btoa(binary);
      mimeType = imageResponse.headers.get('content-type') || "image/jpeg";
    }
    // Prepare the parts array starting with the locked image
    const requestParts: any[] = [
      {
        inline_data: {
          mime_type: mimeType,
          data: base64Image
        }
      }
    ];

    // Add clothing reference if provided
    if (clothingReference) {
      console.log('Processing clothing reference:', clothingReference.name, clothingReference.type);
      
      const clothingBuffer = await clothingReference.arrayBuffer();
      const clothingUint8Array = new Uint8Array(clothingBuffer);
      let clothingBinary = '';
      const chunkSize = 8192;
      for (let i = 0; i < clothingUint8Array.length; i += chunkSize) {
        const chunk = clothingUint8Array.subarray(i, i + chunkSize);
        clothingBinary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const clothingBase64 = btoa(clothingBinary);
      
      requestParts.push({
        inline_data: {
          mime_type: clothingReference.type || "image/jpeg",
          data: clothingBase64
        }
      });
    }

    // Set prompt based on whether clothing is provided
    let prompt;
    if (clothingReference) {
      prompt = `Do this: ${modification}`;
    } else {
      prompt = `Keep composition identical and preserve character, identity, looks and face only modify the following thing: ${modification}`;
    }

    requestParts.push({ text: prompt });

    const requestBody = {
      contents: [{
        role: "user",
        parts: requestParts
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      },
    };

    console.log('Sending request to Gemini...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Gemini response received');
    
    // Log the actual response structure for debugging
    console.log('Response structure:', JSON.stringify({
      candidates: data.candidates?.length || 0,
      hasContent: !!data.candidates?.[0]?.content,
      hasParts: !!data.candidates?.[0]?.content?.parts,
      partsLength: data.candidates?.[0]?.content?.parts?.length || 0,
      finishReason: data.candidates?.[0]?.finishReason,
      error: data.error
    }));

    if (!data.candidates?.[0]?.content?.parts) {
      console.error('Invalid Gemini response structure. Full response:', JSON.stringify(data, null, 2));
      throw new Error('No valid response from Gemini - empty candidates or parts');
    }

    // Extract images from the response
    const images: string[] = [];
    const responseParts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of responseParts) {
      const inline = part.inline_data || part.inlineData;
      if (inline?.data) {
        const mime = inline.mime_type || inline.mimeType || 'image/png';
        const dataUrl = `data:${mime};base64,${inline.data}`;
        images.push(dataUrl);
      }
    }

    if (images.length === 0) {
      console.error('No images generated - full response snippet:', JSON.stringify(data).slice(0, 2000));
      throw new Error('No images generated by Gemini');
    }

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in modify-locked-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});