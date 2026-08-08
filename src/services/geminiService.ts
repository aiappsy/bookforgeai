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
        let raw = error?.message || 'Unknown error';
        if (typeof raw === 'string' && raw.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(raw.trim());
            if (parsed?.error?.message) {
              raw = parsed.error.message;
            }
          } catch {
            // keep raw
          }
        }
        if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429') || raw.includes('quota')) {
          raw = "Gemini API rate limit or quota exceeded (429 RESOURCE_EXHAUSTED). You can enter your own free Gemini API key in API Settings (bottom left gear icon) for dedicated quota.";
        }
        const newMsg = `${raw}\n\nNote: This request was made using ${keyInfo}.`;
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
export interface AmazonNicheOpportunityResult {
  niche_topic: string;
  demand_score: number;
  competition_score: number;
  opportunity_score: number;
  competition_level: 'Low' | 'Medium' | 'High' | 'Extremely High';
  market_size_monthly_searches: number;
  est_monthly_royalty_potential: {
    top_5_bestsellers: number;
    top_20_bestsellers: number;
    average_author: number;
  };
  recommended_list_price: {
    ebook: number;
    paperback: number;
  };
  target_word_count: number;
  top_keywords: Array<{
    keyword: string;
    monthly_searches: number;
    competition: 'Low' | 'Medium' | 'High';
    relevance_score: number;
    opportunity_tip: string;
  }>;
  recommended_categories: Array<{
    category_path: string;
    bsr_for_top_10: number;
    bsr_for_number_1: number;
    competition_difficulty: 'Easy' | 'Moderate' | 'Challenging';
    opportunity_reason: string;
  }>;
  content_gaps_and_opportunities: Array<{
    angle_title: string;
    reader_complaint_addressed: string;
    suggested_feature: string;
  }>;
  competitor_benchmarks: Array<{
    title_pattern: string;
    avg_price: string;
    avg_reviews: number;
    key_weakness: string;
  }>;
  actionable_verdict: string;
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

export async function analyzeAmazonNicheOpportunity(
  topicOrIdea: string,
  apiKey?: string
): Promise<AmazonNicheOpportunityResult> {
  const ai = getAI(apiKey);
  const prompt = `You are a world-class Amazon KDP Market Analyst, Book Publishing Strategist, and Publisher Rocket Data Expert.
Analyze the Amazon KDP Kindle & Paperback marketplace for the book niche / topic: "${topicOrIdea}".

Perform an in-depth Amazon Market Opportunity & Keyword Competition Analysis.
Provide precise, realistic data modeling for Amazon search volume, competition density, category bestseller rank (BSR) thresholds, profit potential, and content gaps based on reader reviews in this category.

Return a JSON object conforming strictly to this schema:
- niche_topic: string
- demand_score: number (0-100)
- competition_score: number (0-100)
- opportunity_score: number (0-100, where higher means high demand + low/medium competition)
- competition_level: string ("Low" | "Medium" | "High" | "Extremely High")
- market_size_monthly_searches: number
- est_monthly_royalty_potential: object containing:
  - top_5_bestsellers: number (estimated USD per month)
  - top_20_bestsellers: number (estimated USD per month)
  - average_author: number (estimated USD per month)
- recommended_list_price: object containing:
  - ebook: number (e.g. 4.99)
  - paperback: number (e.g. 14.99)
- target_word_count: number (e.g. 45000)
- top_keywords: array of objects (7-10 items):
  - keyword: string (long-tail Amazon search term)
  - monthly_searches: number
  - competition: string ("Low" | "Medium" | "High")
  - relevance_score: number (0-100)
  - opportunity_tip: string
- recommended_categories: array of objects (3-5 items):
  - category_path: string (e.g. "Kindle Store > Books > Business & Money > Marketing")
  - bsr_for_top_10: number (e.g. 15000)
  - bsr_for_number_1: number (e.g. 2500)
  - competition_difficulty: string ("Easy" | "Moderate" | "Challenging")
  - opportunity_reason: string
- content_gaps_and_opportunities: array of objects (3-5 items):
  - angle_title: string
  - reader_complaint_addressed: string
  - suggested_feature: string
- competitor_benchmarks: array of objects (3-4 items):
  - title_pattern: string
  - avg_price: string
  - avg_reviews: number
  - key_weakness: string
- actionable_verdict: string (3-4 sentence strategic summary on how to win this niche on Amazon KDP)`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          niche_topic: { type: Type.STRING },
          demand_score: { type: Type.NUMBER },
          competition_score: { type: Type.NUMBER },
          opportunity_score: { type: Type.NUMBER },
          competition_level: { type: Type.STRING },
          market_size_monthly_searches: { type: Type.NUMBER },
          est_monthly_royalty_potential: {
            type: Type.OBJECT,
            properties: {
              top_5_bestsellers: { type: Type.NUMBER },
              top_20_bestsellers: { type: Type.NUMBER },
              average_author: { type: Type.NUMBER }
            },
            required: ["top_5_bestsellers", "top_20_bestsellers", "average_author"]
          },
          recommended_list_price: {
            type: Type.OBJECT,
            properties: {
              ebook: { type: Type.NUMBER },
              paperback: { type: Type.NUMBER }
            },
            required: ["ebook", "paperback"]
          },
          target_word_count: { type: Type.NUMBER },
          top_keywords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                keyword: { type: Type.STRING },
                monthly_searches: { type: Type.NUMBER },
                competition: { type: Type.STRING },
                relevance_score: { type: Type.NUMBER },
                opportunity_tip: { type: Type.STRING }
              },
              required: ["keyword", "monthly_searches", "competition", "relevance_score", "opportunity_tip"]
            }
          },
          recommended_categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category_path: { type: Type.STRING },
                bsr_for_top_10: { type: Type.NUMBER },
                bsr_for_number_1: { type: Type.NUMBER },
                competition_difficulty: { type: Type.STRING },
                opportunity_reason: { type: Type.STRING }
              },
              required: ["category_path", "bsr_for_top_10", "bsr_for_number_1", "competition_difficulty", "opportunity_reason"]
            }
          },
          content_gaps_and_opportunities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                angle_title: { type: Type.STRING },
                reader_complaint_addressed: { type: Type.STRING },
                suggested_feature: { type: Type.STRING }
              },
              required: ["angle_title", "reader_complaint_addressed", "suggested_feature"]
            }
          },
          competitor_benchmarks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title_pattern: { type: Type.STRING },
                avg_price: { type: Type.STRING },
                avg_reviews: { type: Type.NUMBER },
                key_weakness: { type: Type.STRING }
              },
              required: ["title_pattern", "avg_price", "avg_reviews", "key_weakness"]
            }
          },
          actionable_verdict: { type: Type.STRING }
        },
        required: [
          "niche_topic", "demand_score", "competition_score", "opportunity_score",
          "competition_level", "market_size_monthly_searches", "est_monthly_royalty_potential",
          "recommended_list_price", "target_word_count", "top_keywords", "recommended_categories",
          "content_gaps_and_opportunities", "competitor_benchmarks", "actionable_verdict"
        ]
      }
    }
  }), !!apiKey);

  try {
    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Amazon Niche Research JSON", e);
    throw new Error("Unable to analyze Amazon niche opportunity. Please check your API key or try a different topic.");
  }
}

export async function generateOutline(idea: string, keywords: string[], apiKey?: string, systemPrompt?: string) {
  const ai = getAI(apiKey);

  const generate = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an elite Literary Architect, Bestselling Ghostwriter, and Publishing Director.
      Create a masterclass, publication-grade 12-16 chapter book outline for a project about: '${idea}'.
      Keywords & Core Themes: ${keywords.join(", ")}.

      STRUCTURE EACH CHAPTER WITH DEEP LITERARY ARCHITECTURE:
      - **Chapter Title & Subtitle**: High-impact, engaging title.
      - **Core Premise & Objectives**: Key narrative hook or thesis statement.
      - **Key Themes & Sub-topics**: 4-6 detailed bullet points outlining structural progression.
      - **Narrative Arc / Real-World Case Study**: A compelling narrative scenario, character beat, or empirical case study.
      - **Actionable Takeaways / Climax**: Concrete insights, cliffhangers, or practical exercises.
      - **Target Word Allocation & Pacing**: Recommended target word count (e.g. 2,000-2,500 words) and narrative tempo.
      
      MANDATORY CHARACTER NAMING & DIVERSITY RULES:
      - Every character, narrative subject, or case study figure introduced MUST have a distinct first name AND a distinct surname (no repeating first or last names across characters in the manuscript).
      - NEVER use generic AI overused default names (e.g. "Alex", "Sarah", "Elena", "Marcus Vance", "Dr. Jenkins", "David", "Maya", "Ethan", "Chloe", "Carter"). Generate fresh, distinctive, authentic names tailored to this project's setting.`,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        systemInstruction: systemPrompt || "You are a master Literary Architect, NYT Bestselling Editor, and Publishing Specialist. Synthesize deep structural outlines with rich narrative momentum, tropes, psychological depth, and reader engagement loops."
      }
    });
    return response.text || "";
  };

  try {
    return await withRetry(() => generate("gemini-3.6-flash"), !!apiKey);
  } catch (e: any) {
    console.warn("Flash model with thinking failed for outline generation. Retrying standard...", e);
    return await withRetry(() => generate("gemini-3.1-pro-preview"), !!apiKey);
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

export interface LearnedRule {
  id: string;
  rule: string;
  category: 'style' | 'tone' | 'character' | 'plot' | 'formatting';
  learnedFromChapterTitle?: string;
  createdAt: number;
}

export interface ContinuityContext {
  precedingChapterSummaries?: string[];
  previousChapterEnding?: string;
  learnedRules?: LearnedRule[];
  existingCharacterNames?: string[];
}

export function extractExistingCharacterNames(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '');
  const regex = /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Professor\s+)?([A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,20})\b/g;
  const matches = clean.match(regex);
  if (!matches) return [];

  const set = new Set<string>();
  const ignoreList = new Set([
    'Chapter One', 'Chapter Two', 'Chapter Three', 'Chapter Four', 'Chapter Five',
    'Chapter Six', 'Chapter Seven', 'Chapter Eight', 'Chapter Nine', 'Chapter Ten',
    'Chapter Eleven', 'Chapter Twelve', 'Table Of', 'Contents Outline', 'Part One',
    'Part Two', 'Part Three', 'Part Four', 'United States', 'New York', 'San Francisco',
    'Los Angeles', 'North America', 'South America', 'Great Britain', 'Western Europe',
    'Anti AI', 'Project Setup', 'Book Details', 'Publish Export', 'Amazon Research',
    'Audiobook Studio', 'Marketing PR', 'Humanizer Studio', 'Case Study', 'Key Takeaways'
  ]);

  for (const match of matches) {
    const trimmed = match.trim();
    if (!ignoreList.has(trimmed) && !trimmed.toLowerCase().includes('chapter')) {
      set.add(trimmed);
    }
  }

  return Array.from(set).slice(0, 30);
}

