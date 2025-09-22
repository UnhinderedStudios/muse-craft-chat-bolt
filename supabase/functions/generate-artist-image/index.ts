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
  const preservation = `\nPRESERVE COMPOSITION & BACKGROUND:\n- Keep camera angle, lighting setup, background elements, and overall structure IDENTICAL to the reference image\n- DO NOT change the environment, backdrop, or scene in any way`; 
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Adding object removal + preservation instructions to generation prompt`);
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}\n\nHARD RULES FOR GENERATION:\n- NO OBJECTS/PROPS: Absolutely no lamp posts, microphones, guitars, chairs, stands, instruments, tools, furniture, or any physical objects\n- EMPTY HANDS: Character's hands must be completely empty\n- CLEAN BACKGROUND: If reference contains props, erase them in-painting to seamlessly match the existing background\n- FOCUS: Only the character/person, their pose, expression, and clothing\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch, lamp post, microphone, guitar, chair, stand, instrument, tool, furniture, object, prop, holding, carrying, gripping\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  } else {
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  }
}

// Helper function to extract key visual descriptors that should be preserved
function extractKeywords(input: string): string[] {
  const keywords: string[] = [];
  
  // Ethnicity/race descriptors
  const ethnicityMatches = input.match(/\b(black|white|asian|latino|latina|hispanic|african|european|indian|middle eastern|arab|native|indigenous)\b/gi);
  if (ethnicityMatches) keywords.push(...ethnicityMatches);
  
  // Physical traits
  const physicalMatches = input.match(/\b(scar|scars|tattoo|piercing|eye patch|missing eye|bald|beard|mustache|long hair|short hair|curly|straight|spiky|pointy)\b/gi);
  if (physicalMatches) keywords.push(...physicalMatches);
  
  // Themes and styles
  const themeMatches = input.match(/\b(\w+[-]?themed?|\w+punk|goth|vintage|retro|futuristic|cyberpunk|steampunk)\b/gi);
  if (themeMatches) keywords.push(...themeMatches);
  
  // Color descriptors
  const colorMatches = input.match(/\b(red|blue|green|yellow|purple|pink|orange|black|white|gray|grey|silver|gold|blonde|brunette|brown)\b/gi);
  if (colorMatches) keywords.push(...colorMatches);
  
  return [...new Set(keywords.map(k => k.toLowerCase()))];
}

// Helper function to validate and restore lost keywords
function validateAndRestoreKeywords(sanitized: string, originalKeywords: string[], requestId: string): string {
  const lostKeywords: string[] = [];
  
  for (const keyword of originalKeywords) {
    if (!sanitized.toLowerCase().includes(keyword.toLowerCase())) {
      lostKeywords.push(keyword);
    }
  }
  
  if (lostKeywords.length > 0) {
    console.log(`🔍 [${requestId}] Lost keywords detected: ${lostKeywords.join(', ')}`);
    
    // Re-inject critical keywords in a natural way
    let restoredResult = sanitized;
    
    // Add lost ethnicity/physical traits
    const ethnicityLost = lostKeywords.filter(k => k.match(/\b(black|white|asian|latino|latina|hispanic|african|european|indian|middle eastern|arab|native|indigenous)\b/i));
    const physicalLost = lostKeywords.filter(k => k.match(/\b(scar|scars|tattoo|piercing|eye patch|missing eye|bald|beard|mustache|themed?)\b/i));
    const themeLost = lostKeywords.filter(k => k.match(/\b(\w+[-]?themed?|\w+punk|goth|vintage|retro|futuristic|cyberpunk|steampunk)\b/i));
    
    if (ethnicityLost.length > 0) {
      restoredResult = `${ethnicityLost[0]} ${restoredResult}`.trim();
    }
    
    if (physicalLost.length > 0 || themeLost.length > 0) {
      const traits = [...physicalLost, ...themeLost].slice(0, 2); // Limit to avoid overflow
      if (traits.length > 0) {
        restoredResult = `${restoredResult} with ${traits.join(' and ')}`.trim();
      }
    }
    
    console.log(`🔧 [${requestId}] Restored result: "${restoredResult}"`);
    return restoredResult;
  }
  
  return sanitized;
}

// Strengthened GPT sanitization with preservation-first approach
async function quickSanitizeCharacter(
  characterDescription: string, 
  openaiKey: string, 
  requestId: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key available for quick sanitization`);
    return characterDescription;
  }

  const systemPrompt = `PRESERVE USER INTENT - Transform to safe, respectful language while keeping ALL visual characteristics, themes, and physical traits intact.

PRESERVE EVERYTHING:
- Physical traits: scars, missing eyes, unique hair, body type, height, build
- Ethnicity/race: Use respectful terms (Black, Asian, Latino, White, etc.)
- Creative themes: food themes → clothing/costume patterns (bacon theme → bacon-patterned outfit)
- Style descriptors: punk, goth, cyberpunk, vintage, futuristic themes
- Colors, textures, accessories as clothing elements
- Unique characteristics that make the person distinctive

ONLY REMOVE:
- Objects in hands → convert to clothing style
- Explicit nudity/sexual content → "artistic performer style"
- Violence → "dramatic artistic pose"
- Copyrighted characters → "inspired performer style"

TRANSFORMATION EXAMPLES:
- "black dude" → "Black male performer"
- "bacon themed costume" → "performer in bacon-patterned costume design"
- "scar on face" → "performer with facial scar"
- "one eye missing" → "performer with distinctive one-eyed look"
- "pointy spiky hair" → "performer with spiky pointed hairstyle"
- "Asian woman with purple hair" → "Asian female performer with vibrant purple hair"
- "holding microphone" → "vocalist performer style"
- "cyberpunk outfit" → "performer in cyberpunk-styled costume"

OUTPUT: Respectful performer description preserving ALL user intent and visual details. MAX 120 characters.`;

  try {
    console.log(`⚡ [${requestId}] Quick sanitizing: "${characterDescription}"`);
    
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Transform this to safe performer description while preserving ALL visual details and themes: "${characterDescription}"` }
          ],
          max_tokens: 80,
          temperature: 0.2
        }),
      }),
          new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Quick sanitization timeout`)), 10000);
      })
    ]);

    if (!response.ok) {
      console.error(`❌ [${requestId}] Quick sanitization failed:`, await response.text());
      return characterDescription;
    }

    const data = await response.json();
    const sanitized = data.choices?.[0]?.message?.content?.trim();
    
    if (sanitized) {
      // Validation: Re-inject important keywords if they were lost
      const keywordsToPreserve = extractKeywords(characterDescription);
      const validatedResult = validateAndRestoreKeywords(sanitized, keywordsToPreserve, requestId);
      console.log(`✅ [${requestId}] Quick sanitized: "${validatedResult}"`);
      return validatedResult;
    }
    return characterDescription;
  } catch (error) {
    console.error(`❌ [${requestId}] Quick sanitization failed:`, error);
    return characterDescription;
  }
}

