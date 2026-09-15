import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";

export interface Attachment {
  name?: string;
  mimeType: string;
  data: string;
}

function getGeminiBaseUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/gemini-api-proxy`;
  }
  return "https://generativelanguage.googleapis.com";
}

function getAI(customApiKey?: string) {
  let key = customApiKey;

  if (!key || key.trim() === '' || key === 'undefined' || key === 'null') {
    if (typeof window !== 'undefined') {
      key = localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key') || undefined;
    }
  }

  if (!key || key.trim() === '' || key === 'undefined' || key === 'null') {
    key = process.env.GEMINI_API_KEY;
  }

  if (!key || key.trim() === '' || key === 'undefined' || key === 'null') {
    console.error("Gemini API Key missing in BYOK mode.");
    throw new Error("Gemini API Key Missing (BYOK Mode). Please open User Settings -> Personal API Keys to enter your Google Gemini API key.");
  }

  return new GoogleGenAI({
    apiKey: key.trim(),
    httpOptions: { baseUrl: getGeminiBaseUrl() }
  });
}

export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: { baseUrl: getGeminiBaseUrl() }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ role: "user", parts: [{ text: "Hello! Confirm status in 5 words." }] }]
    });
    if (response.text) {
      return { success: true, message: "Gemini API Key successfully verified and working!" };
    } else {
      return { success: false, message: "Received empty response from Gemini API." };
    }
  } catch (err: any) {
    let raw = err?.message || "Failed to validate Gemini API key.";
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
    return { success: false, message: raw };
  }
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
      
      if (!isTransientError && (
        error?.status === 400 || 
        error?.status === 403 || 
        error?.message?.includes('API key') || 
        error?.message?.includes('leaked') ||
        error?.message?.includes('API_KEY_INVALID')
      )) {
        const keyInfo = hasCustomKey ? "the CUSTOM API key provided in settings" : "the default application API key";
        let errDesc = error?.message || 'API key issue';
        if (typeof errDesc === 'string' && errDesc.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(errDesc.trim());
            if (parsed?.error?.message) errDesc = parsed.error.message;
          } catch {}
        }
        
        if (errDesc.toLowerCase().includes('leaked') || errDesc.toLowerCase().includes('compromised')) {
          throw new Error(`[API_KEY_LEAKED] Your Gemini API key (${keyInfo}) was reported as leaked/compromised by Google. Please enter a new free Google Gemini API key to continue.`);
        }
        if (errDesc.toLowerCase().includes('not valid') || errDesc.includes('API_KEY_INVALID')) {
          throw new Error(`[API_KEY_INVALID] The Gemini API key provided (${keyInfo}) is not valid. Please configure a valid Google Gemini API key in settings.`);
        }
      }

    if (isTransientError && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`Transient error or rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
    } else {
        const keyInfo = hasCustomKey ? "your custom API key" : "the default application API key";
        let raw = error?.message || 'Unknown error';
        if (typeof raw === 'string') {
          if (raw.includes('<!DOCTYPE html>') || raw.includes('<html')) {
            if (raw.includes('PayloadTooLargeError') || raw.includes('entity too large')) {
              raw = "Payload Too Large: The request content or attachment exceeded the server limit. Please try sending a shorter prompt or smaller attachment.";
            } else {
              raw = "Server Error: Received an HTML error response from the proxy server.";
            }
          } else if (raw.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(raw.trim());
              if (parsed?.error?.message) {
                raw = parsed.error.message;
              }
            } catch {
              // keep raw
            }
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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

export async function generateOutline(
  idea: string, 
  keywords: string[], 
  apiKey?: string, 
  systemPrompt?: string, 
  category?: string,
  subCategory?: string
) {
  const ai = getAI(apiKey);

  const generate = async (modelName: string) => {
    let architectureInstructions = "";
    let systemRole = "You are a master Literary Architect, NYT Bestselling Editor, and Publishing Specialist. Synthesize deep structural outlines with rich narrative momentum, tropes, psychological depth, and reader engagement loops.";

    if (category === 'sales_copy') {
      systemRole = "You are a legendary Direct-Response Copywriting Architect and Conversion Strategist (inspired by Gary Halbert, Dan Kennedy, Eugene Schwartz, and modern direct-response masters). You design high-converting sales letters, VSLs, and promotional launch campaigns.";
      architectureInstructions = `STRUCTURE A MASTERCLASS 10-14 PART DIRECT-RESPONSE SALES COPY SEQUENCE:
      - **Section 1: The Irresistible Hook & Lead**: Pre-head, arresting headline, subhead, and curiosity hook.
      - **Section 2: The Core Problem & Pain Agitation**: Visceral breakdown of the prospect's real frustrations and emotional pain points.
      - **Section 3: The Failed Solutions & Villain**: Why traditional methods fail and the hidden enemy/obstacle.
      - **Section 4: The Epiphany Bridge & Origin Story**: The authentic breakthrough discovery and journey.
      - **Section 5: The Unique Mechanism & Solution Reveal**: The proprietary system/framework that makes success inevitable.
      - **Section 6: Deep Dive into Core Deliverables / Features**: Detailed breakdown of what the prospect receives.
      - **Section 7: Social Proof & Case Studies**: Specific transformation stories, metrics, and empirical proof.
      - **Section 8: The Irresistible Offer Architecture**: The complete package, value proposition, and deliverables.
      - **Section 9: The Value Stack & High-Value Bonuses**: Stacked value calculation and complementary bonuses.
      - **Section 10: The Ironclad Guarantee & Risk Reversal**: 30-to-90 day no-risk guarantee terms.
      - **Section 11: The Urgency & Scarcity Drivers**: Deadline, limited enrollment, or consequence of delayed action.
      - **Section 12: Objection Buster FAQ**: Defuse the top 5-7 hidden customer hesitations.
      - **Section 13: The Final High-Converting Call to Action (CTA) & P.S. Sequence**: Decisive closing arguments and urgency triggers.`;
    } else if (category === 'white_paper') {
      systemRole = "You are a Senior B2B Strategy Consultant, Enterprise Technology Architect, and Principal Industry Analyst (McKinsey/Gartner-grade). You design authoritative, research-backed white papers and institutional industry reports.";
      architectureInstructions = `STRUCTURE AN AUTHORITATIVE 8-12 SECTION B2B WHITE PAPER & INDUSTRY REPORT:
      - **Section 1: Executive Summary**: Core thesis, strategic context, and key executive takeaways.
      - **Section 2: Macroeconomic & Industry Landscape**: Emerging market dynamics, technological shifts, and regulatory drivers.
      - **Section 3: Market Problem Definition & Limitations of Legacy Approaches**: The operational bottleneck and total cost of inaction.
      - **Section 4: The Novel Architectural Framework**: The paradigm shift, foundational methodology, and architectural diagram/model.
      - **Section 5: Technical & Operational Methodology**: In-depth analysis of components, integration, and operational workflows.
      - **Section 6: Empirical Validation & Benchmark Case Studies**: Real-world performance data, testing benchmarks, and ROI metrics.
      - **Section 7: Financial Impact & Total Cost of Ownership (TCO)**: Economic modeling, cost reduction, and revenue acceleration.
      - **Section 8: Enterprise Security, Governance, Compliance & Risk**: Enterprise risk mitigation, data privacy, and governance frameworks.
      - **Section 9: Strategic Implementation Roadmap**: Phased rollout phases (30-60-90 days), change management, and milestones.
      - **Section 10: Strategic Recommendations & Next Steps**: Actionable guidance for executive stakeholders and decision-makers.`;
    } else if (category === 'web_copy') {
      systemRole = "You are a master Conversion Rate Optimization (CRO) Architect and Principal Digital UX Copywriter. You design high-converting web experiences, landing page suites, and modular digital funnel copy.";
      architectureInstructions = `STRUCTURE A COMPLETE HIGH-CONVERSION DIGITAL WEB COPY & LANDING PAGE SUITE:
      - **Section 1: Hero Section (Above-The-Fold)**: Attention-grabbing H1 headline, benefit subhead, primary CTA, and social proof trust badges.
      - **Section 2: The Problem Matrix & Customer Pain Awareness**: Agitating the current struggle with relatable scenarios and bulleted pain points.
      - **Section 3: The Core Value Proposition & Solution Overview**: Introducing the platform/service with crisp, benefit-first positioning.
      - **Section 4: Key Features & Outcome-Driven Benefits**: 4-6 modular feature blocks formatted as 'Feature -> Tangible Benefit -> Emotional Relief'.
      - **Section 5: How It Works (3-Step Frictionless Flow)**: Visual, step-by-step user onboarding journey from signup to first win.
      - **Section 6: Wall of Social Proof & Customer Case Stories**: Testimonial quotes, before/after metrics, and logo cloud architecture.
      - **Section 7: Comparison & Market Differentiation Matrix**: Side-by-side comparison table vs. status quo and competitors.
      - **Section 8: Pricing Tiers & Package Breakdown**: Plan tiers, highlighted recommended tier, feature checklist, and value anchoring.
      - **Section 9: Frictionless FAQ Section**: Overcoming pricing, onboarding, and compatibility objections.
      - **Section 10: Sticky Conversion Banner & Final Call to Action**: High-urgency closing banner with dual CTAs and risk-free guarantee.
      - **Section 11: Secondary Page Copy (About Us & Feature Deep Dive)**: Micro-copy, mission statement, and deep feature page blurbs.`;
    } else if (category === 'children_stories') {
      systemRole = "You are an acclaimed children's author, storyteller, and literacy specialist (inspired by Roald Dahl, Maurice Sendak, Julia Donaldson, and E.B. White). You design enchanting children's books, picture book page breakdowns, and juvenile story outlines.";
      architectureInstructions = `STRUCTURE AN ENCHANTING CHILDREN'S STORY / JUVENILE BOOK OUTLINE:
      - **Story Premise & Core Wonder**: Engaging premise, curious problem or quest, and emotional/moral core.
      - **Target Age Range & Reading Level**: Explicit age bracket (e.g. Picture Books Ages 2-6, Early Readers Ages 5-8, Chapter Books Ages 6-10, Middle Grade Ages 8-12).
      - **Main Characters & Quirks**: Lovable protagonist, distinct sidekicks, and whimsical or relatable foils with unique voices.
      - **Setting & Sensory World**: Whimsical or familiar setting rich in tactile wonder, sights, and sounds.
      - **Chapter / Scene Breakdown (8-12 Episodes/Scenes)**:
        * Catchy, playful scene or chapter title.
        * Narrative beat & action (rising suspense, funny mishaps, moment of courage).
        * Core dialogue & character milestone.
        * [Illustration Cue]: Suggested visual illustration prompt for each page/spread (character actions, background details, expressions).
        * Heartwarming emotional takeaway or gentle lesson.
      
      MANDATORY CHARACTER NAMING & DIVERSITY RULES:
      - Every character introduced MUST have a distinct, delightful name tailored to children's storytelling.
      - Avoid overused generic tropes. Generate fresh, memorable, child-friendly names.`;
    } else if (category === 'guides' || subCategory === 'how_to_manual' || subCategory === 'masterclass_handbook') {
      systemRole = "You are an expert Instructional Designer, Systems Architect, and Master Technical Author. Deliver crystal-clear, step-by-step how-to guides, execution playbooks, and operational manuals with structured action checklists, troubleshooting matrices, and practical blueprints.";
      architectureInstructions = `STRUCTURE A STEP-BY-STEP OPERATIONAL GUIDE / MASTERCLASS HANDBOOK OUTLINE:
      - **Chapter Title & Operational Objective**: Concrete, outcome-focused title and exact technical/practical goal.
      - **Prerequisites & Tool Stack**: Tools, accounts, hardware/software specifications, or prior knowledge required.
      - **Core Framework & Procedural Phases**: 4-6 sequential, step-by-step phases with clear action verbs.
      - **Action Checklists, Code/Configs & Diagrams**: Specific command-line instructions, code snippets, config files, or Mermaid workflow diagrams to incorporate.
      - **Common Pitfalls & Troubleshooting Matrix**: Edge cases, failure modes, error codes, and exact corrective actions.
      - **Verification Checkpoints & Next Steps**: How to test/validate success before moving forward.
      
      STRICT GUIDELINES FOR MANUALS & GUIDES:
      - Focus 100% on clear, authoritative, practical, and reproducible procedures.
      - DO NOT invent fictional characters, dramatized dialogue, or fictional storytelling scenes.`;
    } else if (category === 'non_fiction') {
      if (subCategory === 'business_leadership') {
        systemRole = "You are a world-class Business Strategist, Management Consultant, and Thought Leadership Author. You design authoritative business frameworks, strategic playbooks, and organizational transformation blueprints.";
        architectureInstructions = `STRUCTURE AN AUTHORITATIVE BUSINESS & THOUGHT LEADERSHIP CHAPTER OUTLINE:
        - **Chapter Title & Strategic Thesis**: High-impact title and core strategic premise.
        - **Proprietary Framework & Mental Model**: The strategic matrix, model, or methodology.
        - **Core Operational Principles**: 4-6 deep analysis points on execution, leadership, or market dynamics.
        - **Empirical Industry Case Studies & Data**: Real-world industry benchmarks, corporate precedents, and empirical lessons.
        - **Executive Action Plan & Implementation Checklist**: Actionable steps, team KPIs, and governance milestones.
        - **Key Strategic Takeaways**: Summary takeaways and executive decision frameworks.`;
      } else if (subCategory === 'health_wellness') {
        systemRole = "You are an authoritative Health, Wellness & Longevity Author and Medical Researcher. You design science-backed protocols, biological wellness frameworks, and sustainable health routines.";
        architectureInstructions = `STRUCTURE A SCIENCE-BACKED HEALTH & WELLNESS CHAPTER OUTLINE:
        - **Chapter Title & Core Protocol**: Impactful chapter title and key health objective.
        - **Biological Mechanism & Science Foundation**: Clear explanation of bodily mechanisms and scientific research.
        - **Actionable Daily Protocols & Habits**: 4-6 concrete routines, timing, dosage/exercise guidelines.
        - **Safety Guidelines, Contraindications & Tracking**: Measurable biometric markers, warnings, and progress metrics.
        - **Implementation Checklist & Lifestyle Integration**: Day-to-day routine checklist and habit triggers.`;
      } else if (subCategory === 'biography_memoir') {
        systemRole = "You are an acclaimed biographical ghostwriter and narrative non-fiction author. Synthesize emotional intimacy, authentic voice, historical or lived detail, and reflective wisdom.";
        architectureInstructions = `STRUCTURE A NARRATIVE MEMOIR / BIOGRAPHICAL CHAPTER OUTLINE:
        - **Chapter Title & Life Milestone**: Evocative title marking a key life chapter or turning point.
        - **Core Emotional Arc & Setting**: Atmosphere, historical context, and lived emotional stakes.
        - **Key Life Events & Relationships**: 4-6 sequential moments exploring challenges, choices, and turning points.
        - **Character Perspectives & Dialogue**: Authentic interactions and character relationships.
        - **Philosophical Reflection & Lived Insight**: Universal takeaway derived from personal truth.`;
      } else {
        systemRole = "You are an acclaimed Personal Development Author, Behavioral Strategist, and Thought Leader. You design actionable psychological frameworks, habit architectures, and transformative non-fiction outlines.";
        architectureInstructions = `STRUCTURE AN ENGAGING SELF-HELP & PERSONAL GROWTH CHAPTER OUTLINE:
        - **Chapter Title & Paradigm Shift**: Catchy title and core mindset/habit breakthrough.
        - **The Psychological Mechanism**: Why traditional habits fail and the cognitive/behavioral mechanics.
        - **Actionable Framework & Core Steps**: 4-6 structured concepts with practical applications.
        - **Relatable Real-World Scenarios**: Grounded examples and situational applications.
        - **Personal Reflection Prompts & Action Checklist**: Journaling exercises, habit audit, and daily action triggers.
        - **Chapter Takeaways**: Summary mental models and core reminders.`;
      }
    } else {
      // Default: Fiction & Storytelling (Preserves 100% of the original rich fiction literary architecture)
      systemRole = "You are a master Literary Architect, NYT Bestselling Editor, and Fiction Specialist. Synthesize deep structural outlines with rich narrative momentum, tropes, psychological depth, and reader engagement loops.";
      architectureInstructions = `STRUCTURE EACH CHAPTER WITH DEEP LITERARY ARCHITECTURE:
      - **Chapter Title & Subtitle**: High-impact, engaging title.
      - **Core Premise & Objectives**: Key narrative hook or thesis statement.
      - **Key Themes & Sub-topics**: 4-6 detailed bullet points outlining structural progression.
      - **Narrative Arc / Real-World Case Study**: A compelling narrative scenario, character beat, or empirical case study.
      - **Actionable Takeaways / Climax**: Concrete insights, cliffhangers, or practical exercises.
      - **Target Word Allocation & Pacing**: Recommended target word count (e.g. 2,000-2,500 words) and narrative tempo.
      
      MANDATORY CHARACTER NAMING & DIVERSITY RULES:
      - Every character, narrative subject, or case study figure introduced MUST have a distinct first name AND a distinct surname (no repeating first or last names across characters in the manuscript).
      - NEVER use generic AI overused default names (e.g. "Alex", "Sarah", "Elena", "Marcus Vance", "Dr. Jenkins", "David", "Maya", "Ethan", "Chloe", "Carter"). Generate fresh, distinctive, authentic names tailored to this project's setting.`;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an elite Literary Architect, Bestselling Ghostwriter, and Publishing Director.
      Create a masterclass, publication-grade outline for a project about: '${idea}'.
      Category / Format: ${category ? category.replace('_', ' ').toUpperCase() : 'MANUSCRIPT'}${subCategory ? ` (Subcategory: ${subCategory.replace('_', ' ')})` : ''}.
      Keywords & Core Themes: ${keywords.join(", ")}.

      ${architectureInstructions}`,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        systemInstruction: systemPrompt || systemRole
      }
    });
    return response.text || "";
  };

  try {
    return await withRetry(() => generate("gemini-3.7-flash"), !!apiKey);
  } catch (e: any) {
    console.warn("Outline generation retry on gemini-3.7-flash...", e);
    return await withRetry(() => generate("gemini-3.7-flash"), !!apiKey);
  }
}

export async function extractChapters(outline: string, apiKey?: string, language: string = 'English') {
  const ai = getAI(apiKey);
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.7-flash",
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
      model: "gemini-3.7-flash",
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
      model: "gemini-3.7-flash",
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
  continuityContext?: ContinuityContext,
  category?: string,
  subCategory?: string
) {
  const ai = getAI(apiKey);
  const topic = bookIdea && bookIdea.trim() !== '' ? bookIdea : 'the project topic';

  if (signal?.aborted) {
    throw new Error('Generation cancelled by user');
  }

  // Format learned rules context
  let learnedRulesBlock = '';
  if (continuityContext?.learnedRules && continuityContext.learnedRules.length > 0) {
    learnedRulesBlock = `\n\nCRITICAL AUTHOR CORRECTIONS & LEARNED STYLE RULES (MANDATORY ENFORCEMENT ACROSS ALL CHAPTERS/SECTIONS):\nThe author has explicitly requested the following style/tone/character rules from previous feedback. You MUST strictly obey every single rule below:\n` +
      continuityContext.learnedRules.map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.rule}`).join('\n') + '\n';
  }

  // Format preceding chapter summaries context
  let precedingSummariesBlock = '';
  if (continuityContext?.precedingChapterSummaries && continuityContext.precedingChapterSummaries.length > 0) {
    precedingSummariesBlock = `\n\nPRECEDING SECTIONS/CHAPTERS STORY & ARGUMENT PROGRESSION (MAINTAIN CONTINUITY):\nThe manuscript has progressed through the following preceding sections. Ensure this new section seamlessly picks up where the previous argument left off without redundant repetition:\n` +
      continuityContext.precedingChapterSummaries.map((s, i) => `- Section/Chapter ${i + 1}: ${s}`).join('\n') + '\n';
  }

  // Format immediate previous chapter ending
  let previousEndingBlock = '';
  if (continuityContext?.previousChapterEnding) {
    previousEndingBlock = `\n\nIMMEDIATELY PRECEDING SECTION CONCLUSION (BRIDGE SEAMLESSLY):\nHere are the final paragraphs of the preceding section. Open this new section with smooth bridge and momentum:\n"""\n${continuityContext.previousChapterEnding}\n"""\n`;
  }

  // Format existing character names block (only for fiction, children's stories, or memoirs)
  const isCharacterDriven = category === 'fiction' || category === 'children_stories' || (category === 'non_fiction' && subCategory === 'biography_memoir');
  let existingCharactersBlock = '';
  if (isCharacterDriven && continuityContext?.existingCharacterNames && continuityContext.existingCharacterNames.length > 0) {
    existingCharactersBlock = `\n\nESTABLISHED PROJECT CHARACTERS / CASE STUDY ENTITIES:\nThe following entities already exist in this manuscript project:\n` +
      continuityContext.existingCharacterNames.map(n => `- ${n}`).join('\n') +
      `\nCRITICAL NAMING LAWS:
1. Re-use these exact names ONLY when referring to these same established entities.
2. For ANY newly introduced entity in this section, assign a completely NEW distinct name.\n`;
  }

  let categorySpecificRequirements = "";
  let defaultSystemPersona = "You are a Pulitzer-worthy author and master ghostwriter. Synthesize authoritative depth, emotional intelligence, visceral narrative texture, and flawless human rhythm while rigorously adhering to all learned user corrections and manuscript continuity.";

  if (category === 'sales_copy') {
    defaultSystemPersona = "You are an elite Direct-Response Copywriting Legend and Conversion Strategist. Craft high-converting, psychologically irresistible sales copy with high emotional velocity and decisive calls to action.";
    categorySpecificRequirements = `SPECIALIZED DIRECT-RESPONSE SALES COPY REQUIREMENTS:
1. PERSUASIVE VELOCITY & CONVERSION CADENCE: Write high-converting sales copy designed to capture immediate attention, agitate core pain points, present compelling proof, and drive action.
2. PSYCHOLOGICAL TRIGGERS: Incorporate fascination bullet points, risk reversals, value stack breakdowns, authentic urgency, and objection disarmament.
3. CONVERSATIONAL CADENCE & FORMATTING: Use short punchy lines, subheads, emphasized words (bold/italics), bulleted benefits (Features -> Tangible Benefits -> Emotional Payoff), and high-impact Call-To-Action (CTA) anchor boxes.
4. ZERO CORPORATE WAFFLE: Ban dry corporate jargon. Write in a direct, one-on-one persuasive tone.`;
  } else if (category === 'white_paper') {
    defaultSystemPersona = "You are a Senior B2B Strategy Consultant and Enterprise Technology Architect (McKinsey/Gartner-grade). Synthesize authoritative, data-driven white papers with analytical rigor, structured frameworks, and executive clarity.";
    categorySpecificRequirements = `SPECIALIZED B2B WHITE PAPER & INDUSTRY REPORT REQUIREMENTS:
1. EXECUTIVE RIGOR & OBJECTIVITY: Deliver institutional-grade analysis with empirical clarity, authoritative problem definitions, and strategic recommendations.
2. STRUCTURED FRAMEWORKS & TABLES: Use Markdown data tables, architectural breakdown lists, key takeaway callout boxes, and quantitative ROI formulas.
3. ENTERPRISE RELEVANCE: Detail technical architectures, integration methodologies, total cost of ownership (TCO), risk mitigation, and phased implementation roadmaps.
4. CITATION & METHODOLOGY TONE: Write with authoritative, balanced precision, avoiding empty promotional hype.`;
  } else if (category === 'web_copy') {
    defaultSystemPersona = "You are a master Conversion Rate Optimization (CRO) Copywriter and Principal UX Content Designer. Craft crisp, scannable digital landing page and web copy that converts visitors into active customers.";
    categorySpecificRequirements = `SPECIALIZED DIGITAL WEB COPY & LANDING PAGE REQUIREMENTS:
1. RAPID SCANNABILITY & VISUAL HIERARCHY: Structure copy for modern web readers with punchy H1/H2 headlines, subheads, and bite-sized modular paragraphs.
2. BENEFIT-DRIVEN POSITIONING: Frame every feature as a tangible customer outcome ('Feature -> Direct Benefit -> Emotional Relief').
3. UX INTERACTION MODULES: Include clear visual cues for Hero copy, badge labels, social proof testimonial quotes, comparison tables, FAQ accordions, and primary/secondary CTA buttons.
4. FRICTIONLESS CONVERSION FOCUS: Write compelling, micro-commitment button copy and risk-free guarantee snippets.`;
  } else if (category === 'children_stories') {
    defaultSystemPersona = "You are an acclaimed children's author, master storyteller, and literacy specialist (inspired by Roald Dahl, Julia Donaldson, Maurice Sendak, and E.B. White). Craft enchanting, age-appropriate children's stories with vivid sensory imagery, delightful rhythmic cadence, engaging character personalities, playful dialogue, and gentle positive moral or emotional themes.";
    categorySpecificRequirements = `SPECIALIZED CHILDREN'S STORY & PICTURE BOOK CHAPTER REQUIREMENTS:
1. DELIGHTFUL AGE-APPROPRIATE NARRATIVE: Write captivating storytelling with vibrant sensory textures, relatable emotional stakes, gentle humor, and age-appropriate vocabulary tailored to young readers and read-aloud listening.
2. RHYTHMIC CADENCE & READ-ALOUD QUALITY: Ensure musical cadence, lively pacing, and pleasant acoustic balance ideal for reading aloud. Use vivid sound effects/onomatopoeia, playful rhymes where appropriate, and natural dialogue.
3. EMBEDDED ILLUSTRATION CUES: Include visual art cues in brackets throughout the scenes, e.g. \`[Illustration: Full-page spread showing Barnaby the curious badger peeking out from an oversized glowing mushroom canopy under starlight]\` to guide illustration layouts.
4. EMOTIONAL WARMTH & HEARTFELT VALUES: Nurture empathy, curiosity, resilience, friendship, kindness, or courage without sounding preachy or condescending.
5. WHOLESOME & SAFE: Strictly avoid adult violence, dark cynicism, vulgarity, or ungrounded fear.`;
  } else if (category === 'guides' || subCategory === 'how_to_manual' || subCategory === 'masterclass_handbook') {
    defaultSystemPersona = "You are an expert instructional designer, systems architect, and technical author. Deliver crystal-clear, step-by-step how-to guides, execution roadmaps, and operational manuals. Use structured action checklists, visual breakdowns, troubleshooting matrices, prerequisite warnings, and pro-tips to ensure readers achieve rapid, foolproof implementation.";
    categorySpecificRequirements = `SPECIALIZED HOW-TO GUIDE & OPERATIONAL MANUAL CHAPTER REQUIREMENTS:
1. STEP-BY-STEP OPERATIONAL CLARITY: Write a comprehensive, hands-on chapter (2,000 to 3,500 words). Thoroughly unpack every phase with numbered operational steps, prerequisite dependencies, environment configurations, and concrete instructions.
2. TECHNICAL ARTIFACTS & WORKFLOWS: Include structured action checklists, code/terminal commands, configuration examples, and Mermaid.js diagrams or visual flowcharts wherever applicable.
3. TROUBLESHOOTING & EDGE CASES: Detail explicit failure mode tables, common pitfalls, debugging tips, and verification checkpoints so readers can validate their progress.
4. ZERO FICTIONAL MELODRAMA: Do NOT invent fictional characters, dramatized dialogue, or atmospheric storytelling scenes. Write directly to the practitioner in a clear, authoritative, highly usable instructional style.`;
  } else if (category === 'non_fiction') {
    if (subCategory === 'business_leadership') {
      defaultSystemPersona = "You are an elite Business Strategy Consultant and Thought Leadership Author. Synthesize authoritative frameworks, empirical industry case studies, and actionable executive roadmaps.";
      categorySpecificRequirements = `SPECIALIZED BUSINESS & THOUGHT LEADERSHIP CHAPTER REQUIREMENTS:
1. STRATEGIC DEPTH & EXECUTIVE RIGOR: Write a full-length chapter (2,000 to 3,500 words). Unpack strategic frameworks, organizational mechanics, and actionable business models.
2. REAL-WORLD CASE PRECEDENTS: Analyze empirical market case studies, benchmark data, and executive decision dilemmas (without inventing fictional melodrama).
3. ACTIONABLE LEADERSHIP TAKEAWAYS: Include an Executive Action Plan, KPI checkpoints, and practical implementation frameworks.`;
    } else if (subCategory === 'health_wellness') {
      defaultSystemPersona = "You are an authoritative Health, Wellness & Longevity Author and Medical Researcher. Synthesize science-backed protocols, biological mechanisms, and practical lifestyle habits.";
      categorySpecificRequirements = `SPECIALIZED HEALTH & WELLNESS CHAPTER REQUIREMENTS:
1. SCIENCE-BACKED RIGOR & ACTIONABLE PROTOCOLS: Write a full-length chapter (2,000 to 3,500 words). Unpack physiological mechanisms, lifestyle protocols, and practical daily routines.
2. EVIDENCE-BASED GUIDELINES: Provide clear safety warnings, dosage/habit tracking tables, and measurable wellness indicators.
3. SUPPORTIVE & EMPOWERING TONE: Maintain an encouraging, evidence-based voice focused on sustainable long-term vitality.`;
    } else if (subCategory === 'biography_memoir') {
      defaultSystemPersona = "You are an acclaimed biographical ghostwriter and narrative non-fiction author. Synthesize emotional intimacy, authentic voice, historical or lived detail, and reflective wisdom.";
      categorySpecificRequirements = `SPECIALIZED MEMOIR & NARRATIVE NON-FICTION CHAPTER REQUIREMENTS:
1. LENGTH & EXPANSIVE DEPTH: Write a full-length chapter (2,000 to 3,500 words). Unpack lived experiences, turning points, and personal reflections with authentic voice, emotional vulnerability, and historical texture.
2. AUTHENTIC CONTINUITY: Deepen character arcs and personal relationships while honoring truth and lived perspective.
3. ELEGANT LITERARY LAYOUT: Use clean Markdown with compelling narrative pacing, reflective pauses, and scene transitions.`;
    } else {
      defaultSystemPersona = "You are a master Personal Development Author and Behavioral Strategist. Synthesize actionable psychological frameworks, habit architectures, and practical life transformation exercises.";
      categorySpecificRequirements = `SPECIALIZED SELF-HELP & PERSONAL GROWTH CHAPTER REQUIREMENTS:
1. PSYCHOLOGICAL DEPTH & ACTIONABLE FRAMEWORKS: Write a full-length chapter (2,000 to 3,500 words). Unpack behavioral psychology, mental models, and step-by-step personal transformation habits.
2. PRACTICAL EXERCISES & REFLECTION PROMPTS: Include self-audit checklists, journal prompts, and daily habit tracking structures.
3. INSPIRATIONAL YET GROUNDED CADENCE: Balance empathetic encouragement with direct accountability and concrete tools.`;
    }
  } else {
    // Default / Fiction: Preserves 100% of the original rich fiction storytelling capabilities
    defaultSystemPersona = "You are a Pulitzer-worthy author and master ghostwriter. Synthesize authoritative depth, emotional intelligence, visceral narrative texture, and flawless human rhythm while rigorously adhering to all learned user corrections and manuscript continuity.";
    categorySpecificRequirements = `SPECIALIZED MANUSCRIPT CHAPTER REQUIREMENTS:
1. LENGTH & EXPANSIVE DEPTH: Write a full-length chapter (2,000 to 3,500 words). Thoroughly unpack every sub-topic with vivid narrative detail, real-world case studies, psychological insights, dialogue, or step-by-step masterclass demonstrations.
2. TOPIC ALIGNMENT: Directly explore and master the specific subject matter of "${chapterTitle}", keeping aligned with the overall manuscript concept '${topic}'.
3. ELEGANT LITERARY LAYOUT: Use clean Markdown with compelling H2 and H3 subheadings, callout quotes, bulleted insights, and chapter-bridging conclusions.`;
  }

  const generate = async (modelName: string) => {
    if (signal?.aborted) {
      throw new Error('Generation cancelled by user');
    }

    const isTechnicalDoc = category === 'guides' || category === 'white_paper' || (category === 'non_fiction' && subCategory !== 'biography_memoir');

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents: `You are an award-winning master author and content strategist writing a publication-grade section/chapter for a manuscript project.
      
      MANUSCRIPT TOPIC / CORE CONCEPT: '${topic}'
      CATEGORY / FORMAT: ${category ? category.replace('_', ' ').toUpperCase() : 'MANUSCRIPT'}${subCategory ? ` (Subcategory: ${subCategory.replace('_', ' ')})` : ''}
      
      FULL MANUSCRIPT OUTLINE FOR CONTEXT:
      ${outline}
      ${precedingSummariesBlock}
      ${previousEndingBlock}
      ${existingCharactersBlock}
      ${learnedRulesBlock}
      
      TASK: Write the complete, deeply detailed, comprehensive content for the section/chapter titled: "${chapterTitle}".
      
      CRITICAL MANDATORY REQUIREMENTS:
      ${categorySpecificRequirements}
      - DO NOT abbreviate, cut, summarize, or output incomplete placeholder text. Write out the full section in complete, polished prose.
      - DO NOT repeat the main project title as an H1 heading at the start. Begin directly with an engaging hook or H2 section title.
      - COHESION & CONTINUITY: Build directly on the preceding sections and respect all author corrections/learned style rules listed above.
      - AUTHENTIC HUMAN PROSE & DE-AI MANDATE:
         * ZERO AI BUZZWORDS OR FORMULAIC CRUTCHES: Strictly forbidden words include "delve", "paradigm shift", "seamlessly", "holistic", "ever-evolving", "landscape", "fostering", "synergy", "testament to", "tapestry", "beacon", "vital role", "pivotal", "underscore", "in conclusion", "in today's fast-paced world", "intricate web", "transformative journey".
         * MASTERFUL BURSTINESS & CADENCE: Alternate sentence lengths dynamically. Mix ultra-short punchy declarations with expansive descriptive observations.
         * ${isTechnicalDoc
             ? 'PRACTICAL CLARITY & FACTUAL PRECISION: Write with direct authority, clear actionable terminology, concrete examples/checklists, and zero fictional melodrama.'
             : 'RICH SENSORY DETAIL & ACTIVE VERBS: Write with visceral clarity, emotional resonance, grounded metaphors, and natural authority.'}
      - STRATEGIC INLINE VISUAL PLACEHOLDERS:
         At 1 to 2 pivotal conceptual moments (e.g. system architecture diagrams, procedural flowcharts, terminal workflows, or key narrative scenes), insert a clean visual placeholder on its own line between paragraphs:
         ![Visual: Specific detailed description of the diagram, workflow, or scene](placeholder:visual_${Date.now()}_1)
         Do NOT paste base64 or external links. Use this clean placeholder syntax so the visual engine can autoplace the image later.`,
      config: {
        systemInstruction: (systemPrompt ? `${systemPrompt}\n\n` : '') + defaultSystemPersona
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
        reject(new Error('Generation timed out. Click Re-generate to try again.'));
      }, 120000);
    });

    try {
      const response = await Promise.race([generatePromise, abortPromise, timeoutPromise]);
      return sanitizeAiBuzzwords(response.text || "");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  try {
    return await withRetry(() => generate("gemini-3.7-flash"), !!apiKey);
  } catch (e: any) {
    if (e.message?.includes('cancelled') || signal?.aborted) {
      throw e;
    }
    console.warn("Flash model 3.7 failed for chapter generation. Retrying with high-velocity gemini-2.5-flash...", e);
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
10. CODE BOXES & VISUAL DIAGRAM FORMATTING:
   - FORMAT DATA GRIDS AS CLEAN MARKDOWN TABLES (| Col 1 | Col 2 |).
   - ENCLOSE QUOTES & KEY INSIGHTS IN BLOCKQUOTES (> ...).
   - NEVER create dark terminal code blocks (```bash ... ``` or ```text ... ```) unless the user explicitly requests code or shell commands.
   - BOX & CODE BLOCK REMOVAL: If the user asks to "remove boxes", "remove code blocks", "delete the boxes", "strip code blocks", or "unwrap boxes", you MUST strip all ``` code block fences, unwrapping the text into clean, flowing Markdown paragraphs, blockquotes (> ...), or tables.
   - MANDATORY TOOL INVOCATION: When asked to edit, remove boxes, rewrite, or polish, you MUST invoke 'updateChapter' or 'updateMultipleChapters' to write the revised text back into the manuscript!`;

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
    response = await withRetry(() => callModel("gemini-3.7-flash"), !!apiKey);
  } catch (e: any) {
    console.warn("Primary chat call failed on gemini-3.7-flash, retrying...", e);
    response = await withRetry(() => callModel("gemini-3.7-flash"), !!apiKey);
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

  // Intelligent Failsafe: If no tool call was triggered, handle box removal or parse markdown
  if (updatedChapters.length === 0 && !revisedContent && !updatedOutline) {
    // 1. Direct surgical box unwrap if user asked to remove/strip boxes or code blocks
    const isBoxRemovalRequest = /(remove|delete|strip|get rid of|unwrap|take away|eliminate)\s+(the\s+)?(boxes|box|code\s*blocks?|terminal\s*blocks?|ascii\s*boxes?)/i.test(message);
    if (isBoxRemovalRequest && activeChapterObj && activeChapterObj.content) {
      const unwrapped = activeChapterObj.content.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_, codeContent) => {
        const trimmed = codeContent.trim();
        // Convert to clean quote or prose
        return `\n\n> ${trimmed.split('\n').join('\n> ')}\n\n`;
      });
      if (unwrapped !== activeChapterObj.content) {
        updatedChapters.push({
          id: activeChapterObj.id,
          title: activeChapterObj.title,
          content: unwrapped
        });
        revisedContent = unwrapped;
        replyText = `✓ Successfully removed all code boxes from "${activeChapterObj.title}" and formatted the content as clean readable prose.`;
      }
    }

    // 2. Parse markdown code blocks from model reply
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
      } else if (activeChapterObj && replyText.trim().startsWith('#') && replyText.length > 300) {
        // Model emitted raw markdown directly into conversation
        updatedChapters.push({ id: activeChapterObj.id, title: activeChapterObj.title, content: replyText.trim() });
        revisedContent = replyText.trim();
        replyText = `✓ Applied revision to "${activeChapterObj.title}".`;
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
    model: "gemini-3.7-flash",
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
    const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];
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
      model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
    model: "gemini-3.7-flash",
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
  language: string = 'English',
  intensity: 'light' | 'moderate' | 'deep' = 'moderate',
  genre: 'narrative' | 'business' | 'memoir' | 'academic' | 'general' | 'sales_copy' | 'white_paper' | 'web_copy' | 'children_stories' = 'general'
): Promise<string> {
  const ai = getAI(apiKey);

  let systemPersona = "";
  let strategyInstructions = "";

  const genreGuideline: Record<string, string> = {
    narrative: "GENRE FOCUS: Fiction & Creative Narrative. Focus on scene immersion, character perspective, dialogue rhythm, sensory grounding, and show-don't-tell techniques.",
    children_stories: "GENRE FOCUS: Children's Stories & Picture Books. Focus on delightful age-appropriate vocabulary, rhythmic read-aloud cadence, playful dialogue, sensory wonder, warmth, and preserving [Illustration: ...] prompts intact.",
    business: "GENRE FOCUS: Thought Leadership & Non-Fiction. Focus on authoritative clarity, engaging real-world observations, crisp logic, and memorable metaphors without corporate waffle.",
    memoir: "GENRE FOCUS: Memoir & Personal Narrative. Focus on emotional intimacy, reflective authenticity, atmospheric detail, and genuine personal voice.",
    academic: "GENRE FOCUS: Academic & Analytical. Focus on rigorous yet crystal-clear articulation, eliminating pedantic fluff while keeping intellectual precision.",
    sales_copy: "GENRE FOCUS: Direct-Response Sales Copy. Focus on high-converting persuasive cadence, visceral pain/desire hooks, punchy conversational rhythms, objection handling, fascination bullets, and clear urgent call-to-actions without sounding like a robotic pitch.",
    white_paper: "GENRE FOCUS: White Paper & Industry Report. Focus on authoritative executive clarity, data-driven analytical rigor, clear methodology frameworks, structured takeaway boxes/tables, and eliminating fluffy buzzwords while preserving technical precision.",
    web_copy: "GENRE FOCUS: Web Copy & Digital Landing Pages. Focus on rapid visual scannability, punchy above-the-fold hooks, benefits-over-features framing, high-impact subheads, and conversion-optimized micro-copy.",
    general: "GENRE FOCUS: General Trade & Non-Fiction. Focus on balanced readability, natural flow, engaging storytelling, and clear structure."
  };

  const intensityGuideline = {
    light: "TRANSFORMATION INTENSITY: LIGHT / PRECISION POLISH. Make surgical improvements to fix awkward phrasing, passive constructions, and robotic transitions while preserving ~80-90% of original sentence structures.",
    moderate: "TRANSFORMATION INTENSITY: BALANCED REFRESH. Thoroughly rephrase stiff, mechanical, or robotic sentences into engaging, fluid prose with strong natural rhythm and active voice.",
    deep: "TRANSFORMATION INTENSITY: DEEP LITERARY RE-IMAGINE. Perform a total prose overhaul. Re-craft flat, monotone, or formulaic paragraphs into captivating, high-impact narrative prose with rich vocabulary and master-level cadence."
  }[intensity] || "";

  if (mode === 'natural') {
    systemPersona = "You are a master developmental editor and prose stylist specializing in natural human voice, effortless readability, and engaging storytelling cadence. You eliminate robotic stiffness and create prose that reads like a thoughtful, articulate human author.";
    strategyInstructions = `MODE: NATURAL HUMAN FLOW & CONVERSATIONAL VOICE
- PRIORITY: Maximum readability, smooth paragraph transitions, and authentic human voice.
- CONVERSATIONAL CADENCE: Rewrite stiff, mechanical, or passive phrasing into direct, engaging human observations. Make every paragraph flow naturally into the next.
- ELIMINATE ROBOTIC TRANSITIONS: Strip out "Furthermore", "Moreover", "In conclusion", "It is important to note that", "As previously mentioned", "This underscores the fact that", and replace them with organic narrative connections.
- ACTIVE HUMAN VOICE: Use active verbs, natural rhythm, and clear sentence pacing.
- DIVERSITY OF SENTENCE LENGTH: Mix short declarative statements with flowing, well-crafted compound thoughts.`;
  } else if (mode === 'authorial') {
    systemPersona = "You are a world-class literary editor at a top publishing house (Penguin Random House, HarperCollins). You elevate draft manuscripts into bestselling, publication-grade literary prose with rich imagery, rhythmic cadence, and deep authorial authority.";
    strategyInstructions = `MODE: AUTHORIAL VOICE ENHANCEMENT & LITERARY POLISH
- PRIORITY: Bestseller-quality prose elevation, emotional resonance, and stylistic distinction.
- LITERARY ELEVATION: Elevate flat or repetitive wording into evocative, publication-grade prose.
- STRENGTHEN VERBS & NOUNS: Replace weak verbs + adverbs with precise, evocative verbs. Eliminate filter words ("she noticed that", "it could be seen that", "he realized").
- SHOW, DON'T TELL: Convert abstract claims into grounded, vivid sensory imagery and sharp conceptual clarity.
- RHYTHM & PROSE HARMONY: Craft sentence cadences and paragraph structures that mesmerize the reader and establish unmistakable authorial authority.`;
  } else {
    systemPersona = "You are an anti-AI detector prose specialist. You aggressively rewrite text to maximize sentence length burstiness, eliminate all AI phrase patterns, and introduce organic human variance.";
    strategyInstructions = `MODE: MAXIMUM AI DETECTION BYPASS (HIGH BURSTINESS)
- PRIORITY: Maximize sentence length variation (burstiness) and perplexity to bypass AI detectors (Turnitin, GPTZero, CopyLeaks).
- BURSTINESS: Alternate short, punchy 3-7 word sentences with rich, multi-clause thoughts.
- ELIMINATE ALL AI TELLTALES: Strip away every formulaic structure, balanced parallel lists, and AI crutches.
- UNPREDICTABLE HUMAN CADENCE: Introduce organic phrasing, unexpected analogies, and dynamic sentence structures.`;
  }

  const selectedGenreGuideline = genreGuideline[genre] || genreGuideline.general;

  const prompt = `${systemPersona}

TASK: Rewrite and transform the manuscript chapter text below according to the specified editorial strategy, intensity level, and genre focus.

CRITICAL LAWS:
1. FACTUAL & STRUCTURAL INTEGRITY: Preserve all chapter subheadings (Markdown H2, H3), core facts, character names, numbers, and logical arguments intact. Do NOT delete factual content.
2. ABSOLUTE BAN ON AI BUZZWORDS: Never output words like "delve", "paradigm shift", "seamlessly", "holistic", "ever-evolving", "landscape", "fostering", "synergy", "testament to", "tapestry", "beacon", "vital role", "pivotal", "underscore", "in conclusion", "in today's fast-paced world", "intricate web", "transformative journey", "furthermore", "moreover", "realm", "embark", "harness", "unravel", "demystify", "myriad", "plethora".
3. ${selectedGenreGuideline}
4. ${intensityGuideline}
5. ${strategyInstructions}
6. FORMATTING: Output ONLY the complete revised Markdown manuscript text. Language: ${language}.

MANUSCRIPT TEXT TO TRANSFORM:
"""
${content}
"""`;

  const generate = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPersona,
        temperature: mode === 'authorial' ? 0.88 : mode === 'natural' ? 0.85 : 0.82,
        topP: 0.95
      }
    });
    return response.text || content;
  };

  try {
    const result = await withRetry(() => generate("gemini-3.7-flash"), !!apiKey);
    return sanitizeAiBuzzwords(result);
  } catch (e: any) {
    console.warn("Humanize error on gemini-3.7-flash, retrying...", e);
    const result = await withRetry(() => generate("gemini-3.7-flash"), !!apiKey);
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
    model: "gemini-3.7-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 2048 },
      systemInstruction: "You are an elite Publishing Executive, Master Literary Agent, and ACX Audio Director. Deliver clear, authoritative, and deeply knowledgeable answers."
    }
  }), !!apiKey);

  return response.text || "No response received from expert system.";
}

