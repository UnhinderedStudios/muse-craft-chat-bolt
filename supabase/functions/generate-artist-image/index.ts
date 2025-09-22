// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get analysis instruction based on object constraints
function getAnalysisInstruction(finalPrompt: string, prefix: string, requestId: string): string {
  const hasObjectConstraints = prefix.toLowerCase().includes('no objects') || 
                               prefix.toLowerCase().includes('cannot be present') ||
                               prefix.toLowerCase().includes('no props') ||
                               prefix.toLowerCase().includes('no items');
  
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Object constraints detected - using object-removal analysis`);
    return `CRITICAL: Keep camera angle and lighting style identical, BUT remove all objects/props from the scene. Replace any objects with clean, neutral background where props were located. Hands should be empty. Only change the character/subject as requested: "${finalPrompt}". Preserve the pose style and overall composition but eliminate all objects, instruments, tools, furniture, or props. The character should fit naturally into a clean scene. Respond with an enhanced prompt that emphasizes preserving composition while removing all objects and only modifying the subject.`;
  } else {
    return `CRITICAL: Keep composition, lighting, background and structure of this image identical. Only change the character/subject as requested: "${finalPrompt}". Preserve the exact same pose, camera angle, lighting setup, background elements, and overall visual structure. The character should fit naturally into the existing scene without altering any other visual elements. Respond with an enhanced prompt that emphasizes preserving the original image's composition while only modifying the subject.`;
  }
}