// Smart GPT failure analysis and fix
async function analyzeAndFixFailure(
  failureReason: string,
  originalCharacter: string,
  openaiKey: string,
  requestId: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key for failure analysis`);
    return originalCharacter;
  }

  const systemPrompt = `Analyze Gemini generation failure and fix the character description. 
Failure: "${failureReason}"
Original: "${originalCharacter}"

Fix by:
1. Removing problematic elements (objects, inappropriate content)
2. Making description more generic/safe
3. Focusing on basic visual traits
4. Ensuring music artist theme

Return ONLY the fixed character description, ~100-150 chars max.`;

  try {
    console.log(`🔍 [${requestId}] Analyzing failure: "${failureReason}"`);
    
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Fix this character description based on the failure.` }
          ],
          max_tokens: 60,
          temperature: 0.2
        }),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Failure analysis timeout`)), 15000);
      })
    ]);

    if (!response.ok) {
      console.error(`❌ [${requestId}] Failure analysis failed:`, await response.text());
      return originalCharacter;
    }

    const data = await response.json();
    const fixed = data.choices?.[0]?.message?.content?.trim();
    
    if (fixed) {
      console.log(`✅ [${requestId}] Fixed character: "${fixed}"`);
      return fixed;
    }
    return originalCharacter;
  } catch (error) {
    console.error(`❌ [${requestId}] Failure analysis error:`, error);
    return originalCharacter;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  // Generate unique request ID for tracking outside try-catch for global access
  let requestId: string;
  let FINAL_GENERATION_PROMPT: string | undefined;
  let CURRENT_CHARACTER: string | undefined;
  
  try {
    requestId = generateRequestId();
    console.log(`🆔 [${requestId}] Artist Generator request started - Function entry`);
    
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      console.log(`✅ [${requestId}] CORS preflight handled`);
      return new Response(null, { headers: CORS });
    }

    // Early validation
    if (!req) {
      console.error(`❌ [${requestId}] No request object received`);
      return new Response(
        JSON.stringify({ error: "Invalid request", requestId }),
        { status: 400, headers: CORS }
      );
    }

    console.log(`✅ [${requestId}] Initial request validation passed`);
    
    // Timeout wrapper for critical operations
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]);
    };

    console.log(`🔍 [${requestId}] Validating environment variables`);
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!geminiKey) {
      console.error(`❌ [${requestId}] Missing GEMINI_API_KEY`);
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY", requestId }),
        { status: 500, headers: CORS }
      );
    }
    
    console.log(`✅ [${requestId}] Environment validation passed, keys available: GEMINI=${!!geminiKey}, OPENAI=${!!openaiKey}`);

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let imageData = "";
    
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      console.log(`📤 [${requestId}] Processing multipart form data`);
      try {
        const formData = await withTimeout(req.formData(), 10000, "FormData parsing");
        prompt = (formData.get("prompt") as string) || "";
        const imageFile = formData.get("image") as File;
        
        console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", hasImage: ${!!imageFile}`);
        
        if (imageFile) {
          console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
          
          // Check file size (limit to 5MB to prevent memory issues)
          if (imageFile.size > 5 * 1024 * 1024) {
            console.error(`❌ [${requestId}] File too large: ${imageFile.size} bytes (max 5MB)`);
            return new Response(
              JSON.stringify({ error: "Image file too large. Maximum size is 5MB for optimal processing.", requestId }),
              { status: 400, headers: CORS }
            );
          }
          
          // Memory check - ensure we have enough memory for processing
          const memoryEstimate = imageFile.size * 2; // Rough estimate for base64 conversion
          if (memoryEstimate > 15 * 1024 * 1024) {
            console.error(`❌ [${requestId}] Estimated memory usage too high: ${memoryEstimate} bytes`);
            return new Response(
              JSON.stringify({ error: "Image too large for processing. Please use a smaller image.", requestId }),
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
        const body = await withTimeout(req.json(), 5000, "JSON parsing").catch(() => ({}));
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

    // Standard prefix template with object removal constraints - using Gemini-friendly language
    const STANDARD_PREFIX = "Keep composition, structure, lighting and character position identical, character must be completely transformed to the reference image, in other words not a single thing must resemble from the character in the image, this should be changed, pose must be completely different but very cool to the current image, it should be clear that the person is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Character must be completely transformed with:";

    // Extract or establish the immutable prefix and character parts
    let FULL_PREFIX = "";
    let CHARACTER = "";
    
    if (prompt.includes("Character must be entirely replaced with:")) {
      // User provided full prompt with prefix
      const prefixMatch = prompt.match(/^(.*?Character must be entirely replaced with:)\s*(.*)$/s);
      FULL_PREFIX = prefixMatch?.[1] || STANDARD_PREFIX;
      CHARACTER = prefixMatch?.[2]?.trim() || "";
      console.log(`✅ [${requestId}] User provided full prompt - prefix extracted`);
    } else {
      // User provided only character description - auto-prepend standard prefix
      FULL_PREFIX = STANDARD_PREFIX;
      CHARACTER = prompt.trim();
      console.log(`🔧 [${requestId}] Auto-prepending standard prefix to user input: "${CHARACTER}"`);
    }
    
    console.log(`🎯 [${requestId}] Immutable Prefix System Debug:`);
    console.log(`  🔒 [${requestId}] FULL_PREFIX: "${FULL_PREFIX}"`);
    console.log(`  🎭 [${requestId}] CHARACTER: "${CHARACTER}"`);
    console.log(`  🖼️ [${requestId}] Has reference image: ${!!imageData}`);
    console.log(`  🛡️ [${requestId}] Prefix protection: ENABLED - prefix will never be modified`);
    console.log(`  🔄 [${requestId}] Request independent - no state persistence`);

    // ALWAYS use Gemini 2.5 Flash Image Preview for BOTH analysis and generation - matching Nano Banana UI
    const analysisModel = "gemini-2.5-flash-image-preview";
    const generationModel = "gemini-2.5-flash-image-preview";
    
    console.log(`🔧 [${requestId}] Using models: analysis=${analysisModel}, generation=${generationModel}`);
    
    // Initialize CURRENT_CHARACTER from extracted CHARACTER
    CURRENT_CHARACTER = CHARACTER;
    
    // STEP 1: Multi-stage sanitization process
    console.log(`📝 [${requestId}] ORIGINAL INPUT: "${CHARACTER}"`);
    
    // Stage 1: Quick GPT sanitization
    if (CURRENT_CHARACTER && openaiKey) {
      console.log(`⚡ [${requestId}] Stage 1 - Quick GPT sanitization: "${CURRENT_CHARACTER}"`);
      
      const sanitizedCharacter = await quickSanitizeCharacter(
        CURRENT_CHARACTER,
        openaiKey, 
        requestId
      );
      
      if (sanitizedCharacter !== CURRENT_CHARACTER) {
        CURRENT_CHARACTER = sanitizedCharacter;
        console.log(`✅ [${requestId}] Stage 1 COMPLETE: "${CURRENT_CHARACTER}"`);
      } else {
        console.log(`ℹ️ [${requestId}] Stage 1 - No changes needed`);
      }
    }

    // Stage 2: Selective object removal (preserve themes)
    console.log(`🔧 [${requestId}] Stage 2 - Selective pattern removal on: "${CURRENT_CHARACTER}"`);
    let stageTwo = CURRENT_CHARACTER;
    
    // Remove ONLY objects in hands/being used (preserve clothing themes)
    const objectPatterns = [
      /\b(holding|carrying|playing|using)\s+(a\s+|an\s+|the\s+)?(?:guitar|microphone|mic|instrument|piano|drums|bass|phone|cup|bottle)\b/gi,
      /\b(sitting on|standing on)\s+(a\s+|an\s+|the\s+)?(chair|stool|stage|platform|booth)\b/gi,
      /\b(eating|drinking|smoking)\s+\w+/gi,
      // Remove standalone instruments when clearly objects (not themes)
      /\b(with\s+)?(a\s+|an\s+|the\s+)(guitar|microphone|mic|instrument|piano|drums|bass)\b(?!\s*(design|pattern|theme|style|costume|outfit))/gi
    ];
    
    objectPatterns.forEach((pattern, idx) => {
      const before = stageTwo;
      stageTwo = stageTwo.replace(pattern, '');
      if (before !== stageTwo) {
        console.log(`🗑️ [${requestId}] Pattern ${idx + 1} removed objects`);
      }
    });
    
    // Stage 3: Artist name removal with improved detection
    const artistPatterns = [
      /\b(taylor swift|ed sheeran|adele|drake|beyonce|kanye|rihanna|ariana|justin bieber)\b/gi,
      /\b(like|style of|similar to|inspired by|as)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/gi,
      /\b[A-Z][a-z]+\s+style\b/gi
    ];
    
    artistPatterns.forEach((pattern, idx) => {
      const before = stageTwo;
      stageTwo = stageTwo.replace(pattern, '');
      if (before !== stageTwo) {
        console.log(`🎭 [${requestId}] Artist pattern ${idx + 1} removed`);
      }
    });

    // Stage 4: Clean up and normalize
    stageTwo = stageTwo
      .replace(/\s{2,}/g, ' ')
      .replace(/[,\s]+$/g, '')
      .replace(/^[,\s]+/g, '')
      .trim();
      
    if (stageTwo !== CURRENT_CHARACTER) {
      CURRENT_CHARACTER = stageTwo;
      console.log(`✅ [${requestId}] Stage 2-4 COMPLETE: "${CURRENT_CHARACTER}"`);
    }

    // Stage 5: Final safety checkpoint
    const prohibitedPatterns = [
      'penis', 'vagina', 'sex', 'nude', 'naked', 'explicit', 'nsfw',
      'kill', 'death', 'blood', 'violence', 'weapon', 'gun', 'knife'
    ];
    
    const hasProhibited = prohibitedPatterns.some(pattern => 
      CURRENT_CHARACTER.toLowerCase().includes(pattern)
    );
    
    if (hasProhibited) {
      console.log(`🚨 [${requestId}] BLOCKED: Prohibited content in final check`);
      CURRENT_CHARACTER = "Professional music performer with clean artistic styling";
      console.log(`🔒 [${requestId}] SAFETY OVERRIDE applied`);
    }
    
    // If character becomes too short, use fallback
    if (CURRENT_CHARACTER.length < 5) {
      CURRENT_CHARACTER = "Professional musician portrait with studio lighting";
      console.log(`📏 [${requestId}] SHORT DESCRIPTION FALLBACK applied`);
    }

    const hasObjectConstraints = FULL_PREFIX.toLowerCase().includes('no objects');
    FINAL_GENERATION_PROMPT = `${FULL_PREFIX} ${CURRENT_CHARACTER}`;
    
    console.log(`🎯 [${requestId}] SANITIZATION COMPLETE - Stages passed, sending to Gemini`);
    console.log(`📋 [${requestId}] FINAL SANITIZED CHARACTER: "${CURRENT_CHARACTER}"`)
    
    console.log(`🎯 [${requestId}] FINAL TO GEMINI: "${FINAL_GENERATION_PROMPT.substring(0, 100)}..."`);
    
    let generationParts = [];
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
    
    generationParts.push({
      text: getGenerationPrompt(FINAL_GENERATION_PROMPT, hasObjectConstraints, requestId)
    });

    console.log(`🎨 [${requestId}] Generating with Gemini...`);
    
    const generationRes = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: generationParts
            }],
            generationConfig: {
              temperature: 0.85,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            }
          })
        }
      ),
      20000,
      "Gemini generation"
    );

    const generationJson = await generationRes.json().catch(() => ({}));
    let images: string[] = [];

    if (generationRes.ok) {
      const candidate = generationJson?.candidates?.[0];
      if (candidate) {
        const parts = candidate?.content?.parts ?? [];
        const imageParts = parts.filter((part: any) => part?.inline_data || part?.inlineData);
        
        images = imageParts
          .map((part: any) => {
            const mimeType = part.inline_data?.mime_type || part.inlineData?.mimeType || "image/png";
            const base64Data = part.inline_data?.data || part.inlineData?.data;
            return base64Data ? `data:${mimeType};base64,${base64Data}` : null;
          })
          .filter(Boolean);
        
        console.log(`✅ [${requestId}] Generated ${images.length} images`);
      }
    }

    // Only retry if failed AND we have OpenAI for fixing
    if (images.length === 0 && openaiKey) {
      console.log(`🔄 [${requestId}] Failed, trying GPT fix + retry...`);
      
      const failureReason = generationJson?.error?.message || "No images returned";
      const fixedCharacter = await analyzeAndFixFailure(
        failureReason,
        CURRENT_CHARACTER,
        openaiKey,
        requestId
      );
      
      if (fixedCharacter !== CURRENT_CHARACTER) {
        console.log(`🎯 [${requestId}] Retrying with: "${fixedCharacter}"`);
        
        // Update prompt and retry once
        const retryPrompt = `${FULL_PREFIX} ${fixedCharacter}`;
        generationParts[generationParts.length - 1] = {
          text: getGenerationPrompt(retryPrompt, hasObjectConstraints, requestId)
        };
        
        const retryRes = await withTimeout(
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": geminiKey,
              },
              body: JSON.stringify({
                contents: [{
                  parts: generationParts
                }],
                generationConfig: {
                  temperature: 0.85,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 8192,
                }
              })
            }
          ),
          20000,
          "Gemini retry"
        );

        const retryJson = await retryRes.json().catch(() => ({}));
        
        if (retryRes.ok) {
          const candidate = retryJson?.candidates?.[0];
          if (candidate) {
            const parts = candidate?.content?.parts ?? [];
            const imageParts = parts.filter((part: any) => part?.inline_data || part?.inlineData);
            
            images = imageParts
              .map((part: any) => {
                const mimeType = part.inline_data?.mime_type || part.inlineData?.mimeType || "image/png";
                const base64Data = part.inline_data?.data || part.inlineData?.data;
                return base64Data ? `data:${mimeType};base64,${base64Data}` : null;
              })
              .filter(Boolean);
            
            console.log(`✅ [${requestId}] Retry generated ${images.length} images`);
          }
        }
      }
    }

    if (!images.length) {
      console.error(`❌ [${requestId}] No images extracted from Gemini response after attempts`);
      return new Response(
        JSON.stringify({ 
          error: "No images generated by Gemini 2.5 Flash Image Preview after multiple attempts",
          raw: generationJson,
          requestId
        }),
        { status: 502, headers: CORS }
      );
    }

    console.log(`  ✅ [${requestId}] SUCCESS! Generated ${images.length} artist image(s) with Gemini 2.5 Flash Image Preview`);
    
    // Validate critical variables before response construction
    const safeFinalPrompt = FINAL_GENERATION_PROMPT || 'generation_prompt_undefined';
    const safeCurrentCharacter = CURRENT_CHARACTER || 'character_undefined';
    
    console.log(`✅ [${requestId}] Successful generation - returning ${images.length} images`);
    console.log(`🔍 [${requestId}] Final response validation - prompt: ${!!safeFinalPrompt}, character: ${!!safeCurrentCharacter}`);
    
    // Debug: Show transformation process
    console.log(`🔍 [${requestId}] TRANSFORMATION DEBUG:`);
    console.log(`  📝 Original input: "${CHARACTER}"`);
    console.log(`  🔧 After sanitization: "${safeCurrentCharacter}"`);
    console.log(`  🎯 Final to Gemini: "${safeFinalPrompt?.substring(0, 150)}..."`);
    
    // Final validation before response construction
    if (!images || images.length === 0) {
      console.error(`❌ [${requestId}] No images generated despite success flag`);
      return new Response(
        JSON.stringify({ 
          error: "No images were generated", 
          requestId,
          debug: {
            finalPrompt: safeFinalPrompt,
            character: safeCurrentCharacter,
            errorPhase: "validation"
          }
        }),
        { status: 500, headers: CORS }
      );
    }
    
    // Construct response with additional validation
    try {
      const responseData = { 
        images,
        enhancedPrompt: safeFinalPrompt,
        debug: {
          requestId,
          originalPrompt: prompt || 'undefined',
          hasReferenceImage: !!imageData,
          finalPrompt: safeFinalPrompt,
          character: safeCurrentCharacter,
          imageCount: images.length,
          analysisModel: analysisModel || 'undefined',
          generationModel: generationModel || 'undefined',
          timestamp: new Date().toISOString(),
          guaranteedGemini: true // Confirm no fallback to other services
        }
      };
      
      const responseJson = JSON.stringify(responseData);
      console.log(`📦 [${requestId}] Response size: ${responseJson.length} characters`);
      
      return new Response(responseJson, { headers: CORS });
    } catch (responseError: any) {
      console.error(`❌ [${requestId}] Response construction failed:`, responseError);
      return new Response(
        JSON.stringify({ 
          error: "Response construction failed", 
          requestId,
          details: responseError.message 
        }),
        { status: 500, headers: CORS }
      );
    }

  } catch (err: any) {
    // Defensive error handling to prevent 502
    let errorRequestId: string;
    let safeFinalPrompt: string;
    let safeCurrentCharacter: string;
    
    try {
      errorRequestId = typeof requestId !== 'undefined' ? requestId : generateRequestId();
      safeFinalPrompt = typeof FINAL_GENERATION_PROMPT !== 'undefined' ? FINAL_GENERATION_PROMPT : 'undefined';
      safeCurrentCharacter = typeof CURRENT_CHARACTER !== 'undefined' ? CURRENT_CHARACTER : 'undefined';
      
      console.error(`❌ [${errorRequestId}] Artist generator unhandled error:`, err?.message || 'unknown error');
      if (err?.stack) {
        console.error(`❌ [${errorRequestId}] Error stack:`, err.stack);
      }
    } catch (loggingError) {
      // Even logging failed, use absolute fallbacks
      errorRequestId = 'error_' + Date.now();
      safeFinalPrompt = 'undefined';
      safeCurrentCharacter = 'undefined';
      console.error(`❌ [${errorRequestId}] Critical error in error handling:`, loggingError);
    }
    
    try {
      const errorResponse = {
        error: (err?.message || "Unhandled error").toString(),
        requestId: errorRequestId,
        debug: {
          finalPrompt: safeFinalPrompt,
          character: safeCurrentCharacter,
          errorPhase: "execution",
          timestamp: new Date().toISOString(),
          errorType: err?.name || 'UnknownError'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), { status: 500, headers: CORS });
    } catch (responseError) {
      // Last resort fallback
      console.error(`❌ Critical: Cannot construct error response:`, responseError);
      return new Response(
        JSON.stringify({ error: "Critical system error", requestId: errorRequestId || 'unknown' }),
        { status: 500, headers: CORS }
      );
    }
  }
});