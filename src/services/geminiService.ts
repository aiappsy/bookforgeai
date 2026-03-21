import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";

function getAI(customApiKey?: string) {
  return new GoogleGenAI({ apiKey: customApiKey || process.env.GEMINI_API_KEY });
}

async function withRetry<T>(fn: () => Promise<T>, hasCustomKey: boolean, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('RESOURCE_EXHAUSTED') || 
                          error?.message?.includes('quota');
      
      if (isRateLimit && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        const keyInfo = hasCustomKey ? "your custom API key" : "the default application API key";
        const newMsg = `${error?.message || 'Unknown error'}\n\nNote: This request was made using ${keyInfo}.`;
        if (error instanceof Error) {
          error.message = newMsg;
          throw error;
        } else {
          throw new Error(newMsg);
        }
      }
    }
  }
}

export async function researchNiche(idea: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze Amazon KDP for niche: '${idea}'. Return a JSON object with: demand_score (0-100), top_keywords (array of strings), recommended_categories (array of strings).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          demand_score: { type: Type.NUMBER },
          top_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommended_categories: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  }), !!apiKey);
  try {
    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse research JSON", e);
    return { demand_score: 50, top_keywords: [idea], recommended_categories: ["General"] };
  }
}

export async function generateOutline(idea: string, keywords: string[], apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Create a detailed 10-15 chapter outline for a comprehensive book about '${idea}'. Keywords: ${keywords.join(", ")}. Make it structured with clear chapter titles and bullet points for what each chapter will cover.`
  }), !!apiKey);
  return response.text || "";
}

export async function extractChapters(outline: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Extract a list of chapter titles from this outline. Return a JSON array of strings. Outline: ${outline}`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  }), !!apiKey);
  try {
    const text = (response.text || "[]").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse chapters JSON", e);
    return [];
  }
}

export async function generateChapter(bookIdea: string, outline: string, chapterTitle: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are writing a book about '${bookIdea}'.
    Here is the full outline for context:
    ${outline}
    
    Write the complete, detailed content for the chapter titled: "${chapterTitle}".
    Make it extremely detailed, long (at least 1500-2000 words), engaging, and well-structured. Use markdown formatting. Do not output the chapter title as an H1, just start with the content or an H2.`,
    config: {
      systemInstruction: "Write in a clear, practical, encouraging tone. Target audience: busy adults aged 35-55. Expand on concepts thoroughly."
    }
  }), !!apiKey);
  return response.text || "";
}

export async function sendChatMessage(
  message: string,
  history: { role: 'user' | 'model', text: string }[],
  currentDocument: string,
  documentType: 'outline' | 'chapter',
  apiKey?: string
) {
  const ai = getAI(apiKey);
  const updateDocTool: FunctionDeclaration = {
    name: "updateDocument",
    description: `Updates the current ${documentType} with new content based on the user's feedback. Call this ONLY when the user explicitly asks to change, rewrite, or update the document.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        revisedContent: {
          type: Type.STRING,
          description: `The complete, revised ${documentType} in Markdown format.`
        }
      },
      required: ["revisedContent"]
    }
  };

  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const systemInstruction = `You are an expert book editor and co-writer.
The user is currently working on a ${documentType}.
CURRENT DOCUMENT CONTENT:
---
${currentDocument}
---

Help the user brainstorm, critique, or rewrite. 
If the user asks you to change the document, use the 'updateDocument' tool to provide the FULL revised text. If you just want to talk or answer a question, reply normally without calling the tool.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [...formattedHistory, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [updateDocTool] }]
    }
  }), !!apiKey);

  let replyText = "";
  let revisedContent = null;

  if (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    if (call.name === "updateDocument") {
      revisedContent = (call.args as any).revisedContent;
      replyText = "I have updated the document as requested.";
    }
  } else {
    replyText = response.text || "";
  }

  return { replyText, revisedContent };
}

export async function createCover(idea: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const coverPrompt = `Professional book cover for '${idea}', genre: non-fiction, style: clean modern photography, minimalist, bold typography`;
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: coverPrompt,
    config: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K"
      }
    }
  }), !!apiKey);
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/jpeg;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function synthesizeAudiobook(manuscript: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const sampleText = manuscript.substring(0, 1000);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: sampleText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  }), !!apiKey);
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  return null;
}

export async function optimizeMetadata(idea: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Optimize KDP metadata for '${idea}'. Return a JSON object with: title, subtitle, keywords (array of 7 strings), categories (array of 2 strings), description.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING }
        }
      }
    }
  }), !!apiKey);
  try {
    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse metadata JSON", e);
    return { title: idea, subtitle: "", keywords: [], categories: [], description: "" };
  }
}