export async function summarizeChapterForContinuity(
  chapterTitle: string,
  chapterContent: string,
  apiKey?: string
): Promise<string> {
  if (!chapterContent || chapterContent.trim().length < 50) return '';
  const ai = getAI(apiKey);
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a concise 2 to 3 sentence narrative and factual summary of what occurs and is established in Chapter titled "${chapterTitle}". Focus on plot progression, key character developments, core arguments, and current narrative state. Do NOT include introductory filler.

CHAPTER CONTENT:
${chapterContent.substring(0, 10000)}`
    });
    return (res.text || '').trim();
  } catch (e) {
    console.warn("Error summarizing chapter for continuity:", e);
    return `In ${chapterTitle}, key developments and narrative progression took place.`;
  }
}

export async function extractLearnedRulesFromFeedback(
  userFeedback: string,
  previousContent: string,
  revisedContent: string,
  chapterTitle: string,
  apiKey?: string
): Promise<LearnedRule[]> {
  if (!userFeedback || userFeedback.trim().length < 5) return [];
  const ai = getAI(apiKey);
  try {
    const prompt = `Analyze the user's edit request/critique and the chapter revision to extract 1 to 3 explicit, actionable writing style/tone/character/plot rules that the AI must follow in ALL future chapters of this book.

USER CRITIQUE / FEEDBACK: "${userFeedback}"
CHAPTER TITLE: "${chapterTitle}"

Return JSON matching this exact schema:
{
  "rules": [
    {
      "rule": "Clear actionable instruction (e.g., 'Avoid using rhetorical questions in section headings', 'Keep dialogue short and direct', 'Ensure Protagonist Alex is described as calculated, not emotional')",
      "category": "style" | "tone" | "character" | "plot" | "formatting"
    }
  ]
}

If the user feedback is purely a typo fix or non-repeatable change, return an empty array {"rules": []}.`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rule: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ["style", "tone", "character", "plot", "formatting"] }
                },
                required: ["rule", "category"]
              }
            }
          },
          required: ["rules"]
        }
      }
    });

    const parsed = JSON.parse(res.text || '{"rules":[]}');
    if (Array.isArray(parsed.rules)) {
      return parsed.rules.map((r: any) => ({
        id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        rule: r.rule,
        category: r.category || 'style',
        learnedFromChapterTitle: chapterTitle,
        createdAt: Date.now()
      }));
    }
    return [];
  } catch (e) {
    console.warn("Could not extract learned rules from feedback:", e);
    return [];
  }
}

export async function generateChapter(
  bookIdea: string,
  outline: string,
  chapterTitle: string,
  apiKey?: string,
  systemPrompt?: string,
  signal?: AbortSignal,
  continuityContext?: ContinuityContext
) {
  const ai = getAI(apiKey);
  const topic = bookIdea && bookIdea.trim() !== '' ? bookIdea : 'the book topic';

  if (signal?.aborted) {
    throw new Error('Generation cancelled by user');
  }

  // Format learned rules context
  let learnedRulesBlock = '';
  if (continuityContext?.learnedRules && continuityContext.learnedRules.length > 0) {
    learnedRulesBlock = `\n\nCRITICAL AUTHOR CORRECTIONS & LEARNED STYLE RULES (MANDATORY ENFORCEMENT ACROSS ALL CHAPTERS):\nThe author has explicitly requested the following style/tone/character rules from previous chapter feedback. You MUST strictly obey every single rule below:\n` +
      continuityContext.learnedRules.map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.rule}`).join('\n') + '\n';
  }

  // Format preceding chapter summaries context
  let precedingSummariesBlock = '';
  if (continuityContext?.precedingChapterSummaries && continuityContext.precedingChapterSummaries.length > 0) {
    precedingSummariesBlock = `\n\nPRECEDING CHAPTERS STORY & ARGUMENT PROGRESSION (MAINTAIN NARRATIVE CONTINUITY):\nThe book has progressed through the following preceding chapters. Ensure this new chapter seamlessly picks up where the previous story/argument left off without repeating introduced concepts or character intros:\n` +
      continuityContext.precedingChapterSummaries.map((s, i) => `- Chapter ${i + 1}: ${s}`).join('\n') + '\n';
  }

  // Format immediate previous chapter ending
  let previousEndingBlock = '';
  if (continuityContext?.previousChapterEnding) {
    previousEndingBlock = `\n\nIMMEDIATELY PRECEDING CHAPTER CONCLUSION (BRIDGE SEAMLESSLY):\nHere are the final paragraphs of the preceding chapter. Open this new chapter with smooth narrative bridge and momentum:\n"""\n${continuityContext.previousChapterEnding}\n"""\n`;
  }

  // Format existing character names block
  let existingCharactersBlock = '';
  if (continuityContext?.existingCharacterNames && continuityContext.existingCharacterNames.length > 0) {
    existingCharactersBlock = `\n\nESTABLISHED PROJECT CHARACTERS (MANDATORY NAME CONTINUITY & UNIQUNESS):\nThe following character names already exist in this manuscript project:\n` +
      continuityContext.existingCharacterNames.map(n => `- ${n}`).join('\n') +
      `\nCRITICAL CHARACTER NAMING LAWS:
1. Re-use these exact names ONLY when referring to these same established characters.
2. For ANY newly introduced character in this chapter, you MUST assign a completely NEW first name AND a completely NEW surname. No new character should share a first name or a surname with any existing character!\n`;
  }

  const generate = async (modelName: string) => {
    if (signal?.aborted) {
      throw new Error('Generation cancelled by user');
    }

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents: `You are an award-winning, master bestselling author writing a publication-grade, immersive chapter for a book manuscript.
      
      BOOK TOPIC / CORE CONCEPT: '${topic}'
      
      FULL MANUSCRIPT OUTLINE FOR CONTEXT:
      ${outline}
      ${precedingSummariesBlock}
      ${previousEndingBlock}
      ${existingCharactersBlock}
      ${learnedRulesBlock}
      
      TASK: Write the complete, deeply detailed, comprehensive content for the chapter titled: "${chapterTitle}".
      
      CRITICAL MANDATORY CHAPTER REQUIREMENTS:
      1. LENGTH & EXPANSIVE DEPTH: Write a full-length chapter (2,000 to 3,500 words). Thoroughly unpack every sub-topic with vivid narrative detail, real-world case studies, psychological insights, dialogue, or step-by-step masterclass demonstrations.
      2. TOPIC ALIGNMENT: Directly explore and master the specific subject matter of "${chapterTitle}", keeping aligned with the overall book concept '${topic}'.
      3. ELEGANT LITERARY LAYOUT: Use clean Markdown with compelling H2 and H3 subheadings, callout quotes, bulleted insights, and chapter-bridging conclusions.
      4. DO NOT abbreviate, cut, summarize, or output incomplete text. Write out the full chapter in complete, polished prose from hook to resolution.
      5. DO NOT repeat the main book title as an H1 heading at the start. Begin directly with an engaging narrative hook or H2 section title.
      6. COHESION & CONTINUITY: Build directly on the preceding chapters and respect all author corrections/learned style rules listed above.
      7. AUTHENTIC HUMAN PROSE & DE-AI MANDATE:
         - ZERO AI BUZZWORDS OR FORMULAIC CRUTCHES: Strictly forbidden words include "delve", "paradigm shift", "seamlessly", "holistic", "ever-evolving", "landscape", "fostering", "synergy", "testament to", "tapestry", "beacon", "vital role", "pivotal", "underscore", "in conclusion", "in today's fast-paced world", "intricate web", "transformative journey".
         - MASTERFUL BURSTINESS & CADENCE: Alternate sentence lengths dynamically. Mix ultra-short 3-5 word declarations with expansive, multi-clause descriptive observations.
         - RICH SENSORY DETAIL & ACTIVE VERBS: Write with visceral clarity, emotional resonance, grounded metaphors, and natural conversational authority.
      8. MANDATORY CHARACTER NAMING UNIQUNESS & DIVERSITY (NO DUPLICATE FIRST OR SURNAMES):
         - UNIQUE NAMES PER MANUSCRIPT: Every character in this manuscript MUST have a distinct first name AND a distinct surname so readers do not confuse different characters.
         - NO SHARED FIRST NAMES OR SURNAMES: Do NOT give different characters the same first name or the same surname unless they are explicitly established in the narrative as immediate family members (e.g. siblings or parent/child sharing a family surname).
         - NO OVERUSED AI CLICHÉ NAMES: NEVER default to overused generic AI character names (e.g. "Alex", "Sarah", "Elena", "Marcus Vance", "Dr. Jenkins", "David", "Maya", "Ethan", "Chloe", "Carter", "Lucas", "Olivia"). Generate fresh, distinctive, authentic names tailored to the book's setting.
         - PROJECT CONTINUITY: Keep established character names consistent across all chapters in this project, and never give newly introduced characters the names of existing characters in the project.`,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        systemInstruction: (systemPrompt ? `${systemPrompt}\n\n` : '') + "You are a Pulitzer-worthy author and master ghostwriter. Synthesize authoritative depth, emotional intelligence, visceral narrative texture, and flawless human rhythm while rigorously adhering to all learned user corrections and manuscript continuity."
      }
    });

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        if (signal.aborted) reject(new Error('Generation cancelled by user'));
        signal.addEventListener('abort', () => reject(new Error('Generation cancelled by user')));
      }
    });

    let timeoutId: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Generation timed out after 3 minutes. Click Re-generate to try again.'));
      }, 180000);
    });

    try {
      const response = await Promise.race([generatePromise, abortPromise, timeoutPromise]);
      return sanitizeAiBuzzwords(response.text || "");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  try {
    return await withRetry(() => generate("gemini-3.6-flash"), !!apiKey);
  } catch (e: any) {
    if (e.message?.includes('cancelled') || signal?.aborted) {
      throw e;
    }
    console.warn("Flash model failed for chapter generation. Falling back to gemini-2.5-flash...", e);
    return await withRetry(() => generate("gemini-2.5-flash"), !!apiKey);
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

  const ghostwriterInstruction = `You are an elite NYT-Bestselling Ghostwriter, Senior Developmental Editor, Master Stylist, and ACX Publishing Specialist.
You have FULL EDITORIAL AND ARCHITECTURAL CONTROL over the user's book manuscript.

YOUR CORE EXPERTISE:
1. DEVELOPMENTAL EDITING: Deep plot architecture, three-act structure, Dan Harmon story circles, Minto pyramid principles, pacing, theme resonance, character motivation, and dialogue authenticity.
2. PUBLISHING & ACX AUDIOBOOK STANDARDS: KDP keyword indexing, ACX audio narration specs, narrator direction, voice delivery tags, SSML tags, and audio formatting.
3. HUMAN PROSE MASTERY: High burstiness, varied sentence cadence, zero AI clichés (never use "delve", "tapestry", "beacon", "seamlessly", "holistic", "fostering", "paradigm shift").

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
7. In your conversational text response, summarize specifically what changes you made.
8. MANDATORY CHARACTER NAMING UNIQUNESS & DIVERSITY RULES:
   - Every character in this project MUST have a unique first name AND a unique surname so readers do not confuse different people (no two distinct characters sharing a first or last name unless explicitly established as immediate family).
   - NEVER reuse generic overused AI cliché names (e.g., "Alex", "Sarah", "Elena", "Marcus Vance", "Dr. Jenkins", "David", "Maya", "Ethan", "Chloe", "Carter", "Lucas", "Olivia").
   - Maintain strict character name consistency across all chapters in this manuscript project, and do NOT give new characters the names of existing characters.
9. MANDATORY CROSS-CHAPTER MANUSCRIPT COHESION & CONTINUITY:
   - When rewriting, editing, or polishing any chapter, maintain total narrative, thematic, chronological, and stylistic cohesion with the surrounding chapters and full book outline.
   - Do NOT introduce plot contradictions, retcon established facts, repeat introductory explanations already covered in earlier chapters, or disrupt the narrative flow and character arcs established across the book.
   - Maintain consistent character motivations, tone, vocabulary level, and narrative rhythm throughout the rewrite.
10. MANDATORY NON-LETTER / DIAGRAM / TABLE FORMATTING RULES:
   - Whenever including non-letter content such as ASCII diagrams, flowcharts, schemas, or architectural figures, ALWAYS enclose them inside explicit Markdown code blocks (\`\`\`text ... \`\`\`) with monospace alignment.
   - Format data grids, metrics, and matrices as clean Markdown tables (| Col 1 | Col 2 |).
   - Enclose quotes, key insights, and mandates in Markdown blockquotes (> ...).
   - Never output raw unformatted ASCII art or malformed/empty image tags.`;

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
        thinkingConfig: { thinkingBudget: 2048 },
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

export async function artDirectorAgent(
  baseRequest: string, 
  type: 'cover' | 'inline', 
  apiKey?: string, 
  inspirationImage?: string,
  bookDetails?: { title?: string; subtitle?: string; authorName?: string; genre?: string; description?: string }
): Promise<string> {
  const ai = getAI(apiKey);
  const title = bookDetails?.title || '';
  const authorName = bookDetails?.authorName || '';
  const subtitle = bookDetails?.subtitle || '';
  const genre = bookDetails?.genre || '';
  const description = bookDetails?.description || '';

  const coverInfo = `Book Title: "${title || 'Untitled'}"${subtitle ? `, Subtitle: "${subtitle}"` : ''}${authorName ? `, Author Name: "${authorName}"` : ''}${genre ? `, Genre/Category: "${genre}"` : ''}. `;

  const directive = type === 'cover' 
    ? `You are a World-Class Amazon KDP Bestseller Art Director.
Analyze the book details (${coverInfo} Summary: "${description.substring(0, 400)}").
Your job is to benchmark top-selling Amazon bestsellers in this book's genre to identify winning visual patterns:
- High-contrast focal point imagery
- Cinematic lighting & rich atmospheric color palette
- Clean framing that reserves generous negative space at the top and bottom specifically for large title and author typography overlays.
CRITICAL: DO NOT copy or clone any specific existing book cover, copyrighted layout, coins, or author text. Create an original artwork prompt with NO TEXT in the background image.`
    : "Create an expert editorial illustration or highly polished photo prompt for an inline book image based on the user's description. Maintain a clean, professional, and directly relevant aesthetic.";
    
  const userParts: any[] = [`Perform Amazon Bestseller Cover Style Benchmarking and create an expert AI image generation prompt for this concept: "${baseRequest}"\n${coverInfo}\nOutput ONLY the final highly-detailed image prompt. Do not include conversational text or markdown code blocks.`];
  
  if (inspirationImage) {
    const data = inspirationImage.split(',')[1] || inspirationImage;
    if (data.length > 50) {
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: data
        }
      });
      userParts[0] += "\n\nCRITICAL USER STYLE REFERENCE IMAGE ATTACHED: Carefully analyze the attached example cover image ONLY for color scheme, lighting, and visual tone. DO NOT copy or clone any text, words, author names, logos, or specific copyrighted cover template frames from the reference image. Formulate a prompt for a completely original, text-free background artwork suited for this manuscript.";
    }
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: 'user', parts: userParts.map(p => typeof p === 'string' ? { text: p } : p) }],
    config: {
      systemInstruction: directive
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

export function generateProceduralCoverSvg(
  prompt: string,
  bookDetails?: { title?: string; subtitle?: string; authorName?: string; genre?: string; description?: string },
  inspirationImage?: string
): string {
  const cleanTitle = (bookDetails?.title || prompt || 'Bestselling Masterpiece').replace(/[<>&'"]/g, '').trim();
  const cleanAuthor = (bookDetails?.authorName || 'Author Name').replace(/[<>&'"]/g, '').trim();
  const cleanSubtitle = (bookDetails?.subtitle || 'An Authoritative Guide for Achieving Excellence').replace(/[<>&'"]/g, '').trim();
  const genre = (bookDetails?.genre || '').toLowerCase();

  // Compute a seed from title and author to vary color schemes & visual themes dynamically
  let hash = 0;
  const str = cleanTitle + cleanAuthor + (bookDetails?.genre || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);

  // Palettes tailored dynamically to genres or seeds
  const palettes = [
    // 0: Deep Imperial Navy & Gold
    { bg1: '#090d1a', bg2: '#1e1b4b', border1: '#fef08a', border2: '#d97706', plaque1: '#ffffff', plaque2: '#f8f4eb', banner: '#881337', text: '#0f172a', accent: '#b45309' },
    // 1: Executive Onyx & Rose Gold
    { bg1: '#09090b', bg2: '#18181b', border1: '#fde8e8', border2: '#f43f5e', plaque1: '#fafafa', plaque2: '#f4f4f5', banner: '#881337', text: '#18181b', accent: '#be123c' },
    // 2: Emerald Visionary & Gold
    { bg1: '#022c22', bg2: '#064e3b', border1: '#fef08a', border2: '#059669', plaque1: '#ffffff', plaque2: '#f0fdf4', banner: '#065f46', text: '#022c22', accent: '#047857' },
    // 3: Deep Royal Sapphire & Platinum
    { bg1: '#0f172a', bg2: '#1e293b', border1: '#e2e8f0', border2: '#38bdf8', plaque1: '#ffffff', plaque2: '#f1f5f9', banner: '#1e3a8a', text: '#0f172a', accent: '#0284c7' },
    // 4: Classic Burgundy & Gold
    { bg1: '#450a0a', bg2: '#7f1d1d', border1: '#fef08a', border2: '#d97706', plaque1: '#fffbe8', plaque2: '#fef3c7', banner: '#991b1b', text: '#450a0a', accent: '#b45309' }
  ];

  let selectedIndex = seed % palettes.length;
  if (genre.includes('finance') || genre.includes('business') || genre.includes('success')) selectedIndex = 0;
  if (genre.includes('thriller') || genre.includes('mystery') || genre.includes('crime')) selectedIndex = 1;
  if (genre.includes('mindfulness') || genre.includes('health') || genre.includes('nature')) selectedIndex = 2;
  if (genre.includes('sci-fi') || genre.includes('tech') || genre.includes('future')) selectedIndex = 3;
  if (genre.includes('history') || genre.includes('classic') || genre.includes('biography')) selectedIndex = 4;

  const pal = palettes[selectedIndex];

  // Format title into multi-line if needed
  const words = cleanTitle.split(' ');
  let line1 = '';
  let line2 = '';
  if (words.length > 3) {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid).join(' ').toUpperCase();
    line2 = words.slice(mid).join(' ').toUpperCase();
  } else {
    line1 = cleanTitle.toUpperCase();
  }

  const authorDisplay = cleanAuthor.toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" width="1200" height="1600">
    <defs>
      <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.border1}"/>
        <stop offset="50%" stop-color="${pal.border2}"/>
        <stop offset="100%" stop-color="${pal.accent}"/>
      </linearGradient>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${pal.bg1}"/>
        <stop offset="100%" stop-color="${pal.bg2}"/>
      </linearGradient>
      <linearGradient id="plaqueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${pal.plaque1}"/>
        <stop offset="100%" stop-color="${pal.plaque2}"/>
      </linearGradient>
      <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${pal.banner}"/>
        <stop offset="100%" stop-color="${pal.banner}"/>
      </linearGradient>
      <filter id="plaqueShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
      <pattern id="bgLattice" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none"/>
        <path d="M 0 20 L 20 0 L 40 20 L 20 40 Z" fill="none" stroke="${pal.border2}" stroke-width="0.8" opacity="0.15"/>
      </pattern>
    </defs>

    <!-- Canvas Base Background -->
    <rect width="1200" height="1600" fill="url(#bgGrad)"/>
    <rect width="1200" height="1600" fill="url(#bgLattice)"/>

    <!-- Outer Frame Border -->
    <rect x="30" y="30" width="1140" height="1540" fill="none" stroke="url(#frameGrad)" stroke-width="10"/>
    <rect x="44" y="44" width="1112" height="1512" fill="none" stroke="${pal.border1}" stroke-width="2" opacity="0.8"/>
    <rect x="52" y="52" width="1096" height="1496" fill="none" stroke="${pal.border2}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5"/>

    <!-- Center Ivory/Cream Plaque Card -->
    <rect x="90" y="90" width="1020" height="1420" rx="8" fill="url(#plaqueGrad)" filter="url(#plaqueShadow)"/>
    <rect x="106" y="106" width="988" height="1388" rx="4" fill="none" stroke="url(#frameGrad)" stroke-width="3"/>
    <rect x="116" y="116" width="968" height="1368" rx="2" fill="none" stroke="${pal.banner}" stroke-width="1.5"/>

    <!-- Top Header Banner Box -->
    <rect x="117" y="117" width="966" height="130" fill="url(#bannerGrad)"/>
    <rect x="122" y="122" width="956" height="120" fill="none" stroke="${pal.border1}" stroke-width="1.5" opacity="0.8"/>
    <text x="600" y="172" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="800" fill="${pal.border1}" text-anchor="middle" letter-spacing="6">
      BESTSELLER EDITION
    </text>
    <text x="600" y="210" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="4">
      AUTHORITATIVE PUBLISHING MASTERPIECE
    </text>

    <!-- Main Title Block -->
    ${line2 ? `
      <text x="600" y="390" font-family="'Playfair Display', Georgia, serif" font-size="74" font-weight="900" fill="${pal.text}" text-anchor="middle" letter-spacing="2">
        ${line1}
      </text>
      <text x="600" y="485" font-family="'Playfair Display', Georgia, serif" font-size="74" font-weight="900" fill="${pal.text}" text-anchor="middle" letter-spacing="2">
        ${line2}
      </text>
    ` : `
      <text x="600" y="430" font-family="'Playfair Display', Georgia, serif" font-size="80" font-weight="900" fill="${pal.text}" text-anchor="middle" letter-spacing="2">
        ${line1}
      </text>
    `}

    <!-- Central Laurel Wreath & Open Book Emblem -->
    <g transform="translate(600, 720)">
      <circle cx="0" cy="0" r="120" fill="none" stroke="${pal.border2}" stroke-width="1.5" opacity="0.3"/>
      <circle cx="0" cy="0" r="100" fill="#ffffff" stroke="url(#frameGrad)" stroke-width="2"/>
      
      <path d="M -60 -20 C -70 0, -70 40, -40 70 C -20 85, 0 85, 0 85 C 0 85, -20 70, -35 50 C -45 35, -45 0, -35 -20 Z" fill="${pal.accent}" opacity="0.7"/>
      <path d="M 60 -20 C 70 0, 70 40, 40 70 C 20 85, 0 85, 0 85 C 0 85, 20 70, 35 50 C 45 35, 45 0, 35 -20 Z" fill="${pal.accent}" opacity="0.7"/>
      
      <g transform="translate(-24, -22) scale(1.2)">
        <path d="M 2 8 Q 20 0, 20 18 L 20 36 Q 2 20, 2 8 Z" fill="#ffffff" stroke="${pal.banner}" stroke-width="2"/>
        <path d="M 38 8 Q 20 0, 20 18 L 20 36 Q 38 20, 38 8 Z" fill="#ffffff" stroke="${pal.banner}" stroke-width="2"/>
        <line x1="20" y1="18" x2="20" y2="36" stroke="${pal.accent}" stroke-width="2"/>
      </g>
    </g>

    <!-- Subtitle Block -->
    <text x="600" y="1000" font-family="'Playfair Display', Georgia, serif" font-size="28" font-style="italic" fill="${pal.accent}" text-anchor="middle" font-weight="600">
      ${cleanSubtitle.length > 65 ? cleanSubtitle.slice(0, 65) + '...' : cleanSubtitle}
    </text>

    <!-- Author Block -->
    <line x1="260" y1="1130" x2="940" y2="1130" stroke="url(#frameGrad)" stroke-width="3"/>
    <line x1="260" y1="1138" x2="940" y2="1138" stroke="${pal.banner}" stroke-width="1.5"/>

    <text x="600" y="1230" font-family="'Playfair Display', Georgia, serif" font-size="54" font-weight="900" fill="${pal.text}" text-anchor="middle" letter-spacing="5">
      ${authorDisplay}
    </text>

    <line x1="260" y1="1282" x2="940" y2="1282" stroke="${pal.banner}" stroke-width="1.5"/>
    <line x1="260" y1="1290" x2="940" y2="1290" stroke="url(#frameGrad)" stroke-width="3"/>

    <!-- Footer Credit -->
    <text x="600" y="1380" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-style="italic" font-weight="600" fill="#64748b" text-anchor="middle">
      Author of Bestselling Works &amp; Master Guides
    </text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export async function createCover(
  prompt: string, 
  apiKey?: string, 
  inspirationImage?: string, 
  isPremium: boolean = false,
  bookDetails?: { title?: string; subtitle?: string; authorName?: string; genre?: string; description?: string }
) {
  const ai = getAI(apiKey);
  const title = bookDetails?.title || prompt;
  const subtitle = bookDetails?.subtitle || '';
  const authorName = bookDetails?.authorName || '';
  const genre = bookDetails?.genre || '';
  const description = bookDetails?.description || '';

  console.info("Generating bespoke AI SVG book cover for:", title);

  // Ask Gemini AI to generate a custom XML SVG cover specifically crafted for this book's title, genre, and details
  const svgSystemPrompt = `You are an elite Book Cover Art Director. Generate a complete, standalone, valid XML SVG image (viewBox="0 0 1200 1600", width="1200", height="1600") for a high-end physical book cover.

BOOK DETAILS:
- Title: "${title}"
- Subtitle: "${subtitle}"
- Author: "${authorName}"
- Genre: "${genre}"
- Synopsis: "${description.slice(0, 300)}"

COVER DESIGN REQUIREMENTS:
1. Do NOT use photographic raster backgrounds or photographic images.
2. Create a clean, elegant, vector-based bestseller cover layout with a crisp central plaque or framing border, genre-appropriate color palette, high-contrast typography, and clean decorative vector accents/emblems matching the theme.
3. Include the exact Title, Subtitle, and Author Name in clear typography (<text> tags).
4. Return ONLY valid XML SVG starting with <svg> and ending with </svg>. No markdown block quotes, no markdown explanation before or after.`;

  try {
    const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
    for (const model of modelsToTry) {
      try {
        const response = await withRetry(() => ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: svgSystemPrompt }] }]
        }), !!apiKey);

        const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = rawText.match(/<svg[\s\S]*?<\/svg>/i);
        if (match && match[0]) {
          const cleanSvg = match[0].trim();
          console.info(`Gemini AI (${model}) successfully generated custom vector SVG cover!`);
          return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(cleanSvg)))}`;
        }
      } catch (e) {
        console.warn(`Gemini SVG generation failed with model ${model}:`, e);
      }
    }
  } catch (err) {
    console.warn("AI dynamic SVG cover generation failed, using dynamic procedural fallback:", err);
  }

  // Fallback to dynamic, theme-adaptive procedural SVG
  return generateProceduralCoverSvg(prompt, bookDetails, inspirationImage);
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

export function extractFallbackKeywords(bookDetails: any, idea: string, chapters: { title: string; content?: string }[] = []): string[] {
  const textSource = [
    bookDetails?.title || '',
    bookDetails?.subtitle || '',
    bookDetails?.description || '',
    idea || '',
    ...(chapters || []).map(c => c.title || '')
  ].join(' ');

  const cleanText = textSource.replace(/<[^>]*>/g, ' ').replace(/[^\w\s]/gi, ' ').toLowerCase();
  const stopWords = new Set(['about', 'after', 'again', 'against', 'almost', 'also', 'among', 'and', 'because', 'been', 'before', 'being', 'between', 'both', 'chapter', 'could', 'does', 'each', 'from', 'have', 'here', 'into', 'just', 'like', 'main', 'more', 'most', 'much', 'must', 'only', 'other', 'over', 'same', 'some', 'than', 'that', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until', 'upon', 'very', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'would', 'your', 'book', 'guide', 'manual']);
  
  const words = cleanText.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const phrases: string[] = [];

  const mainTitle = (bookDetails?.title || idea || '').trim();
  if (mainTitle) {
    phrases.push(`${mainTitle.toLowerCase()} handbook`);
    phrases.push(`mastering ${mainTitle.toLowerCase()}`);
  }

  if (bookDetails?.subtitle?.trim()) {
    phrases.push(bookDetails.subtitle.trim().toLowerCase().slice(0, 35));
  }

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] !== words[i + 1]) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  const uniqueWords = Array.from(new Set(words));
  uniqueWords.slice(0, 6).forEach(w => {
    phrases.push(`${w} strategies`);
    phrases.push(`${w} best practices`);
  });

  const uniquePhrases = Array.from(new Set(phrases.map(p => p.trim()))).filter(p => p.length >= 5);
  return uniquePhrases.slice(0, 7);
}

export async function generateBookKeywords(
  bookDetails: any,
  idea: string,
  chapters: { title: string; content?: string }[],
  apiKey?: string
): Promise<string[]> {
  try {
    const ai = getAI(apiKey);

    const contextParts: string[] = [];
    if (bookDetails?.title?.trim()) contextParts.push(`Book Title: ${bookDetails.title.trim()}`);
    if (bookDetails?.subtitle?.trim()) contextParts.push(`Subtitle: ${bookDetails.subtitle.trim()}`);
    if (bookDetails?.description?.trim()) contextParts.push(`Description: ${bookDetails.description.trim()}`);
    if (idea?.trim()) contextParts.push(`Core Idea/Concept: ${idea.trim()}`);
    if (chapters && chapters.length > 0) {
      const list = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
      contextParts.push(`Chapters Overview:\n${list}`);
    }

    const context = contextParts.join('\n\n') || idea || 'Manuscript';

    const prompt = `You are an expert Amazon KDP Keyword & SEO Specialist.
Analyze the following book details and manuscript structure to generate exactly 7 highly relevant, long-tail backend search keywords for Amazon KDP.

CRITICAL MANDATORY RULES:
1. KEYWORD RELEVANCE: Every keyword MUST be 100% relevant to THIS EXACT BOOK (Title: "${bookDetails?.title || 'Current Book'}"). Do NOT suggest generic or unrelated keywords.
2. Provide 7 multi-word long-tail phrases (2 to 4 words each) that potential buyers on Amazon search for when looking for a book on this specific subject.
3. Match language: ${bookDetails?.language || 'English'}.

BOOK & MANUSCRIPT CONTEXT:
"""
${context}
"""

Return a JSON object with a single property "keywords": array of exactly 7 strings.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["keywords"]
        }
      }
    }), !!apiKey);

    const parsed = JSON.parse((response.text || '{}').trim());
    if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
      return parsed.keywords;
    }
  } catch (e: any) {
    console.warn("API call for keyword generation failed or hit rate limit. Falling back to content extraction:", e);
  }

  return extractFallbackKeywords(bookDetails, idea, chapters);
}

