import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";

export interface Attachment {
  name?: string;
  mimeType: string;
  data: string;
}

function getAI(customApiKey?: string) {
  const key = (customApiKey && customApiKey.trim() !== '' && customApiKey !== 'undefined' && customApiKey !== 'null') 
    ? customApiKey.trim() 
    : process.env.GEMINI_API_KEY;

  if (!key || key === 'undefined' || key === 'null') {
    console.error("Gemini API Key missing or invalid in environment/settings.");
    throw new Error("Missing API Key. Please click the gear icon in the bottom left to add your Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey: key });
}

async function withRetry<T>(fn: () => Promise<T>, hasCustomKey: boolean, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const isTransientError = error?.status === 429 || 
                               error?.status === 500 ||
                               error?.status === 502 ||
                               error?.status === 503 ||
                               error?.status === 504 ||
                               error?.message?.includes('429') || 
                               error?.message?.includes('502') || 
                               error?.message?.includes('503') || 
                               error?.message?.includes('RESOURCE_EXHAUSTED') || 
                               error?.message?.includes('quota');
      
      if (!isTransientError && error?.status === 400 && error?.message?.includes('API key not valid')) {
        const keyInfo = hasCustomKey ? "the CUSTOM API key you provided in settings" : "the DEFAULT application API key";
        throw new Error(`The API key provided is not valid. (Using ${keyInfo}). Please check your Gemini API key in settings or use the default one if available.`);
      }

    if (isTransientError && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`Transient error or rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1} of ${maxRetries})`);
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

export async function generateBackCover(bookDetails: any, chaptersTitleList: string[], apiKey?: string) {
  const ai = getAI(apiKey);
  
  let prompt = `You are a professional book blurb writer and marketing expert for Amazon KDP.
  Create a compelling back cover blurb for the following book:
  Title: ${bookDetails.title}
  Subtitle: ${bookDetails.subtitle}
  Description: ${bookDetails.description}
  Chapters: ${chaptersTitleList.join(', ')}

  The blurb should include:
  1. A hook (one or two sentences to grab attention).
  2. A summary of the core conflict or promise of the book.
  3. A short "Why you need this" or "What's inside" section.
  4. A call to action.

  Format the output in clean Markdown. Keep it under 250 words. Output ONLY the blurb.`;

  if (bookDetails.language) {
      prompt += `\n\nCRITICAL: You MUST write the blurb entirely in ${bookDetails.language}.`;
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate blurb.";
}
export async function researchNiche(idea: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
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

export async function generateOutline(idea: string, keywords: string[], apiKey?: string, systemPrompt?: string) {
  const ai = getAI(apiKey);

  const generate = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Create a comprehensive, highly detailed 10-15 chapter outline for a book about '${idea}'. Keywords: ${keywords.join(", ")}. Make it structured with clear chapter titles and detailed bullet points outlining key themes, concepts, case studies, and takeaways for each chapter.`,
      config: {
        systemInstruction: systemPrompt || "You are an expert Ghostwriter, Book Architect, and Publishing Specialist. Create rich, well-organized outlines."
      }
    });
    return response.text || "";
  };

  try {
    return await withRetry(() => generate("gemini-3.1-pro-preview"), !!apiKey);
  } catch (e: any) {
    console.warn("Pro model failed for outline generation. Falling back to gemini-3.6-flash...", e);
    return await withRetry(() => generate("gemini-3.6-flash"), !!apiKey);
  }
}

export async function extractChapters(outline: string, apiKey?: string, language: string = 'English') {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: `Extract a list of chapter titles exactly as they appear in this outline. Return a JSON array of strings. Keep them in ${language}. Outline: ${outline}`,
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

export async function generateChapter(bookIdea: string, outline: string, chapterTitle: string, apiKey?: string, systemPrompt?: string) {
  const ai = getAI(apiKey);
  const topic = bookIdea && bookIdea.trim() !== '' ? bookIdea : 'the book topic';
  
  const generate = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an elite bestselling author writing a full-length, publication-grade chapter for a book.
      
      BOOK TOPIC / CORE CONCEPT: '${topic}'
      
      FULL MANUSCRIPT OUTLINE FOR CONTEXT:
      ${outline}
      
      TASK: Write the complete, deeply detailed, comprehensive content for the chapter titled: "${chapterTitle}".
      
      CRITICAL MANDATORY CHAPTER REQUIREMENTS:
      1. LENGTH & DEPTH: Write a full-length chapter (at least 1,500 to 2,500 words). Expand every concept thoroughly with explanations, step-by-step guidance, real-world examples, and actionable takeaways.
      2. TOPIC ALIGNMENT: Directly address and explore the specific subject matter of "${chapterTitle}", keeping aligned with the overall book topic '${topic}'.
      3. RICH STRUCTURE: Use clean Markdown with engaging subheadings (H2, H3), bullet points, highlighted takeaways, and practical advice.
      4. DO NOT abbreviate, shorten, or output incomplete text. Write out the full chapter in complete prose from introduction to conclusion.
      5. DO NOT repeat the main book title as an H1 heading at the start. Begin directly with an engaging chapter introduction or H2 section title.`,
      config: {
        systemInstruction: systemPrompt || "Write in an authoritative, highly engaging, empathetic, and thorough tone. Provide rich depth, compelling narrative flow, and concrete insights."
      }
    });
    return response.text || "";
  };

  try {
    return await withRetry(() => generate("gemini-3.1-pro-preview"), !!apiKey);
  } catch (e: any) {
    console.warn("Pro model failed for chapter generation. Falling back to gemini-3.6-flash...", e);
    return await withRetry(() => generate("gemini-3.6-flash"), !!apiKey);
  }
}

export interface ChapterContext {
  id: string;
  title: string;
  content: string;
}

export interface ChatMessageResult {
  replyText: string;
  revisedContent?: string | null;
  updatedOutline?: string | null;
  updatedChapters?: { id?: string; title?: string; content: string }[];
}

export async function sendChatMessage(
  message: string,
  history: { role: 'user' | 'model', text: string }[],
  currentDocument: string,
  documentType: 'outline' | 'chapter' | 'manuscript',
  apiKey?: string,
  agentRole: 'ghostwriter' | 'art_director' = 'ghostwriter',
  attachments: Attachment[] = [],
  language: string = 'English',
  allChapters: ChapterContext[] = [],
  fullOutline: string = '',
  activeChapterId?: string | null
): Promise<ChatMessageResult> {
  const ai = getAI(apiKey);

  const updateDocTool: FunctionDeclaration = {
    name: "updateDocument",
    description: `Updates the currently active document (${documentType}) with new or revised content in ${language}. Call this when the user explicitly asks to change or rewrite the current active document.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        revisedContent: {
          type: Type.STRING,
          description: `The complete revised content in Markdown format. MUST be written in ${language}.`
        },
        explanation: {
          type: Type.STRING,
          description: `Short summary of what was revised.`
        }
      },
      required: ["revisedContent"]
    }
  };

  const updateOutlineTool: FunctionDeclaration = {
    name: "updateOutline",
    description: `Updates the book outline with new or revised content in ${language}. Call this whenever the user asks to update, rewrite, or expand the book outline.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        revisedOutline: {
          type: Type.STRING,
          description: `The complete revised outline in Markdown format.`
        },
        explanation: {
          type: Type.STRING,
          description: `Short summary of outline changes.`
        }
      },
      required: ["revisedOutline"]
    }
  };

  const updateChapterTool: FunctionDeclaration = {
    name: "updateChapter",
    description: `Updates a single specific chapter's content in ${language}. Call this when the user asks to edit, rewrite, expand, or polish a specific chapter.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        chapterId: {
          type: Type.STRING,
          description: `The ID, index, or title of the chapter to update (e.g. "1" or chapter ID).`
        },
        chapterTitle: {
          type: Type.STRING,
          description: `The title of the chapter being updated.`
        },
        revisedContent: {
          type: Type.STRING,
          description: `The complete revised chapter content in Markdown format.`
        },
        explanation: {
          type: Type.STRING,
          description: `Short summary of chapter changes.`
        }
      },
      required: ["revisedContent"]
    }
  };

  const updateMultipleChaptersTool: FunctionDeclaration = {
    name: "updateMultipleChapters",
    description: `Updates MULTIPLE or ALL chapters across the manuscript in ${language}. ALWAYS call this when the user asks to 'update all chapters', 'rewrite all chapters', 'polish the whole manuscript', or edit multiple chapters at once.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              chapterId: { type: Type.STRING, description: "Chapter ID, chapter index number (e.g. '1', '2'), or exact title" },
              chapterTitle: { type: Type.STRING, description: "Chapter Title" },
              revisedContent: { type: Type.STRING, description: "Complete revised chapter text in Markdown" }
            },
            required: ["revisedContent"]
          },
          description: `List of updated chapters with their complete revised content.`
        },
        explanation: {
          type: Type.STRING,
          description: `Summary of changes made across all updated chapters.`
        }
      },
      required: ["chapters"]
    }
  };

  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const chaptersOverview = allChapters && allChapters.length > 0
    ? allChapters.map((c, i) => `[CHAPTER ${i + 1}] ID: "${c.id}" | Title: "${c.title}"\nContent Preview / Length: ${c.content.length} chars\n---\n${c.content}\n---`).join('\n\n')
    : 'No chapters created yet.';

  const activeChapterObj = allChapters.find(c => c.id === activeChapterId);

  const ghostwriterInstruction = `You are an expert Ghostwriter, Book Editor, and Master Stylist.
You have FULL EDITORIAL CONTROL over the user's book manuscript.

BOOK OUTLINE:
===
${fullOutline || currentDocument || '(No outline provided)'}
===

ALL MANUSCRIPT CHAPTERS (${allChapters.length} Total):
===
${chaptersOverview}
===

CURRENT VIEW: ${documentType.toUpperCase()} ${activeChapterObj ? `(Active Chapter: "${activeChapterObj.title}", ID: "${activeChapterObj.id}")` : ''}

CRITICAL MANDATORY RULES FOR ALL EDITS:
1. SURGICAL EDITS & LENGTH PRESERVATION:
   - Perform ONLY the specific edits, additions, or modifications explicitly requested by the user.
   - NEVER truncate, condense, shorten, or cut existing text unless the user explicitly requested you to shorten or summarize it!
   - Preserve the full length, depth, sub-headings, examples, and core prose of the original chapter.
2. WHEN IN DOUBT, ASK FOR CLARIFICATION:
   - If a user instruction is ambiguous, unclear, or could drastically alter the structure or core content, ask for clarification and directions first instead of assuming or making broad cuts.
3. WHEN THE USER ASKS TO EDIT, REWRITE, EXPAND, POLISH, OR UPDATE ANY CHAPTER(S) OR OUTLINE:
   - YOU MUST CALL ONE OF THE TOOLS: 'updateChapter', 'updateMultipleChapters', 'updateOutline', OR 'updateDocument'!
   - Always output the ENTIRE revised chapter in full, complete Markdown format without omitting any sections or using placeholders like '[rest of chapter remains unchanged]'.
   - DO NOT just reply in plain text saying "I have updated the document" without calling a tool. Calling a tool is what updates the user's files!
4. IF THE USER ASKS TO UPDATE ALL CHAPTERS or MULTIPLE CHAPTERS:
   - YOU MUST CALL 'updateMultipleChapters' and include the FULL REVISED CONTENT for EVERY chapter in the 'chapters' array.
   - Set chapterId to the chapter index (e.g., "1", "2") or its ID/Title.
5. WRITE ALL REVISED TEXT IN: ${language}.
6. Always provide complete, publication-ready Markdown text for all chapter revisions.
7. In your conversational text response, summarize specifically what changes you made.`;

  const artDirectorInstruction = `You are an elite Art Director and Visual Concept Designer.
The user is working on a ${documentType}.
CURRENT DOCUMENT CONTENT:
---
${currentDocument}
---

Your job is to discuss visual styling, brainstorm graphical assets, and insert images.
CRITICAL: You must communicate and write any document updates in: ${language}.
If the user asks you to insert an image, DO NOT refuse! Instead, use 'updateChapter' or 'updateDocument' to insert standard Markdown image syntax (![A descriptive prompt detailing the image contents]()) directly into the document.
ALWAYS USE THIS EXACT MARKDOWN FORMAT: ![Detailed prompt describing the visual]()`;

  const systemInstruction = agentRole === 'art_director' ? artDirectorInstruction : ghostwriterInstruction;

  const userParts: any[] = [{ text: message }];
  attachments.forEach(att => {
    userParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  const toolsList = agentRole === 'art_director' 
    ? [{ functionDeclarations: [updateDocTool, updateChapterTool] }]
    : [{ functionDeclarations: [updateDocTool, updateOutlineTool, updateChapterTool, updateMultipleChaptersTool] }];

  const callModel = async (modelName: string) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: [...formattedHistory, { role: 'user', parts: userParts }],
      config: {
        systemInstruction,
        tools: toolsList
      }
    });
  };

  let response: any;
  try {
    response = await withRetry(() => callModel("gemini-3.1-pro-preview"), !!apiKey);
  } catch (e: any) {
    console.warn("Pro model failed or unavailable in chat, falling back to gemini-3.6-flash...", e);
    response = await withRetry(() => callModel("gemini-3.6-flash"), !!apiKey);
  }

  let replyText = response.text || "";
  let revisedContent: string | null = null;
  let updatedOutline: string | null = null;
  let updatedChapters: { id?: string; title?: string; content: string }[] = [];

  if (response.functionCalls && response.functionCalls.length > 0) {
    for (const call of response.functionCalls) {
      if (call.name === "updateOutline") {
        const args = call.args as any;
        updatedOutline = args.revisedOutline;
        revisedContent = args.revisedOutline;
        if (!replyText || replyText.trim() === "") {
          replyText = args.explanation || "✓ Book outline updated successfully.";
        }
      } else if (call.name === "updateChapter") {
        const args = call.args as any;
        updatedChapters.push({
          id: args.chapterId || activeChapterId || undefined,
          title: args.chapterTitle || activeChapterObj?.title,
          content: args.revisedContent
        });
        revisedContent = args.revisedContent;
        if (!replyText || replyText.trim() === "") {
          replyText = args.explanation || `✓ Chapter updated successfully.`;
        }
      } else if (call.name === "updateMultipleChapters") {
        const args = call.args as any;
        if (Array.isArray(args.chapters)) {
          args.chapters.forEach((ch: any) => {
            updatedChapters.push({
              id: ch.chapterId,
              title: ch.chapterTitle,
              content: ch.revisedContent
            });
          });
        }
        if (!replyText || replyText.trim() === "") {
          replyText = args.explanation || `✓ Updated ${updatedChapters.length} chapter(s) across the manuscript.`;
        }
      } else if (call.name === "updateDocument") {
        const args = call.args as any;
        revisedContent = args.revisedContent;
        if (!replyText || replyText.trim() === "") {
          replyText = args.explanation || "✓ Document updated successfully.";
        }
      }
    }
  }

  // Intelligent Failsafe: If no tool call was triggered, parse markdown code blocks or structured chapters directly from text
  if (updatedChapters.length === 0 && !revisedContent && !updatedOutline) {
    const codeBlockRegex = /```(?:markdown|text)?\n([\s\S]*?)```/g;
    let match;
    const extractedBlocks: string[] = [];
    while ((match = codeBlockRegex.exec(replyText)) !== null) {
      if (match[1] && match[1].trim().length > 30) {
        extractedBlocks.push(match[1].trim());
      }
    }

    if (extractedBlocks.length > 0) {
      if (documentType === 'outline') {
        updatedOutline = extractedBlocks[0];
        revisedContent = extractedBlocks[0];
      } else if (activeChapterId) {
        updatedChapters.push({ id: activeChapterId, content: extractedBlocks[0] });
        revisedContent = extractedBlocks[0];
      }
    }
  }

  return { replyText, revisedContent, updatedOutline, updatedChapters };
}