// ---------------------------------------------------------------------------
// VISUAL DESIGNER & CHAPTER ILLUSTRATION PIPELINE (NANO BANANA)
// ---------------------------------------------------------------------------

export interface CharacterProfile {
  id: string;
  name: string;
  role?: 'protagonist' | 'deuteragonist' | 'supporting' | 'antagonist' | 'companion' | 'guide';
  speciesOrType?: string; // e.g. "Human child (age 6)", "Small fluffy red fox", "Elderly owl wizard"
  physicalAppearance: string; // e.g. "Round cherubic cheeks, messy chestnut curly hair, bright hazel eyes, button nose"
  clothingAndAttire: string; // e.g. "Oversized mustard-yellow hooded raincoat with wooden buttons, navy blue rain boots, striped teal scarf"
  distinctiveFeatures: string; // e.g. "Always carries a glowing brass acorn lantern and a tiny brown leather satchel"
  colorPalette?: string[];
  lockedPromptAnchor: string; // The distilled immutable visual anchor prompt injected into all scene drawings
  isLocked?: boolean;
}

export interface ExtractedScene {
  id: string;
  title: string;
  excerpt: string;
  sceneSummary: string;
  characterNames: string[];
  suggestedPrompt: string;
  colorModeRecommendation: 'color' | 'black_and_white';
  suggestedArtStyle?: string;
  mood: string;
  composition: string; // e.g. "Wide cinematic shot", "Medium profile view", "Dynamic close-up action"
}

