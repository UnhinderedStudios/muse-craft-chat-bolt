// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Transport layer helper for robust Gemini API calls with retry logic
async function callGeminiWithTransportRetries(
  url: string,
  body: any,
  headers: Record<string, string>,
  requestId: string,
  attemptNumber: number = 1
): Promise<Response> {
  const maxTransportRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let retry = 0; retry < maxTransportRetries; retry++) {
    try {
      console.log(`🌐 [${requestId}] Gemini API call attempt ${retry + 1}/${maxTransportRetries} (generation attempt ${attemptNumber})`);
      
      // Add optimized headers for proxy handling
      const optimizedHeaders = {
        ...headers,
        'Accept': 'application/json',
        'Connection': 'keep-alive',
        'User-Agent': 'Supabase-Edge-Function/1.0'
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: optimizedHeaders,
        body: JSON.stringify(body)
      });
      
      // Log response details for debugging
      console.log(`📡 [${requestId}] Gemini response: ${response.status} ${response.statusText}`);
      console.log(`📊 [${requestId}] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
      
      return response;
      
    } catch (error) {
      const isLastRetry = retry === maxTransportRetries - 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`🔌 [${requestId}] Transport error attempt ${retry + 1}: ${errorMessage}`);
      
      if (isLastRetry) {
        throw new Error(`Transport failed after ${maxTransportRetries} attempts: ${errorMessage}`);
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, retry) + Math.random() * 1000;
      console.log(`⏳ [${requestId}] Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unexpected transport retry loop exit');
}

// Safe response reader that handles 502s and non-JSON responses
async function readResponseSafely(response: Response, requestId: string): Promise<{
  success: boolean;
  data?: any;
  error?: {
    status: number;
    statusText: string;
    contentType: string;
    headers: Record<string, string>;
    bodySnippet: string;
    isHtml502: boolean;
  };
}> {
  const status = response.status;
  const statusText = response.statusText;
  const contentType = response.headers.get('content-type') || '';
  const headers = Object.fromEntries(response.headers.entries());
  
  try {
    const text = await response.text();
    const bodySnippet = text.substring(0, 500); // First 500 chars for debugging
    
    // Check if it's an HTML 502 error page
    const isHtml502 = status === 502 && contentType.includes('text/html');
    if (isHtml502) {
      console.error(`🚫 [${requestId}] HTML 502 detected - proxy/gateway error`);
      console.error(`📄 [${requestId}] Response body snippet: ${bodySnippet}`);
    }
    
    // Log non-JSON responses for debugging
    if (!contentType.includes('application/json') && status !== 200) {
      console.error(`📋 [${requestId}] Non-JSON error response (${status}): ${bodySnippet}`);
    }
    
    if (response.ok && contentType.includes('application/json')) {
      const data = JSON.parse(text);
      return { success: true, data };
    }
    
    return {
      success: false,
      error: {
        status,
        statusText,
        contentType,
        headers,
        bodySnippet,
        isHtml502
      }
    };
    
  } catch (parseError) {
    console.error(`🔍 [${requestId}] Failed to read response: ${parseError}`);
    return {
      success: false,
      error: {
        status,
        statusText,
        contentType,
        headers,
        bodySnippet: `Parse error: ${parseError}`,
        isHtml502: false
      }
    };
  }
}

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
function getGenerationPrompt(finalPrompt: string, hasObjectConstraints: boolean, requestId: string, backgroundHex?: string, characterCount?: number): string {
  const preservation = `\nPRESERVE COMPOSITION & BACKGROUND:\n- Keep camera angle, lighting setup, background elements, and overall structure IDENTICAL to the reference image\n- DO NOT change the environment, backdrop, or scene in any way`; 
  
  // Add background color instruction if provided
  const backgroundInstruction = backgroundHex ? `\n- BACKGROUND COLOR: Change background color to ${backgroundHex}` : '';
  
  // Always add character count instruction (include for characterCount = 1)
  const characterInstruction = `\n- CHARACTER COUNT: Image contains ${characterCount || 1} distinct character${(characterCount || 1) > 1 ? 's' : ''}`;
  
  // Add safety hint for single characters to avoid face-swap detection
  const singleCharacterSafety = (characterCount === 1) ? `\n- SAFETY NOTE: Do not edit or transform the identity of the person in the reference image. Use the image only as a style guide for lighting, framing and mood. Generate a completely new, original character from scratch.` : '';
  
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Adding object removal + preservation instructions to generation prompt`);
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}${backgroundInstruction}${characterInstruction}${singleCharacterSafety}\n\nHARD RULES FOR GENERATION:\n- NO OBJECTS/PROPS: Absolutely no lamp posts, microphones, guitars, chairs, stands, instruments, tools, furniture, or any physical objects\n- EMPTY HANDS: Character's hands must be completely empty\n- CLEAN BACKGROUND: If reference contains props, erase them in-painting to seamlessly match the existing background\n- FOCUS: Only the character/person, their pose, expression, and clothing\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch, lamp post, microphone, guitar, chair, stand, instrument, tool, furniture, object, prop, holding, carrying, gripping\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  } else {
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}${backgroundInstruction}${characterInstruction}${singleCharacterSafety}\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  }
}

// Helper function to extract key visual descriptors that should be preserved
function extractKeywords(input: string): string[] {
  const keywords: string[] = [];
  
  // Gender descriptors (CRITICAL)
  const genderMatches = input.match(/\b(man|woman|male|female|boy|girl|guy|lady|dude)\b/gi);
  if (genderMatches) keywords.push(...genderMatches);
  
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
    
    // CRITICAL: Add lost gender first (highest priority)
    const genderLost = lostKeywords.filter(k => k.match(/\b(man|woman|male|female|boy|girl|guy|lady|dude)\b/i));
    if (genderLost.length > 0) {
      const genderTerm = genderLost[0].toLowerCase();
      // Convert to appropriate performer term
      const genderMap: Record<string, string> = {
        'man': 'male', 'guy': 'male', 'dude': 'male', 'boy': 'male',
        'woman': 'female', 'lady': 'female', 'girl': 'female'
      };
      const performerGender = genderMap[genderTerm] || genderTerm;
      restoredResult = `${performerGender} ${restoredResult}`.trim();
      console.log(`🚨 [${requestId}] CRITICAL: Restored gender "${genderTerm}" as "${performerGender}"`);
    }
    
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

// Background color processing function
function processBackgroundColor(prompt: string, backgroundHex?: string): string {
  let processedPrompt = prompt;
  
  // Don't prepend background hex to prompt - handle it separately in generation
  // This prevents corrupting the character description during sanitization
  
  // Remove non-color background elements (preserve color-based backgrounds)
  // Remove patterns like "background forest", "background city", "volcano background" etc
  // But preserve "red background", "blue background", "green background" etc
  const colorKeywords = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'violet', 'turquoise', 'gold', 'silver'];
  const colorPattern = colorKeywords.join('|');
  
  // Remove non-color background requests
  processedPrompt = processedPrompt.replace(
    new RegExp(`(?<!(?:${colorPattern})\\s)background\\s+(?!(?:${colorPattern}))\\w+(?:\\s+\\w+)*(?=\\s|,|\\.|$)`, 'gi'),
    ''
  );
  
  // Remove trailing background patterns like "volcano background", "explosion background" unless they're colors
  processedPrompt = processedPrompt.replace(
    new RegExp(`(?<!(?:${colorPattern})\\s)\\w+(?:\\s+\\w+)*\\s+background(?!\\s+(?:${colorPattern}))`, 'gi'),
    ''
  );
  
  // Clean up multiple spaces and commas
  processedPrompt = processedPrompt.replace(/\s{2,}/g, ' ')
                                 .replace(/\s*,\s*/g, ', ')
                                 .replace(/,\s*,/g, ', ')
                                 .replace(/^,|,$/g, '')
                                 .trim();
  
  return processedPrompt;
}

// New two-step validation function for user intent adherence
async function validateSanitizedPrompt(
  originalPrompt: string,
  sanitizedPrompt: string,
  openaiKey: string,
  requestId: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key available for prompt validation`);
    return sanitizedPrompt;
  }

  const validationPrompt = `Compare the ORIGINAL user request with the SANITIZED version.

ORIGINAL: "${originalPrompt}"
SANITIZED: "${sanitizedPrompt}"

Can you with 100% certainty say that the user's visual requests were properly adhered to? Check for:
- All colors mentioned are preserved
- All clothing/accessory items are preserved (even if rephrased)
- All physical descriptions are maintained
- All unique visual elements are kept
- Creative combinations aren't oversimplified

If YES (all visual elements preserved): Output "APPROVED: [sanitized prompt]"
If NO (visual elements lost/oversimplified): Output "CORRECTED: [improved prompt that better preserves user's visual intent]"

Be precise - if boxing gloves were requested, they should still be recognizable as boxing gloves, not just "accessories".`;

  try {
    console.log(`🔍 [${requestId}] Validating sanitized prompt against original intent...`);
    
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
            { role: 'user', content: validationPrompt }
          ],
          max_tokens: 150,
          temperature: 0.1
        }),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Validation timeout`)), 10000);
      })
    ]);

    if (!response.ok) {
      console.error(`❌ [${requestId}] Prompt validation failed:`, await response.text());
      return sanitizedPrompt;
    }

    const data = await response.json();
    const validationResult = data.choices?.[0]?.message?.content?.trim();
    
    if (validationResult) {
      if (validationResult.startsWith('APPROVED:')) {
        const approvedPrompt = validationResult.replace('APPROVED:', '').trim();
        console.log(`✅ [${requestId}] Validation APPROVED - using sanitized prompt`);
        return approvedPrompt;
      } else if (validationResult.startsWith('CORRECTED:')) {
        const correctedPrompt = validationResult.replace('CORRECTED:', '').trim();
        console.log(`🔧 [${requestId}] Validation CORRECTED - using improved prompt`);
        console.log(`📝 [${requestId}] Correction: "${correctedPrompt}"`);
        return correctedPrompt;
      }
    }
    
    console.log(`⚠️ [${requestId}] Validation returned unexpected format, using sanitized prompt`);
    return sanitizedPrompt;
  } catch (error) {
    console.error(`❌ [${requestId}] Prompt validation failed:`, error);
    return sanitizedPrompt;
  }
}


// Strengthened GPT sanitization with preservation-first approach
async function quickSanitizeCharacter(
  characterDescription: string, 
  openaiKey: string, 
  requestId: string,
  backgroundHex?: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key available for quick sanitization`);
    return processBackgroundColor(characterDescription, backgroundHex);
  }

  const systemPrompt = `CRITICAL: PRESERVE USER INTENT - Transform to safe, respectful language while keeping ALL visual characteristics, themes, and physical traits intact.

🚨 GENDER PRESERVATION (MANDATORY):
- "man" → "male performer"
- "woman" → "female performer" 
- "guy/dude" → "male performer"
- "lady/girl" → "female performer"
- NEVER remove or ignore gender specifications
- Gender is the MOST IMPORTANT detail to preserve

PRESERVE EVERYTHING:
- Gender: ALWAYS preserve and convert to performer terms (man→male, woman→female)
- Physical traits: scars, missing eyes, unique hair, body type, height, build
- Ethnicity/race: Use respectful terms (Black, Asian, Latino, White, etc.)
- Creative themes: food themes → clothing/costume patterns (bacon theme → bacon-patterned outfit)
- Style descriptors: punk, goth, cyberpunk, vintage, futuristic themes
- Colors, textures, accessories as clothing elements
- Unique characteristics that make the person distinctive
- IMPORTANT: If someone requests a different background COLOR (red, blue, etc.), preserve it completely
- IMPORTANT: If someone requests background elements that are NOT colors (forest, city, volcano, explosion, etc.), remove these completely to keep default background
- Only preserve background requests that are pure colors

ONLY REMOVE:
- Objects in hands → convert to clothing style
- Explicit nudity/sexual content → "artistic performer style"
- Violence → "dramatic artistic pose"
- Copyrighted characters → "inspired performer style"
- Non-color background elements (keep only color backgrounds)

CRITICAL TRANSFORMATION EXAMPLES:
- "man standing still" → "male performer standing still"
- "woman singing" → "female performer singing"
- "black dude" → "Black male performer"
- "asian woman with purple hair" → "Asian female performer with vibrant purple hair"
- "bacon themed costume" → "performer in bacon-patterned costume design"
- "scar on face" → "performer with facial scar"
- "one eye missing" → "performer with distinctive one-eyed look"
- "pointy spiky hair" → "performer with spiky pointed hairstyle"
- "holding microphone" → "vocalist performer style"
- "cyberpunk outfit" → "performer in cyberpunk-styled costume"
- "red background" → "red background" (preserve)
- "volcano background" → "" (remove completely)

OUTPUT: Respectful performer description preserving ALL user intent and visual details, especially GENDER. MAX 120 characters.`;

  try {
    console.log(`⚡ [${requestId}] Quick sanitizing: "${characterDescription}"`);
    
    // Process background color first
    const processedCharacter = processBackgroundColor(characterDescription, backgroundHex);
    
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
            { role: 'user', content: `Transform this to safe performer description while preserving ALL visual details and themes: "${processedCharacter}"` }
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
    return processedCharacter;
  } catch (error) {
    console.error(`❌ [${requestId}] Quick sanitization failed:`, error);
    return processBackgroundColor(characterDescription, backgroundHex);
  }
}