export async function artDirectorAgent(baseRequest: string, type: 'cover' | 'inline', apiKey?: string, inspirationImage?: string): Promise<string> {
  const ai = getAI(apiKey);
  const directive = type === 'cover' 
    ? "Create a masterful, high-end book cover image prompt. Focus on striking imagery, powerful composition, lighting, and mood. Specify 'leave negative space for title text' instead of embedding the title itself. Style: Bestselling modern publication."
    : "Create an expert editorial illustration or highly polished photo prompt for an inline book image based on the user's description. Maintain a clean, professional, and directly relevant aesthetic.";
    
  const userParts: any[] = [`I need an expert AI image generation prompt for the following concept: "${baseRequest}"\n\nOutput ONLY the final highly-detailed image prompt. Do not include any other conversational text or quotes.`];
  
  if (inspirationImage) {
    const data = inspirationImage.split(',')[1];
    userParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: data
      }
    });
    userParts[0] += "\n\nI have provided an inspiration image. Please analyze its style, composition, lighting, and layout principles, and incorporate those specific visual characteristics into your engineered prompt to ensure the new cover captures the same professional aesthetic.";
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: 'user', parts: userParts.map(p => typeof p === 'string' ? { text: p } : p) }],
    config: {
      systemInstruction: `You are an elite Art Director and Master Prompt Engineer for AI Image models. ${directive} Use descriptive keywords for lighting, camera angles, color palettes, and artistic style.`
    }
  }), !!apiKey);
  
  return response.text?.trim() || baseRequest;
}