export interface ChapterIllustration {
  id: string;
  chapterId: string;
  sceneTitle: string;
  prompt: string;
  imageUrl: string;
  colorMode: 'color' | 'black_and_white';
  artStyle: string;
  aspectRatio: string;
  characterNamesUsed: string[];
  createdAt: number;
  insertedInMarkdown?: boolean;
}

export async function extractCharacterProfilesFromManuscript(
  manuscriptText: string,
  bookCategory?: string,
  apiKey?: string
): Promise<CharacterProfile[]> {
  if (!manuscriptText || manuscriptText.trim().length < 50) return [];
  const ai = getAI(apiKey);

  const isChildren = bookCategory === 'children_stories' || manuscriptText.toLowerCase().includes('picture book') || manuscriptText.toLowerCase().includes('children');

  const prompt = `You are a Lead Character Concept Artist and Visual Designer for ${isChildren ? "top Children's Illustrated Picture Books" : "Bestselling Fiction Novels"}.
Analyze the following manuscript excerpt and identify all key characters. For each character, create a meticulous, highly detailed visual character sheet and an immutable "lockedPromptAnchor" that will ensure 100% visual consistency across every single illustration in the book.

CRITICAL INSTRUCTIONS FOR CHARACTER COHESION:
1. Specify exact physical traits (species/type, age/build, facial structure, skin/fur/feather texture and color, eye color/shape, exact hair/quill style).
2. Specify exact, unchanging signature clothing & accessories (every color, garment, button, hat, shoes, prop).
3. The "lockedPromptAnchor" MUST be a single dense, vivid descriptive sentence that can be pasted directly into an AI image generator to recreate THIS EXACT SAME CHARACTER every time without alteration.

MANUSCRIPT CONTENT:
"""
${manuscriptText.substring(0, 25000)}
"""

Return a JSON array of character profiles.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING, enum: ["protagonist", "deuteragonist", "supporting", "antagonist", "companion", "guide"] },
              speciesOrType: { type: Type.STRING },
              physicalAppearance: { type: Type.STRING },
              clothingAndAttire: { type: Type.STRING },
              distinctiveFeatures: { type: Type.STRING },
              lockedPromptAnchor: { type: Type.STRING }
            },
            required: ["name", "physicalAppearance", "clothingAndAttire", "lockedPromptAnchor"]
          }
        }
      }
    }), !!apiKey);

    const text = (response.text || "[]").replace(/```json/g, '').replace(/```/g, '').trim();
    const list = JSON.parse(text);
    if (Array.isArray(list)) {
      return list.map((c: any) => ({
        id: 'char_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: c.name || 'Unnamed Character',
        role: c.role || 'supporting',
        speciesOrType: c.speciesOrType || 'Human',
        physicalAppearance: c.physicalAppearance || '',
        clothingAndAttire: c.clothingAndAttire || '',
        distinctiveFeatures: c.distinctiveFeatures || '',
        lockedPromptAnchor: c.lockedPromptAnchor || `${c.name}: ${c.physicalAppearance}, wearing ${c.clothingAndAttire}`,
        isLocked: true
      }));
    }
    return [];
  } catch (e) {
    console.error("Failed to extract characters:", e);
    return [];
  }
}

export async function extractChapterScenesAndMoments(
  chapterTitle: string,
  chapterContent: string,
  existingCharacters: CharacterProfile[] = [],
  bookCategory: string = 'guides',
  apiKey?: string
): Promise<ExtractedScene[]> {
  if (!chapterContent || chapterContent.trim().length < 30) return [];
  const ai = getAI(apiKey);

  const isChildren = bookCategory === 'children_stories';
  const isGuides = bookCategory === 'guides' || bookCategory === 'white_paper';
  const isNonFiction = bookCategory === 'non_fiction';
  const isFiction = bookCategory === 'fiction';

  const charContext = existingCharacters.length > 0 && (isFiction || isChildren)
    ? `\nKNOWN CHARACTER BIBLE (LOCK VISUALS TO THESE):\n` + existingCharacters.map(c => `- ${c.name} (${c.speciesOrType || 'Character'}): ${c.lockedPromptAnchor}`).join('\n')
    : '';

  let roleAndGoal = `You are an elite Children's Book Art Director and Scene Designer.
Analyze this chapter and identify 2 to 4 key visual moments/scenes that would make captivating, storytelling illustrations.`;

  let fallbackStyle = 'Whimsical Storybook Watercolor';

  if (isGuides) {
    roleAndGoal = `You are an elite Technical Illustrator, Systems Architect, and Modern Information Designer (in the aesthetic style of Linear, Stripe, Apple Developer, and Figma blueprints).
Analyze this chapter and identify 2 to 4 key technical concepts, architectural diagrams, workflows, or developer/engineering moments that would benefit from clean visual illustrations or blueprints.`;
    fallbackStyle = 'Modern Tech & SaaS Vector';
  } else if (isNonFiction) {
    roleAndGoal = `You are an award-winning Editorial Art Director and Visual Information Designer (Harvard Business Review, The Economist, NYT).
Analyze this chapter and identify 2 to 4 key conceptual ideas, executive frameworks, or editorial metaphors that would make captivating, thought-provoking illustrations.`;
    fallbackStyle = 'Editorial Thought Leadership Illustration';
  } else if (isFiction) {
    roleAndGoal = `You are an elite Film Concept Artist and Cinematic Storyboard Illustrator.
Analyze this chapter and identify 2 to 4 pivotal narrative moments with high visual tension, atmospheric world-building, and character emotion.`;
    fallbackStyle = 'Cinematic Concept Art';
  }

  const prompt = `${roleAndGoal}

CHAPTER TITLE: "${chapterTitle}"
CATEGORY: "${bookCategory}"
${charContext}

CHAPTER TEXT:
"""
${chapterContent.substring(0, 15000)}
"""

FOR EACH VISUAL MOMENT / SCENE DETECTED:
1. Identify the core action, concept, mood, and setting.
2. Formulate an expert, highly descriptive image generation prompt (suggestedPrompt) capturing the visual's composition, environment, lighting, and focal elements.
3. Recommend whether the scene shines in 'color' or 'black_and_white'.

Return a JSON array matching the schema.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              excerpt: { type: Type.STRING },
              sceneSummary: { type: Type.STRING },
              characterNames: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedPrompt: { type: Type.STRING },
              colorModeRecommendation: { type: Type.STRING, enum: ["color", "black_and_white"] },
              suggestedArtStyle: { type: Type.STRING },
              mood: { type: Type.STRING },
              composition: { type: Type.STRING }
            },
            required: ["title", "excerpt", "sceneSummary", "suggestedPrompt", "colorModeRecommendation", "mood"]
          }
        }
      }
    }), !!apiKey);

    const text = (response.text || "[]").replace(/```json/g, '').replace(/```/g, '').trim();
    const list = JSON.parse(text);
    if (Array.isArray(list)) {
      return list.map((s: any) => ({
        id: 'scene_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: s.title || 'Visual Moment',
        excerpt: s.excerpt || '',
        sceneSummary: s.sceneSummary || '',
        characterNames: Array.isArray(s.characterNames) ? s.characterNames : [],
        suggestedPrompt: s.suggestedPrompt || s.sceneSummary,
        colorModeRecommendation: s.colorModeRecommendation === 'black_and_white' ? 'black_and_white' : 'color',
        suggestedArtStyle: s.suggestedArtStyle || fallbackStyle,
        mood: s.mood || 'Focus',
        composition: s.composition || 'Medium shot'
      }));
    }
    return [];
  } catch (e) {
    console.error("Failed to extract chapter scenes:", e);
    return [];
  }
}