// PRESERVATION-FIRST GPT failure analysis and fix - maintains all visual details
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

  const systemPrompt = `PRESERVE ALL USER DETAILS. Rewrite safely and respectfully without removing or generalizing details.

PRESERVE EVERYTHING:
- Age & ethnicity: Use respectful terms (Black, Asian, Latino, White, etc.) - NEVER remove
- Physical traits: scars, missing eyes, unique hair, body type, height, build  
- Creative themes: food themes → clothing/costume patterns (bacon theme → bacon-patterned outfit)
- Style descriptors: punk, goth, cyberpunk, vintage, futuristic themes
- Colors, textures, accessories as clothing elements
- Unique characteristics that make the person distinctive

ONLY REMOVE:
- Objects in hands → convert to "performer style" phrasing
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

CRITICAL: If you remove a word, replace with a synonym that preserves meaning. Do NOT shorten by dropping details.

Return ONLY the rewritten description (100-150 chars). Preserve ALL visual details from original.`;

  try {
    console.log(`🔍 [${requestId}] Preservation-first analysis: "${originalCharacter}"`);
    
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
            { role: 'user', content: `Rewrite this preserving ALL visual details: "${originalCharacter}"` }
          ],
          max_tokens: 80,
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
      // Re-inject any lost keywords from original
      const keywordsToPreserve = extractKeywords(originalCharacter);
      const fixedValidated = validateAndRestoreKeywords(fixed, keywordsToPreserve, requestId);
      console.log(`✅ [${requestId}] Preservation-first fixed: "${fixedValidated}"`);
      return fixedValidated;
    }
    return originalCharacter;
  } catch (error) {
    console.error(`❌ [${requestId}] Failure analysis error:`, error);
    return originalCharacter;
  }
}