export async function generateInlineImage(prompt: string, apiKey?: string) {
  const ai = getAI(apiKey);
  
  // Hand off the basic prompt to the Art Director Agent to create a stunning descriptive prompt
  const expertPrompt = await artDirectorAgent(prompt, 'inline', apiKey);
  console.log("Art Director engineered inline prompt:", expertPrompt);

  const imageModels = ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "imagen-3.0-generate-002"];
  for (const model of imageModels) {
    try {
      const response = await withRetry(() => ai.models.generateContent({
        model,
        contents: expertPrompt,
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      }), !!apiKey);
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/jpeg;base64,${part.inlineData.data}`;
        }
      }
    } catch (err: any) {
      console.warn(`Inline image generation failed with ${model}:`, err);
    }
  }
  return null;
}

export async function createCover(prompt: string, apiKey?: string, inspirationImage?: string, isPremium: boolean = false) {
  const ai = getAI(apiKey);
  
  const prefix = isPremium ? "MANUS AI PREMIUM STYLE: " : "";
  const expertPrompt = await artDirectorAgent(
    `${prefix}${prompt}. Cinematic lighting, ultra-high definition, professional book cover quality, vibrant colors, striking centerpiece.`, 
    'cover', 
    apiKey,
    inspirationImage
  );
  console.log("Cover generation engineered prompt:", expertPrompt);

  const imageModels = ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "imagen-3.0-generate-002"];
  let lastError: any = null;

  for (const model of imageModels) {
    try {
      const response = await withRetry(() => ai.models.generateContent({
        model,
        contents: expertPrompt,
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
    } catch (err: any) {
      console.warn(`Cover generation failed with model ${model}:`, err);
      lastError = err;
    }
  }
  throw lastError || new Error("Failed to generate cover image with Gemini image models.");
}

export async function synthesizeAudiobook(manuscript: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const sampleText = manuscript.substring(0, 1000);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
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
  } catch (err) {
    console.warn("Audiobook synthesis unavailable:", err);
  }
  return null;
}

export async function optimizeMetadata(idea: string, apiKey?: string, language: string = 'English') {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: `Act as an expert Amazon KDP publisher. Deeply optimize KDP metadata for the book idea: '${idea}'. 
    CRITICAL: Ensure the content (Title, Subtitle, Description) is translated and localized to ${language}. Categories and Backend keywords can be kept in English or localized based on market fit, but the main content must be in ${language}.
    Provide: 
    1. A hook-driven Title and Subtitle.
    2. A suggested Author Pen Name.
    3. Exactly 7 backend long-tail keywords.
    4. Exactly 3 BISAC categories.
    5. An HTML-formatted description containing bolding and bullet points (for Amazon).
    6. A specific recommended trim size (must be one of: "5x8", "6x9", "7x10", "8.5x11").
    7. A suggested retail price (e.g. "$9.99").
    8. An AI Image Prompt for the cover.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          author_name: { type: Type.STRING },
          description_html: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          trim_size: { type: Type.STRING },
          suggested_price: { type: Type.STRING },
          cover_design_prompt: { type: Type.STRING }
        }
      }
    }
  }), !!apiKey);
  try {
    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse metadata JSON", e);
    return { title: idea, subtitle: "", keywords: [], categories: [], description_html: "" };
  }
}