export async function optimizeMetadata(idea: string, apiKey?: string, language: string = 'English') {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: `You are an expert Amazon KDP publishing specialist and SEO strategist.
Analyze the following book details, title, and manuscript context, and generate deeply relevant KDP metadata, keywords, and BISAC categories specifically tailored to THIS EXACT BOOK.

CRITICAL MANDATORY INSTRUCTIONS:
1. KEYWORDS: All 7 backend keywords MUST be 100% specific and directly relevant to the actual book topic, title, and manuscript content provided below. Do NOT generate generic or unrelated keywords.
2. TITLE & DESCRIPTION: Ensure Title, Subtitle, and Description match THIS EXACT BOOK topic and content.
3. LANGUAGE: Title, Subtitle, and Description MUST be in ${language}.

BOOK & MANUSCRIPT CONTEXT:
"""
${idea}
"""

Provide a JSON object with:
1. "title": Hook-driven main title.
2. "subtitle": High-converting subtitle or hook.
3. "author_name": Suggested author pen name.
4. "keywords": Exactly 7 backend long-tail keywords (array of 7 highly relevant strings).
5. "categories": Exactly 3 standard BISAC categories (array of 3 strings matching standard BISAC format).
6. "description_html": An HTML-formatted description containing bolding, paragraphs, and bullet points.
7. "trim_size": Recommended trim size ("5x8", "6x9", "7x10", or "8.5x11").
8. "suggested_price": Suggested retail price (e.g. "$9.99").
9. "cover_design_prompt": AI image generation prompt for the book cover.`,
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
        },
        required: ["title", "subtitle", "author_name", "description_html", "keywords", "categories", "trim_size", "suggested_price"]
      }
    }
  }), !!apiKey);

  return safeParseMetadataJson(response.text || "{}", idea);
}