export async function generateSceneIllustrationWithNanoBanana(params: {
  scenePrompt: string;
  chapterTitle?: string;
  colorMode: 'color' | 'black_and_white';
  artStyle: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4';
  charactersInScene?: CharacterProfile[];
  bookCategory?: string;
  apiKey?: string;
}): Promise<string> {
  const {
    scenePrompt,
    chapterTitle = '',
    colorMode,
    artStyle,
    aspectRatio = '4:3',
    charactersInScene = [],
    bookCategory = 'guides',
    apiKey
  } = params;

  const ai = getAI(apiKey);

  const isChildren = bookCategory === 'children_stories';
  const isGuides = bookCategory === 'guides' || bookCategory === 'white_paper';
  const isNonFiction = bookCategory === 'non_fiction';
  const isFiction = bookCategory === 'fiction';

  // 1. Synthesize Nano Banana Art Director prompt enforcing character consistency and color palette
  let characterConsistencyInstruction = '';
  if ((isFiction || isChildren) && charactersInScene && charactersInScene.length > 0) {
    characterConsistencyInstruction = `\nCRITICAL CHARACTER VISUAL CONSISTENCY ANCHORS (MANDATORY EXACT MATCHING):\n` +
      charactersInScene.map(c => `[CHARACTER "${c.name.toUpperCase()}"]: ${c.lockedPromptAnchor || c.physicalAppearance + ', wearing ' + c.clothingAndAttire}. Maintain exact face structure, hair, colors, proportions, and attire without deviation.`).join('\n') +
      `\nSTRICT CHARACTER RULE: The above characters MUST be rendered with 100% cohesive, identical physical features and outfits matching their established design across the entire book.\n`;
  }

  let colorModeDirective = '';
  if (colorMode === 'black_and_white') {
    if (isGuides) {
      colorModeDirective = `\nCOLOR MODE: CLEAN MONOCHROME BLUEPRINT & INK. Crisp, high-contrast black line art and technical architectural blueprints on a clean white background. Precision geometry, sharp technical lines, pure monochrome.\n`;
    } else {
      colorModeDirective = `\nCOLOR MODE: STRICT BLACK AND WHITE LINE ART / INK. Clean, high-contrast crisp black line art on a clean white background. Pure black outlines and elegant ink cross-hatching.\n`;
    }
  } else {
    if (isGuides) {
      colorModeDirective = `\nCOLOR MODE: VIBRANT MODERN TECH PALETTE. Clean modern SaaS palette (indigo, cyan, violet, slate), subtle atmospheric glow, crisp vector clarity, and balanced lighting.\n`;
    } else {
      colorModeDirective = `\nCOLOR MODE: VIBRANT FULL COLOR. Rich, cohesive, harmonious color palette with cinematic lighting, warm ambient highlights, and captivating visual storytelling depth.\n`;
    }
  }

  // Engineer the category-tuned Master Prompt
  let masterArtDirectorPrompt = '';
  if (isGuides) {
    masterArtDirectorPrompt = `You are "Nano Banana", an elite Technical Illustrator, Systems Architect, and Modern SaaS Visual Designer (in the style of Linear, Stripe, Apple Developer, and Figma architectural blueprints).
Create a single, cohesive, publication-quality technical illustration or architectural graphic for: "${scenePrompt}" (Chapter: "${chapterTitle}").
Art Style: "${artStyle}".
${colorModeDirective}
${characterConsistencyInstruction}
Composition: Ultra-clean layout, modern developer aesthetics, clear visual hierarchy, precision vector lines, balanced whitespace, professional technical finish.
Output ONLY the final detailed AI generation prompt string. No code fences, no conversational text.`;
  } else if (isNonFiction) {
    masterArtDirectorPrompt = `You are "Nano Banana", an award-winning Editorial Illustrator and Visual Information Designer (Harvard Business Review, The Economist, NYT).
Create a single, sophisticated, publication-quality editorial illustration for: "${scenePrompt}" (Chapter: "${chapterTitle}").
Art Style: "${artStyle}".
${colorModeDirective}
${characterConsistencyInstruction}
Composition: Thoughtful visual metaphor, sophisticated balance, elegant palette, professional editorial weight.
Output ONLY the final detailed AI generation prompt string. No code fences, no conversational text.`;
  } else if (isFiction) {
    masterArtDirectorPrompt = `You are "Nano Banana", a master Cinematic Concept Artist and Film Matte Painter.
Create a breathtaking, publication-quality scene illustration for: "${scenePrompt}" (Chapter: "${chapterTitle}").
Art Style: "${artStyle}".
${colorModeDirective}
${characterConsistencyInstruction}
Composition: Cinematic lighting, atmospheric depth, emotive character staging, high visual tension, immersive world-building.
Output ONLY the final detailed AI generation prompt string. No code fences, no conversational text.`;
  } else {
    masterArtDirectorPrompt = `You are "Nano Banana", an award-winning Children's Book Art Director and Master Illustrator (in the style of Beatrix Potter, Oliver Jeffers, Maurice Sendak, and Pixar).
Create a single, cohesive, publication-quality chapter illustration for: "${scenePrompt}" (Chapter: "${chapterTitle}").
Art Style: "${artStyle}".
${colorModeDirective}
${characterConsistencyInstruction}
Composition: Masterful visual storytelling, balanced focal point, rich environmental details, charming expressive character poses, clear readable silhouette.
Output ONLY the final detailed AI generation prompt string. No code fences, no conversational text.`;
  }

  const engineeredPrompt = `${scenePrompt}. ${colorModeDirective} Art Style: ${artStyle}. ${characterConsistencyInstruction}`.trim();

  console.info("Nano Banana scene generation request:", engineeredPrompt);

  // 1. Race Imagen 3 with a 14-second window (if supported/enabled on user's key)
  try {
    if ((ai.models as any).generateImages) {
      const imagenPromise = (ai.models as any).generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: engineeredPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio === '1:1' ? '1:1' : aspectRatio === '3:4' ? '3:4' : '4:3'
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Imagen timeout')), 14000)
      );

      const imgRes: any = await Promise.race([imagenPromise, timeoutPromise]);
      const bytes = imgRes?.generatedImages?.[0]?.image?.imageBytes;
      if (bytes) {
        console.info("Successfully generated Imagen 3 visual!");
        return `data:image/jpeg;base64,${bytes}`;
      }
    }
  } catch (err: any) {
    console.info("Imagen 3 bypassed or unavailable, transitioning to vector schematic generator:", err?.message || err);
  }

  // 2. Dynamic Bespoke Vector SVG Generation via Gemini 2.5 Flash (Ultra-fast ~1.5s, 100% reliable)
  try {
    const isTech = isGuides || isNonFiction;
    const svgSystemPrompt = `You are a master Technical Systems Architect, Infographic Designer, and Illustrator.
Generate a complete, standalone, production-grade valid XML SVG image (viewBox="0 0 1200 675", width="1200", height="675") for:
"${scenePrompt}" (Chapter: "${chapterTitle}").
Category: ${bookCategory}. Art Style: ${artStyle}.

DESIGN INSTRUCTIONS:
1. Palette: ${isTech ? (colorMode === 'black_and_white' ? 'Monochrome Blueprint (dark slate #0f172a lines on pure white canvas, precision grid)' : 'Modern Dark Mode Developer Palette (canvas #090d16, containers #1e293b with borders #334155, cyan-400 #22d3ee highlights, indigo-400 #818cf8 accents, emerald-400 #34d399 status pills, clean white #f8fafc text)') : (colorMode === 'black_and_white' ? 'Clean black and white ink line art' : 'Rich, harmonious, vibrant story color palette')}.
2. Visual Structure:
   - Top header bar with visual title matching the prompt, status pill, and category badge
   - 3 to 4 modular cards / architecture blocks representing the components in the prompt
   - Clean connecting paths, arrows, or flow indicators with markers
   - Clear legible typography (<text> tags with system-ui or monospace fonts)
   - Professional decorative vector icons or status chips matching the theme
3. Output Format: Return ONLY raw XML SVG starting with <svg> and ending with </svg>. No markdown code fences, no introductory or concluding remarks.`;

    const svgTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SVG AI timeout')), 6000)
    );

    const svgPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: svgSystemPrompt }] }]
    });

    const svgRes: any = await Promise.race([svgPromise, svgTimeout]);
    const rawText = svgRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanUri = sanitizeSvgToDataUri(rawText);
    if (cleanUri) {
      console.info("Gemini AI successfully generated custom vector SVG visual for scene!");
      return cleanUri;
    }
  } catch (svgErr) {
    console.warn("AI dynamic SVG generation skipped or timed out, using procedural blueprint:", svgErr);
  }

  // 3. Guaranteed Immediate Fallback: Category-aware procedural SVG (0ms latency, 100% success)
  return generateProceduralSceneSvg(scenePrompt, colorMode, artStyle, charactersInScene, bookCategory);
}