export async function extractWritingStyle(sampleText: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const prompt = `Analyze the writing style, voice, tone, narrative pacing, sentence structure, vocabulary, and formatting characteristics of the following manuscript text sample.

Sample Manuscript Content:
"""
${sampleText.substring(0, 5000)}
"""

Provide a concise, comprehensive, and highly actionable "Copywriting Style Guide" instruction (in Markdown format).
This style guide will be used as a system instruction for generating future manuscript chapters to match this exact voice.
Include clear guidelines on:
- Tone & Narrative Voice (e.g., authoritative, conversational, witty, empathetic, dramatic)
- Sentence Structure & Pacing (e.g., short punchy hooks, rhythmic paragraphs, rhetorical questions)
- Vocabulary & Diction (e.g., domain terminology, active verbs, sensory descriptors)
- Formatting & Structural Conventions (e.g., bold key concepts, bullet point summaries, story-driven chapter intros)

Format as a clear, directive prompt starting with: "MATCH THIS COPYWRITING STYLE:" followed by bullet points.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "MATCH THIS COPYWRITING STYLE:\n- Write in an engaging, authoritative, clear tone with punchy pacing and rich structured sections.";
}

export async function formatAndStructureManuscriptWithAI(rawMarkdown: string, apiKey?: string, language: string = 'English') {
  const ai = getAI(apiKey);
  const prompt = `Act as an expert book editor and KDP formatting specialist.
I have a raw or imported markdown manuscript (.md file) that needs to be formatted and structured properly into clean chapters.

Raw Manuscript Text:
"""
${rawMarkdown.substring(0, 500000)}
"""

Your task:
1. Extract a suitable Book Title and Subtitle if present or infer one.
2. Divide and structure the manuscript into distinct, well-formatted chapters.
CRITICAL CHAPTER BOUNDARY RULES:
- Divide the manuscript ONLY at main top-level Chapter titles (e.g., "# Introduction...", "# Chapter 1...", "# Chapter 2...", "# Chapter 15...", "# Kapittel 1...", "# Part I...").
- DO NOT convert subheadings (H2, H3, H4), sub-sections, templates, form fields, or bullet points into separate chapters.
- Specifically, titles like "# [Employee Name]'s Brag Document", "### Section 1: Performance Against Goals", "### Section 2: Strengths", or "Quarterly Performance Review" inside a chapter (e.g. Chapter 12) MUST REMAIN inside their parent chapter body. They are NOT standalone chapters!
- Each chapter object in the array MUST contain the complete body text and all subheadings of that chapter.
3. Clean up formatting: ensure proper Markdown headings, fix broken line breaks, clean up bullet points, and polish typography.
4. Language: ${language}.

Return a JSON object with:
- title: string
- subtitle: string
- chapters: array of objects with { title: string, content: string }`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          }
        },
        required: ["chapters"]
      }
    }
  }), !!apiKey);

  try {
    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);

    if (result && Array.isArray(result.chapters)) {
      const cleanChapters: { title: string; content: string }[] = [];
      const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
      const subSectionRegex = /^(\[.+\]|Section\s+\d+|Quarterly\s+|Monthly\s+|Weekly\s+|Component\s+\d+|Step\s+\d+|Template:)/i;

      result.chapters.forEach((ch: any) => {
        const title = (ch.title || '').trim();
        const content = (ch.content || '').trim();

        // Skip 0-word / empty chapters
        if (content.length < 20 && !title) return;

        // Deduplicate adjacent identical/similar titles or merge accidental sub-section chapters
        if (cleanChapters.length > 0) {
          const lastCh = cleanChapters[cleanChapters.length - 1];
          const normLast = normalizeTitle(lastCh.title);
          const normCurr = normalizeTitle(title);

          const isSubSection = subSectionRegex.test(title);

          if (isSubSection || (normLast && normCurr && (normLast === normCurr || normLast.includes(normCurr) || normCurr.includes(normLast)))) {
            const headingPrefix = isSubSection ? `\n\n### ${title}\n\n` : '\n\n';
            lastCh.content = (lastCh.content + headingPrefix + content).trim();
            return;
          }
        }

        cleanChapters.push({ title, content });
      });

      result.chapters = cleanChapters;
    }

    return result;
  } catch (e) {
    console.error("Failed to parse formatted manuscript JSON", e);
    return null;
  }
}

