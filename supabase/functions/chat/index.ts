// Supabase Edge Function: chat
// Uses OpenAI to continue a chat and return the assistant message
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return cors(new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 }));
    }

    const { messages, system } = await req.json();
    if (!Array.isArray(messages)) {
      return cors(new Response(JSON.stringify({ error: "messages must be an array" }), { status: 400 }));
    }

    // Convert messages to OpenAI format, handling attachments
    const openAiMessages = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages.map((msg: any) => {
        if (msg.attachments && msg.attachments.length > 0) {
          // Create multimodal content for messages with attachments
          const content: any[] = [{ type: "text", text: msg.content }];
          
          for (const attachment of msg.attachments) {
            if (attachment.type.startsWith('image/')) {
              content.push({
                type: "image_url",
                image_url: {
                  url: `data:${attachment.type};base64,${attachment.data}`
                }
              });
            } else if (attachment.type.includes('text') || 
                      attachment.name.endsWith('.txt') || 
                      attachment.name.endsWith('.md') || 
                      attachment.name.endsWith('.json')) {
              // For text files, decode and include content
              try {
                const textContent = atob(attachment.data);
                content[0].text += `\n\nFile "${attachment.name}":\n${textContent}`;
              } catch (e) {
                console.error('Error decoding text file:', e);
              }
          }
          }
          
          return {
            role: msg.role,
            content: content
          };
        }
        return msg;
      }),
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: openAiMessages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[chat] OpenAI error:", errText);
      return cors(new Response(JSON.stringify({ error: errText }), { status: 500 }));
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return cors(new Response(JSON.stringify({ content }), { headers: { "Content-Type": "application/json" } }));
  } catch (e) {
    return cors(new Response(JSON.stringify({ error: String(e) }), { status: 500 }));
  }
});