function safeParseMetadataJson(rawText: string, fallbackIdea: string) {
  if (!rawText) return { title: fallbackIdea, subtitle: "", keywords: [], categories: [], description_html: "" };

  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Attempt 1: Direct JSON parse
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === 'object') return obj;
  } catch (e) {
    console.warn("Direct JSON parse failed for metadata, trying sanitized parse...", e);
  }

  // Attempt 2: Sanitize control characters/raw newlines inside quotes
  try {
    const sanitized = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
      return match
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    });
    const obj = JSON.parse(sanitized);
    if (obj && typeof obj === 'object') return obj;
  } catch (e) {
    console.warn("Sanitized JSON parse failed for metadata, falling back to regex extraction...", e);
  }

  // Attempt 3: Regex fallback extraction
  const extractField = (key: string) => {
    const reg = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
    const m = cleaned.match(reg);
    return m ? m[1] : '';
  };

  const extractArray = (key: string) => {
    const reg = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`, 'i');
    const m = cleaned.match(reg);
    if (!m) return [];
    return m[1]
      .split(',')
      .map(s => s.replace(/"/g, '').trim())
      .filter(Boolean);
  };

  const title = extractField('title') || fallbackIdea;
  const subtitle = extractField('subtitle');
  const author_name = extractField('author_name');
  const description_html = extractField('description_html');
  const trim_size = extractField('trim_size') || '6x9';
  const suggested_price = extractField('suggested_price') || '$9.99';
  const keywords = extractArray('keywords');
  const categories = extractArray('categories');

  return {
    title,
    subtitle,
    author_name,
    description_html,
    trim_size,
    suggested_price,
    keywords,
    categories
  };
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

export async function generateBetaReaderCritique(
  bookDetails: any,
  sampleContent: string,
  targetGenre?: string,
  apiKey?: string
) {
  const ai = getAI(apiKey);
  const prompt = `You are a panel of 3 expert beta readers and literary editors reviewing a manuscript draft.
  Book Title: ${bookDetails.title || 'Untitled'}
  Genre/Category: ${targetGenre || bookDetails.category || 'General Fiction/Non-Fiction'}
  Target Reader: ${bookDetails.targetAudience || 'General Audience'}

  Manuscript Sample:
  """
  ${sampleContent.substring(0, 4000)}
  """

  Provide a comprehensive Beta Reader Critique in JSON format with:
  1. "pacingScore" (1-10 number)
  2. "emotionalResonance" (1-10 number)
  3. "plotClarity" (1-10 number)
  4. "overallHookScore" (1-10 number)
  5. "personas": Array of 3 objects representing different readers:
     - "name": e.g., "Sarah (Avid Genre Reader)", "Marcus (Hardcore Literary Critic)", "Elena (Target Demographic)"
     - "verdict": Short 1-sentence overall impression
     - "likes": Array of 2-3 specific elements they enjoyed
     - "critique": Array of 2-3 constructive suggestions for improvement
  6. "executiveSummary": A 2-paragraph overall report summarizing strengths and critical fixes before publishing.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pacingScore: { type: Type.NUMBER },
          emotionalResonance: { type: Type.NUMBER },
          plotClarity: { type: Type.NUMBER },
          overallHookScore: { type: Type.NUMBER },
          executiveSummary: { type: Type.STRING },
          personas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                verdict: { type: Type.STRING },
                likes: { type: Type.ARRAY, items: { type: Type.STRING } },
                critique: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "verdict", "likes", "critique"]
            }
          }
        },
        required: ["pacingScore", "emotionalResonance", "plotClarity", "overallHookScore", "executiveSummary", "personas"]
      }
    }
  }), !!apiKey);

  try {
    return JSON.parse((response.text || '{}').trim());
  } catch (e) {
    return null;
  }
}