// ==========================================
// MARKETING & PR STUDIO AI GENERATORS
// ==========================================

function formatSocialsForPrompt(socials: any): string {
  if (!socials || typeof socials !== 'object') return '';
  const list = [];
  if (socials.twitter) list.push(`- X / Twitter: ${socials.twitter}`);
  if (socials.instagram) list.push(`- Instagram: ${socials.instagram}`);
  if (socials.linkedin) list.push(`- LinkedIn: ${socials.linkedin}`);
  if (socials.website) list.push(`- Official Website: ${socials.website}`);
  if (socials.newsletter) list.push(`- Newsletter / Substack: ${socials.newsletter}`);
  if (socials.tiktok) list.push(`- TikTok / BookTok: ${socials.tiktok}`);
  if (socials.facebook) list.push(`- Facebook Page: ${socials.facebook}`);
  if (socials.amazonAuthor) list.push(`- Amazon Author Page: ${socials.amazonAuthor}`);
  if (socials.goodreads) list.push(`- Goodreads Profile: ${socials.goodreads}`);

  if (list.length === 0) return '';
  return `\nAuthor Social Media Accounts & Brand Links:\n${list.join('\n')}\n(IMPORTANT: Seamlessly incorporate these actual handles, links, and contact handles directly into the generated content, call-to-actions, and author bio contact footers!).\n`;
}