// Helper function to get generation prompt with object constraints
function getGenerationPrompt(finalPrompt: string, hasObjectConstraints: boolean, requestId: string): string {
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Adding object removal instructions to generation prompt`);
    return `GENERATE AN IMAGE: ${finalPrompt}

HARD RULES FOR GENERATION:
- NO OBJECTS/PROPS: Absolutely no lamp posts, microphones, guitars, chairs, stands, instruments, tools, furniture, or any physical objects
- EMPTY HANDS: Character's hands must be completely empty
- CLEAN BACKGROUND: If reference contains props, erase them and fill with clean, neutral background
- FOCUS: Only the character/person, their pose, expression, and clothing

NEGATIVE PROMPT: lamp post, microphone, guitar, chair, stand, instrument, tool, furniture, object, prop, holding, carrying, gripping

IMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  } else {
    return `GENERATE AN IMAGE: ${finalPrompt}

IMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  }
}

// Function to modify prompt using ChatGPT when Gemini blocks content
async function modifyPromptWithChatGPT(
  fullEnhancedPrompt: string, 
  originalUserPrompt: string, 
  prefix: string, 
  attempt: number, 
  openaiKey: string, 
  requestId: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key available for prompt modification`);
    return fullEnhancedPrompt;
  }

  // Determine if we're working with a character-only string or full prompt
  const isCharacterOnly = !fullEnhancedPrompt.includes("Character must be entirely replaced with:");
  
  // Calculate character limit based on original user prompt (excluding prefix)
  const originalCharacterDescription = originalUserPrompt.replace(prefix, "").trim();
  const maxCharacterLength = originalCharacterDescription.length;
  
  console.log(`📏 [${requestId}] Character limit: ${maxCharacterLength} chars (original: "${originalCharacterDescription}")`);

  const conservativeness = ["moderately", "significantly", "extremely"][Math.min(attempt - 1, 2)];
  
  // Extract composition preservation instructions from the enhanced prompt
  const compositionInstructions = fullEnhancedPrompt.match(/CRITICAL:.*?(?=Character must be|$)/s)?.[0] || "";
  
  // Extract the character description part that needs modification
  const characterMatch = fullEnhancedPrompt.match(/Character must be entirely replaced with: (.+?)(?:\n|$)/s);
  const characterDescription = isCharacterOnly ? fullEnhancedPrompt : (characterMatch?.[1] || originalCharacterDescription);
  
  // Check if prefix contains object removal constraints
  const hasObjectConstraints = prefix.toLowerCase().includes('no objects') || 
                               prefix.toLowerCase().includes('cannot be present') ||
                               prefix.toLowerCase().includes('no props') ||
                               prefix.toLowerCase().includes('no items');
  
  const objectRemovalInstructions = hasObjectConstraints ? `
CRITICAL OBJECT REMOVAL:
- REMOVE ALL OBJECTS: The character description must NOT mention any objects, props, or held items
- This includes: instruments, tools, furniture, accessories, weapons, toys, or ANY physical objects
- Focus ONLY on: person's appearance, pose, facial expression, clothing style, and body language
- EXAMPLE: "person holding a lamp post" → "person in a confident stance"
- EXAMPLE: "musician with guitar" → "performer in artistic pose"` : "";

  const systemPrompt = `You are a prompt safety assistant. Your job is to rephrase ONLY the character description part of image generation prompts to make them more appropriate while preserving the core artistic vision.

CONTEXT: 
- Original prefix: "${prefix}"
- Full composition requirements: "${compositionInstructions}"

TASK: Rephrase ONLY the character description to be ${conservativeness} more family-friendly and safe while keeping the creative essence intact.

CRITICAL CONSTRAINTS:
- CHARACTER LIMIT: Your response MUST NOT exceed ${maxCharacterLength} characters
- PRESERVE GENDER: Always maintain gender specifications (man, woman, boy, girl, male, female, etc.) as core visual elements
- PRESERVE PREFIX INTENT: Respect the artistic direction indicated by the prefix
- ONLY MODIFY: The character description, not composition/lighting instructions
- KEEP CORE CONCEPT: Maintain the essential visual elements and pose${objectRemovalInstructions}

ESSENTIAL GENDER PRESERVATION:
- Gender terms are NOT problematic and must be kept intact
- "Man" stays "man", "woman" stays "woman", "boy" stays "boy", "girl" stays "girl"
- Gender is a fundamental visual characteristic that must survive sanitization
- Never generalize gender to "person" or "individual" unless the original was already gender-neutral

GUIDELINES:
- Remove any potentially problematic terms (NOT including gender)
- Use more neutral, artistic language for tone/professionalism
- Keep the core visual concept (pose, style, mood, GENDER)
- Make it sound more professional/artistic
- Focus on artistic elements like style, expression, fashion
- Use terms like "artist", "performer", "creative professional" but KEEP the gender
- Respect the prefix's artistic direction
- "Neutral language" refers to tone/professionalism, NOT gender removal

EXAMPLES:
Input: "crazy man jumping around like an idiot"
Output: "energetic man in dynamic motion with expressive pose"

Input: "gothic punk woman with peace sign pose"
Output: "alternative style female musician making peace gesture"

Input: "stupid boy with messy hair"
Output: "young man with tousled hair in playful pose"

Respond with ONLY the rephrased character description (max ${maxCharacterLength} chars), nothing else.`;

  try {
    console.log(`🔄 [${requestId}] Modifying character description with ChatGPT (attempt ${attempt}, ${conservativeness} safer)`);
    console.log(`📝 [${requestId}] Character to modify: "${characterDescription}"`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: characterDescription }
        ],
        max_tokens: Math.min(100, Math.ceil(maxCharacterLength * 1.2)), // Allow some buffer
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      console.error(`❌ [${requestId}] ChatGPT API failed:`, await response.text());
      return fullEnhancedPrompt;
    }

    const data = await response.json();
    const modifiedCharacterDescription = data.choices?.[0]?.message?.content?.trim();
    
    if (modifiedCharacterDescription) {
      console.log(`🔍 [${requestId}] Modified character: "${modifiedCharacterDescription}" (${modifiedCharacterDescription.length}/${maxCharacterLength} chars)`);
      
      // Programmatic prop scrub - remove common object phrases after ChatGPT sanitization
      let scrubbedDescription = modifiedCharacterDescription;
      if (hasObjectConstraints) {
        const propPatterns = [
          /\bholding\s+[^,\n.]*/gi,
          /\bcarrying\s+[^,\n.]*/gi,
          /\bgripping\s+[^,\n.]*/gi,
          /\bclutching\s+[^,\n.]*/gi,
          /\busing\s+[^,\n.]*/gi,
          /\bleaning\s+(?:on|against)\s+[^,\n.]*/gi,
          /\bwith\s+(?:a|an|the)\s+[^,\n.]*/gi,
        ];
        
        propPatterns.forEach(pattern => {
          scrubbedDescription = scrubbedDescription.replace(pattern, '').trim();
        });
        
        // Clean up whitespace and commas
        scrubbedDescription = scrubbedDescription
          .replace(/\s{2,}/g, " ")
          .replace(/\s*,\s*/g, ", ")
          .replace(/,\s*,/g, ", ")
          .replace(/^,|,$/g, "")
          .trim();
          
        if (scrubbedDescription !== modifiedCharacterDescription) {
          console.log(`🧽 [${requestId}] Prop scrubbed: "${scrubbedDescription}"`);
          modifiedCharacterDescription = scrubbedDescription;
        }
      }
      
      // Validate character limit
      if (modifiedCharacterDescription.length > maxCharacterLength) {
        console.warn(`⚠️ [${requestId}] Modified prompt exceeds character limit, truncating`);
        const truncated = modifiedCharacterDescription.substring(0, maxCharacterLength);
        console.log(`✂️ [${requestId}] Truncated to: "${truncated}"`);
        
        if (isCharacterOnly) {
          return truncated;
        }
        
        // Reconstruct the full prompt with the truncated character description
        const modifiedFullPrompt = fullEnhancedPrompt.replace(
          /Character must be entirely replaced with: .+?(?=\n|$)/s,
          `Character must be entirely replaced with: ${truncated}`
        );
        
        return modifiedFullPrompt;
      }
      
      if (isCharacterOnly) {
        console.log(`✅ [${requestId}] ChatGPT modified character-only: "${modifiedCharacterDescription}"`);
        return modifiedCharacterDescription;
      }
      
      // Reconstruct the full prompt with the modified character description
      const modifiedFullPrompt = fullEnhancedPrompt.replace(
        /Character must be entirely replaced with: .+?(?=\n|$)/s,
        `Character must be entirely replaced with: ${modifiedCharacterDescription}`
      );
      
      console.log(`✅ [${requestId}] ChatGPT modified character within limits: "${modifiedCharacterDescription}"`);
      return modifiedFullPrompt;
    } else {
      console.error(`❌ [${requestId}] No modified character description returned from ChatGPT`);
      return fullEnhancedPrompt;
    }
  } catch (error) {
    console.error(`❌ [${requestId}] ChatGPT prompt modification failed:`, error);
    return fullEnhancedPrompt;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  // Generate unique request ID for tracking
  const requestId = generateRequestId();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    console.log(`🆔 [${requestId}] Artist Generator request started`);
    
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!geminiKey) {
      console.error(`❌ [${requestId}] Missing GEMINI_API_KEY`);
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY", requestId }),
        { status: 500, headers: CORS }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let imageData = "";
    
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      console.log(`📤 [${requestId}] Processing multipart form data`);
      try {
        const formData = await req.formData();
        prompt = (formData.get("prompt") as string) || "";
        const imageFile = formData.get("image") as File;
        
        console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", hasImage: ${!!imageFile}`);
        
        if (imageFile) {
          console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
          
          // Check file size (limit to 10MB)
          if (imageFile.size > 10 * 1024 * 1024) {
            console.error(`❌ [${requestId}] File too large: ${imageFile.size} bytes`);
            return new Response(
              JSON.stringify({ error: "Image file too large. Maximum size is 10MB.", requestId }),
              { status: 400, headers: CORS }
            );
          }

          const arrayBuffer = await imageFile.arrayBuffer();
          
          // Convert to base64 using Deno's built-in encoding to avoid stack overflow
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = encodeBase64(uint8Array);
          
          const mimeType = imageFile.type || "image/jpeg";
          imageData = `data:${mimeType};base64,${base64}`;
          console.log(`✅ [${requestId}] Image converted to base64, length: ${base64.length}`);
        }
      } catch (formError: any) {
        console.error(`❌ [${requestId}] FormData parsing error:`, formError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to parse form data", 
            details: formError.message,
            requestId 
          }),
          { status: 400, headers: CORS }
        );
      }
    } else {
      console.log(`📤 [${requestId}] Processing JSON body`);
      try {
        // Handle JSON body for text-only prompts
        const body = await req.json().catch(() => ({}));
        prompt = body?.prompt?.toString?.() || "";
        imageData = body?.imageData?.toString?.() || "";
        console.log(`📝 [${requestId}] JSON body - prompt: "${prompt}", hasImageData: ${!!imageData}`);
      } catch (jsonError: any) {
        console.error(`❌ [${requestId}] JSON parsing error:`, jsonError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to parse JSON body", 
            details: jsonError.message,
            requestId 
          }),
          { status: 400, headers: CORS }
        );
      }
    }

    if (!prompt.trim()) {
      prompt = "Professional musician portrait, studio lighting, artistic and cinematic";
    }

    // Extract prefix from prompt for context preservation
    const prefixMatch = prompt.match(/^(.*?Character must be entirely replaced with:)/s);
    const prefix = prefixMatch?.[1] || "";
    
    console.log(`🎯 [${requestId}] Artist Generator Debug:`);
    console.log(`  📝 [${requestId}] Prompt: "${prompt}"`);
    console.log(`  🎨 [${requestId}] Extracted prefix: "${prefix}"`);
    console.log(`  🖼️ [${requestId}] Has reference image: ${!!imageData}`);
    console.log(`  🔄 [${requestId}] Request independent - no state persistence`);

    // ALWAYS use Gemini 2.5 Flash Image Preview for BOTH analysis and generation - matching Nano Banana UI
    const analysisModel = "gemini-2.5-flash-image-preview";
    const generationModel = "gemini-2.5-flash-image-preview";
    
    console.log(`🔧 [${requestId}] Using models: analysis=${analysisModel}, generation=${generationModel}`);
    
    let finalPrompt = prompt;
    let analysisSuccessful = false;
    let promptModificationAttempts = 0;

    // Pre-sanitize character description if it exists to prevent content policy violations during analysis
    const characterMatch = prompt.match(/Character must be entirely replaced with:\s*(.+)$/);
    if (characterMatch && openaiKey) {
      const originalCharacter = characterMatch[1];
      console.log(`🧹 [${requestId}] Pre-sanitizing character description: "${originalCharacter}"`);
      
      // Extract prefix from original prompt to pass constraints to ChatGPT
      const prefixMatch = prompt.match(/^(.*?)(?=Character must be entirely replaced with:)/);
      const extractedPrefix = prefixMatch ? prefixMatch[1].trim() : "";
      
      const sanitizedCharacter = await modifyPromptWithChatGPT(
        originalCharacter,  // Only modify the character part
        originalCharacter,  // Pass the same as original user prompt
        extractedPrefix,    // Pass the extracted prefix so ChatGPT knows the constraints
        1,                  // First attempt at sanitization
        openaiKey, 
        requestId
      );
      
      if (sanitizedCharacter !== originalCharacter) {
        // Reconstruct the full prompt with the sanitized character
        finalPrompt = prompt.replace(originalCharacter, sanitizedCharacter);
        console.log(`✅ [${requestId}] Pre-sanitized character: "${sanitizedCharacter}"`);
      } else {
        console.log(`⚠️ [${requestId}] Character sanitization unchanged, proceeding with original`);
      }
    }

    // If image is provided, first analyze it to enhance the prompt
    if (imageData) {
      const [mimeTypePart, base64Data] = imageData.split(",");
      const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
      
      const analysisParts = [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        },
        {
          text: getAnalysisInstruction(finalPrompt, prefix, requestId)
        }
      ];

      const analysisRequestBody = {
        contents: [{
          parts: analysisParts
        }],
        generationConfig: {
          temperature: 1.0,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      console.log(`  🔍 [${requestId}] Analyzing reference image with Gemini 2.5 Flash Image Preview`);

      const analysisRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify(analysisRequestBody)
        }
      );

      const analysisJson = await analysisRes.json().catch(() => ({} as any));

      if (!analysisRes.ok) {
        console.error(`❌ [${requestId}] Gemini analysis FAILED:`, analysisJson);
        
        // Check if this is a content policy violation during analysis
        const isContentBlock = analysisJson?.error?.message?.includes?.("PROHIBITED_CONTENT") || 
                               analysisJson?.error?.message?.includes?.("content policy") ||
                               analysisRes.status === 400;
        
        if (isContentBlock && openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🚫 [${requestId}] Content policy violation during analysis, attempting ChatGPT character modification (${promptModificationAttempts}/3)`);
          
          // Extract just the character description from the original prompt
          const characterMatch = prompt.match(/Character must be entirely replaced with:\s*(.+)$/);
          const originalCharacter = characterMatch?.[1] || prompt.split(": ").pop() || prompt;
          
          console.log(`📝 [${requestId}] Character to modify: "${originalCharacter}"`);
          console.log(`📏 [${requestId}] Character limit: ${originalCharacter.length} chars (original: "${originalCharacter}")`);
          
          const modifiedCharacter = await modifyPromptWithChatGPT(
            originalCharacter,  // Only modify the character part
            originalCharacter,  // Pass the same as original user prompt
            prefix,             // Pass prefix to maintain object constraints
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          
          if (modifiedCharacter !== originalCharacter) {
            // Reconstruct the full prompt with the modified character
            finalPrompt = prompt.replace(originalCharacter, modifiedCharacter);
            analysisSuccessful = false; // Mark as unsuccessful so we use original prompt structure
            console.log(`✅ [${requestId}] ChatGPT modified character within limits: "${modifiedCharacter}"`);
            console.log(`🔍 [${requestId}] Modified character: "${modifiedCharacter}" (${modifiedCharacter.length}/${originalCharacter.length} chars)`);
          } else {
            console.log(`  🔄 [${requestId}] Using original prompt as fallback`);
            finalPrompt = prompt;
            analysisSuccessful = false;
          }
        } else {
          console.log(`  🔄 [${requestId}] Using original prompt as fallback`);
          finalPrompt = prompt;
          analysisSuccessful = false;
        }
      } else {
        const analysisText = analysisJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (analysisText) {
          // Check if the analysis returned a refusal message instead of actual analysis
          const isRefusal = analysisText.includes("I cannot") || 
                           analysisText.includes("harmful") || 
                           analysisText.includes("inappropriate") ||
                           analysisText.includes("content policy");
          
          if (isRefusal && openaiKey && promptModificationAttempts < 3) {
            promptModificationAttempts++;
            console.log(`🚫 [${requestId}] Analysis returned refusal, attempting ChatGPT character modification (${promptModificationAttempts}/3)`);
            
            // Extract just the character description from the original prompt
            const characterMatch = prompt.match(/Character must be entirely replaced with:\s*(.+)$/);
            const originalCharacter = characterMatch?.[1] || prompt.split(": ").pop() || prompt;
            
            console.log(`📝 [${requestId}] Character to modify: "${originalCharacter}"`);
            console.log(`📏 [${requestId}] Character limit: ${originalCharacter.length} chars (original: "${originalCharacter}")`);
            
            const modifiedCharacter = await modifyPromptWithChatGPT(
              originalCharacter,  // Only modify the character part
              originalCharacter,  // Pass the same as original user prompt
              prefix,             // Pass prefix to maintain object constraints
              promptModificationAttempts, 
              openaiKey, 
              requestId
            );
            
            if (modifiedCharacter !== originalCharacter) {
              // Reconstruct the full prompt with the modified character
              finalPrompt = prompt.replace(originalCharacter, modifiedCharacter);
              analysisSuccessful = false; // Use original prompt structure
              console.log(`✅ [${requestId}] ChatGPT modified character within limits: "${modifiedCharacter}"`);
              console.log(`🔍 [${requestId}] Modified character: "${modifiedCharacter}" (${modifiedCharacter.length}/${originalCharacter.length} chars)`);
            } else {
              finalPrompt = prompt;
              analysisSuccessful = false;
            }
          } else {
            finalPrompt = analysisText;
            analysisSuccessful = true;
            console.log(`  ✅ [${requestId}] Enhanced prompt from analysis: "${finalPrompt.substring(0, 100)}..."`);
          }
        } else {
          console.error(`❌ [${requestId}] No analysis text returned`);
          console.log(`  🔄 [${requestId}] Using original prompt as fallback for empty response`);
          finalPrompt = prompt;
          analysisSuccessful = false;
        }
      }
    }

    // Extract object constraints for generation
    const hasObjectConstraints = prefix.toLowerCase().includes('no objects') || 
                                 prefix.toLowerCase().includes('cannot be present') ||
                                 prefix.toLowerCase().includes('no props') ||
                                 prefix.toLowerCase().includes('no items');
    
    console.log(`🎯 [${requestId}] hasObjectConstraints: ${hasObjectConstraints}`);
    
    // Now generate image using Gemini 2.5 Flash Image Preview with reference image if available
    const generationParts = [];
    
    // Add reference image to generation if available (for better composition preservation)
    if (imageData) {
      const [mimeTypePart, base64Data] = imageData.split(",");
      const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
      
      generationParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }
    
    // Add the enhanced prompt with explicit image generation instruction
    const explicitPrompt = getGenerationPrompt(finalPrompt, hasObjectConstraints, requestId);
    
    generationParts.push({
      text: explicitPrompt
    });

    // Enhanced retry logic with ChatGPT prompt modification fallback
    let generationAttempts = 0;
    const maxGenerationAttempts = 3;
    let generationJson: any;
    let images: string[] = [];
    let currentPrompt = finalPrompt;

    while (generationAttempts < maxGenerationAttempts && images.length === 0) {
      generationAttempts++;

      // Update generation parts with current prompt
      let currentGenerationParts = [];
      
      // For attempt 2 with object constraints, skip reference image to avoid prop conflicts
      const useReferenceImage = imageData && !(hasObjectConstraints && generationAttempts === 2);
      if (useReferenceImage) {
        const [mimeTypePart, base64Data] = imageData.split(",");
        const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
        
        currentGenerationParts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        });
        console.log(`🖼️ [${requestId}] Using reference image for generation attempt ${generationAttempts}`);
      } else if (hasObjectConstraints && generationAttempts === 2) {
        console.log(`🚫 [${requestId}] Skipping reference image for attempt ${generationAttempts} due to object constraints`);
      }
      
      currentGenerationParts.push({
        text: getGenerationPrompt(currentPrompt, hasObjectConstraints, requestId)
      });

      const generationRequestBody = {
        contents: [{
          parts: currentGenerationParts
        }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      };

      console.log(`  🎨 [${requestId}] Generation attempt ${generationAttempts}/${maxGenerationAttempts} with Gemini 2.5 Flash Image Preview`);
      console.log(`  📝 [${requestId}] Using prompt: "${currentPrompt.substring(0, 100)}..."`);

      const generationRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify(generationRequestBody)
        }
      );

      generationJson = await generationRes.json().catch(() => ({} as any));

      if (!generationRes.ok) {
        console.error(`❌ [${requestId}] Gemini generation attempt ${generationAttempts} FAILED:`, generationJson);
        
        // Check if it's a content policy violation and we have ChatGPT available
        const isContentBlock = generationJson?.error?.message?.includes?.("PROHIBITED_CONTENT") || 
                              generationJson?.error?.message?.includes?.("content policy") ||
                              generationRes.status === 400;
        
        if (isContentBlock && openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🤖 [${requestId}] Content policy violation detected, attempting ChatGPT prompt modification (${promptModificationAttempts}/3)`);
          
          const modifiedPrompt = await modifyPromptWithChatGPT(
            currentPrompt, // Pass the full enhanced prompt 
            prompt,        // Pass the original user prompt
            prefix,        // Pass the extracted prefix
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          if (modifiedPrompt !== currentPrompt) {
            currentPrompt = modifiedPrompt;
            console.log(`🔄 [${requestId}] Retrying with modified prompt: "${currentPrompt.substring(0, 100)}..."`);
            generationAttempts--; // Don't count this as a failed generation attempt
            continue;
          }
        }
        
        if (generationAttempts === maxGenerationAttempts) {
          return new Response(
            JSON.stringify({ 
              error: generationJson?.error?.message || "Gemini generation error", 
              raw: generationJson,
              requestId,
              promptModificationAttempts
            }),
            { status: generationRes.status, headers: CORS }
          );
        }
        continue;
      }

      // Extract generated images from Gemini 2.5 Flash response
      const candidate = generationJson?.candidates?.[0];
      if (!candidate) {
        console.log(`⚠️ [${requestId}] No candidate returned from Gemini on attempt ${generationAttempts}`);
        continue;
      }

      // Look for inline_data or inlineData parts containing images (API variants)
      const parts = candidate?.content?.parts ?? [];
      const imageParts = parts.filter((part: any) => part?.inline_data || part?.inlineData);
      
      console.log(`  🔍 [${requestId}] Found ${imageParts.length} image parts in attempt ${generationAttempts}`);
      
      images = imageParts
        .map((part: any) => {
          const mimeType = part.inline_data?.mime_type || part.inlineData?.mimeType || "image/png";
          const base64Data = part.inline_data?.data || part.inlineData?.data;
          return base64Data ? `data:${mimeType};base64,${base64Data}` : null;
        })
        .filter(Boolean);

      if (images.length === 0) {
        const textParts = parts.filter((part: any) => part.text);
        if (textParts.length > 0) {
          console.log(`⚠️ [${requestId}] Attempt ${generationAttempts} returned text instead of image, retrying...`);
        }
        
        // Check if empty results might be due to content blocking - trigger ChatGPT fallback
        if (openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🚫 [${requestId}] Empty results detected (potential content block), attempting ChatGPT prompt modification (${promptModificationAttempts}/3)`);
          
          const modifiedPrompt = await modifyPromptWithChatGPT(
            currentPrompt, // Pass the full enhanced prompt 
            prompt,        // Pass the original user prompt
            prefix,        // Pass the extracted prefix
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          if (modifiedPrompt !== currentPrompt) {
            currentPrompt = modifiedPrompt;
            console.log(`🔄 [${requestId}] Retrying with modified prompt after empty results: "${currentPrompt.substring(0, 100)}..."`);
            generationAttempts--; // Don't count this as a failed generation attempt
            continue;
          }
        }
      }
    }

    if (!images.length) {
      console.error(`❌ [${requestId}] No images extracted from Gemini response after ${maxGenerationAttempts} attempts`);
      return new Response(
        JSON.stringify({ 
          error: "No images generated by Gemini 2.5 Flash Image Preview after multiple attempts",
          raw: generationJson,
          requestId,
          attempts: generationAttempts
        }),
        { status: 502, headers: CORS }
      );
    }

    console.log(`  ✅ [${requestId}] SUCCESS! Generated ${images.length} artist image(s) with Gemini 2.5 Flash Image Preview`);
    
    return new Response(JSON.stringify({ 
      images,
      enhancedPrompt: currentPrompt,
      debug: {
        requestId,
        originalPrompt: prompt,
        hasReferenceImage: !!imageData,
        enhancedPrompt: finalPrompt,
        finalPrompt: currentPrompt,
        imageCount: images.length,
        analysisModel: analysisModel,
        generationModel: generationModel,
        analysisSuccessful,
        promptModificationAttempts,
        timestamp: new Date().toISOString(),
        guaranteedGemini: true // Confirm no fallback to other services
      }
    }), { headers: CORS });

  } catch (err: any) {
    const requestId = generateRequestId(); // Generate ID even for errors
    console.error(`❌ [${requestId}] Artist generator unhandled error:`, err);
    return new Response(
      JSON.stringify({ 
        error: err?.message || "Unhandled error",
        requestId 
      }),
      { status: 500, headers: CORS }
    );
  }
});