export async function autoFixChapterFromCritique(
  bookDetails: any,
  chapterTitle: string,
  chapterContent: string,
  critiqueResult: any,
  specificReaderCritique?: string[],
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const critiquesToFix = specificReaderCritique && specificReaderCritique.length > 0
    ? specificReaderCritique.join('\n- ')
    : critiqueResult?.personas?.map((p: any) => `${p.name}: ${p.critique?.join('; ')}`).join('\n- ') || 'Fix pacing, enhance emotional resonance, and improve plot clarity.';

  const prompt = `You are an elite literary editor and bestselling author.
Re-write and polish the manuscript chapter text below to address and resolve all points raised by the Beta Reader Critique, while preserving the original storyline, voice, character dynamics, and formatting.

Book Title: ${bookDetails.title || 'Untitled'}
Chapter Title: ${chapterTitle || 'Chapter'}
Language: ${bookDetails.language || 'English'}

EXECUTIVE PANEL SUMMARY:
${critiqueResult?.executiveSummary || 'Pacing and clarity need refinement.'}

SPECIFIC BETA READER CRITIQUES & FIXES TO IMPLEMENT:
- ${critiquesToFix}

ORIGINAL CHAPTER CONTENT:
"""
${chapterContent}
"""

INSTRUCTIONS:
1. Seamlessly apply every critique fix into the narrative (e.g. resolve pacing slowdowns, sharpen hooks, deepen character emotions, clarify plot logic).
2. MANUSCRIPT COHESION & CONTINUITY: Ensure total narrative, stylistic, character, and plot continuity with the rest of the manuscript. Do NOT retcon established events, change character personalities/names, or introduce contradictions.
3. UNIQUE CHARACTER NAMES: Maintain existing character names without alteration. Do NOT give new characters generic or duplicated names.
4. Output ONLY the complete revised chapter text in clean Markdown format.
5. Do NOT include meta-conversational text, preface, or commentary before/after the chapter content.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return (response.text || chapterContent).trim();
}

export interface AudiobookScriptSegment {
  segment_id: string;
  speaker_id: string; // 'narrator' or character_id e.g. 'char_1'
  speaker_name: string;
  raw_text: string;
  clean_spoken_text: string;
  delivery_emotion: string;
  speaking_rate: number;
  pause_before_ms: number;
  pause_after_ms: number;
  soundscape_cue?: string;
  ssml_text: string;
}

export interface CharacterRosterItem {
  character_id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age_group: 'child' | 'young_adult' | 'adult' | 'elderly';
  vocal_tone: string;
  recommended_accent: string;
  suggested_elevenlabs_voice: string;
  assigned_voice_id?: string;
  description?: string;
  color_theme?: string;
}

export interface PronunciationLexiconItem {
  term: string;
  category: 'character_name' | 'place' | 'fictional_term' | 'complex_word';
  phonetic_spelling: string;
  ssml_phoneme: string;
  notes: string;
}

export interface BackgroundSoundscapeItem {
  scene_marker: string;
  ambient_description: string;
  suggested_music_genre: string;
  sound_effects: string[];
}

export interface AudiobookConversionJSON {
  chapter_metadata: {
    title: string;
    clean_spoken_title: string;
    word_count: number;
    estimated_duration_minutes: number;
    target_pacing_wpm: number;
    overall_tone: string;
  };
  character_roster: CharacterRosterItem[];
  pronunciation_lexicon: PronunciationLexiconItem[];
  audiobook_script: AudiobookScriptSegment[];
  background_soundscapes: BackgroundSoundscapeItem[];
}

export async function rewriteManuscriptForAudio(
  bookDetails: any,
  chapterTitle: string,
  chapterContent: string,
  apiKey?: string
): Promise<{ adapted_content: string; summary_of_changes: string[] }> {
  const ai = getAI(apiKey);

  const prompt = `You are an elite Master Audiobook Script Editor and Audio Production Specialist.
TASK: Rewrite the following print manuscript chapter into a world-class, ear-friendly "Audiobook Spoken Edition".

Book Title: ${bookDetails.title || 'Untitled'}
Genre / Category: ${bookDetails.categories?.[0] || 'General'}
Chapter Title: ${chapterTitle}

RAW PRINT MANUSCRIPT:
"""
${chapterContent.substring(0, 10000)}
"""

AUDIOBOOK ADAPTATION INSTRUCTIONS:
1. Eliminate Redundant Dialogue Tags: Remove clunky print dialogue attributions ("he said", "she muttered looking out the window", "he replied dryly") whenever multi-character voice actors make speaker identity crystal clear.
2. Optimize Rhythmic Cadence & Breathability: Break long, nested, convoluted print sentences into punchy, rhythmic, easy-to-follow spoken prose that flows effortlessly when read aloud.
3. Natural Phonetic Conversion: Convert all numbers, dates, currencies, abbreviations, and non-speakable symbols into full natural spoken words (e.g. "$1.5M" -> "one point five million dollars", "Dr." -> "Doctor").
4. Spoken Scene Transitions: Replace visual scene dividers (like "***" or blank lines) with natural spoken transitions (e.g., "Later that evening...", "Meanwhile,").
5. Listener Clarity: Clarify ambiguous pronouns and awkward tongue-twisters to prevent listener confusion.

Output a clean, valid JSON object with:
- "adapted_content": string (the complete rewritten audiobook spoken text)
- "summary_of_changes": string[] (list of 3 to 5 key audio optimizations made, e.g. "Removed 12 redundant dialogue tags", "Converted numerical values to phonetic spoken words", "Restructured 8 complex sentences for oral breathing cadence")`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 1024 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          adapted_content: { type: Type.STRING },
          summary_of_changes: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["adapted_content", "summary_of_changes"]
      }
    }
  }), !!apiKey);

  try {
    const raw = (response.text || '{}').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse rewritten audio manuscript", e);
    throw new Error("Failed to adapt manuscript for audiobook spoken edition.");
  }
}

export async function convertManuscriptToAudiobookScriptJSON(
  bookDetails: any,
  chapterTitle: string,
  chapterContent: string,
  apiKey?: string
): Promise<AudiobookConversionJSON> {
  const ai = getAI(apiKey);

  const prompt = `You are an ACX Master Audio Director, ElevenLabs Voice Casting Specialist, and Literary Parsing Engine.
TASK: Convert raw manuscript chapter text into a high-fidelity, studio-grade audiobook script formatted for multi-character text-to-speech synthesis and ACX master standards.

Book Title: ${bookDetails.title || 'Untitled'}
Author: ${bookDetails.authorName || 'Author'}
Genre / Category: ${bookDetails.categories?.[0] || 'General'}
Chapter Title: ${chapterTitle}

RAW MANUSCRIPT TEXT:
"""
${chapterContent.substring(0, 10000)}
"""

PERFORM THE FOLLOWING COMPREHENSIVE DIRECTORIAL TASKS:
1. Audio-First Spoken Adaptation & Dialogue Tag Cleaning: Strip visual artifacts, footnotes, headers, page numbers. Crucially, strip redundant print dialogue tags ("he said", "she replied") from clean_spoken_text when multi-character voice casting makes speaker identity obvious. Convert ALL numerals, dates, currencies, abbreviations, and non-speakable symbols into full natural spoken phonetics (e.g., "$1.5M" -> "one point five million dollars", "2026" -> "twenty twenty-six", "Dr." -> "Doctor", "%" -> "percent").
2. Multi-Character Dialogue & Fluid Narrative Paragraph Segmentation: Parse dialogue vs narration. Assign speaker_id="narrator" or "char_1", "char_2", etc. CRITICAL HUMAN FLUENCY REQUIREMENT: Combine consecutive narrative sentences by the narrator into complete, continuous, well-formed paragraphs (100 to 180 words per segment). NEVER break continuous narrator prose into tiny 5-10 word micro-fragments, as micro-fragmentation causes unnatural robotic stops and starts in text-to-speech engines! Only break segments when the speaking character changes or at major scene transitions.
3. Precise Voice Casting Roster & Special Roles (Airport Announcers / PA Intercom): Identify every character speaking. Accurately assign gender ("male" or "female"). Ensure distinct voice assignment: assign male voices (e.g. Adam, George, Antoni, Josh, Arnold, Clyde, Dave, Fin, Charlie, Liam, Callum, Patrick, Harry, James, Joseph, Bill, Daniel) to ALL male characters, and female voices (e.g. Rachel, Lily, Bella, Domi, Elli, Charlotte, Dorothy, Matilda, Alice, Serena, Freya) to ALL female characters. SPECIAL ROLES: If the manuscript features an Airport Announcer, PA System, Intercom, Flight Attendant, Station Dispatcher, or Radio Host, assign crisp announcer voices (e.g. 'Alice' for female airport announcer with pristine diction, or 'Patrick' for male authoritative presenter). Format clean_spoken_text with authentic public address cadence (e.g., "Attention passengers...", "Flight B Seven Four Seven...").
4. Natural Audio Flow & Minimal Pauses: Keep pause_before_ms and pause_after_ms VERY TIGHT (between 0ms and 100ms max). Do NOT add large 500ms+ empty pauses between lines because ElevenLabs and TTS engines already include punctuation silence!
5. Expressive Subtext & SSML Annotation: Annotate granular emotional delivery states (e.g. "whispered conspiratorially", "sarcastic deadpan", "choked back tears"). Include SSML break tags (e.g. '<break time="200ms"/>') and rate modulations (0.85 to 1.15).
6. Comprehensive Pronunciation Lexicon: Identify fantasy names, foreign words, technical jargon, or tricky surnames. Supply phonetic spellings (e.g. "AY-thur-ee-ul") and valid IPA SSML phoneme tags (e.g. '<phoneme alphabet="ipa" ph="eɪ.θɜː.ri.əl">Aetherial</phoneme>').
7. Atmospheric Soundscapes: Suggest ambient background audio cues, musical key themes, and acoustic environmental reverberation parameters.
8. Output entire result as a clean, valid JSON object matching the requested schema.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 2048 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapter_metadata: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              clean_spoken_title: { type: Type.STRING },
              word_count: { type: Type.NUMBER },
              estimated_duration_minutes: { type: Type.NUMBER },
              target_pacing_wpm: { type: Type.NUMBER },
              overall_tone: { type: Type.STRING }
            },
            required: ["title", "clean_spoken_title", "word_count", "estimated_duration_minutes", "target_pacing_wpm", "overall_tone"]
          },
          character_roster: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                character_id: { type: Type.STRING },
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                age_group: { type: Type.STRING },
                vocal_tone: { type: Type.STRING },
                recommended_accent: { type: Type.STRING },
                suggested_elevenlabs_voice: { type: Type.STRING },
                color_theme: { type: Type.STRING }
              },
              required: ["character_id", "name", "gender", "age_group", "vocal_tone", "recommended_accent", "suggested_elevenlabs_voice"]
            }
          },
          pronunciation_lexicon: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                category: { type: Type.STRING },
                phonetic_spelling: { type: Type.STRING },
                ssml_phoneme: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: ["term", "category", "phonetic_spelling", "ssml_phoneme", "notes"]
            }
          },
          audiobook_script: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                segment_id: { type: Type.STRING },
                speaker_id: { type: Type.STRING },
                speaker_name: { type: Type.STRING },
                raw_text: { type: Type.STRING },
                clean_spoken_text: { type: Type.STRING },
                delivery_emotion: { type: Type.STRING },
                speaking_rate: { type: Type.NUMBER },
                pause_before_ms: { type: Type.NUMBER },
                pause_after_ms: { type: Type.NUMBER },
                soundscape_cue: { type: Type.STRING },
                ssml_text: { type: Type.STRING }
              },
              required: ["segment_id", "speaker_id", "speaker_name", "raw_text", "clean_spoken_text", "delivery_emotion", "speaking_rate", "pause_before_ms", "pause_after_ms", "ssml_text"]
            }
          },
          background_soundscapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scene_marker: { type: Type.STRING },
                ambient_description: { type: Type.STRING },
                suggested_music_genre: { type: Type.STRING },
                sound_effects: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["scene_marker", "ambient_description", "suggested_music_genre", "sound_effects"]
            }
          }
        },
        required: ["chapter_metadata", "character_roster", "pronunciation_lexicon", "audiobook_script", "background_soundscapes"]
      }
    }
  }), !!apiKey);

  try {
    const raw = (response.text || '{}').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse audiobook JSON output", e);
    throw new Error("Failed to parse audiobook JSON script from AI response.");
  }
}