// Validate that all critical detail categories are present before sending to Gemini
function validateCriticalCategories(description: string, originalKeywords: string[], requestId: string): string {
  let validated = description;
  
  // Check for required categories that should be preserved
  const ethnicityKeywords = originalKeywords.filter(k => k.match(/\b(black|white|asian|latino|latina|hispanic|african|european|indian|middle eastern|arab|native|indigenous)\b/i));
  const physicalKeywords = originalKeywords.filter(k => k.match(/\b(scar|scars|tattoo|piercing|eye patch|missing eye|bald|beard|mustache)\b/i));
  const themeKeywords = originalKeywords.filter(k => k.match(/\b(\w+[-]?themed?|\w+punk|goth|vintage|retro|futuristic|cyberpunk|steampunk)\b/i));
  const colorKeywords = originalKeywords.filter(k => k.match(/\b(red|blue|green|yellow|purple|pink|orange|black|white|gray|grey|silver|gold|blonde|brunette|brown)\b/i));
  
  // Re-inject missing critical categories
  const missingEthnicity = ethnicityKeywords.filter(k => !validated.toLowerCase().includes(k.toLowerCase()));
  const missingPhysical = physicalKeywords.filter(k => !validated.toLowerCase().includes(k.toLowerCase()));
  const missingTheme = themeKeywords.filter(k => !validated.toLowerCase().includes(k.toLowerCase()));
  const missingColors = colorKeywords.filter(k => !validated.toLowerCase().includes(k.toLowerCase()));
  
  if (missingEthnicity.length > 0) {
    validated = `${missingEthnicity[0]} ${validated}`.trim();
    console.log(`🔧 [${requestId}] Re-injected ethnicity: ${missingEthnicity[0]}`);
  }
  
  if (missingPhysical.length > 0 || missingTheme.length > 0 || missingColors.length > 0) {
    const traits = [...missingPhysical, ...missingTheme, ...missingColors.slice(0, 2)].slice(0, 3);
    if (traits.length > 0) {
      validated = `${validated} with ${traits.join(' and ')}`.trim();
      console.log(`🔧 [${requestId}] Re-injected traits: ${traits.join(', ')}`);
    }
  }
  
  return validated;
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
    let backgroundHex = "";
    let characterCount = 1;
    
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      console.log(`📤 [${requestId}] Processing multipart form data`);
      try {
        const formData = await withTimeout(req.formData(), 15000, "FormData parsing");
        prompt = (formData.get("prompt") as string) || "";
        backgroundHex = (formData.get("backgroundHex") as string) || "";
        const characterCountValue = formData.get("characterCount") as string;
        characterCount = characterCountValue ? parseInt(characterCountValue, 10) : 1;
        const imageFile = formData.get("image") as File;
        
        console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", backgroundHex: "${backgroundHex}", characterCount: ${characterCount}, hasImage: ${!!imageFile}`);
        
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
        backgroundHex = body?.backgroundHex?.toString?.() || "";
        characterCount = body?.characterCount ? parseInt(body.characterCount.toString(), 10) : 1;
        imageData = body?.imageData?.toString?.() || "";
        console.log(`📝 [${requestId}] JSON body - prompt: "${prompt}", backgroundHex: "${backgroundHex}", characterCount: ${characterCount}, hasImageData: ${!!imageData}`);
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

    // Standard prefix template with safer language to avoid PROHIBITED_CONTENT
    const STANDARD_PREFIX = "Match the overall framing, camera angle, and lighting style of the reference image. Generate a new, original character from scratch that is completely different from the alien creature in the reference image. The character should have a dynamic pose and it should be clear that the character is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Generate a new character:";

    // Extract or establish the immutable prefix and character parts
    let FULL_PREFIX = "";
    let CHARACTER = "";
    
    if (prompt.includes("Generate a new character:")) {
      // User provided full prompt with prefix
      const prefixMatch = prompt.match(/^(.*?Generate a new character:)\s*(.*)$/s);
      FULL_PREFIX = prefixMatch?.[1] || STANDARD_PREFIX;
      CHARACTER = prefixMatch?.[2]?.trim() || "";
      console.log(`✅ [${requestId}] User provided full prompt - prefix extracted`);
    } else {
      // User provided only character description - auto-prepend standard prefix
      FULL_PREFIX = STANDARD_PREFIX;
      CHARACTER = prompt.trim();
      console.log(`🔧 [${requestId}] Auto-prepending standard prefix to user input: "${CHARACTER}"`);
    }
    
    // Handle multiple character descriptions when characterCount > 1
    if (characterCount > 1) {
      console.log(`👥 [${requestId}] Processing multiple characters (count: ${characterCount})`);
      
      // Check if user provided multiple descriptions separated by " and " or ", "
      const characterDescriptions = CHARACTER.split(/\s+and\s+|,\s+/).map(desc => desc.trim()).filter(desc => desc.length > 0);
      
      if (characterDescriptions.length === 1 && characterCount > 1) {
        // Single description provided, apply to all characters
        const singleDesc = characterDescriptions[0];
        const expandedDesc = Array(characterCount).fill(singleDesc).map((desc, i) => `character ${i + 1}: ${desc}`).join(', ');
        CHARACTER = expandedDesc;
        console.log(`🔄 [${requestId}] Single description applied to ${characterCount} characters: "${CHARACTER}"`);
      } else if (characterDescriptions.length > 1) {
        // Multiple descriptions provided, use them
        const processedDescs = characterDescriptions.slice(0, characterCount).map((desc, i) => `character ${i + 1}: ${desc}`);
        // If fewer descriptions than characters, repeat the last one
        while (processedDescs.length < characterCount) {
          const lastDesc = characterDescriptions[characterDescriptions.length - 1];
          processedDescs.push(`character ${processedDescs.length + 1}: ${lastDesc}`);
        }
        CHARACTER = processedDescs.join(', ');
        console.log(`👥 [${requestId}] Multiple descriptions processed: "${CHARACTER}"`);
      }
    }

    console.log(`🎯 [${requestId}] Immutable Prefix System Debug:`);
    console.log(`  🔒 [${requestId}] FULL_PREFIX: "${FULL_PREFIX}"`);
    console.log(`  🎭 [${requestId}] CHARACTER: "${CHARACTER}"`);
    console.log(`  👥 [${requestId}] CHARACTER COUNT: ${characterCount}`);
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
        requestId,
        backgroundHex
      );
      
      if (sanitizedCharacter !== CURRENT_CHARACTER) {
        CURRENT_CHARACTER = sanitizedCharacter;
        console.log(`✅ [${requestId}] Stage 1 COMPLETE: "${CURRENT_CHARACTER}"`);
      } else {
        console.log(`ℹ️ [${requestId}] Stage 1 - No changes needed`);
      }
      
      // Stage 1.5: Validate sanitized prompt against user intent
      console.log(`🔍 [${requestId}] Stage 1.5 - Validating prompt adherence to user intent`);
      const validatedCharacter = await validateSanitizedPrompt(
        CHARACTER, // Original user prompt
        CURRENT_CHARACTER, // Current sanitized prompt
        openaiKey,
        requestId
      );
      
      if (validatedCharacter !== CURRENT_CHARACTER) {
        CURRENT_CHARACTER = validatedCharacter;
        console.log(`✅ [${requestId}] Stage 1.5 CORRECTED: "${CURRENT_CHARACTER}"`);
      } else {
        console.log(`✅ [${requestId}] Stage 1.5 APPROVED: No corrections needed`);
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
    
    const generationInstruction = getGenerationPrompt(FINAL_GENERATION_PROMPT, hasObjectConstraints, requestId, backgroundHex, characterCount);
    generationParts.push({
      text: generationInstruction
    });

    console.log(`📋 [${requestId}] COMPLETE PROMPT TO GEMINI: "${generationInstruction.substring(0, 200)}..."`);
    console.log(`🎭 [${requestId}] CHARACTER COUNT: ${characterCount}, BACKGROUND: ${backgroundHex || 'default'}`);
    console.log(`🎨 [${requestId}] Generating with Gemini...`);
    
    // Use transport-retry wrapper for robust Gemini calls
    const seed = Math.floor(Math.random() * 1000000);
    console.log(`🚀 [${requestId}] Sending initial request to Gemini (seed: ${seed}): "${finalPrompt.substring(0, 100)}..."`);
    
    const generationRes = await withTimeout(
      callGeminiWithTransportRetries(
        `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
        {
          contents: [{
            parts: generationParts
          }],
          generationConfig: {
            temperature: 0.85,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            seed
          }
        },
        {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        requestId,
        1
      ),
      45000,
      "Gemini generation"
    );

    // Use safe response reader for structured error handling
    const responseResult = await readResponseSafely(generationRes, requestId);
    let images: string[] = [];
    let lastGeminiError: any = null;

    if (responseResult.success) {
      const generationJson = responseResult.data;
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
      } else {
        console.log(`⚠️ [${requestId}] No candidate in successful response`);
        lastGeminiError = { message: "No candidate in response", data: generationJson };
      }
    } else {
      lastGeminiError = responseResult.error;
      const errorInfo = responseResult.error!;
      
      if (errorInfo.isHtml502) {
        console.error(`🚫 [${requestId}] Gemini returned HTML 502 - gateway/proxy issue`);
      } else {
        console.error(`❌ [${requestId}] Gemini API error: ${errorInfo.status} ${errorInfo.statusText}`);
      }
      
      // Log detailed error information for debugging
      console.error(`🔍 [${requestId}] Error details: status=${errorInfo.status}, type=${errorInfo.contentType}, body="${errorInfo.bodySnippet}"`);
    }

    // Multi-attempt retry loop with preservation-first approach (3 attempts total)
    if (images.length === 0 && openaiKey) {
      const failureReason = lastGeminiError?.message || lastGeminiError?.bodySnippet || "No images returned";
      const originalKeywords = extractKeywords(CURRENT_CHARACTER);
      const retryAttempts = [];
      
      console.log(`🔄 [${requestId}] Starting multi-attempt retry (max 3 attempts)...`);
      
      for (let attempt = 1; attempt <= 3 && images.length === 0; attempt++) {
        console.log(`🎯 [${requestId}] Retry attempt ${attempt}/3`);
        
        // Get preservation-first fix
        const fixedCharacter = await analyzeAndFixFailure(
          failureReason,
          CURRENT_CHARACTER,
          openaiKey,
          requestId
        );
        
        // Validate and restore critical categories
        const validatedCharacter = validateCriticalCategories(fixedCharacter, originalKeywords, requestId);
        
        // Final keyword restoration check
        const finalCharacter = validateAndRestoreKeywords(validatedCharacter, originalKeywords, requestId);
        
        console.log(`🎭 [${requestId}] Attempt ${attempt} character: "${finalCharacter}"`);
        
        // Track this attempt
        retryAttempts.push({
          attempt,
          textSentToGemini: finalCharacter,
          lostKeywords: originalKeywords.filter(k => !finalCharacter.toLowerCase().includes(k.toLowerCase())),
          restoredKeywords: originalKeywords.filter(k => finalCharacter.toLowerCase().includes(k.toLowerCase()) && !fixedCharacter.toLowerCase().includes(k.toLowerCase()))
        });
        
        // Update prompt for this attempt
        const retryPrompt = `${FULL_PREFIX} ${finalCharacter}`;
        generationParts[generationParts.length - 1] = {
          text: getGenerationPrompt(retryPrompt, hasObjectConstraints, requestId, backgroundHex, characterCount)
        };
        
        // Generate different seed for each retry attempt
        const retrySeed = Math.floor(Math.random() * 1000000);
        console.log(`🚀 [${requestId}] Sending attempt ${attempt} to Gemini (seed: ${retrySeed}): "${retryPrompt.substring(0, 100)}..."`);
        
        // Send to Gemini with transport retries
        const retryRes = await withTimeout(
          callGeminiWithTransportRetries(
            `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
            {
              contents: [{
                parts: generationParts
              }],
              generationConfig: {
                temperature: 0.85,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                seed: retrySeed
              }
            },
            {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            requestId,
            attempt + 1
          ),
          45000,
          `Gemini retry attempt ${attempt}`
        );

        const retryResult = await readResponseSafely(retryRes, requestId);
        
        if (retryResult.success) {
          const retryJson = retryResult.data;
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
            
            console.log(`✅ [${requestId}] Attempt ${attempt} generated ${images.length} images`);
            
            if (images.length > 0) {
              console.log(`🎉 [${requestId}] SUCCESS on attempt ${attempt}!`);
              break;
            }
          }
        } else {
          // Update last error for better error reporting
          lastGeminiError = retryResult.error;
          const errorInfo = retryResult.error!;
          console.log(`❌ [${requestId}] Attempt ${attempt} failed: ${errorInfo.status} ${errorInfo.statusText}`);
          if (errorInfo.isHtml502) {
            console.log(`🚫 [${requestId}] Attempt ${attempt} got HTML 502 - proxy issue`);
          }
        }
      }
      
      // If all attempts failed, log detailed debug info
      if (images.length === 0) {
        console.error(`❌ [${requestId}] All 3 retry attempts failed`);
        console.error(`🔍 [${requestId}] Debug info:`);
        console.error(`  📝 Original: "${CURRENT_CHARACTER}"`);
        console.error(`  🎯 Original keywords: [${originalKeywords.join(', ')}]`);
        retryAttempts.forEach((attempt, i) => {
          console.error(`  🔄 Attempt ${i + 1}: "${attempt.textSentToGemini}"`);
          console.error(`    Lost: [${attempt.lostKeywords.join(', ')}]`);
          console.error(`    Restored: [${attempt.restoredKeywords.join(', ')}]`);
        });
      }
    }

    if (!images.length) {
      console.error(`❌ [${requestId}] No images extracted from Gemini response after attempts`);
      
      // Prepare structured error response with debug info
      const errorResponse = {
        error: "No images generated by Gemini 2.5 Flash Image Preview after multiple attempts",
        requestId,
        details: {
          lastGeminiStatus: lastGeminiError?.status,
          lastGeminiStatusText: lastGeminiError?.statusText,
          lastGeminiHeaders: lastGeminiError?.headers,
          lastGeminiBodySnippet: lastGeminiError?.bodySnippet,
          isHtml502: lastGeminiError?.isHtml502,
          transient: lastGeminiError?.isHtml502 || lastGeminiError?.status >= 500
        },
        debug: {
          originalPrompt: CHARACTER,
          finalCharacter: CURRENT_CHARACTER,
          finalPrompt: FINAL_GENERATION_PROMPT
        }
      };
      
      return new Response(
        JSON.stringify(errorResponse),
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