export async function generatePressRelease(bookDetails: any, targetAudience: string, launchDate: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const socialContext = formatSocialsForPrompt(bookDetails.socials);
  const prompt = `You are an elite publishing PR specialist & publicist.
Write an official, industry-standard Press Release for the upcoming book launch.

Book Details:
- Title: ${bookDetails.title}
- Subtitle: ${bookDetails.subtitle || 'N/A'}
- Author: ${bookDetails.authorName}
- Target Audience: ${targetAudience || 'General Readers'}
- Launch Date: ${launchDate || 'FOR IMMEDIATE RELEASE'}
- Description: ${bookDetails.description}
- Language: ${bookDetails.language || 'English'}
${socialContext}
Structure the Press Release strictly with:
1. **FOR IMMEDIATE RELEASE** header & Location / Date line
2. **Attention-grabbing Headline & Subheadline**
3. **Strong Opening Paragraph** (The "Who, What, When, Where, Why")
4. **Key Highlights & Book Value Proposition**
5. **Memorable Author Quote** (Inspirational & compelling)
6. **About the Author / Boilerplate**
7. **Media Contact Information Placeholder & Availability** (Review copies, interviews, podcast appearances, and official links)
8. **### End of Release Indicator**

Write in clean, polished Markdown. CRITICAL: Match the requested language (${bookDetails.language || 'English'}).`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate press release.";
}