export function sanitizeSvgToDataUri(rawSvg: string): string {
  if (!rawSvg) return '';
  let clean = rawSvg.trim();
  const match = clean.match(/<svg[\s\S]*?<\/svg>/i);
  if (match) {
    clean = match[0];
  } else {
    return '';
  }
  if (!clean.includes('xmlns=')) {
    clean = clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  // Replace raw unescaped & that isn't already an entity
  clean = clean.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  try {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clean)))}`;
  } catch (e) {
    console.warn("Failed to base64 encode SVG:", e);
    return '';
  }
}

export function generateProceduralSceneSvg(
  prompt: string,
  colorMode: 'color' | 'black_and_white',
  artStyle: string,
  characters: CharacterProfile[] = [],
  bookCategory: string = 'guides'
): string {
  const isBW = colorMode === 'black_and_white';
  const cleanPrompt = prompt.replace(/[<>&'"]/g, '').slice(0, 80);
  const isGuides = bookCategory === 'guides' || bookCategory === 'white_paper' || bookCategory === 'non_fiction';

  // Break prompt into key conceptual phrases for dynamic node labels
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 2);
  const node1Title = (words.slice(0, 3).join(' ') || 'Input & Source').toUpperCase();
  const node2Title = (words.slice(3, 6).join(' ') || 'Core Processing').toUpperCase();
  const node3Title = (words.slice(6, 10).join(' ') || 'Output & Result').toUpperCase();

  if (isGuides) {
    // High-tech modern dark-mode system architecture blueprint
    const bg = isBW ? '#ffffff' : '#090d16';
    const cardBg = isBW ? '#f8fafc' : '#111827';
    const border = isBW ? '#cbd5e1' : '#1e293b';
    const accent = isBW ? '#0f172a' : '#22d3ee';
    const subAccent = isBW ? '#475569' : '#818cf8';
    const textMain = isBW ? '#0f172a' : '#f8fafc';
    const textMuted = isBW ? '#64748b' : '#94a3b8';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
      <defs>
        <pattern id="techgrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="${isBW ? '#e2e8f0' : '#1e293b'}" stroke-width="1" opacity="0.6"/>
        </pattern>
        <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="${subAccent}"/>
        </linearGradient>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="${accent}"/>
        </marker>
      </defs>

      <!-- Canvas Background -->
      <rect width="1200" height="675" fill="${bg}"/>
      <rect width="1200" height="675" fill="url(#techgrid)"/>

      <!-- Header Top Bar -->
      <rect x="40" y="30" width="1120" height="70" rx="12" fill="${cardBg}" stroke="${border}" stroke-width="1.5"/>
      <circle cx="70" cy="65" r="14" fill="${accent}" opacity="0.2"/>
      <circle cx="70" cy="65" r="6" fill="${accent}"/>
      <text x="100" y="60" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" font-weight="800" fill="${textMain}" letter-spacing="0.5">
        TOPOLOGY &amp; ARCHITECTURAL SPECIFICATION
      </text>
      <text x="100" y="80" font-family="system-ui, sans-serif" font-size="12" fill="${textMuted}">
        ${cleanPrompt}
      </text>
      <rect x="1010" y="48" width="130" height="34" rx="8" fill="${isBW ? '#e2e8f0' : '#1e293b'}"/>
      <text x="1075" y="70" font-family="monospace" font-size="11" font-weight="700" fill="${accent}" text-anchor="middle">
        VERIFIED SPEC
      </text>

      <!-- Connection Lines -->
      <path d="M 370 285 L 470 285" stroke="${accent}" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#arrow)"/>
      <path d="M 730 285 L 830 285" stroke="${accent}" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#arrow)"/>
      <path d="M 600 395 L 600 460" stroke="${subAccent}" stroke-width="2" stroke-dasharray="4 4"/>

      <!-- Node 1 -->
      <g transform="translate(100, 160)">
        <rect width="270" height="250" rx="16" fill="${cardBg}" stroke="${border}" stroke-width="2"/>
        <rect width="270" height="40" rx="16" fill="${isBW ? '#e2e8f0' : '#1e293b'}"/>
        <text x="20" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${accent}">
          01. STAGE ONE
        </text>
        <text x="20" y="70" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${textMain}">
          ${node1Title}
        </text>
        <text x="20" y="95" font-family="monospace" font-size="11" fill="${textMuted}">
          • Data Ingestion &amp; Payload
        </text>
        <text x="20" y="120" font-family="monospace" font-size="11" fill="${textMuted}">
          • Schema Validation
        </text>
        <text x="20" y="145" font-family="monospace" font-size="11" fill="${textMuted}">
          • Event Streaming Bridge
        </text>
        <rect x="20" y="180" width="230" height="45" rx="8" fill="${isBW ? '#ffffff' : '#090d16'}" stroke="${border}"/>
        <text x="35" y="208" font-family="monospace" font-size="11" fill="${accent}">
          Status: OPERATIONAL
        </text>
      </g>

      <!-- Node 2 -->
      <g transform="translate(470, 160)">
        <rect width="260" height="250" rx="16" fill="${cardBg}" stroke="url(#glowGrad)" stroke-width="2"/>
        <rect width="260" height="40" rx="16" fill="${isBW ? '#e2e8f0' : '#1e293b'}"/>
        <text x="20" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${subAccent}">
          02. CORE ENGINE
        </text>
        <text x="20" y="70" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${textMain}">
          ${node2Title}
        </text>
        <text x="20" y="95" font-family="monospace" font-size="11" fill="${textMuted}">
          • Transformation Pipeline
        </text>
        <text x="20" y="120" font-family="monospace" font-size="11" fill="${textMuted}">
          • Distributed State Storage
        </text>
        <text x="20" y="145" font-family="monospace" font-size="11" fill="${textMuted}">
          • Low-Latency Execution
        </text>
        <rect x="20" y="180" width="220" height="45" rx="8" fill="${isBW ? '#ffffff' : '#090d16'}" stroke="${border}"/>
        <text x="35" y="208" font-family="monospace" font-size="11" fill="${subAccent}">
          Throughput: OPTIMAL
        </text>
      </g>

      <!-- Node 3 -->
      <g transform="translate(830, 160)">
        <rect width="270" height="250" rx="16" fill="${cardBg}" stroke="${border}" stroke-width="2"/>
        <rect width="270" height="40" rx="16" fill="${isBW ? '#e2e8f0' : '#1e293b'}"/>
        <text x="20" y="26" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${accent}">
          03. DELIVERY LAYER
        </text>
        <text x="20" y="70" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${textMain}">
          ${node3Title}
        </text>
        <text x="20" y="95" font-family="monospace" font-size="11" fill="${textMuted}">
          • Client Consumer APIs
        </text>
        <text x="20" y="120" font-family="monospace" font-size="11" fill="${textMuted}">
          • Analytics &amp; Monitoring
        </text>
        <text x="20" y="145" font-family="monospace" font-size="11" fill="${textMuted}">
          • Automated Persistence
        </text>
        <rect x="20" y="180" width="230" height="45" rx="8" fill="${isBW ? '#ffffff' : '#090d16'}" stroke="${border}"/>
        <text x="35" y="208" font-family="monospace" font-size="11" fill="${accent}">
          Output: VERIFIED
        </text>
      </g>

      <!-- Bottom Summary Box -->
      <rect x="100" y="470" width="1000" height="150" rx="16" fill="${cardBg}" stroke="${border}" stroke-width="1.5"/>
      <text x="130" y="505" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="${textMain}">
        CONCEPTUAL FLOW &amp; SPECIFICATION SUMMARY
      </text>
      <text x="130" y="535" font-family="system-ui, sans-serif" font-size="12" fill="${textMuted}">
        ${cleanPrompt}
      </text>
      <text x="130" y="575" font-family="monospace" font-size="11" font-weight="600" fill="${accent}">
        MANUSCRIPT ARCHITECTURAL VISUAL — PUBLICATION READY
      </text>
    </svg>`;
    return sanitizeSvgToDataUri(svg);
  }

  // Children's & Fiction Storybook Procedural Fallback
  const charNames = characters.map(c => c.name).join(' and ') || 'Scene Illustration';
  const bgColor = isBW ? '#ffffff' : '#f8fafc';
  const strokeColor = isBW ? '#111827' : '#4338ca';
  const accentColor = isBW ? '#374151' : '#f59e0b';
  const textColor = isBW ? '#111827' : '#1e1b4b';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${isBW ? '#e5e7eb' : '#e2e8f0'}" stroke-width="1"/>
      </pattern>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${isBW ? '#ffffff' : '#dbeafe'}"/>
        <stop offset="100%" stop-color="${isBW ? '#f9fafb' : '#fef3c7'}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#skyGrad)"/>
    <rect width="1200" height="900" fill="url(#grid)" opacity="0.4"/>
    <rect x="20" y="20" width="1160" height="860" rx="16" fill="none" stroke="${strokeColor}" stroke-width="${isBW ? '4' : '3'}"/>
    <rect x="150" y="740" width="900" height="100" rx="16" fill="#ffffff" stroke="${strokeColor}" stroke-width="2"/>
    <text x="600" y="775" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="18" font-weight="800" fill="${textColor}" text-anchor="middle">
      ${charNames.toUpperCase()} — ${isBW ? 'MONOCHROME STORYBOOK ILLUSTRATION' : 'STORY SCENE'}
    </text>
    <text x="600" y="810" font-family="'Georgia', serif" font-size="14" font-style="italic" fill="${isBW ? '#4b5563' : '#6366f1'}" text-anchor="middle">
      "${cleanPrompt}..."
    </text>
  </svg>`;

  return sanitizeSvgToDataUri(svg);
}

export interface ManuscriptVisualPlaceholder {
  rawMatch: string;
  placeholderId: string;
  description: string;
  index: number;
}

/**
 * Detects all unrendered visual placeholders inside manuscript prose.
 * Matches:
 * 1. Markdown placeholder syntax: ![Description](placeholder:id), ![Description](placeholder), ![Description]()
 * 2. Bracketed tags: [IMAGE: Description], [ILLUSTRATION: Description], [VISUAL: Description], [FIGURE: Description]
 */
export function detectManuscriptVisualPlaceholders(content: string): ManuscriptVisualPlaceholder[] {
  if (!content) return [];
  const results: ManuscriptVisualPlaceholder[] = [];

  // 1. Markdown placeholder syntax
  const mdRegex = /!\[([^\]]+)\]\((?:placeholder(?::([^\)\s]+))?|)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(content)) !== null) {
    const description = match[1].trim();
    const explicitId = match[2];
    const placeholderId = explicitId || ('ph_' + Math.random().toString(36).substring(2, 9));
    results.push({
      rawMatch: match[0],
      placeholderId,
      description,
      index: match.index
    });
  }

  // 2. Bracketed text syntax
  const bracketRegex = /\[(?:IMAGE|ILLUSTRATION|VISUAL|FIGURE):\s*([^\]]+)\]/gi;
  while ((match = bracketRegex.exec(content)) !== null) {
    const description = match[1].trim();
    const placeholderId = 'ph_' + Math.random().toString(36).substring(2, 9);
    results.push({
      rawMatch: match[0],
      placeholderId,
      description,
      index: match.index
    });
  }

  return results;
}

/**
 * Analyzes a chapter manuscript and intelligently decides 1 to 3 pivotal moments where
 * a visual diagram, flowchart, technical schematic, or illustration should be inserted.
 */
export async function autoSuggestChapterVisualPlaceholders(
  chapterContent: string,
  chapterTitle: string,
  bookCategory: string,
  apiKey?: string
): Promise<{ updatedContent: string; newPlaceholdersCount: number }> {
  if (!chapterContent || chapterContent.trim() === '') {
    return { updatedContent: chapterContent, newPlaceholdersCount: 0 };
  }
  const ai = getAI(apiKey);
  const isGuides = bookCategory === 'guides' || bookCategory === 'white_paper';

  const prompt = `You are an elite Book Designer and Visual Information Architect.