export async function generateAudiobookScript(
  bookDetails: any,
  chapterTitle: string,
  chapterContent: string,
  apiKey?: string
) {
  const ai = getAI(apiKey);
  const prompt = `You are an expert ACX audiobook producer and voice director.
  Convert the following chapter into a voice-actor-ready Audiobook Narration Script.
  Book Title: ${bookDetails.title || 'Untitled'}
  Author: ${bookDetails.authorName || 'Author'}
  Chapter: ${chapterTitle}

  Text:
  """
  ${chapterContent.substring(0, 5000)}
  """

  Generate a structured Markdown voice script including:
  1. **Audiobook Header & Opening Credits Cue**
  2. **Estimated Narration Duration** (calculate based on ~150 words per minute)
  3. **Voice Direction & Tone Notes** (e.g., Pacing, Accent, Emotional Arc)
  4. **Pronunciation Guide** (for complex names or specialized jargon)
  5. **Narrator-Formatted Script with Performance Cues**:
     - Insert inline bracketed cues for the narrator, e.g. *[pause 2s]*, *[warm, conversational tone]*, *[hushed whisper]*, *[emphasis on 'never']*.
     - Character voice tags if dialogue is present.
  6. **Closing Audio Cue & Chapter Outro**`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }), !!apiKey);

  return response.text || "Failed to generate audiobook script.";
}