export async function generateSocialCampaign(bookDetails: any, platform: string, tone: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const socialContext = formatSocialsForPrompt(bookDetails.socials);
  const prompt = `You are a social media growth strategist for authors and book marketers.
Create a series of 5 high-converting social media posts for **${platform}** with a **${tone}** tone.

Book Title: ${bookDetails.title}
Subtitle: ${bookDetails.subtitle || ''}
Author: ${bookDetails.authorName}
Description: ${bookDetails.description}
Language: ${bookDetails.language || 'English'}
${socialContext}
Provide 5 distinct posts:
1. **Post 1: The Teaser / Curiosity Hook**
2. **Post 2: The Key Problem / Pain Point Solved**
3. **Post 3: High-Impact Quote / Excerpt Graphic Text**
4. **Post 4: Official Launch Day / "Available Now" Call-To-Action**
5. **Post 5: Behind-The-Scenes / Author's Journey**

Include emojis, line breaks for readability, clear Calls to Action (CTAs), and 5-7 targeted hashtags for each post.
Format nicely with Markdown headings for each post.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate social posts.";
}

export async function generateEmailLaunchSequence(bookDetails: any, apiKey?: string) {
  const ai = getAI(apiKey);
  const socialContext = formatSocialsForPrompt(bookDetails.socials);
  const prompt = `You are an expert email marketing strategist for book launches.
Create a 4-Part Automated Book Launch Email Sequence for subscribers/readers.

Book Details:
- Title: ${bookDetails.title}
- Subtitle: ${bookDetails.subtitle || ''}
- Author: ${bookDetails.authorName}
- Description: ${bookDetails.description}
- Language: ${bookDetails.language || 'English'}
${socialContext}
Generate 4 emails with Subject Line, Preview Text, Email Body, and Call To Action:
- **Email 1: The Announcement / Teaser (T-7 Days)** - Introduce the book & story behind it.
- **Email 2: Cover Reveal & Sneak Peek (T-3 Days)** - Share key takeaways or a sample chapter link.
- **Email 3: Official Launch Day (T-0 Days)** - Urgency, buy links, launch discount/bonus.
- **Email 4: Review Request & Gratitude (T+3 Days)** - Thank readers, ask for an honest review on Amazon/Goodreads.

Format clearly in Markdown.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate email sequence.";
}

