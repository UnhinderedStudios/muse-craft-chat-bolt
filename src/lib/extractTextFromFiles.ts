// Text extraction utilities for file attachments
import type { FileAttachment } from "@/types";

// Dynamically import heavy libs only when needed
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Load PDF.js lazily
    const pdfjs = await import("pdfjs-dist");
    
    // Use CDN worker URL for reliable builds
    const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs";
    
    // @ts-ignore - types from pdfjs-dist may not include GlobalWorkerOptions shape
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    // @ts-ignore - getDocument is exported from the same module
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        // @ts-ignore - items are TextItem objects
        .map((it) => (typeof it.str === "string" ? it.str : "")) as string[];
      text += strings.join(" ") + "\n";
    }
    return text.trim();
  } catch (e) {
    console.error("PDF text extraction failed:", e);
    return "";
  }
}

async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    let mammoth: any;
    try {
      mammoth = await import("mammoth/mammoth.browser.js");
    } catch {
      mammoth = await import("mammoth");
    }
    // @ts-ignore - mammoth browser build default export contains extractRawText
    const result = await mammoth.extractRawText({ arrayBuffer });
    return (result?.value as string | undefined)?.trim() ?? "";
  } catch (e) {
    console.error("DOCX text extraction failed:", e);
    return "";
  }
}

function extractTextFromRtf(rtf: string): string {
  try {
    // Remove groups and control words in a simple way
    // 1) Replace escaped hex like \'ab
    let text = rtf.replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
      const hex = m.slice(2);
      try {
        return decodeURIComponent("%" + hex);
      } catch {
        return "";
      }
    });
    // 2) Remove RTF control words like \b, \i0, \par, etc.
    text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
    // 3) Remove braces
    text = text.replace(/[{}]/g, "");
    // 4) Collapse whitespace
    text = text.replace(/\s+/g, " ");
    return text.trim();
  } catch {
    return "";
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

function decodeBase64Text(base64: string, fallback = ""): string {
  try {
    const decoded = atob(base64);
    return decoded || fallback;
  } catch {
    return fallback;
  }
}

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function truncateIfNeeded(text: string, max = 20000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n… [truncated]";
}

export async function extractTextFromAttachments(attachments: FileAttachment[]): Promise<string> {
  const parts: string[] = [];

  for (const file of attachments) {
    const e = ext(file.name);

    // Only extract for non-plain text binary docs to avoid duplication with server
    let extracted = "";

    try {
      if (e === ".pdf") {
        extracted = await extractTextFromPdf(base64ToArrayBuffer(file.data));
      } else if (e === ".docx") {
        extracted = await extractTextFromDocx(base64ToArrayBuffer(file.data));
      } else if (e === ".rtf") {
        extracted = extractTextFromRtf(decodeBase64Text(file.data));
      } else if (e === ".txt" || e === ".md" || e === ".json" || file.type.startsWith("text/")) {
        // Let the server handle simple text files to prevent duplication
        extracted = "";
      } else {
        // Unhandled types for now
        extracted = "";
      }
    } catch (err) {
      console.error(`Failed extracting text from ${file.name}:`, err);
      extracted = "";
    }

    if (extracted) {
      parts.push(`--- File: ${file.name} ---\n${truncateIfNeeded(extracted)}`);
    }
  }

  return parts.length ? parts.join("\n\n") : "";
}