// ==========================================
// MANUSCRIPT HUMANIZE & AI DETECTION ENGINE
// ==========================================

export interface AiScoreReport {
  aiProbability: number; // 0 - 100
  humanProbability: number; // 0 - 100
  burstinessScore: number; // 0 - 100 (sentence length variation)
  perplexityScore: number; // 0 - 100 (vocabulary diversity & natural cadence)
  flaggedBuzzwords: { word: string; count: number }[];
  totalWords: number;
  totalSentences: number;
  suggestions: string[];
}

const AI_BUZZWORD_PATTERNS = [
  "delve", "delves", "delving", "delved",
  "paradigm shift", "seamlessly", "seamless", "holistic",
  "ever-evolving", "ever evolving", "landscape", "fostering", "foster", "fosters", "fostered",
  "synergy", "synergies", "testament to", "a testament to", "testament",
  "tapestry", "rich tapestry", "vibrant tapestry", "intricate tapestry",
  "beacon", "beacon of hope", "beacon of light", "vital role", "pivotal role", "pivotal",
  "underscore", "underscores", "underscoring", "in conclusion", "in summary",
  "in today's fast-paced world", "in today's world", "intricate web", "intricate",
  "transformative journey", "transformative", "multifaceted", "unwavering",
  "paramount", "stark reminder", "game-changer", "gamechanger", "cornerstone",
  "crucial step", "crucial role", "crucial", "it is worth noting", "it's worth noting",
  "it is important to remember", "it is essential to", "furthermore", "moreover",
  "spearhead", "spearheading", "harnessing", "harness", "unravel", "unraveling",
  "deep dive", "dive deep", "embark", "embark on", "embarks", "embarking",
  "realm", "realms", "indispensable", "resonate", "resonates", "resonating",
  "illuminate", "illuminating", "illuminates", "navigate", "navigating", "navigates",
  "elevate", "elevates", "elevating", "empower", "empowers", "empowering",
  "demystify", "demystifying", "myriad", "a myriad of", "plethora", "a plethora of",
  "at its core", "catalyst", "symphony", "hallmark", "bedrock"
];

export function analyzeAiScore(text: string): AiScoreReport {
  if (!text || text.trim().length === 0) {
    return {
      aiProbability: 3,
      humanProbability: 97,
      burstinessScore: 90,
      perplexityScore: 90,
      flaggedBuzzwords: [],
      totalWords: 0,
      totalSentences: 0,
      suggestions: ["Manuscript text is empty."]
    };
  }

  const cleanText = text.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '');

  // 1. Scan for AI buzzwords
  const flaggedMap = new Map<string, number>();
  AI_BUZZWORD_PATTERNS.forEach(pattern => {
    const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = cleanText.match(regex);
    if (matches && matches.length > 0) {
      flaggedMap.set(pattern, matches.length);
    }
  });

  const flaggedBuzzwords = Array.from(flaggedMap.entries()).map(([word, count]) => ({ word, count }));
  const totalBuzzwordMatches = flaggedBuzzwords.reduce((acc, curr) => acc + curr.count, 0);

  // 2. Sentence Rhythm & Burstiness Calculation
  const sentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('#'));

  const totalSentences = Math.max(sentences.length, 1);
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const totalWords = sentenceLengths.reduce((a, b) => a + b, 0);

  const meanLength = totalWords / totalSentences;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - meanLength, 2), 0) / totalSentences;
  const stdDev = Math.sqrt(variance);

  // Burstiness ratio: higher stdDev relative to mean = high burstiness (human-like)
  const stdDevRatio = meanLength > 0 ? (stdDev / meanLength) : 0;
  // Standard human writing stdDevRatio is ~0.5 to 0.9. AI tends to be ~0.2 to 0.35
  const burstinessScore = Math.min(100, Math.max(15, Math.round((stdDevRatio / 0.65) * 85)));

  // 3. Perplexity & Lexical Richness
  const words = cleanText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = new Set(words);
  const lexicalDiversity = words.length > 0 ? (uniqueWords.size / words.length) : 0.5;
  const perplexityScore = Math.min(100, Math.max(15, Math.round(lexicalDiversity * 140)));

  // 4. Combined AI Probability calculation
  let aiProbability = 5;

  if (totalBuzzwordMatches === 0) {
    if (burstinessScore >= 55) {
      aiProbability = Math.max(2, Math.min(6, Math.round(12 - (burstinessScore / 10))));
    } else {
      aiProbability = Math.max(6, Math.min(14, Math.round(20 - (burstinessScore / 10))));
    }
  } else {
    const buzzwordDensityPer1k = totalWords > 0 ? (totalBuzzwordMatches / (totalWords / 1000)) : totalBuzzwordMatches;
    let rawAi = (totalBuzzwordMatches * 12) + (buzzwordDensityPer1k * 15) + ((100 - burstinessScore) * 0.3) + ((100 - perplexityScore) * 0.2);
    aiProbability = Math.min(98, Math.max(15, Math.round(rawAi)));
  }

  const humanProbability = 100 - aiProbability;

  const suggestions: string[] = [];
  if (flaggedBuzzwords.length > 0) {
    suggestions.push(`Replace ${totalBuzzwordMatches} flagged AI buzzword(s) like "${flaggedBuzzwords.slice(0, 3).map(f => f.word).join('", "')}".`);
  }
  if (burstinessScore < 50) {
    suggestions.push(`Vary sentence lengths more. Mix short punchy statements with longer narrative thoughts to improve cadence.`);
  }
  if (perplexityScore < 50) {
    suggestions.push(`Enhance word choice diversity and eliminate repetitive transitional intros.`);
  }
  if (suggestions.length === 0) {
    suggestions.push(`Prose displays strong natural burstiness and authentic human vocabulary!`);
  }

  return {
    aiProbability,
    humanProbability,
    burstinessScore,
    perplexityScore,
    flaggedBuzzwords,
    totalWords,
    totalSentences,
    suggestions
  };
}