export async function generateMediaPitch(bookDetails: any, recipientType: string, apiKey?: string) {
  const ai = getAI(apiKey);
  const socialContext = formatSocialsForPrompt(bookDetails.socials);
  const prompt = `You are a PR agent pitching a new book to media outlets.
Write a personalized pitch email targeting: **${recipientType}** (e.g., Podcast Hosts, Book Reviewers/Bloggers, Journalists/Local Press, Influencers).

Book Details:
- Title: ${bookDetails.title}
- Subtitle: ${bookDetails.subtitle || ''}
- Author: ${bookDetails.authorName}
- Description: ${bookDetails.description}
- About Author: ${bookDetails.aboutAuthor || ''}
- Language: ${bookDetails.language || 'English'}
${socialContext}
Provide:
1. **Catchy Subject Lines** (3 options)
2. **Personalized Opening & Compliment Placeholder**
3. **The Hook** (Why their audience will love this topic RIGHT NOW)
4. **Key Talking Points / Interview Questions** (3-4 bullet points)
5. **The Offer** (Free review copy, exclusive interview, giveaway)
6. **Polished Sign-off & Press Contact Links**

Output in clean Markdown format.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate pitch.";
}

export async function generateLandingPageCopy(bookDetails: any, chapterTitles: string[], apiKey?: string) {
  const ai = getAI(apiKey);
  const prompt = `You are a world-class direct-response copywriter specializing in book landing pages.
Generate high-converting landing page structured JSON for the book:
Title: ${bookDetails.title}
Subtitle: ${bookDetails.subtitle || ''}
Author: ${bookDetails.authorName}
Description: ${bookDetails.description}
Chapters: ${chapterTitles.slice(0, 8).join(', ')}

Return a JSON object matching this structure:
{
  "heroHeadline": "string",
  "heroSubheadline": "string",
  "heroCtaText": "string",
  "keyTakeaways": ["string", "string", "string", "string"],
  "testimonials": [
    { "quote": "string", "name": "string", "title": "string" },
    { "quote": "string", "name": "string", "title": "string" }
  ],
  "authorBio": "string",
  "faq": [
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" }
  ]
}`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          heroHeadline: { type: Type.STRING },
          heroSubheadline: { type: Type.STRING },
          heroCtaText: { type: Type.STRING },
          keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
          testimonials: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                name: { type: Type.STRING },
                title: { type: Type.STRING }
              },
              required: ["quote", "name", "title"]
            }
          },
          authorBio: { type: Type.STRING },
          faq: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              },
              required: ["question", "answer"]
            }
          }
        },
        required: ["heroHeadline", "heroSubheadline", "heroCtaText", "keyTakeaways", "testimonials", "authorBio", "faq"]
      }
    }
  }), !!apiKey);

  try {
    const text = (response.text || '{}').trim();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

export async function generateMarketingStrategyPlan(bookDetails: any, timelineWeeks: number, apiKey?: string) {
  const ai = getAI(apiKey);
  const prompt = `You are a top publishing campaign director.
Create a comprehensive 30-Day Launch Roadmap & PR Marketing Strategy for:
Book: ${bookDetails.title}
Author: ${bookDetails.authorName}
Category: ${bookDetails.categories?.join(', ') || 'General'}

Provide a structured Markdown guide containing:
1. **Target Reader Persona & Positioning**
2. **Pre-Launch Checklist (Week 1 & 2)**
3. **Launch Week Takeover Plan (Week 3)**
4. **Post-Launch Growth & Momentum (Week 4)**
5. **KDP Select & Promo Strategy (Free Days / Countdown Deals)**
6. **Grassroots Guerrilla Marketing Tactics (Zero Budget)**`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate strategy plan.";
}