Analyze the following chapter manuscript ("${chapterTitle}") and identify 1 to 3 pivotal moments where an illustrative visual diagram, flowchart, architecture blueprint, or scene visual will provide maximum reader value.

CHAPTER CONTENT:
${chapterContent.slice(0, 9000)}

TASK:
Pick 1 to 3 distinct paragraphs or sections where inserting a visual adds clarity or narrative depth.
For each visual moment:
1. "anchorText": A short, verbatim snippet (15 to 30 characters) from the end of an existing paragraph in the chapter where the visual should be placed immediately after.
2. "visualDescription": A crisp, highly descriptive prompt for the visual (e.g., "${isGuides ? 'Modern System Architecture Blueprint: Antigravity IDE connected to Gemini CLI and GitHub Actions' : 'Dramatic Scene: Henrik staring at his multi-currency dashboard with disbelief in Oslo'}").

Return a JSON array of objects with keys: "anchorText", "visualDescription". Output ONLY valid JSON.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    }), !!apiKey);

    const text = (response.text || "[]").replace(/```json/g, '').replace(/```/g, '').trim();
    const suggestions = JSON.parse(text);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return { updatedContent: chapterContent, newPlaceholdersCount: 0 };
    }

    let updatedContent = chapterContent;
    let placedCount = 0;

    for (const item of suggestions) {
      if (!item.anchorText || !item.visualDescription) continue;
      const phId = 'ph_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const placeholderMarkdown = `\n\n![${item.visualDescription}](placeholder:${phId})\n\n`;

      const anchorIdx = updatedContent.indexOf(item.anchorText);
      if (anchorIdx !== -1) {
        const insertPos = anchorIdx + item.anchorText.length;
        updatedContent = updatedContent.slice(0, insertPos) + placeholderMarkdown + updatedContent.slice(insertPos);
        placedCount++;
      }
    }

    // Fallback if anchor snippets weren't exact match
    if (placedCount === 0 && suggestions.length > 0) {
      const first = suggestions[0];
      const phId = 'ph_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const placeholderMarkdown = `\n\n![${first.visualDescription}](placeholder:${phId})\n\n`;
      const headingMatch = updatedContent.match(/^(#[^\n]+\n+)/);
      if (headingMatch) {
        updatedContent = updatedContent.replace(headingMatch[0], `${headingMatch[0]}${placeholderMarkdown}`);
        placedCount++;
      } else {
        updatedContent = `${placeholderMarkdown}${updatedContent}`;
        placedCount++;
      }
    }

    return { updatedContent, newPlaceholdersCount: placedCount };
  } catch (e) {
    console.error("Failed to auto-suggest visual placeholders:", e);
    return { updatedContent: chapterContent, newPlaceholdersCount: 0 };
  }
}