// Post-processing sanitizer to eradicate residual AI crutches
export function sanitizeAiBuzzwords(text: string): string {
  if (!text) return text;
  
  let cleaned = text;

  const replacements: [RegExp, string][] = [
    [/\bdelves into\b/gi, "examines"],
    [/\bdelve into\b/gi, "explore"],
    [/\bdelving into\b/gi, "exploring"],
    [/\bdelved into\b/gi, "explored"],
    [/\bdelve\b/gi, "examine"],
    [/\bdelves\b/gi, "examines"],
    [/\bdelving\b/gi, "exploring"],
    [/\ba testament to\b/gi, "proof of"],
    [/\btestament to\b/gi, "proof of"],
    [/\btestament\b/gi, "proof"],
    [/\bparadigm shift\b/gi, "major shift"],
    [/\bseamlessly\b/gi, "smoothly"],
    [/\bseamless\b/gi, "smooth"],
    [/\bever-evolving\b/gi, "changing"],
    [/\bever evolving\b/gi, "changing"],
    [/\bholistic approach\b/gi, "comprehensive approach"],
    [/\bholistic\b/gi, "comprehensive"],
    [/\bfostering a\b/gi, "building a"],
    [/\bfostering\b/gi, "nurturing"],
    [/\bfosters\b/gi, "encourages"],
    [/\bfostered\b/gi, "built"],
    [/\bsynergy\b/gi, "collaboration"],
    [/\bsynergies\b/gi, "collaborations"],
    [/\bvital role\b/gi, "key role"],
    [/\bpivotal role\b/gi, "central role"],
    [/\bpivotal moment\b/gi, "key turning point"],
    [/\bpivotal\b/gi, "crucial"],
    [/\bintricate web\b/gi, "complex network"],
    [/\bintricate\b/gi, "detailed"],
    [/\brich tapestry\b/gi, "vibrant mix"],
    [/\bvibrant tapestry\b/gi, "rich texture"],
    [/\btapestry\b/gi, "mosaic"],
    [/\bbeacon of hope\b/gi, "symbol of hope"],
    [/\bbeacon of light\b/gi, "guiding light"],
    [/\bbeacon of\b/gi, "symbol of"],
    [/\bbeacon\b/gi, "guide"],
    [/\bin today's fast-paced world\b/gi, "today"],
    [/\bin today's world\b/gi, "today"],
    [/\bin an era where\b/gi, "when"],
    [/\bin conclusion,\b/gi, "overall,"],
    [/\bin summary,\b/gi, "in short,"],
    [/\bit is worth noting that\b/gi, ""],
    [/\bit's worth noting that\b/gi, ""],
    [/\bit is worth noting\b/gi, ""],
    [/\bit is important to remember that\b/gi, ""],
    [/\bit is essential to\b/gi, "we must"],
    [/\btransformative journey\b/gi, "growth process"],
    [/\btransformative\b/gi, "profound"],
    [/\bgame-changer\b/gi, "turning point"],
    [/\bgamechanger\b/gi, "turning point"],
    [/\bspearhead\b/gi, "lead"],
    [/\bspearheading\b/gi, "leading"],
    [/\bharnessing the power of\b/gi, "using"],
    [/\bharnessing\b/gi, "using"],
    [/\bharness\b/gi, "use"],
    [/\bunravel the\b/gi, "explain the"],
    [/\bunraveling\b/gi, "explaining"],
    [/\bdeep dive\b/gi, "detailed look"],
    [/\bdive deep into\b/gi, "examine"],
    [/\bembark on a journey\b/gi, "begin"],
    [/\bembark on\b/gi, "start"],
    [/\bembarking on\b/gi, "starting"],
    [/\brealm of\b/gi, "field of"],
    [/\brealm\b/gi, "domain"],
    [/\bindispensable\b/gi, "essential"],
    [/\bresonate deeply with\b/gi, "connect with"],
    [/\bresonates with\b/gi, "connects with"],
    [/\bresonates\b/gi, "connects"],
    [/\billuminate\b/gi, "clarify"],
    [/\billuminating\b/gi, "revealing"],
    [/\bdemystify\b/gi, "simplify"],
    [/\bdemystifying\b/gi, "simplifying"],
    [/\bmyriad of\b/gi, "many"],
    [/\ba myriad of\b/gi, "many"],
    [/\bplethora of\b/gi, "abundance of"],
    [/\ba plethora of\b/gi, "many"],
    [/\bat its core,\b/gi, "fundamentally,"],
    [/\bfirst and foremost,\b/gi, "first,"],
    [/\bwithout further ado,\b/gi, ""],
    [/\bunderscore the importance of\b/gi, "highlight"],
    [/\bunderscores\b/gi, "highlights"],
    [/\bunderscore\b/gi, "highlight"],
    [/\bunderscoring\b/gi, "highlighting"],
    [/\bmultifaceted\b/gi, "complex"],
    [/\bunwavering\b/gi, "steady"],
    [/\bparamount\b/gi, "top priority"],
    [/\bcornerstone\b/gi, "foundation"],
    [/\bbedrock\b/gi, "foundation"],
    [/\bhallmark of\b/gi, "defining feature of"],
    [/\bcatalyst for\b/gi, "spark for"],
    [/\bfurthermore,\b/gi, "also,"],
    [/\bmoreover,\b/gi, "in addition,"]
  ];

  replacements.forEach(([regex, replacement]) => {
    cleaned = cleaned.replace(regex, replacement);
  });

  // Clean up double spaces or floating punctuation
  return cleaned.replace(/  +/g, ' ').replace(/ ,/g, ',');
}

export async function humanizeManuscript(
  content: string,
  mode: 'bypass' | 'natural' | 'authorial' = 'bypass',
  apiKey?: string,
  language: string = 'English'
): Promise<string> {
  const ai = getAI(apiKey);

  let modeInstruction = "";
  if (mode === 'bypass') {
    modeInstruction = `MODE: MAXIMUM AI DETECTION BYPASS (HIGH BURSTINESS)
    - Aggressively rewrite sentences to vary sentence length continuously (alternate short 3-6 word punchy sentences with longer descriptive multi-clause thoughts).
    - Eliminate EVERY SINGLE AI cliché, corporate crutch, academic filler word, and formulaic transition.
    - Ingest active, visceral verbs, grounded human observations, and vivid natural metaphors.`;
  } else if (mode === 'authorial') {
    modeInstruction = `MODE: AUTHORIAL VOICE ENHANCEMENT & PROSE POLISH
    - Polish into rich, publication-grade literary prose while keeping the author's voice authentic, warm, and natural.
    - Eliminate robotic academic transitions, stiff corporate buzzwords, and repetitive sentence openers.
    - Elevate prose clarity, emotional resonance, vocabulary richness, and narrative rhythm without changing any factual content.`;
  } else {
    modeInstruction = `MODE: NATURAL HUMAN FLOW
    - Shift the text into a clear, direct, engaging conversational human voice.
    - Strip away overly formal AI corporate-speak, pseudo-profound summaries, and passive phrasing. Replace with authentic, grounded human prose.
    - Maintain smooth readability, natural cadence, and sentence length diversity.`;
  }

  const prompt = `You are an elite literary editor and manuscript humanization expert specializing in turning AI drafts into genuine, human-written prose that bypasses AI detectors (Turnitin, GPTZero, CopyLeaks).

TASK: Completely rewrite and humanize the manuscript text below.

CRITICAL LAWS:
1. RETAIN ALL FACTUAL CONTENT & STRUCTURE: Keep all chapter subheadings (H2, H3), key arguments, bullet points, and core logic intact. Do NOT shorten or delete content.
2. HIGH BURSTINESS & SENTENCE VARIETY: Alternate sentence length drastically. Mix short, direct, punchy sentences (3-7 words) with rich, descriptive thoughts.
3. ABSOLUTE BAN ON AI BUZZWORDS & CLICHÉS: Never use "delve", "paradigm shift", "seamlessly", "holistic", "ever-evolving", "landscape", "fostering", "synergy", "testament to", "tapestry", "beacon", "vital role", "pivotal", "underscore", "in conclusion", "in today's fast-paced world", "intricate web", "transformative journey", "furthermore", "moreover", "realm", "embark", "harness", "unravel", "demystify", "myriad", "plethora".
4. MANUSCRIPT CONTINUITY & CHARACTER NAMES: Maintain all character names, key terms, and narrative continuity with the rest of the manuscript without altering proper nouns or facts.
5. ${modeInstruction}
6. FORMATTING: Output ONLY the complete revised Markdown manuscript. Language: ${language}.

MANUSCRIPT TEXT TO HUMANIZE:
"""
${content}
"""`;

  const generate = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a world-class literary editor. You transform robotic AI-generated drafts into organic, dynamic, human-written prose with high burstiness, zero buzzwords, and authentic voice."
      }
    });
    return response.text || content;
  };

  try {
    const result = await withRetry(() => generate("gemini-3.6-flash"), !!apiKey);
    return sanitizeAiBuzzwords(result);
  } catch (e: any) {
    console.warn("Humanize error on gemini-3.6-flash, retrying...", e);
    const result = await withRetry(() => generate("gemini-2.5-flash"), !!apiKey);
    return sanitizeAiBuzzwords(result);
  }
}

export async function queryPublishingExpertKnowledge(
  query: string,
  apiKey?: string
): Promise<string> {
  const ai = getAI(apiKey);

  const prompt = `You are an elite Publishing Executive, Master Literary Agent, and ACX Audio Engineering Specialist.
Answer the following query with deep, authoritative, highly specific publishing wisdom and actionable technical guidelines:

USER QUERY: "${query}"

PROVIDE A COMPREHENSIVE, HIGHLY DETAILED RESPONSE COVERING:
1. Direct Executive Answer with step-by-step guidance.
2. Technical Industry Standards (ACX loudness specs: RMS -23dB to -18dB, peak -3.0dB, noise floor <= -60dB; KDP metadata & categories; ISBN vs ASIN rules).
3. Strategic Insights & Best Practices (prose rhythm, voice direction, marketing conversion, distribution channels).
4. Actionable Next Steps formatted in clean Markdown.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 2048 },
      systemInstruction: "You are an elite Publishing Executive, Master Literary Agent, and ACX Audio Director. Deliver clear, authoritative, and deeply knowledgeable answers."
    }
  }), !!apiKey);

  return response.text || "No response received from expert system.";
}




