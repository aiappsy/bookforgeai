import React, { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react';
import { BookOpen, FileText, Image as ImageIcon, Headphones, Settings, CheckCircle2, Loader2, Download, PlayCircle, MessageSquare, Send, ChevronRight, ChevronLeft, PanelLeft, List, Key, X, UploadCloud, Library, Plus, Paperclip, User, Tag, Type, Sparkles, Link, Menu, Trash2, Save, Edit3, Sliders, Check, RotateCcw, RotateCw, History, SlidersHorizontal, Palette, Copy, Wand2, LifeBuoy, AlertTriangle, RefreshCw, Layers, Box, Eye, Book, Megaphone, Share2, Mail, Globe, Compass, ExternalLink, Calendar, Award, Search, HelpCircle, DollarSign, Square, ListTree, AlignLeft, Printer, TrendingUp, Brain, Bot, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  researchNiche,
  generateOutline,
  extractChapters,
  generateChapter,
  sendChatMessage,
  createCover,
  synthesizeAudiobook,
  optimizeMetadata,
  generateInlineImage,
  testGeminiApiKey,
  Attachment,
  generateBackCover,
  extractWritingStyle,
  formatAndStructureManuscriptWithAI,
  generatePressRelease,
  generateSocialCampaign,
  generateEmailLaunchSequence,
  generateMediaPitch,
  generateLandingPageCopy,
  generateMarketingStrategyPlan,
  generateBetaReaderCritique,
  generateAudiobookScript,
  generateBookKeywords,
  extractLearnedRulesFromFeedback,
  summarizeChapterForContinuity,
  extractExistingCharacterNames,
  detectManuscriptVisualPlaceholders,
  autoSuggestChapterVisualPlaceholders,
  generateSceneIllustrationWithNanoBanana,
  ManuscriptVisualPlaceholder,
  LearnedRule,
  ContinuityContext,
  CharacterProfile,
  ChapterIllustration
} from './services/geminiService';
import { exportToDocx, exportEpubManuscript, exportPublishingZipBundle, exportLandingPageHtml, getLandingPageHtmlString } from './services/exportService';
import { extractTextFromFile } from './utils/fileParser';
import { saveProject, loadProject, getProjectsList, deleteProject, getUserSettings, saveUserSettings, saveEmergencySnapshot, scanAllLocalBackups, savePublishedLandingPage, getPublishedLandingPage, deletePublishedLandingPage, PublishedLandingData, moveToTrash, getTrashList, restoreFromTrash, permanentlyDeleteFromTrash, emptyTrash, TrashItem, hasProjectContent } from './services/storage';
import { auth, loginWithGoogle, logoutUser, getUserProfile, ensureUserProfile, trackAIWordUsage, UserProfile } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { CommandPalette } from './components/CommandPalette';
import { HelpDrawer } from './components/HelpDrawer';
import { PriceRoyaltyCalculator } from './components/PriceRoyaltyCalculator';
import { BetaReaderSimulator } from './components/BetaReaderSimulator';
import { AudiobookAssistant } from './components/AudiobookAssistant';
import { TableOfContentsStudio } from './components/TableOfContentsStudio';
import { HumanizerStudio } from './components/HumanizerStudio';
import { AudiobookStudio } from './components/AudiobookStudio';
import { AmazonNicheResearchStudio } from './components/AmazonNicheResearchStudio';
import { VisualDesignerStudio } from './components/VisualDesignerStudio';
import { ContinuityMemoryModal } from './components/ContinuityMemoryModal';
import { AuthModal } from './components/AuthModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AdminPayPalSettingsModal } from './components/AdminPayPalSettingsModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { SupportAiAssistantModal } from './components/SupportAiAssistantModal';
import { PipelineStepper } from './components/PipelineStepper';
import { VersionHistoryModal, ChapterRevision } from './components/VersionHistoryModal';
import { GenerationProgressLogger } from './components/GenerationProgressLogger';
import { humanizeManuscript, analyzeAiScore } from './services/geminiService';

type ViewMode = 'library' | 'setup' | 'details' | 'outline' | 'toc' | 'chapter' | 'assets' | 'visual_designer' | 'marketing' | 'humanizer' | 'audiobook' | 'research';

type Category = 'non_fiction' | 'fiction' | 'children_stories' | 'guides' | 'sales_copy' | 'white_paper' | 'web_copy';

const CATEGORIES: Record<Category, string> = {
  non_fiction: "Non-Fiction Publication",
  fiction: "Fiction & Storytelling",
  children_stories: "Children's Stories & Picture Books",
  guides: "How-to Guides & Manuals",
  sales_copy: "Sales Copy & Direct Response",
  white_paper: "White Paper & Industry Report",
  web_copy: "Web Copy & Landing Pages"
};

export const BOOK_SUBCATEGORIES: Record<string, { id: string; label: string; desc: string; targetAge?: string }[]> = {
  children_stories: [
    { id: 'picture_books', label: "Picture Books & Bedtime Tales", desc: "Vibrant illustration cues, soothing rhythmic cadence, simple vocabulary, and engaging repetition", targetAge: "Ages 2–6" },
    { id: 'early_readers', label: "Early Readers & Phonics Tales", desc: "Short accessible sentences, encouraging dialogue, relatable adventures, and clear milestones", targetAge: "Ages 5–8" },
    { id: 'chapter_books', label: "Illustrated Chapter Books", desc: "Episodic adventure arcs, witty character dynamics, and illustrated scene prompts", targetAge: "Ages 6–10" },
    { id: 'middle_grade', label: "Middle Grade Fiction & Mystery", desc: "Emotional depth, fast-paced quest/mystery arcs, moral courage, and authentic youth voices", targetAge: "Ages 8–12" },
    { id: 'bedtime_fables', label: "Bedtime Fables & Moral Stories", desc: "Calming soothing pacing, gentle life lessons, empathy building, and imaginative dreamscapes", targetAge: "Ages 3–8" },
    { id: 'educational_stem', label: "Educational & STEM Wonder Tales", desc: "Curiosity-sparking scientific discoveries woven seamlessly into narrative adventures", targetAge: "Ages 5–10" }
  ],
  fiction: [
    { id: 'mystery_thriller', label: "Mystery, Thriller & Suspense", desc: "Fast-paced tension, gripping plot twists, detectives, crime, and high-stakes resolutions" },
    { id: 'crime_detective', label: "Crime Fiction & Police Procedurals", desc: "Hardboiled detectives, gritty criminal underworlds, forensic mysteries, and intense whodunits" },
    { id: 'romance', label: "Romance & Romantic Comedy", desc: "Emotional chemistry, relationship dynamics, heartfelt tropes, and satisfying happily-ever-afters" },
    { id: 'women_fiction', label: "Women's Fiction & Family Sagas", desc: "Generational bonds, emotional resilience, motherhood, sisterhood, and life turning points" },
    { id: 'fantasy_magic', label: "Fantasy & Epic Realms", desc: "Immersive magical systems, mythical creatures, quest arcs, and legendary worldbuilding" },
    { id: 'sci_fi', label: "Science Fiction & Cyberpunk", desc: "Space opera, futuristic technology, dystopian futures, time travel, and AI dilemmas" },
    { id: 'dystopian_apocalyptic', label: "Dystopian & Post-Apocalyptic", desc: "Societal collapse, survival instincts, totalitarian regimes, and rebuilding civilization" },
    { id: 'action_adventure', label: "Action & Adventure", desc: "High-octane survival, global espionage, ancient artifacts, and relentless hero journeys" },
    { id: 'horror_supernatural', label: "Horror & Dark Supernatural", desc: "Chilling psychological dread, haunted settings, eerie mysteries, and occult folklore" },
    { id: 'paranormal_urban_fantasy', label: "Paranormal & Urban Fantasy", desc: "Mythical beings in modern cities, occult investigations, vampires, shapeshifters, and magic in the real world" },
    { id: 'historical_fiction', label: "Historical Fiction", desc: "Authentic period detail, historical events, cultural textures, and timeless human drama" },
    { id: 'literary_contemporary', label: "Literary & Contemporary Drama", desc: "Deep character-driven prose, philosophical depth, family sagas, and social themes" },
    { id: 'humor_satire', label: "Humorous Fiction & Satirical Novels", desc: "Witty banter, absurd misadventures, situational comedy, and sharp social satire" },
    { id: 'young_adult', label: "Young Adult (YA) Fiction", desc: "Coming-of-age journeys, high-stakes teenage drama, rebellion, and emotional discovery" },
    { id: 'short_stories_anthology', label: "Short Story Collections & Anthologies", desc: "Bite-sized narrative arcs, themed literary shorts, and compact worldbuilding" }
  ],
  non_fiction: [
    { id: 'self_help', label: "Self-Help & Personal Growth", desc: "Habits, mindset shifts, emotional resilience, and practical life frameworks" },
    { id: 'business_leadership', label: "Business & Thought Leadership", desc: "Strategy, entrepreneurship, organizational culture, and case study breakthroughs" },
    { id: 'health_wellness', label: "Health, Nutrition & Wellness", desc: "Longevity, fitness, mental health, somatic wellbeing, and science-backed protocols" },
    { id: 'biography_memoir', label: "Memoir & Narrative Non-Fiction", desc: "True stories, personal transformation, lived experiences, and inspiring life journeys" }
  ],
  guides: [
    { id: 'how_to_manual', label: "Step-by-Step Practical Manual", desc: "Clear instructions, action checklists, diagrams, and execution roadmaps" },
    { id: 'masterclass_handbook', label: "Professional Masterclass Handbook", desc: "Deep technical blueprints, best practices, troubleshooting, and expert workflows" }
  ]
};

export const DEFAULT_CATEGORY_PROMPTS: Record<Category, string> = {
  sales_copy: "You are an elite Direct-Response Copywriting Legend and Conversion Strategist (inspired by Gary Halbert, Dan Kennedy, Eugene Schwartz). Write high-converting, psychologically compelling copy that hooks readers instantly, agitates core pain points, presents an irresistible offer with proof and case studies, overcomes objections before they arise, and drives decisive action with urgent, crystal-clear CTAs. Use powerful conversational cadence, active verbs, rhythmic line breaks, subheads, bulleted benefits (fascinations), risk-reversals, and social proof integration. Strictly avoid dry corporate jargon and generic fluff.",
  white_paper: "You are a Senior B2B Strategy Consultant, Enterprise Technology Architect, and Principal Industry Analyst (McKinsey/Gartner-grade). Synthesize authoritative, data-driven white papers with executive summaries, empirical problem framing, deep architectural frameworks, comparative benchmarks, implementation roadmaps, governance considerations, and strategic recommendations. Maintain a rigorous, credible, objective executive tone with structured Markdown tables, key takeaway callouts, and clear analytical definitions. Zero hype or empty buzzwords.",
  web_copy: "You are a master Digital UX & Conversion Rate Optimization (CRO) Copywriter. Craft high-impact, scannable web and landing page copy optimized for rapid comprehension and high conversion. Write punchy above-the-fold hero hooks, benefit-driven H1/H2 headlines, problem/solution matrices, modular feature breakdowns with 'Feature -> Benefit -> Meaning' structures, social proof blocks, objection-busting FAQs, and frictionless Call-to-Action (CTA) sections. Keep prose punchy, mobile-friendly, engaging, and action-oriented.",
  children_stories: "You are an acclaimed children's author, master storyteller, and literacy specialist (inspired by Roald Dahl, Julia Donaldson, Maurice Sendak, and E.B. White). Write enchanting, age-appropriate children's stories with vivid sensory imagery, delightful rhythmic cadence, engaging character personalities, playful dialogue, and gentle positive moral or emotional themes. Include visual illustration prompts in brackets [Illustration: ...] to guide page artists or AI image generation. Keep language captivating, accessible, and free of dry adult abstractions or inappropriate violence.",
  non_fiction: "You are a master non-fiction ghostwriter and bestselling thought leader. Write authoritative, engaging, and deeply researched chapters that blend compelling storytelling, real-world case studies, psychological insight, actionable frameworks, and memorable takeaways. Maintain an inspiring, conversational, yet authoritative cadence that keeps readers hooked from first word to last.",
  fiction: "You are a master fiction novelist and narrative architect. Craft immersive storytelling with vivid sensory world-building, sharp character-driven dialogue, escalating narrative tension, rich subtext, emotional vulnerability, and satisfying scene resolution. Follow strict character naming diversity and eliminate repetitive AI tropes.",
  guides: "You are an expert instructional designer, master educator, and technical author. Deliver crystal-clear, step-by-step how-to guides and operational manuals. Use structured action checklists, visual breakdowns, troubleshooting matrices, prerequisite warnings, and pro-tips to ensure readers achieve rapid, foolproof implementation."
};

const LANGUAGES = [
  "English",
  "Norwegian",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Swedish",
  "Danish",
  "Finnish",
  "Japanese",
  "Korean",
  "Chinese"
];

const BISAC_CATEGORIES = [
  // FICTION
  "FICTION / General",
  "FICTION / Action & Adventure",
  "FICTION / African American / General",
  "FICTION / Classics",
  "FICTION / Contemporary Women",
  "FICTION / Crime",
  "FICTION / Dystopian",
  "FICTION / Fairy Tales, Folk Tales, Legends & Mythology",
  "FICTION / Family Life",
  "FICTION / Fantasy / General",
  "FICTION / Fantasy / Action & Adventure",
  "FICTION / Fantasy / Dark Fantasy",
  "FICTION / Fantasy / Dragon & Mythical",
  "FICTION / Fantasy / Epic",
  "FICTION / Fantasy / Historical",
  "FICTION / Fantasy / Paranormal",
  "FICTION / Fantasy / Urban",
  "FICTION / Historical / General",
  "FICTION / Horror",
  "FICTION / Humorous / General",
  "FICTION / Literary",
  "FICTION / Medical",
  "FICTION / Mystery & Detective / General",
  "FICTION / Mystery & Detective / Cozy / General",
  "FICTION / Mystery & Detective / Hardboiled",
  "FICTION / Mystery & Detective / Police Procedural",
  "FICTION / Mystery & Detective / Women Sleuths",
  "FICTION / Psychological",
  "FICTION / Romance / General",
  "FICTION / Romance / Clean & Wholesome",
  "FICTION / Romance / Contemporary",
  "FICTION / Romance / Fantasy",
  "FICTION / Romance / Historical / General",
  "FICTION / Romance / Romantic Comedy",
  "FICTION / Romance / Sci-Fi",
  "FICTION / Romance / Suspense",
  "FICTION / Science Fiction / General",
  "FICTION / Science Fiction / Alien Contact",
  "FICTION / Science Fiction / Cyberpunk",
  "FICTION / Science Fiction / Dystopian",
  "FICTION / Science Fiction / Space Opera",
  "FICTION / Science Fiction / Time Travel",
  "FICTION / Short Stories (single author)",
  "FICTION / Thrillers / General",
  "FICTION / Thrillers / Crime",
  "FICTION / Thrillers / Legal",
  "FICTION / Thrillers / Medical",
  "FICTION / Thrillers / Political",
  "FICTION / Thrillers / Psychological",
  "FICTION / Thrillers / Spy & Espionage",
  "FICTION / Thrillers / Suspense",
  "FICTION / Thrillers / Technological",
  "FICTION / Urban & Street Lit",
  "FICTION / Westerns",

  // YOUNG ADULT FICTION
  "YOUNG ADULT FICTION / General",
  "YOUNG ADULT FICTION / Action & Adventure",
  "YOUNG ADULT FICTION / Coming of Age",
  "YOUNG ADULT FICTION / Dystopian",
  "YOUNG ADULT FICTION / Fantasy / General",
  "YOUNG ADULT FICTION / Mystery & Detective",
  "YOUNG ADULT FICTION / Romance / General",
  "YOUNG ADULT FICTION / Science Fiction",
  "YOUNG ADULT FICTION / Social Themes",

  // NON-FICTION - BUSINESS & ECONOMICS
  "NON-FICTION / General",
  "BUSINESS & ECONOMICS / General",
  "BUSINESS & ECONOMICS / Accounting",
  "BUSINESS & ECONOMICS / Advertising & Promotion",
  "BUSINESS & ECONOMICS / Artificial Intelligence",
  "BUSINESS & ECONOMICS / Consulting",
  "BUSINESS & ECONOMICS / E-Commerce / General",
  "BUSINESS & ECONOMICS / Economics / General",
  "BUSINESS & ECONOMICS / Entrepreneurship",
  "BUSINESS & ECONOMICS / Finance / General",
  "BUSINESS & ECONOMICS / Finance / Personal",
  "BUSINESS & ECONOMICS / Human Resources & Personnel Management",
  "BUSINESS & ECONOMICS / International / General",
  "BUSINESS & ECONOMICS / Investments & Securities / General",
  "BUSINESS & ECONOMICS / Leadership",
  "BUSINESS & ECONOMICS / Management",
  "BUSINESS & ECONOMICS / Marketing / General",
  "BUSINESS & ECONOMICS / Real Estate",
  "BUSINESS & ECONOMICS / Sales & Selling",
  "BUSINESS & ECONOMICS / Small Business",
  "BUSINESS & ECONOMICS / Strategic Planning",

  // NON-FICTION - SELF-HELP & PERSONAL DEVELOPMENT
  "SELF-HELP / General",
  "SELF-HELP / Affirmations",
  "SELF-HELP / Aging",
  "SELF-HELP / Anxieties & Phobias",
  "SELF-HELP / Communication & Social Skills",
  "SELF-HELP / Creativity",
  "SELF-HELP / Emotional Healing",
  "SELF-HELP / Habits & Routines",
  "SELF-HELP / Journaling",
  "SELF-HELP / Motivational & Inspirational",
  "SELF-HELP / Personal Growth / General",
  "SELF-HELP / Personal Growth / Happiness",
  "SELF-HELP / Personal Growth / Success",
  "SELF-HELP / Relationships / General",
  "SELF-HELP / Self-Management / Stress Management",
  "SELF-HELP / Self-Management / Time Management",
  "SELF-HELP / Spiritual",

  // NON-FICTION - HEALTH, FITNESS & WELLNESS
  "HEALTH & FITNESS / General",
  "HEALTH & FITNESS / Alternative Therapies",
  "HEALTH & FITNESS / Beauty & Grooming",
  "HEALTH & FITNESS / Diet & Nutrition / Diets",
  "HEALTH & FITNESS / Diet & Nutrition / General",
  "HEALTH & FITNESS / Exercise / General",
  "HEALTH & FITNESS / Healthy Living & Wellness",
  "HEALTH & FITNESS / Mental Health",
  "HEALTH & FITNESS / Mind & Body",
  "HEALTH & FITNESS / Sleep",
  "HEALTH & FITNESS / Weight Loss",
  "HEALTH & FITNESS / Yoga",

  // NON-FICTION - TECHNOLOGY, COMPUTERS & SCIENCE
  "COMPUTERS / General",
  "COMPUTERS / Artificial Intelligence & Semantics",
  "COMPUTERS / Business Software / General",
  "COMPUTERS / Computer Science",
  "COMPUTERS / Data Science & Data Analytics",
  "COMPUTERS / Information Technology",
  "COMPUTERS / Languages / General",
  "COMPUTERS / Networking / General",
  "COMPUTERS / Security / General",
  "COMPUTERS / Software Development & Engineering",
  "COMPUTERS / Web / General",
  "TECHNOLOGY & ENGINEERING / General",
  "TECHNOLOGY & ENGINEERING / Robotics",
  "SCIENCE / General",
  "SCIENCE / Astronomy",
  "SCIENCE / Physics / General",

  // BIOGRAPHY, AUTOBIOGRAPHY & MEMOIR
  "BIOGRAPHY & AUTOBIOGRAPHY / General",
  "BIOGRAPHY & AUTOBIOGRAPHY / Artists, Architects, Photographers",
  "BIOGRAPHY & AUTOBIOGRAPHY / Business",
  "BIOGRAPHY & AUTOBIOGRAPHY / Historical",
  "BIOGRAPHY & AUTOBIOGRAPHY / Literary Figures",
  "BIOGRAPHY & AUTOBIOGRAPHY / Personal Memoirs",
  "BIOGRAPHY & AUTOBIOGRAPHY / Political",
  "BIOGRAPHY & AUTOBIOGRAPHY / Science & Technology",

  // COOKING, FOOD & WINE
  "COOKING / General",
  "COOKING / Baking",
  "COOKING / Comfort Food",
  "COOKING / Health & Healing / General",
  "COOKING / Quick & Easy",
  "COOKING / Regional & Ethnic / General",
  "COOKING / Vegetarian & Vegan",

  // CRAFTS, HOBBIES & HOME
  "CRAFTS & HOBBIES / General",
  "CRAFTS & HOBBIES / Gardening",
  "CRAFTS & HOBBIES / Needlework / General",
  "CRAFTS & HOBBIES / Woodworking",
  "HOUSE & HOME / General",
  "HOUSE & HOME / Decorating & Furnishing",
  "HOUSE & HOME / Organizing",

  // EDUCATION, PARENTING & FAMILY
  "EDUCATION / General",
  "EDUCATION / Higher",
  "EDUCATION / Teaching Methods & Materials / General",
  "FAMILY & RELATIONSHIPS / General",
  "PARENTING / General",
  "PARENTING / Child Care",
  "PARENTING / Child Development",

  // HISTORY, POLITICS & SOCIAL SCIENCES
  "HISTORY / General",
  "HISTORY / Ancient / General",
  "HISTORY / Military / General",
  "HISTORY / Modern / 20th Century",
  "HISTORY / Modern / 21st Century",
  "HISTORY / United States / General",
  "HISTORY / World",
  "POLITICAL SCIENCE / General",
  "POLITICAL SCIENCE / Public Policy / General",
  "SOCIAL SCIENCE / General",
  "SOCIAL SCIENCE / Media Studies",

  // PSYCHOLOGY & PHILOSOPHY
  "PSYCHOLOGY / General",
  "PSYCHOLOGY / Applied Psychology",
  "PSYCHOLOGY / Cognitive Psychology & Cognition",
  "PSYCHOLOGY / Interpersonal Relations",
  "PHILOSOPHY / General",
  "PHILOSOPHY / Ethics & Moral Philosophy",
  "PHILOSOPHY / Mind & Language",

  // RELIGION & SPIRITUALITY
  "BODY, MIND & SPIRIT / General",
  "BODY, MIND & SPIRIT / Astrology",
  "BODY, MIND & SPIRIT / Mindfulness & Meditation",
  "RELIGION / General",
  "RELIGION / Christian Life / General",
  "RELIGION / Inspirational",
  "RELIGION / Spirituality",

  // ART, MUSIC, PERFORMING ARTS
  "ART / General",
  "DESIGN / General",
  "DESIGN / Graphic Arts",
  "MUSIC / General",
  "PHOTOGRAPHY / General",

  // CHILDREN, JUVENILE & YOUNG ADULT
  "JUVENILE FICTION / General",
  "JUVENILE FICTION / Action & Adventure / General",
  "JUVENILE FICTION / Animals / General",
  "JUVENILE FICTION / Bedtime & Dreams",
  "JUVENILE FICTION / Fairy Tales & Folklore / General",
  "JUVENILE FICTION / Fantasy & Magic",
  "JUVENILE FICTION / Humorous Stories",
  "JUVENILE FICTION / Interactive & Early Learning",
  "JUVENILE FICTION / Readers / Beginner",
  "JUVENILE FICTION / Readers / Chapter Books",
  "JUVENILE FICTION / Social Themes / Friendship & Values",
  "JUVENILE FICTION / Science Fiction",
  "JUVENILE NONFICTION / General",
  "JUVENILE NONFICTION / Animals / General",
  "JUVENILE NONFICTION / Science & Nature / General",
  "YOUNG ADULT FICTION / General",
  "YOUNG ADULT FICTION / Fantasy / General",
  "YOUNG ADULT FICTION / Romance / General",
  "YOUNG ADULT NONFICTION / General"
];

function formatMetadataKeywords(rawKeywords: any): string[] {
  let list: string[] = [];
  if (Array.isArray(rawKeywords)) {
    list = rawKeywords
      .map((k: any) => (typeof k === 'string' ? k : String(k?.keyword || k?.name || k || '')).trim())
      .filter(Boolean);
  } else if (typeof rawKeywords === 'string' && rawKeywords.trim()) {
    list = rawKeywords
      .split(/[,;\n]+/)
      .map((k: string) => k.trim())
      .filter(Boolean);
  }

  while (list.length < 7) {
    list.push('');
  }
  return list.slice(0, 7);
}

function formatMetadataCategories(rawCategories: any): string[] {
  let list: string[] = [];
  if (Array.isArray(rawCategories)) {
    list = rawCategories
      .map((c: any) => (typeof c === 'string' ? c : String(c?.category || c?.name || c || '')).trim())
      .filter(Boolean);
  } else if (typeof rawCategories === 'string' && rawCategories.trim()) {
    list = rawCategories
      .split(/[,;\n]+/)
      .map((c: string) => c.trim())
      .filter(Boolean);
  }

  list = list.map((cat: string) => {
    if (!cat) return '';
    const exact = BISAC_CATEGORIES.find(b => b.toLowerCase() === cat.toLowerCase());
    if (exact) return exact;

    const partial = BISAC_CATEGORIES.find(
      b => b.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(b.toLowerCase())
    );
    if (partial) return partial;

    return cat;
  });

  while (list.length < 3) {
    list.push('');
  }
  return list.slice(0, 3);
}

export interface AuthorSocials {
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  website?: string;
  newsletter?: string;
  tiktok?: string;
  facebook?: string;
  amazonAuthor?: string;
  goodreads?: string;
}

interface BookDetails {
  title: string;
  subtitle: string;
  authorName: string;
  description: string;
  aboutAuthor: string;
  keywords: string[];
  categories: string[];
  subCategory?: string;
  pricing: string;
  trimSize: string;
  language: string;
  globalInstructions?: string;
  inspirationImage?: string | null;
  socials?: AuthorSocials;
  metadata?: {
    description_html?: string;
    pricing_strategy?: string;
    trim_size?: string;
    cover_design_prompt?: string;
  }
}

interface Chapter {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
  revisions?: ChapterRevision[];
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: { name: string, mimeType: string, data: string }[];
}

function parseMarkdownToChaptersLocally(rawText: string) {
  if (!rawText || !rawText.trim()) {
    return { title: 'Imported Manuscript', subtitle: '', chapters: [] };
  }

  const lines = rawText.split(/\r?\n/);
  let inferredTitle = '';
  let inferredSubtitle = '';

  // 1. Try to infer Book Title from first H1 or title frontmatter
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const trimmed = lines[i].trim();
    if (/^#\s+(.+)/.test(trimmed) && !inferredTitle) {
      inferredTitle = trimmed.replace(/^#\s+/, '').replace(/\*+/g, '').trim();
    } else if (trimmed.toLowerCase().startsWith('title:') && !inferredTitle) {
      inferredTitle = trimmed.replace(/^title:\s*/i, '').replace(/["']/g, '').trim();
    }
  }

  // Regex for explicit Chapter / Kapittel / Capítulo / Chapitre / Part markers or top-level intros
  const explicitChapterRegex = /^(\s*#\s*|\s*##\s*|\s*\*\*\s*)?((Chapter|Kapittel|Capítulo|Chapitre|PART|Part|Book|KAPITTEL|CHAPTER)\s+(\d+|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)\b|Introduction|Intro|Preface|Prologue|Epilogue|Conclusion|Foreword|Afterword)/i;

  // 2. Count heading patterns to determine dominant hierarchy
  let h1Count = 0;
  let h2Count = 0;
  let explicitChapterCount = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (explicitChapterRegex.test(trimmed) && !/^###+/.test(trimmed)) {
      explicitChapterCount++;
    }
    if (/^#\s+[^\s#]/.test(trimmed)) {
      h1Count++;
    } else if (/^##\s+[^\s#]/.test(trimmed)) {
      h2Count++;
    }
  });

  // Determine function for identifying chapter boundaries
  let isChapterLine: (line: string, index: number) => boolean;

  if (explicitChapterCount >= 2) {
    // Priority A: Document has explicit Chapter/Kapittel/Part markers or Introduction/Preface.
    // Split ONLY on explicit chapter markers at H1/H2 level! Do NOT split on subheadings (### or ####) or template placeholders.
    isChapterLine = (trimmed: string, idx: number) => {
      if (/^###+/.test(trimmed)) return false;
      if (/^#\s*\[.+\]/.test(trimmed)) return false;
      if (explicitChapterRegex.test(trimmed)) return true;
      return false;
    };
  } else if (h1Count >= 2) {
    // Priority B: Document uses H1 (`# `) for chapters without explicit "Chapter X" words.
    // Split ONLY on `# `, preserving `##` and `###` subheadings INSIDE the chapter.
    isChapterLine = (trimmed: string, idx: number) => {
      if (/^###+/.test(trimmed)) return false;
      if (/^#\s*\[.+\]/.test(trimmed)) return false;
      if (/^#\s+/.test(trimmed)) {
        const cleanH1 = trimmed.replace(/^#\s+/, '').replace(/\*+/g, '').trim();
        if (cleanH1 === inferredTitle && idx < 5 && h1Count > 2) return false;
        if (/^#\s*(Section\s+\d+|Quarterly|Monthly|Weekly|Step\s+\d+|Component\s+\d+)/i.test(trimmed)) return false;
        return true;
      }
      return false;
    };
  } else if (h2Count >= 2) {
    // Priority C: Document uses H2 (`## `) for chapters (and `#` was only top title or missing).
    // Split ONLY on `## `, preserving `###` and `####` subheadings INSIDE the chapter.
    isChapterLine = (trimmed: string, idx: number) => {
      if (/^###+/.test(trimmed)) return false;
      return /^##\s+/.test(trimmed);
    };
  } else {
    // Priority D: Fallback for small or unstructured manuscripts
    isChapterLine = (trimmed: string, idx: number) => {
      if (/^###+/.test(trimmed)) return false;
      if (explicitChapterRegex.test(trimmed)) return true;
      if (/^#\s+/.test(trimmed) && !/^#\s*\[.+\]/.test(trimmed)) return true;
      if (/^(---|[*]{3,}|_{3,}|\\pagebreak)/.test(trimmed)) return true;
      return false;
    };
  }

  const rawChapters: { title: string; lines: string[] }[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isChapterLine(trimmed, i)) {
      const nonWhitespaceCount = currentLines.join('').trim().length;

      // If we already had a chapter title, but accumulated virtually NO content (<25 chars) before hitting another chapter heading,
      // update currentTitle to the new heading rather than pushing a 0-word duplicate chapter!
      if (currentTitle && nonWhitespaceCount < 25) {
        const cleanNewTitle = trimmed
          .replace(/^#+\s*/, '')
          .replace(/^\*+\s*/, '')
          .replace(/\*+\s*$/, '')
          .replace(/^-\s*/, '')
          .trim();
        // If new title is longer/more descriptive, adopt it
        if (cleanNewTitle.length > currentTitle.length || !currentTitle) {
          currentTitle = cleanNewTitle;
        }
        currentLines = [];
      } else {
        if (currentLines.length > 0 || currentTitle) {
          rawChapters.push({
            title: currentTitle,
            lines: currentLines
          });
          currentLines = [];
        }
        currentTitle = trimmed
          .replace(/^#+\s*/, '')
          .replace(/^\*+\s*/, '')
          .replace(/\*+\s*$/, '')
          .replace(/^-\s*/, '')
          .trim();
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0 || currentTitle) {
    rawChapters.push({
      title: currentTitle,
      lines: currentLines
    });
  }

  const cleanChapters: { title: string; content: string }[] = [];

  const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const subSectionTitleRegex = /^(\[.+\]|Section\s+\d+|Quarterly\s+|Monthly\s+|Weekly\s+|Component\s+\d+|Step\s+\d+|Template:)/i;

  rawChapters.forEach((ch) => {
    let content = ch.lines.join('\n').trim();
    let title = ch.title.trim();

    if (!title) {
      const firstHeadingMatch = content.match(/^#+\s*(.+)/m);
      if (firstHeadingMatch) {
        title = firstHeadingMatch[1].trim();
      } else {
        title = `Chapter ${cleanChapters.length + 1}`;
      }
    }

    // Strip duplicate title header from top of content body if repeated
    const contentLines = content.split('\n');
    if (contentLines.length > 0) {
      const firstLineClean = contentLines[0].trim().replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      if (firstLineClean && (firstLineClean.toLowerCase() === title.toLowerCase() || title.toLowerCase().startsWith(firstLineClean.toLowerCase()))) {
        contentLines.shift();
        content = contentLines.join('\n').trim();
      }
    }

    // Ignore empty/ghost chapters (< 30 chars of content) if we already have or will have real chapters
    if (content.length < 30 && title) {
      // Check if previous cleanChapter has the same normalized title
      if (cleanChapters.length > 0) {
        const lastCh = cleanChapters[cleanChapters.length - 1];
        if (normalizeTitle(lastCh.title) === normalizeTitle(title) || normalizeTitle(lastCh.title).includes(normalizeTitle(title))) {
          // Skip empty duplicate
          return;
        }
      }
      // Skip empty chapter
      return;
    }

    // Merge accidental sub-sections or templates back into preceding chapter if applicable
    if (cleanChapters.length > 0) {
      const lastCh = cleanChapters[cleanChapters.length - 1];
      const normLast = normalizeTitle(lastCh.title);
      const normCurr = normalizeTitle(title);
      const isSubSection = subSectionTitleRegex.test(title);

      if (isSubSection || (normLast && normCurr && (normLast === normCurr || normLast.includes(normCurr) || normCurr.includes(normLast)))) {
        const headingPrefix = isSubSection ? `\n\n### ${title}\n\n` : '\n\n';
        lastCh.content = (lastCh.content + headingPrefix + content).trim();
        return;
      }
    }

    cleanChapters.push({
      title: title || `Chapter ${cleanChapters.length + 1}`,
      content: content
    });
  });

  if (cleanChapters.length === 0) {
    cleanChapters.push({
      title: inferredTitle ? `Chapter 1: ${inferredTitle}` : 'Chapter 1: Full Manuscript',
      content: rawText.trim()
    });
  }

  return {
    title: inferredTitle || 'Imported Manuscript',
    subtitle: inferredSubtitle,
    chapters: cleanChapters
  };
}

const generateId = () => Math.random().toString(36).substring(2, 9);

function ChapterView({ 
  chapter, 
  onContentChange, 
  onRegenerate, 
  onHumanize, 
  onIllustrate,
  onShowVersionHistory, 
  onDelete, 
  onUndo, 
  canUndo, 
  components,
  onAutoPlaceVisuals,
  onBatchGenerateVisuals,
  isAutoPlacingVisuals,
  isBatchGeneratingVisuals
}: { 
  chapter: Chapter, 
  onContentChange: (c: string) => void, 
  onRegenerate: () => void, 
  onHumanize?: () => void, 
  onIllustrate?: () => void,
  onShowVersionHistory?: () => void, 
  onDelete?: () => void, 
  onUndo?: () => void, 
  canUndo?: boolean, 
  components: any,
  onAutoPlaceVisuals?: () => void,
  onBatchGenerateVisuals?: () => void,
  isAutoPlacingVisuals?: boolean,
  isBatchGeneratingVisuals?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isAuthorPage = chapter.title.toLowerCase().includes('about the author');

  const report = useMemo(() => analyzeAiScore(chapter.content), [chapter.content]);
  const placeholders = useMemo(() => detectManuscriptVisualPlaceholders(chapter.content), [chapter.content]);

  return (
    <div className="space-y-4">
      {isAuthorPage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs flex items-center gap-3 shadow-xs">
          <User className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <strong className="font-semibold text-amber-950">Book End-Matter Page (Single Instance)</strong>
            <p className="text-amber-800 mt-0.5">This is the single "About the Author" biography page for your entire book manuscript. It is printed once at the end of the book.</p>
          </div>
        </div>
      )}

      {/* AI Score Mini Alert Bar */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-zinc-200 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px]">Manuscript AI Scan:</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            report.aiProbability > 70 ? 'bg-red-100 text-red-800 border border-red-200' :
            report.aiProbability > 35 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
            'bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}>
            {report.aiProbability}% Estimated AI Probability
          </span>
          <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
            Burstiness Score: <strong className="text-zinc-800">{report.burstinessScore}/100</strong>
          </span>
        </div>

        {report.flaggedBuzzwords.length > 0 && (
          <span className="text-[11px] text-red-600 font-medium truncate max-w-xs">
            {report.flaggedBuzzwords.length} AI buzzword(s) found ("{report.flaggedBuzzwords.slice(0, 2).map(f => f.word).join('", "')}")
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white px-4 sm:px-6 py-3 rounded-2xl border border-zinc-200 shadow-sm gap-4">
        <div className="flex flex-wrap gap-2 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto">
           <button 
             onClick={() => setIsEditing(false)}
             className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!isEditing ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
           >
             Preview
           </button>
           <button 
             onClick={() => setIsEditing(true)}
             className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${isEditing ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
           >
             Edit Markdown
           </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onAutoPlaceVisuals && (
            <button
              onClick={onAutoPlaceVisuals}
              disabled={isAutoPlacingVisuals}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 border border-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Have AI scan the chapter to determine 1-3 strategic locations and insert visual placeholders"
            >
              {isAutoPlacingVisuals ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isAutoPlacingVisuals ? 'Placing Markers...' : '🪄 AI Auto-Place Visuals'}</span>
            </button>
          )}
          {onIllustrate && (
            <button
              onClick={onIllustrate}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Open Visual Designer Studio to design custom chapter graphics and blueprints"
            >
              <Palette className="w-3.5 h-3.5 text-yellow-200" />
              <span>Visual Studio</span>
            </button>
          )}
          {onShowVersionHistory && (
            <button
              onClick={onShowVersionHistory}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Inspect previous chapter drafts, humanized revisions, and revert to earlier versions"
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Revisions ({chapter.revisions?.length || 1})
            </button>
          )}
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
              title="Regret / Undo last change"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              Regret / Undo
            </button>
          )}
          {onHumanize && (
            <button
              onClick={onHumanize}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="Humanize prose, fix sentence rhythm burstiness, and remove AI buzzwords"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-600" /> Humanize
            </button>
          )}
          <button
            onClick={onRegenerate}
            className="flex-1 sm:flex-none justify-center items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <PlayCircle className="w-4 h-4" /> Rewrite with AI
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-1 sm:flex-none justify-center items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              title="Delete Chapter"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Indicated Visual Placeholders Auto-Generate Banner */}
      {placeholders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-300/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <Sparkles className="w-5 h-5 text-yellow-100" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-2 flex-wrap">
                <span>{placeholders.length} Visual Moment{placeholders.length > 1 ? 's' : ''} Indicated in Manuscript</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-bold">Ready to Auto-Place</span>
              </h4>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                The manuscript specifies positions for visuals. Click below to automatically generate and autoplace them in-line.
              </p>
            </div>
          </div>
          {onBatchGenerateVisuals && (
            <button
              onClick={onBatchGenerateVisuals}
              disabled={isBatchGeneratingVisuals}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {isBatchGeneratingVisuals ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-200" />}
              <span>{isBatchGeneratingVisuals ? 'Generating Visuals...' : `⚡ Auto-Generate All (${placeholders.length})`}</span>
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
        {isEditing ? (
          <textarea
            className="w-full min-h-[70vh] p-4 sm:p-8 font-mono text-sm border-none focus:outline-none resize-y bg-transparent"
            value={chapter.content}
            onChange={(e) => onContentChange(e.target.value)}
          />
        ) : (
          <div className="p-4 sm:p-8 prose prose-zinc max-w-none prose-sm sm:prose-base">
            <Markdown components={components}>{chapter.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthorSocialsForm({ 
  socials = {}, 
  onChange, 
  onSaveDefault 
}: { 
  socials?: AuthorSocials; 
  onChange: (updated: AuthorSocials) => void; 
  onSaveDefault?: () => void; 
}) {
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    if (onSaveDefault) onSaveDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const safeSocials = socials || {};

  return (
    <div className="space-y-4 bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 gap-2">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-600" />
            Social Media & Author Media Handles
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Connect your profiles. These automatically populate press releases, media pitches, social campaigns, and book landing page footers!
          </p>
        </div>
        {onSaveDefault && (
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-2xs shrink-0 self-start sm:self-auto"
          >
            {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {savedNotice ? 'Saved to Profile!' : 'Save as Default'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {/* Twitter / X */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span className="font-bold">𝕏</span> Twitter / X
          </label>
          <input
            type="text"
            value={safeSocials.twitter || ''}
            onChange={(e) => onChange({ ...safeSocials, twitter: e.target.value })}
            placeholder="@AuthorName or URL"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Instagram */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>📸</span> Instagram
          </label>
          <input
            type="text"
            value={safeSocials.instagram || ''}
            onChange={(e) => onChange({ ...safeSocials, instagram: e.target.value })}
            placeholder="@author_books or URL"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* LinkedIn */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>💼</span> LinkedIn
          </label>
          <input
            type="text"
            value={safeSocials.linkedin || ''}
            onChange={(e) => onChange({ ...safeSocials, linkedin: e.target.value })}
            placeholder="https://linkedin.com/in/author"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Author Website */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-600" /> Website
          </label>
          <input
            type="text"
            value={safeSocials.website || ''}
            onChange={(e) => onChange({ ...safeSocials, website: e.target.value })}
            placeholder="https://authorwebsite.com"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Newsletter / Substack */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-pink-600" /> Newsletter / Substack
          </label>
          <input
            type="text"
            value={safeSocials.newsletter || ''}
            onChange={(e) => onChange({ ...safeSocials, newsletter: e.target.value })}
            placeholder="https://author.substack.com"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* TikTok */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>🎵</span> TikTok / BookTok
          </label>
          <input
            type="text"
            value={safeSocials.tiktok || ''}
            onChange={(e) => onChange({ ...safeSocials, tiktok: e.target.value })}
            placeholder="@author_tok or URL"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Facebook Page */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>📘</span> Facebook Page
          </label>
          <input
            type="text"
            value={safeSocials.facebook || ''}
            onChange={(e) => onChange({ ...safeSocials, facebook: e.target.value })}
            placeholder="https://facebook.com/authorpage"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Amazon Author Central */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>🛒</span> Amazon Author Page
          </label>
          <input
            type="text"
            value={safeSocials.amazonAuthor || ''}
            onChange={(e) => onChange({ ...safeSocials, amazonAuthor: e.target.value })}
            placeholder="https://amazon.com/author/username"
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Goodreads Profile */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
            <span>📚</span> Goodreads Profile
          </label>
          <input
            type="text"
            value={safeSocials.goodreads || ''}
            onChange={(e) => onChange({ ...safeSocials, goodreads: e.target.value })}
            placeholder="https://goodreads.com/author/..."
            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>
    </div>
  );
}

interface ApiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialKey: string;
  errorMessage?: string | null;
  onKeySaved: (key: string) => void;
}

function ApiKeyRequiredModal({
  isOpen,
  onClose,
  initialKey,
  errorMessage,
  onKeySaved
}: ApiKeyRequiredModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key') || initialKey || '';
      setKeyInput(stored);
      setTestResult(null);
    }
  }, [isOpen, initialKey]);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setTestResult({ success: false, message: 'Please enter or paste your Google Gemini API key.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testGeminiApiKey(trimmed);
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      localStorage.setItem('user_custom_gemini_key', trimmed);
      localStorage.setItem('gemini_api_key', trimmed);
      onKeySaved(trimmed);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setKeyInput(text.trim());
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 bg-gradient-to-r from-amber-50 via-orange-50 to-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-base">Google Gemini API Key Required</h3>
              <p className="text-xs text-zinc-500">Bring Your Own Key (BYOK) for Unlimited Drafting & Publishing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Notice Callout */}
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMessage || "API Key Update Needed"}</span>
            </div>
            <p className="leading-relaxed text-zinc-700">
              Google reported that the application's shared API key has expired or was reported as leaked. To continue generating outlines, research, chapters, and artwork without disruption, please enter your free personal Google Gemini API key below.
            </p>
          </div>

          {/* Quick 1-Click Link to Google AI Studio */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Need a free API key?
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">100% Free Tier</span>
            </div>
            <p className="text-xs text-zinc-600">
              Get an instant API key directly from Google AI Studio in 30 seconds:
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <span>Get Free Key at aistudio.google.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Input field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800">
                Paste Your Google Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Paste from Clipboard
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-800 font-medium px-1.5 py-0.5 rounded cursor-pointer"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Verification Status */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={isTesting || !keyInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating Key...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Test & Save Key</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BookSnapshot {
  chapters: Chapter[];
  outline: string;
  bookDetails: BookDetails;
  timestamp: number;
  description: string;
}

export default function App() {
  // Auth & SaaS Subscription State
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isAdminPayPalModalOpen, setIsAdminPayPalModalOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isSupportAssistantOpen, setIsSupportAssistantOpen] = useState(false);

  // Mobile & Sidebar UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('manus_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('manus_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Global State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [sourceUrls, setSourceUrls] = useState<string>('');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<Category>('non_fiction');
  const [research, setResearch] = useState<any>(null);
  const [outline, setOutline] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [draggedChapterIndex, setDraggedChapterIndex] = useState<number | null>(null);
  const [bookDetails, setBookDetails] = useState<BookDetails>({
    title: '',
    subtitle: '',
    authorName: '',
    description: '',
    aboutAuthor: '',
    keywords: [],
    categories: [],
    pricing: '$9.99',
    trimSize: '6x9',
    language: 'English',
    inspirationImage: null
  });
  const [assets, setAssets] = useState<{coverUrl?: string | null, audioUrl?: string | null, metadata?: any, backCoverContent?: string}>({});

  // Visual Designer & Illustration Pipeline (Character Bible & Chapter Illustrations)
  const [characterBible, setCharacterBible] = useState<CharacterProfile[]>([]);
  const [chapterIllustrations, setChapterIllustrations] = useState<ChapterIllustration[]>([]);
  const [isBatchGeneratingVisuals, setIsBatchGeneratingVisuals] = useState<boolean>(false);
  const [isAutoPlacingVisuals, setIsAutoPlacingVisuals] = useState<boolean>(false);

  // Cross-Chapter Cohesion & Editorial Memory State
  const [continuityMemory, setContinuityMemory] = useState<{
    learnedRules: LearnedRule[];
    chapterSummaries: Record<string, string>;
  }>({
    learnedRules: [],
    chapterSummaries: {}
  });
  const [showContinuityModal, setShowContinuityModal] = useState<boolean>(false);

  // History & Regret (Undo / Redo / Version Stack) State
  const [historyStack, setHistoryStack] = useState<BookSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState<boolean>(false);
  const [versionHistoryChapterId, setVersionHistoryChapterId] = useState<string | null>(null);
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);

  // Copywriting Style Extractor State
  const [showStyleExtractorModal, setShowStyleExtractorModal] = useState<boolean>(false);
  const [styleSourceType, setStyleSourceType] = useState<'bookshelf' | 'custom_text'>('bookshelf');
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState<string>('');
  const [customStyleSampleText, setCustomStyleSampleText] = useState<string>('');
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState<boolean>(false);
  const [extractedStyleResult, setExtractedStyleResult] = useState<string>('');
  const [styleAnalysisNotice, setStyleAnalysisNotice] = useState<string | null>(null);

  // Recovery Center State
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveredBackupsList, setRecoveredBackupsList] = useState<Array<any>>([]);

  // Trash & Safe Delete Protection State
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string; category?: string; chapterCount?: number; wordCount?: number; updatedAt?: number; idea?: string } | null>(null);
  const [showTrashModal, setShowTrashModal] = useState<boolean>(false);
  const [trashList, setTrashList] = useState<TrashItem[]>([]);
  const [undoDeleteToast, setUndoDeleteToast] = useState<{ id: string; title: string } | null>(null);

  // Markdown Manuscript Importer State
  const [showMdImportModal, setShowMdImportModal] = useState<boolean>(false);
  const [mdRawText, setMdRawText] = useState<string>('');
  const [mdFileName, setMdFileName] = useState<string>('');
  const [isProcessingMd, setIsProcessingMd] = useState<boolean>(false);
  const [mdParsedPreview, setMdParsedPreview] = useState<{ title?: string; subtitle?: string; chapters: { title: string; content: string }[] } | null>(null);
  const [mdImportNotice, setMdImportNotice] = useState<string | null>(null);

  const pushHistorySnapshot = (
    description: string,
    override?: { chapters?: Chapter[]; outline?: string; bookDetails?: BookDetails }
  ) => {
    const snap: BookSnapshot = {
      chapters: override?.chapters ? JSON.parse(JSON.stringify(override.chapters)) : JSON.parse(JSON.stringify(chapters)),
      outline: override?.outline ?? outline,
      bookDetails: override?.bookDetails ? JSON.parse(JSON.stringify(override.bookDetails)) : JSON.parse(JSON.stringify(bookDetails)),
      timestamp: Date.now(),
      description
    };

    setHistoryStack(prev => {
      const base = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
      const next = [...base, snap];
      if (next.length > 50) next.shift();
      return next;
    });

    setHistoryIndex(prev => {
      const baseLen = historyIndex >= 0 ? historyIndex + 1 : 0;
      return Math.min(baseLen, 49);
    });
  };

  const handleUndo = () => {
    if (historyIndex <= 0 || historyStack.length === 0) return;
    const prevIndex = historyIndex - 1;
    const snap = historyStack[prevIndex];
    if (!snap) return;

    setChapters(JSON.parse(JSON.stringify(snap.chapters)));
    setOutline(snap.outline);
    setBookDetails(JSON.parse(JSON.stringify(snap.bookDetails)));
    setHistoryIndex(prevIndex);

    const undoneDesc = historyStack[historyIndex]?.description || "last action";
    setHistoryNotice(`Undid: ${undoneDesc}`);
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snap = historyStack[nextIndex];
    if (!snap) return;

    setChapters(JSON.parse(JSON.stringify(snap.chapters)));
    setOutline(snap.outline);
    setBookDetails(JSON.parse(JSON.stringify(snap.bookDetails)));
    setHistoryIndex(nextIndex);

    setHistoryNotice(`Redid: ${snap.description}`);
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  const restoreHistorySnapshot = (index: number) => {
    const snap = historyStack[index];
    if (!snap) return;

    pushHistorySnapshot(`Before revert to ${snap.description}`);

    setChapters(JSON.parse(JSON.stringify(snap.chapters)));
    setOutline(snap.outline);
    setBookDetails(JSON.parse(JSON.stringify(snap.bookDetails)));

    setHistoryNotice(`Reverted to: ${snap.description}`);
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (!isInput || e.shiftKey) {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        const target = e.target as HTMLElement;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyStack]);
  
  // Storage State
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const chapterAbortControllerRef = useRef<AbortController | null>(null);

  const handleStopGeneration = (targetChapterId?: string) => {
    if (chapterAbortControllerRef.current) {
      chapterAbortControllerRef.current.abort();
      chapterAbortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGeneratingStep('');

    if (targetChapterId) {
      setChapters(prev => prev.map(c => {
        if (c.id === targetChapterId) {
          return { ...c, status: c.content && c.content.trim() ? 'done' : 'idle' };
        }
        return c;
      }));
    } else {
      setChapters(prev => prev.map(c => {
        if (c.status === 'generating') {
          return { ...c, status: c.content && c.content.trim() ? 'done' : 'idle' };
        }
        return c;
      }));
    }

    setHistoryNotice('AI generation stopped.');
    setTimeout(() => setHistoryNotice(null), 3000);
  };
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyModalMessage, setApiKeyModalMessage] = useState<string | null>(null);

  const handleApiError = (e: any, defaultContextMsg: string) => {
    const rawMsg = e?.message || "Unknown error";
    console.error(`[API Error in ${defaultContextMsg}]:`, e);

    if (
      rawMsg.includes('API_KEY_LEAKED') ||
      rawMsg.includes('leaked') ||
      rawMsg.includes('compromised') ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('API key not valid') ||
      rawMsg.includes('API Key Missing') ||
      rawMsg.includes('API_KEY_ERROR')
    ) {
      const isLeaked = rawMsg.includes('leaked') || rawMsg.includes('API_KEY_LEAKED') || rawMsg.includes('compromised');
      setApiKeyModalMessage(
        isLeaked
          ? "Google reported that the application's shared API key was leaked/deactivated. Enter your free Google Gemini API key below to continue without interruptions."
          : "A valid Google Gemini API key is required. Please paste your Google Gemini API key below to continue."
      );
      setIsApiKeyModalOpen(true);
      return;
    }

    if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429') || rawMsg.includes('quota')) {
      setApiKeyModalMessage("Gemini API rate limit reached (429 Quota Exceeded). Providing your own free personal API key gives you dedicated quota with zero rate limits!");
      setIsApiKeyModalOpen(true);
      return;
    }

    alert(`${defaultContextMsg}: ${rawMsg}`);
  };
  const [categoryPrompts, setCategoryPrompts] = useState<Record<Category, string>>(DEFAULT_CATEGORY_PROMPTS);
  const DEFAULT_ELEVENLABS_KEY = 'sk_716bc2b43a089a12f75c4a3be97c723e0aad0cbcd33cd90a';
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(() => {
    return localStorage.getItem('elevenlabs_api_key') || DEFAULT_ELEVENLABS_KEY;
  });
  const [descViewTab, setDescViewTab] = useState<'formatted' | 'html'>('formatted');
  const [showCoverTextOverlay, setShowCoverTextOverlay] = useState<boolean>(true);
  const [showCoverEditor, setShowCoverEditor] = useState<boolean>(false);
  const [coverSaveNotice, setCoverSaveNotice] = useState<boolean>(false);
  const [coverTextPosition, setCoverTextPosition] = useState<'top' | 'middle' | 'bottom'>('top');
  const [coverOverlayDarkness, setCoverOverlayDarkness] = useState<'none' | 'subtle' | 'medium' | 'dark'>('medium');
  const [coverViewMode, setCoverViewMode] = useState<'wrap' | 'front' | '3d'>('wrap');
  const [spineBgColor, setSpineBgColor] = useState<string>('#18181b');
  const [spineTextColor, setSpineTextColor] = useState<string>('#ffffff');
  const [backBgColor, setBackBgColor] = useState<string>('#18181b');
  const [spinePageCount, setSpinePageCount] = useState<number>(220);
  const [showBarcodeOnBack, setShowBarcodeOnBack] = useState<boolean>(true);
  const [pdfIncludeHyperlinks, setPdfIncludeHyperlinks] = useState<boolean>(false);
  const [imageBag, setImageBag] = useState<Record<string, string>>({});
  const [mockIsbn, setMockIsbn] = useState<string | null>(null);

  // Global Command Palette, Help Drawer & Studio Subtabs
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [helpDrawerOpen, setHelpDrawerOpen] = useState<boolean>(false);
  const [assetsSubTab, setAssetsSubTab] = useState<'export' | 'cover' | 'price_royalty'>('export');

  // Marketing & PR Studio State
  const [marketingSubTab, setMarketingSubTab] = useState<'press_release' | 'beta_readers' | 'audiobook_script' | 'social_campaign' | 'email_sequence' | 'media_pitch' | 'landing_page' | 'strategy_roadmap'>('press_release');
  const [selectedLandingTemplate, setSelectedLandingTemplate] = useState<'classic' | 'modern' | 'editorial'>('classic');

  // Custom Uploaded Cover Design Templates
  const [uploadedCoverTemplates, setUploadedCoverTemplates] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    try {
      const saved = localStorage.getItem('uploaded_cover_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleUploadCoverTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const newTemplate = {
          id: 'tpl_' + Date.now(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: dataUrl
        };
        setUploadedCoverTemplates(prev => {
          const updated = [newTemplate, ...prev];
          try {
            localStorage.setItem('uploaded_cover_templates', JSON.stringify(updated.slice(0, 10)));
          } catch (err) {}
          return updated;
        });
        setAssets(prev => ({ ...prev, coverUrl: dataUrl }));
        setShowCoverTextOverlay(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteUploadedTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedCoverTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem('uploaded_cover_templates', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const [pressReleaseContent, setPressReleaseContent] = useState<string>('');
  const [targetAudienceInput, setTargetAudienceInput] = useState<string>('');
  const [launchDateInput, setLaunchDateInput] = useState<string>('FOR IMMEDIATE RELEASE');
  const [isGeneratingPR, setIsGeneratingPR] = useState<boolean>(false);

  const [socialPostsContent, setSocialPostsContent] = useState<string>('');
  const [socialPlatform, setSocialPlatform] = useState<string>('X / Twitter');
  const [socialTone, setSocialTone] = useState<string>('Enthusiastic & Inspiring');
  const [isGeneratingSocial, setIsGeneratingSocial] = useState<boolean>(false);

  const [emailSequenceContent, setEmailSequenceContent] = useState<string>('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState<boolean>(false);

  const [mediaPitchContent, setMediaPitchContent] = useState<string>('');
  const [pitchRecipientType, setPitchRecipientType] = useState<string>('Podcast Hosts & Producers');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);

  const [landingCopyData, setLandingCopyData] = useState<any>(null);
  const [isGeneratingLanding, setIsGeneratingLanding] = useState<boolean>(false);

  const [marketingPlanContent, setMarketingPlanContent] = useState<string>('');
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState<boolean>(false);

  // Instant Cloud / Web Landing Page Publishing State
  const [publishedLandingData, setPublishedLandingData] = useState<PublishedLandingData | null>(null);
  const [isPublishingLanding, setIsPublishingLanding] = useState<boolean>(false);
  const [publishModalOpen, setPublishModalOpen] = useState<boolean>(false);
  const [copiedLinkNotice, setCopiedLinkNotice] = useState<boolean>(false);
  const [standalonePublishedPage, setStandalonePublishedPage] = useState<PublishedLandingData | null>(null);

  useEffect(() => {
    // Check if user is accessing a live published landing page via URL param
    const params = new URLSearchParams(window.location.search);
    const pubId = params.get('landingId') || params.get('pub');
    if (pubId) {
      getPublishedLandingPage(pubId).then(data => {
        if (data) {
          setStandalonePublishedPage(data);
        }
      });
    }
  }, []);

  const handlePublishLandingPage = async () => {
    if (!bookDetails.title) {
      alert("Please enter a book title before publishing your landing page!");
      return;
    }
    setIsPublishingLanding(true);
    try {
      const pubId = projectId ? `pub_${projectId}` : `pub_${Date.now()}`;
      const sampleText = chapters.length > 0 && chapters[0].content ? chapters[0].content.substring(0, 850) + '...' : undefined;
      const dataToPublish: PublishedLandingData = {
        id: pubId,
        projectId: projectId || undefined,
        updatedAt: Date.now(),
        bookDetails,
        landingCopyData,
        coverUrl: assets?.coverUrl || undefined,
        sampleChapterText: sampleText
      };
      await savePublishedLandingPage(dataToPublish);
      setPublishedLandingData(dataToPublish);
      setPublishModalOpen(true);
    } catch (e: any) {
      alert("Publishing failed: " + e.message);
    } finally {
      setIsPublishingLanding(false);
    }
  };

  const handleUnpublishLandingPage = async () => {
    if (!publishedLandingData?.id) return;
    if (confirm("Are you sure you want to unpublish this landing page? The public link will no longer be accessible.")) {
      await deletePublishedLandingPage(publishedLandingData.id);
      setPublishedLandingData(null);
      setPublishModalOpen(false);
    }
  };

  const handleGeneratePR = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingPR(true);
    try {
      const res = await generatePressRelease(bookDetails, targetAudienceInput, launchDateInput, customApiKey);
      setPressReleaseContent(res);
    } catch (e: any) {
      alert("Error generating press release: " + e.message);
    } finally {
      setIsGeneratingPR(false);
    }
  };

  const handleGenerateSocial = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingSocial(true);
    try {
      const res = await generateSocialCampaign(bookDetails, socialPlatform, socialTone, customApiKey);
      setSocialPostsContent(res);
    } catch (e: any) {
      alert("Error generating social posts: " + e.message);
    } finally {
      setIsGeneratingSocial(false);
    }
  };

  const handleGenerateEmailSequence = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingEmail(true);
    try {
      const res = await generateEmailLaunchSequence(bookDetails, customApiKey);
      setEmailSequenceContent(res);
    } catch (e: any) {
      alert("Error generating email sequence: " + e.message);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleGeneratePitch = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingPitch(true);
    try {
      const res = await generateMediaPitch(bookDetails, pitchRecipientType, customApiKey);
      setMediaPitchContent(res);
    } catch (e: any) {
      alert("Error generating pitch: " + e.message);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const handleGenerateLandingCopy = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingLanding(true);
    try {
      const chapterTitles = chapters.map(c => c.title);
      const res = await generateLandingPageCopy(bookDetails, chapterTitles, customApiKey);
      setLandingCopyData(res);
    } catch (e: any) {
      alert("Error generating landing copy: " + e.message);
    } finally {
      setIsGeneratingLanding(false);
    }
  };

  const handleGenerateStrategy = async () => {
    if (!bookDetails.title) return;
    setIsGeneratingStrategy(true);
    try {
      const res = await generateMarketingStrategyPlan(bookDetails, 4, customApiKey);
      setMarketingPlanContent(res);
    } catch (e: any) {
      alert("Error generating marketing plan: " + e.message);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };
  // Chat State
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProjectsList().then(setSavedProjects);

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const prof = await ensureUserProfile(u);
          setUserProfile(prof);
        } catch (e) {
          console.warn("Could not load user profile:", e);
        }
        const conf = await getUserSettings();
        if (conf?.customApiKey) setCustomApiKey(conf.customApiKey);
        if (conf?.prompts) {
          setCategoryPrompts(prev => ({ ...prev, ...conf.prompts }));
        }
        if (conf?.socials || conf?.defaultSocials) {
          const userSocials = conf.socials || conf.defaultSocials;
          setBookDetails(prev => ({
            ...prev,
            socials: { ...userSocials, ...prev.socials }
          }));
        }
        getProjectsList().then(setSavedProjects);
      } else {
        setUserProfile(null);
      }
      setAuthChecking(false);
    });
    return unsub;
  }, []);

  const refreshLibrary = async () => setSavedProjects(await getProjectsList());

  // Debounced Auto-saver to protect storage quotas & maintain instant local persistence
  useEffect(() => {
    if (!projectId) return;

    // PREVENT BLANK GHOST DRAFTS: Only auto-save to library index if project has real user content
    const isCustomTitle = Boolean(bookDetails.title?.trim() && bookDetails.title.trim() !== 'Untitled Project' && bookDetails.title.trim() !== 'Untitled Book' && bookDetails.title.trim() !== 'Untitled Manuscript');
    const hasChapters = Array.isArray(chapters) && chapters.length > 0;
    const hasIdea = Boolean(idea?.trim());
    const hasOutline = Boolean(outline?.trim());
    const hasResearch = Boolean(research);
    const hasIllustrations = Boolean(characterBible?.length || chapterIllustrations?.length);
    const hasRealContent = isCustomTitle || hasChapters || hasIdea || hasOutline || hasResearch || hasIllustrations;

    if (!hasRealContent) {
      return;
    }

    const currentData = {
      id: projectId,
      title: bookDetails.title?.trim() || assets?.metadata?.title || (chapters.length > 0 ? chapters[0].title : null) || (idea ? idea.substring(0, 30) + '...' : 'Untitled Manuscript'),
      updatedAt: Date.now(),
      item_idea: idea,
      idea,
      category,
      research,
      outline,
      chapters,
      assets,
      bookDetails,
      chats,
      continuityMemory,
      characterBible,
      chapterIllustrations
    };

    saveEmergencySnapshot(currentData);

    const saveTimer = setTimeout(async () => {
      await saveProject(currentData);
      refreshLibrary();
    }, 1500);

    return () => clearTimeout(saveTimer);
  }, [idea, category, research, outline, chapters, assets, bookDetails, chats, continuityMemory, characterBible, chapterIllustrations, projectId, user]);

  const handleOpenRecoveryModal = () => {
    const backups = scanAllLocalBackups();
    setRecoveredBackupsList(backups);
    setShowRecoveryModal(true);
  };

  const handleRestoreBackup = async (backup: any) => {
    if (!backup || !backup.data) return;

    pushHistorySnapshot("Restored from Local Backup");

    const data = backup.data;
    if (data.id) setProjectId(data.id);
    if (data.idea) setIdea(data.idea);
    if (data.category) setCategory(data.category);
    if (data.research) setResearch(data.research);
    if (data.outline) setOutline(data.outline);
    if (Array.isArray(data.chapters)) setChapters(data.chapters);
    if (data.bookDetails) setBookDetails(data.bookDetails);
    if (data.assets) setAssets(data.assets);
    if (data.chats) setChats(data.chats);
    if (Array.isArray(data.characterBible)) setCharacterBible(data.characterBible);
    if (Array.isArray(data.chapterIllustrations)) setChapterIllustrations(data.chapterIllustrations);
    if (data.continuityMemory) setContinuityMemory(data.continuityMemory);

    const restoredSaveData = {
      id: data.id || ('kdp_proj_' + Date.now()),
      title: data.title || backup.title || 'Restored Manuscript',
      updatedAt: Date.now(),
      item_idea: data.idea || '',
      idea: data.idea || '',
      category: data.category || 'non_fiction',
      research: data.research || null,
      outline: data.outline || '',
      chapters: Array.isArray(data.chapters) ? data.chapters : [],
      assets: data.assets || {},
      bookDetails: data.bookDetails || { title: data.title || backup.title || '' },
      chats: data.chats || {},
      continuityMemory: data.continuityMemory,
      characterBible: data.characterBible,
      chapterIllustrations: data.chapterIllustrations
    };

    await saveProject(restoredSaveData);
    await refreshLibrary();

    if (Array.isArray(data.chapters) && data.chapters.length > 0) {
      setActiveChapterId(data.chapters[0].id);
      setViewMode('chapter');
    } else {
      setViewMode('setup');
    }

    setHistoryNotice(`Successfully restored manuscript: "${backup.title}" (${backup.chapterCount} chapters, ${backup.wordCount} words)`);
    setTimeout(() => setHistoryNotice(null), 5000);
    setShowRecoveryModal(false);
  };

  const handleOpenMdImportModal = () => {
    setShowMdImportModal(true);
    setMdImportNotice(null);
  };

  const handleFileUploadMd = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMdFileName(file.name);
    setIsProcessingMd(true);
    setMdImportNotice(`Extracting text from "${file.name}"...`);
    try {
      const text = await extractTextFromFile(file);
      setMdRawText(text);
      const parsed = parseMarkdownToChaptersLocally(text);
      setMdParsedPreview(parsed);
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      setMdImportNotice(`Successfully loaded "${file.name}" (${wordCount.toLocaleString()} words). Found ${parsed.chapters.length} chapters.`);
    } catch (err: any) {
      console.error("Error reading manuscript file:", err);
      setMdImportNotice(`Error reading "${file.name}": ` + (err.message || "Unknown error"));
    } finally {
      setIsProcessingMd(false);
    }
  };

  const handleProcessMdManuscript = async (useAI: boolean) => {
    if (!mdRawText.trim()) {
      alert("Please upload or paste markdown manuscript text first.");
      return;
    }

    if (!useAI) {
      const parsed = parseMarkdownToChaptersLocally(mdRawText);
      setMdParsedPreview(parsed);
      setMdImportNotice(`Local structure parse complete! Found ${parsed.chapters.length} chapters.`);
      return;
    }

    setIsProcessingMd(true);
    setMdImportNotice("Gemini AI is analyzing, formatting headers, fixing broken line breaks & structuring into chapters...");
    try {
      const aiResult = await formatAndStructureManuscriptWithAI(mdRawText, customApiKey, bookDetails.language || 'English');
      if (aiResult && Array.isArray(aiResult.chapters) && aiResult.chapters.length > 0) {
        setMdParsedPreview(aiResult);
        setMdImportNotice(`Gemini AI formatted and structured ${aiResult.chapters.length} chapters! Review below and click 'Apply to Book Workspace'.`);
      } else {
        const parsed = parseMarkdownToChaptersLocally(mdRawText);
        setMdParsedPreview(parsed);
        setMdImportNotice("AI response complete. Applied clean local structure parse.");
      }
    } catch (e: any) {
      console.error(e);
      const parsed = parseMarkdownToChaptersLocally(mdRawText);
      setMdParsedPreview(parsed);
      setMdImportNotice("Notice: " + (e.message || "Using clean local structure parse."));
    } finally {
      setIsProcessingMd(false);
    }
  };

  const handleApplyImportedManuscript = () => {
    if (!mdParsedPreview || !Array.isArray(mdParsedPreview.chapters) || mdParsedPreview.chapters.length === 0) {
      alert("No formatted chapters available to import.");
      return;
    }

    pushHistorySnapshot("Imported & Formatted .md Manuscript");

    if (!projectId) {
      setProjectId(generateId());
    }

    const newChapters: Chapter[] = mdParsedPreview.chapters.map((ch, idx) => ({
      id: generateId(),
      title: ch.title || `Chapter ${idx + 1}`,
      content: ch.content || '',
      status: 'done' as const
    }));

    if (mdParsedPreview.title) {
      setBookDetails(prev => ({
        ...prev,
        title: mdParsedPreview.title || prev.title
      }));
    }

    if (!idea) {
      setIdea(mdParsedPreview.title || 'Imported Manuscript');
    }

    setChapters(newChapters);
    if (newChapters.length > 0) {
      setActiveChapterId(newChapters[0].id);
    }

    setOutline(newChapters.map((c, i) => `### Chapter ${i + 1}: ${c.title}`).join('\n\n'));
    setViewMode('chapter');
    setShowMdImportModal(false);

    setHistoryNotice(`Successfully imported & formatted ${newChapters.length} chapters from .md manuscript!`);
    setTimeout(() => setHistoryNotice(null), 5000);

    // Automatically generate & fill Amazon Book Details from imported manuscript in the background
    const manuscriptSample = newChapters.slice(0, 4)
      .map(c => `Chapter: ${c.title}\n${c.content.substring(0, 800)}`)
      .join('\n\n');
    const promptContent = `Title: ${mdParsedPreview.title || 'Imported Manuscript'}\n\nChapter Structure:\n${newChapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')}\n\nSample Text:\n${manuscriptSample}`;

    optimizeMetadata(promptContent, customApiKey, bookDetails.language || 'English')
      .then(meta => {
        if (meta) {
          const keywords = formatMetadataKeywords(meta.keywords);
          const categories = formatMetadataCategories(meta.categories);

          setBookDetails(prev => ({
            ...prev,
            title: prev.title || meta.title || mdParsedPreview.title || '',
            subtitle: prev.subtitle || meta.subtitle || '',
            authorName: prev.authorName || meta.author_name || user?.displayName || '',
            description: prev.description || meta.description_html || '',
            keywords,
            categories,
            pricing: prev.pricing || meta.suggested_price || '$9.99',
            trimSize: prev.trimSize || meta.trim_size || '6x9',
            metadata: meta
          }));
        }
      })
      .catch(err => console.warn("Background auto-metadata generation error:", err));
  };

  const handleCreateNewProject = () => {
    setMobileMenuOpen(false);
    setProjectId(generateId());
    setIdea('');
    setCategory('non_fiction');
    setResearch(null);
    setOutline('');
    setChapters([]);
    setBookDetails({
      title: '',
      subtitle: '',
      authorName: '',
      description: '',
      aboutAuthor: '',
      keywords: [],
      categories: [],
      pricing: '$9.99',
      trimSize: '6x9',
      language: 'English',
      globalInstructions: '',
      inspirationImage: null
    });
    setAssets({});
    setChats({});
    setCharacterBible([]);
    setChapterIllustrations([]);
    setMockIsbn(null);
    setImageBag({});
    setViewMode('setup');
  };

  const handleOpenProject = async (id: string) => {
    setMobileMenuOpen(false);
    const data = await loadProject(id);
    if (!data) return;
    setProjectId(data.id);
    setIdea(data.idea || data.item_idea || '');
    setCategory(data.category as Category || 'non_fiction');
    setResearch(data.research || null);
    setOutline(data.outline || '');
    setChapters(data.chapters || []);
    setBookDetails(data.bookDetails || {
      title: '',
      subtitle: '',
      authorName: '',
      description: '',
      aboutAuthor: '',
      keywords: [],
      categories: [],
      pricing: '$9.99',
      trimSize: '6x9',
      language: 'English',
      globalInstructions: '',
      inspirationImage: null
    });
    if (data.bookDetails?.inspirationImage) {
        setBookDetails(prev => ({ ...prev, inspirationImage: data.bookDetails.inspirationImage }));
    }
    setAssets(data.assets || {});
    setChats(data.chats || {});
    if (data.characterBible && Array.isArray(data.characterBible)) {
      setCharacterBible(data.characterBible);
    } else {
      setCharacterBible([]);
    }
    if (data.chapterIllustrations && Array.isArray(data.chapterIllustrations)) {
      setChapterIllustrations(data.chapterIllustrations);
    } else {
      setChapterIllustrations([]);
    }
    if (data.continuityMemory) {
      setContinuityMemory(data.continuityMemory);
    } else {
      setContinuityMemory({ learnedRules: [], chapterSummaries: {} });
    }
    setViewMode('setup');
  };

  const handleOpenTrashModal = async () => {
    const list = await getTrashList();
    setTrashList(list);
    setShowTrashModal(true);
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Locate project card info
    const projSummary = savedProjects.find(p => p.id === id);
    let chapterCount = 0;
    let wordCount = 0;
    try {
      const fullData = await loadProject(id);
      if (fullData) {
        const chaps = Array.isArray(fullData.chapters) ? fullData.chapters : [];
        chapterCount = chaps.length;
        chaps.forEach((c: any) => {
          if (c?.content) wordCount += c.content.trim().split(/\s+/).filter(Boolean).length;
        });
      }
    } catch (err) {}

    setProjectToDelete({
      id,
      title: projSummary?.title || 'Untitled Manuscript',
      category: projSummary?.category || 'non_fiction',
      chapterCount,
      wordCount,
      updatedAt: projSummary?.updatedAt || Date.now(),
      idea: projSummary?.idea || ''
    });
  };

  const handleConfirmMoveToTrash = async () => {
    if (!projectToDelete) return;
    const target = projectToDelete;
    setProjectToDelete(null);

    await moveToTrash(target.id);
    await refreshLibrary();

    if (projectId === target.id) {
      setViewMode('library');
      setProjectId(null);
    }

    // Floating 15-second undo toast
    setUndoDeleteToast({ id: target.id, title: target.title });
    setTimeout(() => {
      setUndoDeleteToast(prev => (prev?.id === target.id ? null : prev));
    }, 15000);
  };

  const handleUndoDelete = async (id: string) => {
    setUndoDeleteToast(null);
    const restored = await restoreFromTrash(id);
    if (restored) {
      await refreshLibrary();
      setHistoryNotice(`Successfully restored "${restored.title || 'Manuscript'}" from Trash!`);
      setTimeout(() => setHistoryNotice(null), 4000);
      handleOpenProject(id);
    }
  };

  const handleRestoreFromTrashModal = async (id: string) => {
    const restored = await restoreFromTrash(id);
    if (restored) {
      const updatedList = await getTrashList();
      setTrashList(updatedList);
      await refreshLibrary();
      setHistoryNotice(`Successfully restored "${restored.title || 'Manuscript'}" to your bookshelf!`);
      setTimeout(() => setHistoryNotice(null), 4000);
    }
  };

  const handlePermanentDeleteFromTrash = async (id: string, title: string) => {
    if (confirm(`Are you absolutely sure you want to permanently delete "${title}"? This cannot be undone.`)) {
      await permanentlyDeleteFromTrash(id);
      const updatedList = await getTrashList();
      setTrashList(updatedList);
    }
  };

  const handleEmptyAllTrash = async () => {
    if (confirm("Are you sure you want to empty the entire trash bin? All deleted manuscripts in trash will be permanently erased.")) {
      await emptyTrash();
      setTrashList([]);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, viewMode, activeChapterId]);

  const handleStartProject = async () => {
    if (!idea.trim()) return;
    setIsGenerating(true);
    setGeneratingStep('Preparing context...');
    try {
      const conf = await getUserSettings();
      const customPrompt = conf?.prompts?.[category] || categoryPrompts[category] || DEFAULT_CATEGORY_PROMPTS[category] || "You are an expert ghostwriter.";

      let context = '';
      
      const urls = sourceUrls.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
      if (urls.length > 0) {
        setGeneratingStep('Fetching URLs...');
        for (const url of urls) {
          try {
            const res = await fetch('/api/fetch-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.text) {
              context += `\n\n--- Content from URL: ${url} ---\n${data.text}`;
            }
          } catch(e) {
            console.error("Failed to fetch url", url);
          }
        }
      }

      if (sourceFiles.length > 0) {
        setGeneratingStep('Extracting reference documents...');
        for (const file of sourceFiles) {
          try {
            const text = await extractTextFromFile(file);
            context += `\n\n--- Content from file: ${file.name} ---\n${text.substring(0, 20000)}`;
          } catch (err) {
            console.warn(`Failed to extract text from ${file.name}`, err);
          }
        }
      }

      let fullIdea = idea;
      if (context) {
        fullIdea = `${idea}\n\n### ADDITIONAL INFLUENCE / SOURCES:\n${context}`;
      }

      setGeneratingStep('Researching niche & market angle...');
      const res = await researchNiche(fullIdea, customApiKey);
      setResearch(res);

      if (res && Array.isArray(res.top_keywords) && res.top_keywords.length > 0) {
        const initialKw = formatMetadataKeywords(res.top_keywords);
        setBookDetails(prev => ({
          ...prev,
          keywords: prev.keywords.some(k => k.trim()) ? prev.keywords : initialKw
        }));
      }
      
      setGeneratingStep('Generating architectural outline...');
      const languagePrompt = bookDetails.language ? `\n\nCRITICAL: You MUST write the entire outline in ${bookDetails.language}. All titles and section bullet points MUST be in ${bookDetails.language}.` : '';
      const globalInstructionsPrompt = bookDetails?.globalInstructions ? `\n\nADDITIONAL MANDATORY INSTRUCTIONS:\n${bookDetails.globalInstructions}` : '';
      const effectiveSubCategory = bookDetails?.subCategory || (BOOK_SUBCATEGORIES[category] ? BOOK_SUBCATEGORIES[category][0]?.id : undefined);
      const out = await generateOutline(fullIdea, res.top_keywords || [], customApiKey, customPrompt + languagePrompt + globalInstructionsPrompt, category, effectiveSubCategory);
      setOutline(out);
      
      setIdea(fullIdea);
      setViewMode('outline');
    } catch (e: any) {
      handleApiError(e, "Failed to start project");
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleExtractChapters = async () => {
    setIsGenerating(true);
    setGeneratingStep('Extracting chapters...');
    try {
      pushHistorySnapshot("Before extracting chapters");
      const titles = await extractChapters(outline, customApiKey, bookDetails?.language || 'English');
      const newChapters: Chapter[] = titles.map((t: string) => ({
        id: Math.random().toString(36).substring(7),
        title: t,
        content: '',
        status: 'idle'
      }));
      setChapters(newChapters);
      if (newChapters.length > 0) {
        setActiveChapterId(newChapters[0].id);
        setViewMode('chapter');
      }
    } catch (e: any) {
      handleApiError(e, "Failed to extract chapters");
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    if (chapterAbortControllerRef.current) {
      chapterAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    chapterAbortControllerRef.current = abortController;

    pushHistorySnapshot(`Before generating ${chapter.title}`);
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: 'generating' } : c));
    
    try {
      const conf = await getUserSettings();
      const customPrompt = conf?.prompts?.[category] || categoryPrompts[category] || DEFAULT_CATEGORY_PROMPTS[category] || "Write in a clear, practical, encouraging tone.";
      
      let combinedPrompt = `${customPrompt}\n${bookDetails?.globalInstructions ? 'Also explicitly follow these overall instructions for this section: ' + bookDetails.globalInstructions : ''}`;
      
      if (bookDetails?.language) {
          combinedPrompt += `\n\nCRITICAL: The entire section/chapter MUST be written in ${bookDetails.language}. Do not use English unless quoting or if strictly necessary.`;
      }

      // Build cross-chapter continuity context
      const chIndex = chapters.findIndex(c => c.id === chapterId);
      const preceding = chIndex > 0 ? chapters.slice(0, chIndex) : [];
      const precedingSummaries = preceding
        .filter(c => c.content && c.content.trim())
        .map(c => continuityMemory.chapterSummaries[c.id] || `Section "${c.title}" progressed the storyline/argument.`);
      
      const prevCh = chIndex > 0 ? chapters[chIndex - 1] : null;
      const prevEnding = prevCh?.content ? prevCh.content.trim().substring(Math.max(0, prevCh.content.trim().length - 1200)) : '';

      const existingNames = extractExistingCharacterNames(outline + '\n' + preceding.map(c => c.content || '').join('\n'));

      const continuityCtx: ContinuityContext = {
        precedingChapterSummaries: precedingSummaries,
        previousChapterEnding: prevEnding,
        learnedRules: continuityMemory.learnedRules,
        existingCharacterNames: existingNames
      };

      const effectiveTopic = (idea && idea.trim()) || (bookDetails?.title && bookDetails.title.trim()) || bookDetails?.description || 'the manuscript topic';
      const effectiveSubCategory = bookDetails?.subCategory || (BOOK_SUBCATEGORIES[category] ? BOOK_SUBCATEGORIES[category][0]?.id : undefined);
      const content = await generateChapter(
        effectiveTopic, 
        outline, 
        chapter.title, 
        customApiKey, 
        combinedPrompt, 
        abortController.signal, 
        continuityCtx, 
        category,
        effectiveSubCategory
      );

      if (abortController.signal.aborted) {
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: c.content && c.content.trim() ? 'done' : 'idle' } : c));
        return;
      }

      let finalContent = content;
      const detectedPlaceholders = detectManuscriptVisualPlaceholders(content);

      if (detectedPlaceholders.length > 0) {
        setGeneratingStep(`Auto-rendering ${detectedPlaceholders.length} indicated visual(s) with Nano Banana...`);
        const autoIllustrations: ChapterIllustration[] = [];
        const isGuides = category === 'guides' || category === 'white_paper';

        for (let i = 0; i < detectedPlaceholders.length; i++) {
          const ph = detectedPlaceholders[i];
          try {
            setGeneratingStep(`Rendering visual ${i + 1} of ${detectedPlaceholders.length}: "${ph.description.slice(0, 30)}..."`);
            const b64 = await generateSceneIllustrationWithNanoBanana({
              scenePrompt: ph.description || 'Technical Architecture Blueprint',
              chapterTitle: chapter.title,
              colorMode: 'color',
              artStyle: isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration',
              aspectRatio: isGuides ? '16:9' : '4:3',
              bookCategory: category,
              apiKey: customApiKey
            });

            if (b64) {
              const newId = 'illus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
              const newIll: ChapterIllustration = {
                id: newId,
                chapterId: chapter.id,
                sceneTitle: ph.description.slice(0, 50),
                prompt: ph.description,
                imageUrl: b64,
                colorMode: 'color',
                artStyle: isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration',
                aspectRatio: isGuides ? '16:9' : '4:3',
                characterNamesUsed: [],
                createdAt: Date.now(),
                insertedInMarkdown: true
              };
              autoIllustrations.push(newIll);
              finalContent = finalContent.replace(ph.rawMatch, `![${ph.description}](asset:${newId})`);
            }
          } catch (imgErr) {
            console.warn("Auto-rendering placeholder error:", imgErr);
          }
        }

        if (autoIllustrations.length > 0) {
          setChapterIllustrations(prev => [...autoIllustrations, ...prev]);
        }
      }

      setChapters(prev => prev.map(c => {
        if (c.id !== chapterId) return c;
        const existingRevs = c.revisions || [];
        const newRev: ChapterRevision = {
          id: generateId(),
          timestamp: Date.now(),
          label: existingRevs.length === 0 ? 'Initial AI Chapter Generation' : `AI Rewrite Pass #${existingRevs.length + 1}`,
          content: finalContent,
          wordCount: finalContent.trim().split(/\s+/).filter(Boolean).length
        };
        return { ...c, content: finalContent, status: 'done', revisions: [...existingRevs, newRev] };
      }));

      // Asynchronously generate & cache continuity summary for this chapter
      summarizeChapterForContinuity(chapter.title, content, customApiKey)
        .then((summary) => {
          if (summary) {
            setContinuityMemory(prev => ({
              ...prev,
              chapterSummaries: {
                ...prev.chapterSummaries,
                [chapterId]: summary
              }
            }));
          }
        })
        .catch(err => console.warn("Continuity summary error:", err));
    } catch (e: any) {
      if (abortController.signal.aborted || e.message?.includes('cancelled')) {
        console.log("Chapter generation cancelled by user.");
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: c.content && c.content.trim() ? 'done' : 'idle' } : c));
      } else {
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: c.content && c.content.trim() ? 'done' : 'idle' } : c));
        handleApiError(e, `Failed to generate ${chapter.title}`);
      }
    } finally {
      if (chapterAbortControllerRef.current === abortController) {
        chapterAbortControllerRef.current = null;
      }
    }
  };

  const handleGenerateAllChapters = async (overwrite: boolean = false) => {
    const targets = overwrite ? chapters : chapters.filter(c => c.status === 'idle');
    if (!targets.length) return;

    if (chapterAbortControllerRef.current) {
      chapterAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    chapterAbortControllerRef.current = abortController;

    setIsGenerating(true);
    
    for (let i = 0; i < targets.length; i++) {
        if (abortController.signal.aborted) {
          break;
        }
        const chap = targets[i];
        setGeneratingStep(`Writing chapter ${i + 1} of ${targets.length}: "${chap.title}"...`);
        await handleGenerateChapter(chap.id);
    }
    
    setIsGenerating(false);
    setGeneratingStep('');
    if (chapterAbortControllerRef.current === abortController) {
      chapterAbortControllerRef.current = null;
    }
  };

  const handleExtractStyle = async () => {
    let textToAnalyze = '';

    if (styleSourceType === 'bookshelf') {
      if (!selectedSourceProjectId) {
        alert("Please select a book project from your bookshelf.");
        return;
      }
      setIsAnalyzingStyle(true);
      setStyleAnalysisNotice("Loading source manuscript...");
      try {
        const sourceProj = await loadProject(selectedSourceProjectId);
        if (!sourceProj) {
          alert("Could not load the selected project.");
          setIsAnalyzingStyle(false);
          setStyleAnalysisNotice(null);
          return;
        }

        const chapterTexts = sourceProj.chapters.map((c: any, i: number) => `Chapter ${i + 1}: ${c.title}\n${c.content || ''}`).join('\n\n');
        textToAnalyze = `Project Title: ${sourceProj.title}\n\nIdea: ${sourceProj.idea || ''}\n\nOutline Summary:\n${sourceProj.outline || ''}\n\nSample Chapters:\n${chapterTexts}`;

        if (!textToAnalyze.trim()) {
          alert("The selected book project has no text content to analyze.");
          setIsAnalyzingStyle(false);
          setStyleAnalysisNotice(null);
          return;
        }
      } catch (err: any) {
        alert("Error loading source project: " + err.message);
        setIsAnalyzingStyle(false);
        setStyleAnalysisNotice(null);
        return;
      }
    } else {
      textToAnalyze = customStyleSampleText;
      if (!textToAnalyze.trim()) {
        alert("Please paste or type sample manuscript text to analyze.");
        return;
      }
    }

    setIsAnalyzingStyle(true);
    setStyleAnalysisNotice("Gemini AI is analyzing writing voice, tone, sentence pacing, and narrative style...");
    try {
      const stylePrompt = await extractWritingStyle(textToAnalyze, customApiKey);
      setExtractedStyleResult(stylePrompt);
      setStyleAnalysisNotice("Style profile extracted successfully! Review and apply below.");
    } catch (e: any) {
      console.error(e);
      alert("Failed to extract writing style: " + (e.message || "Unknown error"));
      setStyleAnalysisNotice(null);
    } finally {
      setIsAnalyzingStyle(false);
    }
  };

  const handleApplyExtractedStyle = (andRewriteAll: boolean = false) => {
    if (!extractedStyleResult.trim()) return;

    pushHistorySnapshot("Applied copied copywriting style");

    setBookDetails(prev => ({
      ...prev,
      globalInstructions: extractedStyleResult
    }));

    setHistoryNotice("Copied copywriting style applied to Global Chapter Instructions!");
    setTimeout(() => setHistoryNotice(null), 4000);
    setShowStyleExtractorModal(false);

    if (andRewriteAll && chapters.length > 0) {
      handleGenerateAllChapters(true);
    }
  };

  const handleGenerateBackCover = async () => {
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Crafting compelling back cover blurb...');
    try {
      const blurb = await generateBackCover(bookDetails, chapters.map(c => c.title), customApiKey);
      setAssets(prev => ({ ...prev, backCoverContent: blurb }));
    } catch (e: any) {
      alert("Blurb generation failed: " + e.message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleInsertTocChapter = (tocMarkdown: string) => {
    pushHistorySnapshot("Inserted Table of Contents Chapter");

    // Check if a TOC chapter already exists
    const existingIndex = chapters.findIndex(c => 
      c.title.toLowerCase().includes('table of contents') || 
      c.title.toLowerCase().includes('contents')
    );

    if (existingIndex !== -1) {
      setChapters(prev => prev.map((c, idx) => {
        if (idx === existingIndex) {
          return { ...c, content: tocMarkdown, status: 'done' as const };
        }
        return c;
      }));
    } else {
      // Place as Front Matter right at top
      const tocChapter: Chapter = {
        id: generateId(),
        title: "Table of Contents",
        content: tocMarkdown,
        status: 'done' as const
      };
      setChapters(prev => [tocChapter, ...prev]);
    }

    setHistoryNotice("Table of Contents synchronized with book workspace!");
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  const handleInsertIllustrationIntoChapter = (chapterId: string, markdownSnippet: string, position: 'top' | 'bottom' = 'bottom') => {
    pushHistorySnapshot("Inserted Scene Illustration into Chapter");
    setChapters(prev => prev.map(c => {
      if (c.id !== chapterId) return c;
      let updatedContent = '';
      if (!c.content) {
        updatedContent = markdownSnippet;
      } else if (position === 'top') {
        const match = c.content.match(/^(#[^\n]+\n+)/);
        if (match) {
          updatedContent = c.content.replace(match[0], `${match[0]}${markdownSnippet}\n\n`);
        } else {
          updatedContent = `${markdownSnippet}\n\n${c.content}`;
        }
      } else {
        updatedContent = `${c.content}\n\n${markdownSnippet}\n`;
      }
      return { ...c, content: updatedContent };
    }));
    setHistoryNotice("Scene illustration inserted into chapter manuscript!");
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  const handleBatchGenerateVisuals = async (chapterId: string) => {
    const targetChapter = chapters.find(c => c.id === chapterId);
    if (!targetChapter) return;
    const placeholders = detectManuscriptVisualPlaceholders(targetChapter.content);
    if (placeholders.length === 0) {
      alert("No visual placeholders detected in this chapter.");
      return;
    }

    setIsBatchGeneratingVisuals(true);
    try {
      let currentContent = targetChapter.content;
      const isGuides = category === 'guides' || category === 'white_paper';
      const newIllustrations: ChapterIllustration[] = [];

      for (let i = 0; i < placeholders.length; i++) {
        const ph = placeholders[i];
        setHistoryNotice(`Generating visual ${i + 1} of ${placeholders.length}: "${ph.description.slice(0, 30)}..."`);
        const b64 = await generateSceneIllustrationWithNanoBanana({
          scenePrompt: ph.description || 'Technical Diagram',
          chapterTitle: targetChapter.title,
          colorMode: 'color',
          artStyle: isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration',
          aspectRatio: isGuides ? '16:9' : '4:3',
          bookCategory: category,
          apiKey: customApiKey
        });

        if (b64) {
          const newId = 'illus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          const newIll: ChapterIllustration = {
            id: newId,
            chapterId: targetChapter.id,
            sceneTitle: ph.description.slice(0, 50),
            prompt: ph.description,
            imageUrl: b64,
            colorMode: 'color',
            artStyle: isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration',
            aspectRatio: isGuides ? '16:9' : '4:3',
            characterNamesUsed: [],
            createdAt: Date.now(),
            insertedInMarkdown: true
          };
          newIllustrations.push(newIll);

          currentContent = currentContent.replace(ph.rawMatch, `![${ph.description}](asset:${newId})`);
        }
      }

      if (newIllustrations.length > 0) {
        setChapterIllustrations(prev => [...newIllustrations, ...prev]);
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: currentContent } : c));
        pushHistorySnapshot(`Auto-generated and placed ${newIllustrations.length} visuals in chapter`);
        setHistoryNotice(`Successfully generated and placed ${newIllustrations.length} visuals!`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to batch generate visuals: " + (err.message || "Unknown error"));
    } finally {
      setIsBatchGeneratingVisuals(false);
      setTimeout(() => setHistoryNotice(null), 3500);
    }
  };

  const handleAutoPlaceVisuals = async (chapterId: string) => {
    const targetChapter = chapters.find(c => c.id === chapterId);
    if (!targetChapter) return;

    setIsAutoPlacingVisuals(true);
    setHistoryNotice("AI analyzing chapter to identify optimal visual placements...");
    try {
      const result = await autoSuggestChapterVisualPlaceholders(
        targetChapter.content,
        targetChapter.title,
        category,
        customApiKey
      );
      if (result.newPlaceholdersCount > 0) {
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: result.updatedContent } : c));
        pushHistorySnapshot(`AI placed ${result.newPlaceholdersCount} visual placeholders in chapter`);
        setHistoryNotice(`AI identified and placed ${result.newPlaceholdersCount} visual moments! Click "Auto-Generate All" to render them.`);
      } else {
        alert("AI analyzed the manuscript but did not find clear anchor points to place visuals, or the chapter text is very short.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to auto-suggest visuals: " + (err.message || "Unknown error"));
    } finally {
      setIsAutoPlacingVisuals(false);
      setTimeout(() => setHistoryNotice(null), 4500);
    }
  };

  const handleExportDocx = async () => {
    setIsGenerating(true);
    setGeneratingStep('manus AI: Formatting Manuscript for Amazon KDP (.docx)...');
    
    // Give React time to render the loading state before block thread
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await exportToDocx(bookDetails, chapters, assets.coverUrl);
    } catch (e: any) {
      console.error(e);
      alert("DOCX export failed: " + e.message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleExportEpub = async () => {
    setIsGenerating(true);
    setGeneratingStep('manus AI: Compiling & Packaging EPUB E-reader File...');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await exportEpubManuscript(bookDetails, chapters, assets.coverUrl);
    } catch (e: any) {
      console.error(e);
      alert("EPUB export failed: " + e.message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handlePrintPdf = () => {
    if (chapters.length === 0) {
      alert("No written chapters in manuscript to export as PDF.");
      return;
    }

    // Filter out meta-chapters like 'Table of Contents' or 'Contents' to avoid duplicate TOC pages
    const contentChapters = chapters.filter(ch => {
      const t = ch.title.toLowerCase().trim();
      return !t.includes('table of contents') && t !== 'contents';
    });

    if (contentChapters.length === 0) {
      alert("No story chapters to export.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups in your browser to open the Print/PDF view.");
      return;
    }

    const title = bookDetails.title || assets.metadata?.title || 'Untitled Manuscript';
    const author = bookDetails.authorName || user?.displayName || 'Author';
    const subtitle = bookDetails.subtitle || assets.metadata?.subtitle || '';
    const currentYear = new Date().getFullYear();

    const getCleanChapterTitle = (rawTitle: string, index: number) => {
      if (!rawTitle) return `Chapter ${index}`;
      const trimmed = rawTitle.trim();
      const lower = trimmed.toLowerCase();
      
      if (
        lower.startsWith('about the author') ||
        lower.startsWith('table of contents') ||
        lower.startsWith('contents') ||
        lower.startsWith('introduction') ||
        lower.startsWith('foreword') ||
        lower.startsWith('preface') ||
        lower.startsWith('prologue') ||
        lower.startsWith('epilogue') ||
        lower.startsWith('acknowledgments')
      ) {
        return trimmed;
      }
      
      if (/^chapter\s+\d+/i.test(trimmed)) {
        return trimmed;
      }
      
      return `Chapter ${index}: ${trimmed}`;
    };

    const formatContentToBookHtml = (content: string) => {
      if (!content) return '<p class="empty-ch">No text written for this chapter yet.</p>';
      
      let html = content.replace(/\r\n/g, '\n');

      // 1. Extract and format Code Blocks / ASCII Diagrams (``` ... ```)
      const codeBlocks: string[] = [];
      html = html.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
        const index = codeBlocks.length;
        const cleanCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd();
        codeBlocks.push(`<pre class="ch-code-block"><code>${cleanCode}</code></pre>`);
        return `\n\n__CODE_BLOCK_${index}__\n\n`;
      });

      // 2. Extract and format Markdown Tables (| ... |)
      const tableBlocks: string[] = [];
      html = html.replace(/((?:\|[^\n]+\|\n?)+)/g, (match) => {
        const lines = match.trim().split('\n').filter(l => l.trim().startsWith('|'));
        if (lines.length < 2) return match;
        
        let tableHtml = '<table class="ch-table">';
        let inTbody = false;
        
        lines.forEach((line, idx) => {
          if (/^\|[\s\-:|]+\|$/.test(line.trim())) return; // skip divider
          const cells = line.split('|').slice(1, -1).map(c => c.trim());
          if (idx === 0) {
            tableHtml += '<thead><tr>';
            cells.forEach(c => {
              const formatted = c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
              tableHtml += `<th>${formatted}</th>`;
            });
            tableHtml += '</tr></thead>';
          } else {
            if (!inTbody) {
              tableHtml += '<tbody>';
              inTbody = true;
            }
            tableHtml += '<tr>';
            cells.forEach(c => {
              const formatted = c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
              tableHtml += `<td>${formatted}</td>`;
            });
            tableHtml += '</tr>';
          }
        });
        if (inTbody) tableHtml += '</tbody>';
        tableHtml += '</table>';

        const index = tableBlocks.length;
        tableBlocks.push(tableHtml);
        return `\n\n__TABLE_BLOCK_${index}__\n\n`;
      });

      // 3. Extract Blockquotes (> ...)
      const quoteBlocks: string[] = [];
      html = html.replace(/((?:^>[^\n]*\n?)+)/gm, (match) => {
        const quoteText = match
          .split('\n')
          .map(l => l.replace(/^>\s?/, ''))
          .join('\n')
          .trim();
        if (!quoteText) return match;
        
        const formattedQuote = quoteText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/_(.*?)_/g, '<em>$1</em>')
          .replace(/\n/g, '<br/>');

        const quoteHtml = `<blockquote class="ch-quote"><p>${formattedQuote}</p></blockquote>`;
        const index = quoteBlocks.length;
        quoteBlocks.push(quoteHtml);
        return `\n\n__QUOTE_BLOCK_${index}__\n\n`;
      });

      // 4. Handle Image tags / empty placeholders like ![alt]() or ![alt](url)
      html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, url) => {
        const cleanUrl = url ? url.trim() : '';
        const cleanAlt = alt ? alt.trim() : '';
        if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('http')) {
          return `<figure class="ch-figure"><img src="${cleanUrl}" alt="${cleanAlt}" /><figcaption>${cleanAlt}</figcaption></figure>`;
        }
        if (cleanAlt) {
          return `<div class="ch-illustration-box">🖼️ <strong>Visual Concept:</strong> ${cleanAlt}</div>`;
        }
        return '';
      });

      // 5. Clean up LaTeX formulas like $$\text{...}$$ or $...$
      html = html.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_, formula) => {
        const cleanFormula = formula
          .replace(/\\text\{(.*?)\}/g, '$1')
          .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1 / $2)')
          .replace(/\\/g, '')
          .trim();
        return `<div class="ch-formula-box"><strong>Formula:</strong> ${cleanFormula}</div>`;
      });

      // 6. Split into blocks and process remaining elements
      const rawBlocks = html.split(/\n\n+/);
      const processedBlocks = rawBlocks.map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';

        if (trimmed.startsWith('__CODE_BLOCK_') && trimmed.endsWith('__')) {
          const idx = parseInt(trimmed.replace('__CODE_BLOCK_', '').replace('__', ''), 10);
          return codeBlocks[idx] || '';
        }
        if (trimmed.startsWith('__TABLE_BLOCK_') && trimmed.endsWith('__')) {
          const idx = parseInt(trimmed.replace('__TABLE_BLOCK_', '').replace('__', ''), 10);
          return tableBlocks[idx] || '';
        }
        if (trimmed.startsWith('__QUOTE_BLOCK_') && trimmed.endsWith('__')) {
          const idx = parseInt(trimmed.replace('__QUOTE_BLOCK_', '').replace('__', ''), 10);
          return quoteBlocks[idx] || '';
        }

        // Headings
        if (trimmed.startsWith('#### ')) {
          return `<h4 class="ch-h4">${trimmed.replace(/^####\s+/, '')}</h4>`;
        }
        if (trimmed.startsWith('### ')) {
          return `<h3 class="ch-h3">${trimmed.replace(/^###\s+/, '')}</h3>`;
        }
        if (trimmed.startsWith('## ')) {
          return `<h2 class="ch-h2">${trimmed.replace(/^##\s+/, '')}</h2>`;
        }
        if (trimmed.startsWith('# ')) {
          return `<h2 class="ch-h2">${trimmed.replace(/^#\s+/, '')}</h2>`;
        }

        // Horizontal Dividers
        if (/^(\-\-\-|\*\*\*|===+)$/.test(trimmed)) {
          return `<div class="ch-divider"><hr /></div>`;
        }

        // Unordered lists (- item or * item)
        if (/^[\-\*]\s+/m.test(trimmed)) {
          const items = trimmed
            .split('\n')
            .filter(l => l.trim().match(/^[\-\*]\s+/))
            .map(item => {
              const cleaned = item.replace(/^[\-\*]\s+/, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>');
              return `<li>${cleaned}</li>`;
            })
            .join('');
          return `<ul class="ch-list">${items}</ul>`;
        }

        // Ordered lists (1. item, 2. item)
        if (/^\d+\.\s+/m.test(trimmed)) {
          const items = trimmed
            .split('\n')
            .filter(l => l.trim().match(/^\d+\.\s+/))
            .map(item => {
              const cleaned = item.replace(/^\d+\.\s+/, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>');
              return `<li>${cleaned}</li>`;
            })
            .join('');
          return `<ol class="ch-list-ordered">${items}</ol>`;
        }

        // Auto-detect unfenced ASCII Art / Diagrams
        const isAsciiDiagram = /[\┌\┐\└\┘\├\┤\┬\┴\┼\─\│\▼\▲\►\◄\↖\↗\↘\↙\═\║\╔\╗\╚\╝\+\-\|\/\\]{3,}/.test(trimmed) ||
          (trimmed.split('\n').length >= 2 && /[\─\│\▼\▲\►\◄\<\>\-\+\|\[\]]{2,}/.test(trimmed) && !trimmed.match(/^[a-zA-Z0-9\s,\.\?'"-]+$/));

        if (isAsciiDiagram) {
          const safeDiagram = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<pre class="ch-code-block"><code>${safeDiagram}</code></pre>`;
        }

        // Regular Paragraph
        const cleanP = trimmed
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/_(.*?)_/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code class="ch-inline-code">$1</code>')
          .replace(/\n/g, '<br/>');

        return `<p class="ch-p">${cleanP}</p>`;
      });

      return processedBlocks.filter(Boolean).join('\n');
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — Formatted Manuscript Interior PDF</title>
  <style>
    @page {
      size: 6in 9in;
      margin: 0.75in 0.65in 0.75in 0.75in;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .no-print {
        display: none !important;
      }
      .manuscript-paper {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: "Georgia", "Garamond", "Baskerville", "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111111;
      background: #f1f5f9;
      margin: 0;
      padding: 0;
    }
    
    .print-banner {
      background: #0f172a;
      color: #ffffff;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .print-btn {
      background: #10b981;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .print-btn:hover {
      background: #059669;
    }
    .link-option-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
      background: #1e293b;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #334155;
    }
    .link-option-label:hover {
      background: #334155;
    }
    
    .manuscript-paper {
      max-width: 6.5in;
      background: #ffffff;
      margin: 30px auto;
      padding: 0.75in;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }

    /* Title Page */
    .title-page {
      page-break-after: always;
      break-after: page;
      text-align: center;
      padding-top: 2.2in;
      min-height: 7.5in;
    }
    .book-title {
      font-size: 26pt;
      font-weight: bold;
      line-height: 1.25;
      margin-bottom: 0.25in;
      font-family: "Georgia", serif;
      letter-spacing: -0.5px;
    }
    .book-subtitle {
      font-size: 13pt;
      font-style: italic;
      color: #475569;
      margin-bottom: 2.2in;
      line-height: 1.4;
    }
    .book-author {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #1e293b;
    }
    
    /* Copyright Page */
    .copyright-page {
      page-break-after: always;
      break-after: page;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #475569;
      padding-top: 3.8in;
      min-height: 7.5in;
    }
    .copyright-page p {
      text-indent: 0 !important;
      margin-bottom: 0.8em;
    }

    /* Table of Contents */
    .toc-page {
      page-break-after: always;
      break-after: page;
      padding-top: 0.6in;
      min-height: 7.5in;
    }
    .toc-header {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 1.2in;
      font-family: "Georgia", serif;
    }
    .toc-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.8em;
      font-size: 11pt;
    }
    .toc-title {
      font-weight: 500;
      color: #0f172a;
    }
    .toc-link {
      color: #0f172a;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-color: #94a3b8;
      transition: color 0.2s;
    }
    .toc-link:hover {
      color: #2563eb;
      text-decoration-color: #2563eb;
    }
    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #cbd5e1;
      margin: 0 8px;
    }

    /* Chapter Interior Styling */
    .chapter-block {
      page-break-before: always;
      break-before: page;
      padding-top: 0.5in;
    }
    .chapter-heading-container {
      text-align: center;
      margin-top: 1in;
      margin-bottom: 1.2in;
    }
    .chapter-number-label {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #64748b;
      margin-bottom: 0.15in;
    }
    .chapter-main-title {
      font-size: 20pt;
      font-weight: bold;
      line-height: 1.3;
      font-family: "Georgia", serif;
      color: #0f172a;
    }
    
    .ch-p {
      text-indent: 1.5em;
      margin-top: 0;
      margin-bottom: 0;
      text-align: justify;
    }
    .ch-p:first-of-type,
    .ch-h2 + .ch-p,
    .ch-h3 + .ch-p,
    .ch-h4 + .ch-p,
    pre.ch-code-block + .ch-p,
    table.ch-table + .ch-p,
    blockquote.ch-quote + .ch-p,
    .empty-ch {
      text-indent: 0 !important;
    }
    .ch-h2 {
      font-size: 13pt;
      font-weight: bold;
      text-align: center;
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      font-family: "Georgia", serif;
    }
    .ch-h3 {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 1.4em;
      margin-bottom: 0.4em;
    }
    .ch-h4 {
      font-size: 10.5pt;
      font-weight: bold;
      margin-top: 1.2em;
      margin-bottom: 0.3em;
    }

    /* Code Blocks & ASCII Diagrams */
    pre.ch-code-block {
      font-family: "Courier New", "Cascadia Code", "SFMono-Regular", Consolas, monospace !important;
      font-size: 8.5pt !important;
      line-height: 1.35 !important;
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px !important;
      padding: 10px 14px !important;
      margin: 1.2em 0 !important;
      white-space: pre !important;
      overflow-x: auto !important;
      text-indent: 0 !important;
      page-break-inside: avoid;
      color: #0f172a !important;
    }
    pre.ch-code-block code {
      font-family: inherit !important;
      font-size: inherit !important;
      background: transparent !important;
      padding: 0 !important;
      border: none !important;
    }

    /* Tables */
    table.ch-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 1.4em 0 !important;
      font-size: 9.5pt !important;
      line-height: 1.4 !important;
      page-break-inside: avoid;
      text-indent: 0 !important;
    }
    table.ch-table th, table.ch-table td {
      border: 1px solid #94a3b8 !important;
      padding: 6px 10px !important;
      text-align: left !important;
      vertical-align: top !important;
    }
    table.ch-table th {
      background: #f1f5f9 !important;
      font-weight: bold !important;
      color: #0f172a !important;
    }

    /* Blockquotes */
    blockquote.ch-quote {
      border-left: 3px solid #3b82f6 !important;
      background: #f8fafc !important;
      margin: 1.2em 0 !important;
      padding: 10px 16px !important;
      color: #334155 !important;
      font-style: italic !important;
      text-indent: 0 !important;
      border-radius: 0 6px 6px 0 !important;
      page-break-inside: avoid;
    }
    blockquote.ch-quote p {
      text-indent: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Inline Code & Formula Boxes */
    code.ch-inline-code {
      font-family: "Courier New", monospace !important;
      background: #f1f5f9 !important;
      border: 1px solid #e2e8f0 !important;
      padding: 2px 5px !important;
      border-radius: 4px !important;
      font-size: 9pt !important;
      color: #0f172a !important;
    }
    .ch-formula-box {
      background: #f0fdf4 !important;
      border: 1px solid #bbf7d0 !important;
      border-radius: 6px !important;
      padding: 10px 14px !important;
      margin: 1.2em 0 !important;
      font-size: 9.5pt !important;
      color: #166534 !important;
      text-indent: 0 !important;
      page-break-inside: avoid;
    }
    .ch-illustration-box {
      background: #faf5ff !important;
      border: 1px dashed #d8b4fe !important;
      border-radius: 6px !important;
      padding: 10px 14px !important;
      margin: 1.2em 0 !important;
      font-size: 9.5pt !important;
      color: #6b21a8 !important;
      text-indent: 0 !important;
      page-break-inside: avoid;
    }

    /* Lists & Dividers */
    .ch-list, .ch-list-ordered {
      margin: 0.8em 0 0.8em 1.8em !important;
      padding: 0 !important;
      text-indent: 0 !important;
    }
    .ch-list li, .ch-list-ordered li {
      margin-bottom: 0.35em !important;
      line-height: 1.5 !important;
      text-indent: 0 !important;
    }
    .ch-divider {
      margin: 1.5em 0 !important;
      text-align: center !important;
    }
    .ch-divider hr {
      border: 0 !important;
      border-top: 1px solid #cbd5e1 !important;
      margin: 0 !important;
    }
    .ch-figure {
      margin: 1.2em 0 !important;
      text-align: center !important;
      page-break-inside: avoid;
    }
    .ch-figure img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 4px !important;
      border: 1px solid #e2e8f0 !important;
    }
    .ch-figure figcaption {
      font-size: 9pt !important;
      color: #64748b !important;
      font-style: italic !important;
      margin-top: 6px !important;
    }
    
    .author-page {
      page-break-before: always;
      break-before: page;
      padding-top: 0.8in;
    }
  </style>
</head>
<body>
  <div class="print-banner no-print">
    <div>
      <div style="font-weight: 700; font-size: 15px;">Print Ready Manuscript PDF Export</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
        Formatted 6x9 Trade Paperback Interior. Select "Save as PDF" in print settings.
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 16px;">
      <label class="link-option-label">
        <input type="checkbox" id="tocLinkToggle" ${pdfIncludeHyperlinks ? 'checked' : ''} onchange="toggleTocLinks(this.checked)" style="cursor: pointer; width: 16px; height: 16px;">
        <span>Clickable TOC Links</span>
      </label>
      <button class="print-btn" onclick="window.print()">
        🖨️ Save as PDF / Print
      </button>
    </div>
  </div>

  <div class="manuscript-paper">
    <!-- Title Page -->
    <div class="title-page">
      <div class="book-title">${title}</div>
      ${subtitle ? `<div class="book-subtitle">${subtitle}</div>` : ''}
      <div class="book-author">${author}</div>
    </div>

    <!-- Copyright Page -->
    <div class="copyright-page">
      <p>Copyright © ${currentYear} by ${author}</p>
      <p>All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.</p>
      ${bookDetails.pricing ? `<p style="margin-top: 1.5em;">Suggested Retail Price: ${bookDetails.pricing}</p>` : ''}
      <p style="margin-top: 1.5em;">First Printing, ${currentYear}</p>
    </div>

    <!-- Table of Contents -->
    <div class="toc-page">
      <div class="toc-header">Contents</div>
      ${contentChapters.map((ch, idx) => {
        const cleanTitle = getCleanChapterTitle(ch.title, idx + 1);
        const anchor = `chapter-${idx + 1}`;
        return `
          <div class="toc-row">
            <span class="toc-title-slot" data-title="${cleanTitle.replace(/"/g, '&quot;')}" data-anchor="${anchor}">
              ${pdfIncludeHyperlinks ? `<a href="#${anchor}" class="toc-title toc-link">${cleanTitle}</a>` : `<span class="toc-title">${cleanTitle}</span>`}
            </span>
            <span class="toc-dots"></span>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Chapter Interiors -->
    ${contentChapters.map((ch, idx) => {
      const cleanTitle = getCleanChapterTitle(ch.title, idx + 1);
      const isNamedChapter = ch.title.toLowerCase().startsWith('chapter') || ch.title.toLowerCase().includes('author') || ch.title.toLowerCase().includes('introduction') || ch.title.toLowerCase().includes('prologue');
      return `
        <div class="chapter-block" id="chapter-${idx + 1}">
          <div class="chapter-heading-container">
            ${!isNamedChapter ? `<div class="chapter-number-label">Chapter ${idx + 1}</div>` : ''}
            <div class="chapter-main-title">${cleanTitle}</div>
          </div>
          <div class="chapter-body">
            ${formatContentToBookHtml(ch.content)}
          </div>
        </div>
      `;
    }).join('')}

    <!-- About Author Section if set -->
    ${bookDetails.aboutAuthor ? `
      <div class="author-page" id="chapter-author">
        <div class="chapter-heading-container">
          <div class="chapter-main-title">About the Author</div>
        </div>
        <div class="chapter-body">
          ${formatContentToBookHtml(bookDetails.aboutAuthor)}
        </div>
      </div>
    ` : ''}
  </div>

  <script>
    function toggleTocLinks(enabled) {
      var slots = document.querySelectorAll('.toc-title-slot');
      slots.forEach(function(slot) {
        var title = slot.getAttribute('data-title');
        var anchor = slot.getAttribute('data-anchor');
        if (enabled) {
          slot.innerHTML = '<a href="#' + anchor + '" class="toc-title toc-link">' + title + '</a>';
        } else {
          slot.innerHTML = '<span class="toc-title">' + title + '</span>';
        }
      });
    }

    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportPublishingZip = async () => {
    setIsGenerating(true);
    setGeneratingStep('manus AI: Packaging Complete KDP Publishing Bundle (.zip)...');

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await exportPublishingZipBundle(bookDetails, chapters, assets);
    } catch (e: any) {
      console.error(e);
      alert("Zip bundle creation failed: " + e.message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setViewMode('assets');
    
    // We fetch these sequentially to gracefully handle permissions errors (e.g. 403 Forbidden for Audio/Image)
    let meta = null;
    let cover = null;
    let audio = null;

    try {
      setGeneratingStep('Creating Amazon KDP metadata...');
      const fullBookContext = [
        bookDetails.title ? `Title: ${bookDetails.title}` : '',
        bookDetails.subtitle ? `Subtitle: ${bookDetails.subtitle}` : '',
        bookDetails.description ? `Description: ${bookDetails.description}` : '',
        idea ? `Idea: ${idea}` : '',
        outline ? `Outline:\n${outline}` : '',
        chapters.length > 0 ? `Chapters:\n${chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')}` : ''
      ].filter(Boolean).join('\n\n') || idea || 'Manuscript';

      meta = await optimizeMetadata(fullBookContext, customApiKey, bookDetails.language || 'English');
      if (meta) {
        const generatedKw = formatMetadataKeywords(meta.keywords);
        setBookDetails(prev => ({
          ...prev,
          title: prev.title || meta.title || '',
          subtitle: prev.subtitle || meta.subtitle || '',
          authorName: prev.authorName || meta.author_name || '',
          description: prev.description || meta.description_html || '',
          keywords: prev.keywords.some(k => k.trim()) ? prev.keywords : generatedKw,
          categories: prev.categories.some(c => c.trim()) ? prev.categories : formatMetadataCategories(meta.categories),
          pricing: prev.pricing || meta.suggested_price || '$9.99',
          trimSize: prev.trimSize || meta.trim_size || '6x9',
          metadata: meta
        }));
      }
    } catch (e: any) {
      console.warn("Metadata failed:", e);
      alert("Metadata generation failed. Make sure your API key has text generation enabled. " + (e.message || ""));
    }

    let blurb = '';
    try {
      setGeneratingStep('Agent: Art Director is designing Cover...');
      const currentDetails = {
        title: bookDetails.title || meta?.title || idea,
        subtitle: bookDetails.subtitle || meta?.subtitle || '',
        authorName: bookDetails.authorName || meta?.author_name || user?.displayName || 'Author Name',
        description: bookDetails.description || meta?.description_html || ''
      };
      cover = await createCover(idea, customApiKey, bookDetails.inspirationImage || undefined, false, currentDetails);
    } catch (e: any) {
      console.warn("Cover generation failed or forbidden:", e);
    }

    try {
      setGeneratingStep('KDP Agent: Crafting compelling Back Cover Blurb...');
      blurb = await generateBackCover(
        {
          title: bookDetails.title || meta?.title || idea,
          subtitle: bookDetails.subtitle || meta?.subtitle || '',
          description: bookDetails.description || meta?.description_html || '',
          language: bookDetails.language
        },
        chapters.map(c => c.title),
        customApiKey
      );
    } catch (e: any) {
      console.warn("Back cover blurb generation failed:", e);
    }

    try {
      setGeneratingStep('Generating Audio Sample...');
      const fullManuscript = chapters.map(c => c.content).join('\n\n');
      audio = await synthesizeAudiobook(fullManuscript, customApiKey);
    } catch (e: any) {
      console.warn("Audio generation failed or forbidden:", e);
    }

    const finalBlurb = blurb ? stripHtmlTags(blurb) : (meta?.description_html ? stripHtmlTags(meta.description_html) : '');
    setAssets({ 
      coverUrl: cover, 
      metadata: meta || undefined, 
      audioUrl: audio,
      backCoverContent: finalBlurb 
    });
    setShowCoverTextOverlay(true);
    setIsGenerating(false);
    setGeneratingStep('');
  };

  const handleNanoBananaCover = async () => {
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Consulting manus AI for a Premium Cover...');
    try {
      const currentDetails = {
        ...bookDetails,
        authorName: bookDetails.authorName || user?.displayName || 'Author Name'
      };
      const promptText = (currentDetails.title || "Bestselling Book") + (currentDetails.subtitle ? ": " + currentDetails.subtitle : "");
      const cover = await createCover(promptText, customApiKey, bookDetails.inspirationImage || undefined, true, currentDetails);
      
      let blurb = assets.backCoverContent || '';
      if (!blurb && (bookDetails.title || bookDetails.description)) {
        try {
          blurb = await generateBackCover(bookDetails, chapters.map(c => c.title), customApiKey);
        } catch (e) {
          console.warn("Auto back cover blurb generation skipped:", e);
        }
      }

      if (cover) {
        setAssets(prev => ({ 
          ...prev, 
          coverUrl: cover,
          backCoverContent: blurb ? stripHtmlTags(blurb) : prev.backCoverContent
        }));
        setShowCoverTextOverlay(true);
        // Log to chat
        setChats(prev => ({ ...prev, ['cover']: [...(prev['cover'] || []), { role: 'model', text: "Behold, a masterpiece generated with manus AI." }] }));
      }
    } catch (e: any) {
      console.error("Cover generation failed:", e);
      alert("manus AI cover generation error: " + (e.message || "Unknown error") + "\n\nTip: You can also upload your own cover image using the Upload Cover button!");
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleEditCoverWithNanoBanana = async () => {
    if (!coverEditInput.trim()) return;
    const instruction = coverEditInput;
    setCoverEditInput('');
    setIsGenerating(true);
    setGeneratingStep('manus AI: Re-imagining your cover...');
    
    const newMessage: ChatMessage = { role: 'user', text: instruction };
    setChats(prev => ({ ...prev, ['cover']: [...(prev['cover'] || []), newMessage] }));

    try {
      const currentDetails = {
        ...bookDetails,
        authorName: bookDetails.authorName || user?.displayName || 'Author Name'
      };
      const inspImg = bookDetails.inspirationImage || (assets.coverUrl && assets.coverUrl.startsWith('data:image/') ? assets.coverUrl : undefined);
      const newCover = await createCover(instruction, customApiKey, inspImg, true, currentDetails);
      if (newCover) {
        setAssets(prev => ({ ...prev, coverUrl: newCover }));
        setChats(prev => ({ ...prev, ['cover']: [...(prev['cover'] || []), { role: 'model', text: "I've refined the artwork based on your feedback. How does this look?" }] }));
      }
    } catch (e: any) {
      alert("manus AI refinement failed: " + e.message);
      setChats(prev => ({ ...prev, ['cover']: [...(prev['cover'] || []), { role: 'model', text: `Failed to refine: ${e.message}` }] }));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const stripHtmlTags = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleSaveCover = async () => {
    if (!assets.coverUrl) return;
    await saveProject({
      id: projectId,
      title: bookDetails.title || assets?.metadata?.title || (chapters.length > 0 ? chapters[0].title : null) || (idea ? idea.substring(0, 30) + '...' : 'Untitled Project'),
      updatedAt: Date.now(),
      item_idea: idea,
      idea,
      category,
      research,
      outline,
      chapters,
      assets,
      bookDetails,
      chats
    });
    setCoverSaveNotice(true);
    setTimeout(() => setCoverSaveNotice(false), 3000);
  };

  const handleDeleteCover = () => {
    if (window.confirm("Are you sure you want to delete this book cover?")) {
      setAssets(prev => {
        const next = { ...prev };
        delete next.coverUrl;
        return next;
      });
      setShowCoverEditor(false);
    }
  };

  const fillWrappedCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    if (!text) return y;
    const paragraphs = text.split('\n');
    let currentY = y;

    for (const p of paragraphs) {
      if (!p.trim()) {
        currentY += lineHeight * 0.5;
        continue;
      }
      const words = p.split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      currentY += lineHeight * 1.2;
    }
    return currentY;
  };

  const generateValidIsbn13 = (): string => {
    const prefix = "978";
    const group = "1";
    const publisher = Math.floor(1000 + Math.random() * 9000).toString();
    const titleNum = Math.floor(100 + Math.random() * 900).toString();
    const raw = `${prefix}${group}${publisher}${titleNum}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(raw[i], 10);
      sum += (i % 2 === 0) ? d : d * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return `${prefix}-${group}-${publisher}-${titleNum}-${check}`;
  };

  const drawBarcodeOnCanvas = (ctx: CanvasRenderingContext2D, isbnStr: string, x: number, y: number, width: number, height: number) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#000000';
    const startX = x + 15;
    const barY = y + 15;
    const barHeight = height - 42;
    const availWidth = width - 30;

    const numBars = 42;
    const unit = availWidth / (numBars * 1.4);
    let curX = startX;

    for (let i = 0; i < numBars; i++) {
      const isThick = (isbnStr.charCodeAt(i % isbnStr.length) + i) % 3 === 0;
      const bw = isThick ? unit * 2.2 : unit * 1.1;
      const isSpace = (i % 6 === 0);
      if (!isSpace && curX + bw < x + width - 15) {
        ctx.fillRect(curX, barY, bw, barHeight);
      }
      curX += bw + unit * 0.8;
    }

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ISBN ${isbnStr}`, x + width / 2, y + height - 10);
    ctx.restore();
  };

  const handleDownloadCanvasPng = async (mode: 'front' | 'back' | 'wrap' | 'acx') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentIsbn = mockIsbn || '978-1-960123-45-6';
    const titleText = bookDetails.title || assets.metadata?.title || 'Book Title';
    const subtitleText = bookDetails.subtitle || assets.metadata?.subtitle || '';
    const authorText = bookDetails.authorName || user?.displayName || 'Author Name';
    const blurbText = stripHtmlTags(assets.backCoverContent || bookDetails.description) || 'A compelling narrative crafted with manus AI.';

    if (mode === 'acx') {
      // ACX Audible Audiobook Cover Standard: 2400 x 2400 px @ 300 DPI (1:1 Square)
      canvas.width = 2400;
      canvas.height = 2400;

      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (assets.coverUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = assets.coverUrl!;
        });
      }

      if (showCoverTextOverlay) {
        if (coverOverlayDarkness !== 'none') {
          const opacity = coverOverlayDarkness === 'subtle' ? 0.25 : coverOverlayDarkness === 'dark' ? 0.65 : 0.45;
          ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = 'bold 110px serif';
        fillWrappedCanvasText(ctx, titleText.toUpperCase(), 1200, 380, 2100, 130);

        if (subtitleText) {
          ctx.font = 'italic 54px sans-serif';
          fillWrappedCanvasText(ctx, subtitleText, 1200, 780, 2000, 72);
        }

        ctx.font = 'bold 68px sans-serif';
        ctx.fillText(authorText.toUpperCase(), 1200, 2100);
      }

      downloadBase64(canvas.toDataURL('image/jpeg', 0.98), `${titleText.toLowerCase().replace(/\s+/g, '_')}_ACX_Audiobook_Cover_2400x2400.jpg`);
    } else if (mode === 'front') {
      // Amazon KDP Kindle eBook Cover Standard: 1600 x 2560 px (1:1.6 aspect ratio @ 300 DPI)
      canvas.width = 1600;
      canvas.height = 2560;

      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (assets.coverUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = assets.coverUrl!;
        });
      }

      if (showCoverTextOverlay) {
        if (coverOverlayDarkness !== 'none') {
          const opacity = coverOverlayDarkness === 'subtle' ? 0.25 : coverOverlayDarkness === 'dark' ? 0.65 : 0.45;
          ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = 'bold 96px sans-serif';
        fillWrappedCanvasText(ctx, titleText.toUpperCase(), 800, 320, 1380, 110);

        if (subtitleText) {
          ctx.font = 'italic 48px sans-serif';
          fillWrappedCanvasText(ctx, subtitleText, 800, 700, 1380, 64);
        }

        ctx.font = 'bold 56px serif';
        ctx.fillText(authorText.toUpperCase(), 800, 2280);
      }

      downloadBase64(canvas.toDataURL('image/jpeg', 0.95), `${titleText.toLowerCase().replace(/\s+/g, '_')}_KDP_Kindle_eBook_Cover_1600x2560.jpg`);
    } else if (mode === 'back') {
      // Amazon KDP 300 DPI Back Cover: 1800 x 2700 px (6x9 in)
      canvas.width = 1800;
      canvas.height = 2700;

      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';

      ctx.font = 'bold 78px sans-serif';
      fillWrappedCanvasText(ctx, titleText.toUpperCase(), 900, 260, 1500, 96);

      if (subtitleText) {
        ctx.font = 'italic 42px sans-serif';
        ctx.fillStyle = '#e4e4e7';
        fillWrappedCanvasText(ctx, subtitleText, 900, 480, 1400, 58);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(300, 580);
      ctx.lineTo(1500, 580);
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '38px sans-serif';
      ctx.textAlign = 'left';
      fillWrappedCanvasText(ctx, blurbText, 180, 680, 1440, 60);

      if (showBarcodeOnBack) {
        // Amazon KDP barcode safety box: 600 x 360 px @ 300 DPI
        drawBarcodeOnCanvas(ctx, currentIsbn, 1100, 2200, 550, 320);
      }

      downloadBase64(canvas.toDataURL('image/png'), `${titleText.toLowerCase().replace(/\s+/g, '_')}_KDP_Back_Cover_300dpi.png`);
    } else {
      // Amazon KDP Paperback Full Cover Spread at 300 DPI
      // 6x9 Trim size = 1800 x 2700 px @ 300 DPI per cover
      // Bleed = 0.125 inches = 37.5 px on top, bottom, left, right (total height = 2776 px)
      // Spine width @ 300 DPI = Math.max(30, spinePageCount * 0.00225 * 300)
      const bleedPx = 38; // 0.125" bleed at 300 DPI
      const trimWidthPx = 1800; // 6.0" at 300 DPI
      const trimHeightPx = 2700; // 9.0" at 300 DPI
      const canvasHeight = trimHeightPx + bleedPx * 2; // 2776 px

      const calculatedSpineInches = Math.max(0.1, spinePageCount * 0.00225);
      const spineWidthPx = Math.round(calculatedSpineInches * 300);

      const totalCanvasWidth = bleedPx * 2 + trimWidthPx * 2 + spineWidthPx;

      canvas.width = totalCanvasWidth;
      canvas.height = canvasHeight;

      const backX = bleedPx;
      const spineX = backX + trimWidthPx;
      const frontX = spineX + spineWidthPx;

      // Fill background across entire spread
      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, totalCanvasWidth, canvasHeight);

      // 1. Back Cover Panel
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 78px sans-serif';
      fillWrappedCanvasText(ctx, titleText.toUpperCase(), backX + trimWidthPx / 2, bleedPx + 240, 1500, 96);

      if (subtitleText) {
        ctx.font = 'italic 42px sans-serif';
        ctx.fillStyle = '#e4e4e7';
        fillWrappedCanvasText(ctx, subtitleText, backX + trimWidthPx / 2, bleedPx + 460, 1400, 58);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(backX + 200, bleedPx + 560);
      ctx.lineTo(backX + trimWidthPx - 200, bleedPx + 560);
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'left';
      fillWrappedCanvasText(ctx, blurbText, backX + 180, bleedPx + 660, 1440, 56);

      if (showBarcodeOnBack) {
        // Amazon KDP standard barcode safety area: 2.0" x 1.2" (600 x 360 px at 300 DPI)
        // Placed 0.25" (75 px) from spine and bottom bleed
        const barcodeWidth = 550;
        const barcodeHeight = 320;
        const barcodeX = spineX - barcodeWidth - 75;
        const barcodeY = canvasHeight - bleedPx - barcodeHeight - 75;
        drawBarcodeOnCanvas(ctx, currentIsbn, barcodeX, barcodeY, barcodeWidth, barcodeHeight);
      }

      // 2. Spine Panel
      ctx.fillStyle = spineBgColor || backBgColor || '#18181b';
      ctx.fillRect(spineX, 0, spineWidthPx, canvasHeight);

      // Fold Safety Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 16]);
      ctx.beginPath();
      ctx.moveTo(spineX, 0);
      ctx.lineTo(spineX, canvasHeight);
      ctx.moveTo(spineX + spineWidthPx, 0);
      ctx.lineTo(spineX + spineWidthPx, canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spine Text (rotated 90 degrees clockwise)
      if (spineWidthPx >= 45) { // Only render text if spine is wide enough (>= 0.15 in, ~79 pages)
        ctx.save();
        const spineCenterX = spineX + spineWidthPx / 2;
        ctx.translate(spineCenterX, canvasHeight / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = spineTextColor || '#ffffff';
        ctx.textAlign = 'center';
        const fontSize = Math.min(48, Math.max(22, spineWidthPx * 0.4));
        ctx.font = `bold ${Math.round(fontSize)}px sans-serif`;
        ctx.fillText(`${titleText.toUpperCase()}   —   ${authorText.toUpperCase()}`, 0, fontSize * 0.3);
        ctx.restore();
      }

      // 3. Front Cover Panel
      if (assets.coverUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, frontX, 0, trimWidthPx + bleedPx, canvasHeight);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = assets.coverUrl!;
        });
      } else {
        ctx.fillStyle = backBgColor || '#18181b';
        ctx.fillRect(frontX, 0, trimWidthPx + bleedPx, canvasHeight);
      }

      if (showCoverTextOverlay) {
        if (coverOverlayDarkness !== 'none') {
          const opacity = coverOverlayDarkness === 'subtle' ? 0.25 : coverOverlayDarkness === 'dark' ? 0.65 : 0.45;
          ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
          ctx.fillRect(frontX, 0, trimWidthPx + bleedPx, canvasHeight);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = 'bold 96px sans-serif';
        fillWrappedCanvasText(ctx, titleText.toUpperCase(), frontX + trimWidthPx / 2, bleedPx + 320, 1450, 110);

        if (subtitleText) {
          ctx.font = 'italic 48px sans-serif';
          fillWrappedCanvasText(ctx, subtitleText, frontX + trimWidthPx / 2, bleedPx + 700, 1400, 64);
        }

        ctx.font = 'bold 56px serif';
        ctx.fillText(authorText.toUpperCase(), frontX + trimWidthPx / 2, canvasHeight - bleedPx - 240);
      }

      downloadBase64(canvas.toDataURL('image/png'), `${titleText.toLowerCase().replace(/\s+/g, '_')}_KDP_Paperback_Full_Cover_Spread_300DPI.png`);
    }
  };

  const handleSuggestMetadata = async () => {
    const contextParts: string[] = [];
    if (idea.trim()) contextParts.push(`Book Concept / Idea:\n${idea.trim()}`);
    if (bookDetails.title.trim()) contextParts.push(`Current Book Title:\n${bookDetails.title.trim()}`);
    if (bookDetails.subtitle.trim()) contextParts.push(`Current Subtitle:\n${bookDetails.subtitle.trim()}`);
    if (bookDetails.description.trim()) contextParts.push(`Current Description:\n${bookDetails.description.trim()}`);
    if (outline.trim()) contextParts.push(`Book Outline:\n${outline.trim()}`);
    if (chapters.length > 0) {
      const chapterList = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
      const excerpts = chapters.slice(0, 3).map(c => `Chapter: ${c.title}\nExcerpt:\n${c.content.substring(0, 600)}`).join('\n\n');
      contextParts.push(`Chapter Overview:\n${chapterList}\n\nManuscript Excerpts:\n${excerpts}`);
    }

    const sourceConcept = contextParts.join('\n\n').trim();

    if (!sourceConcept) {
      alert("Please define your book idea in Project Setup, write an outline, or enter a title first before running Magic Fill.");
      return;
    }
    
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Scanning Manuscript & Researching Market Trends...');
    try {
      pushHistorySnapshot("Before Magic Fill metadata optimization");
      const meta = await optimizeMetadata(sourceConcept, customApiKey, bookDetails?.language || 'English');
      if (meta) {
        const keywords = formatMetadataKeywords(meta.keywords);
        const categories = formatMetadataCategories(meta.categories);

        setBookDetails(prev => ({
          ...prev,
          title: meta.title || prev.title || '',
          subtitle: meta.subtitle || prev.subtitle || '',
          authorName: meta.author_name || prev.authorName || user?.displayName || '',
          description: meta.description_html || prev.description || '',
          keywords: keywords.some(k => k.trim()) ? keywords : prev.keywords,
          categories: categories.some(c => c.trim()) ? categories : prev.categories,
          pricing: meta.suggested_price || prev.pricing || '$9.99',
          trimSize: meta.trim_size || prev.trimSize || '6x9',
          metadata: meta
        }));

        setHistoryNotice("Magic Fill complete: Title, blurb, 7 keywords, and 3 BISAC categories updated!");
        setTimeout(() => setHistoryNotice(null), 3500);
      }
    } catch (e: any) {
      handleApiError(e, "Failed to optimize metadata");
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleGenerateKeywordsOnly = async () => {
    const currentTitle = bookDetails.title || idea;
    if (!currentTitle.trim()) {
      alert("Please enter a book title or idea first so AI can generate relevant keywords!");
      return;
    }

    setIsGenerating(true);
    setGeneratingStep("KDP Agent: Generating 7 target search keywords specifically for this book...");
    try {
      pushHistorySnapshot("Before generating keywords for current book");
      const kwList = await generateBookKeywords(bookDetails, idea, chapters, customApiKey);
      if (kwList && kwList.length > 0) {
        const formatted = formatMetadataKeywords(kwList);
        setBookDetails(prev => ({
          ...prev,
          keywords: formatted
        }));
        setHistoryNotice("Updated 7 KDP backend keywords specifically for this book!");
        setTimeout(() => setHistoryNotice(null), 3500);
      }
    } catch (e: any) {
      let msg = e?.message || "Unknown error";
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429") || msg.includes("quota")) {
        setHistoryNotice("Quota limit reached. Auto-extracted keywords applied from book content!");
      } else {
        setHistoryNotice("Keywords updated from book details.");
      }
      setTimeout(() => setHistoryNotice(null), 4000);
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
    }
  };

  const handleGenerateTOC = () => {
    pushHistorySnapshot("Before generating Table of Contents");
    const tocMd = "# Table of Contents\n\n" + chapters.map((c, i) => `${i + 1}. [${c.title}](#${c.id})`).join('\n');
    setOutline(prev => {
      if (prev.includes("# Table of Contents")) {
        return prev.replace(/# Table of Contents[\s\S]*?\n\n/g, tocMd + "\n\n");
      }
      return tocMd + "\n\n" + prev;
    });
    setHistoryNotice("Table of Contents prepended to outline. Click Undo if needed.");
    setTimeout(() => setHistoryNotice(null), 3000);
    setViewMode('outline');
  };

  const handleAddChapter = () => {
    pushHistorySnapshot("Before adding new chapter");
    const newChapter: Chapter = {
      id: Math.random().toString(36).substring(7),
      title: 'New Chapter',
      content: '',
      status: 'idle'
    };
    setChapters(prev => [...prev, newChapter]);
    setActiveChapterId(newChapter.id);
    setViewMode('chapter');
  };

  const handleRenameChapter = (id: string, newTitle: string) => {
    pushHistorySnapshot(`Before renaming chapter to "${newTitle}"`);
    setChapters(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleMoveChapter = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    pushHistorySnapshot(`Before moving chapter "${chapters[index].title}"`);
    setChapters(prev => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleDragStartChapter = (index: number) => {
    setDraggedChapterIndex(index);
  };

  const handleDragOverChapter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropChapter = (index: number) => {
    if (draggedChapterIndex === null || draggedChapterIndex === index) return;
    pushHistorySnapshot(`Before reordering chapters via drag-and-drop`);
    setChapters(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedChapterIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDraggedChapterIndex(null);
  };

  const handleAddAuthorPage = () => {
    pushHistorySnapshot("Before adding Author Page");
    const existing = chapters.find(c => c.title.toLowerCase().includes('about the author'));
    if (existing) {
      setActiveChapterId(existing.id);
      setViewMode('chapter');
      setHistoryNotice("Author Page already exists in manuscript.");
      setTimeout(() => setHistoryNotice(null), 3000);
      return;
    }
    const newChapter: Chapter = {
      id: Math.random().toString(36).substring(7),
      title: 'About the Author',
      content: bookDetails.aboutAuthor || '# About the Author\n\n[Write your bio here...]',
      status: 'done'
    };
    setChapters(prev => [...prev, newChapter]);
    setActiveChapterId(newChapter.id);
    setViewMode('chapter');
    setHistoryNotice("Added single Author Page to book manuscript. Click Undo to revert.");
    setTimeout(() => setHistoryNotice(null), 3500);
  };

  const handleDeleteChapter = (id: string) => {
    const target = chapters.find(c => c.id === id);
    if (target) {
      setChapterToDelete(target);
    }
  };

  const confirmDeleteChapter = () => {
    if (!chapterToDelete) return;
    const target = chapterToDelete;
    pushHistorySnapshot(`Before deleting ${target.title}`);
    setChapters(prev => prev.filter(c => c.id !== target.id));
    if (activeChapterId === target.id) {
      setActiveChapterId(null);
      setViewMode('outline');
    }
    setHistoryNotice(`Deleted "${target.title}". Click Undo to restore.`);
    setTimeout(() => setHistoryNotice(null), 4000);
    setChapterToDelete(null);
  };

  const handleManuscriptAudit = async () => {
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Auditing entire manuscript for consistency...');
    try {
      const fullManuscript = chapters.map(c => `Chapter: ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
      const docId = 'manuscript-audit';
      const newMessage: ChatMessage = { 
        role: 'user', 
        text: "Please audit the entire manuscript for consistency, tone, and logical flow. Provide a detailed report of improvements."
      };
      
      setChats(prev => ({ ...prev, [docId]: [newMessage] }));
      setIsChatting(true);
      
      const { replyText } = await sendChatMessage(
        newMessage.text,
        [],
        fullManuscript,
        'manuscript',
        customApiKey,
        'ghostwriter',
        [],
        bookDetails?.language || 'English',
        chapters.map(c => ({ id: c.id, title: c.title, content: c.content })),
        outline,
        null
      );

      setChats(prev => ({
        ...prev,
        [docId]: [newMessage, { role: 'model', text: replyText }]
      }));
      
      // Navigate to a view where they can see this? 
      // Let's use a special view or just the outline chat.
      setActiveChapterId(null);
      setChats(prev => ({ ...prev, ['outline']: [...(prev['outline'] || []), { role: 'model', text: "### Manuscript Consistency Audit:\n\n" + replyText }] }));
      setViewMode('outline');
      alert("Manuscript Audit complete. Check the Outline Chat for the report.");
    } catch (e: any) {
      alert("Audit failed: " + e.message);
    } finally {
      setIsGenerating(false);
      setIsChatting(false);
      setGeneratingStep('');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && pendingAttachments.length === 0) return;
    
    const docId = viewMode === 'outline' ? 'outline' : (activeChapterId || 'general');

    const currentDocContent = viewMode === 'outline' 
      ? outline 
      : (activeChapterId 
          ? (chapters.find(c => c.id === activeChapterId)?.content || '') 
          : chapters.map((c, i) => `# Chapter ${i + 1}: ${c.title}\n\n${c.content}`).join('\n\n---\n\n'));

    const docType: 'outline' | 'chapter' = viewMode === 'outline' ? 'outline' : 'chapter';

    const newMessage: ChatMessage = { 
      role: 'user', 
      text: chatInput,
      attachments: pendingAttachments.map(a => ({ name: a.name || 'file', mimeType: a.mimeType, data: a.data }))
    };
    const history = chats[docId] || [];
    const updatedHistory = [...history, newMessage];
    
    setChats(prev => ({ ...prev, [docId]: updatedHistory }));
    
    const sendingInput = chatInput;
    const sendingHistory = history.map(m => ({ role: m.role, text: m.text }));
    const sendingAttachments = [...pendingAttachments];

    setChatInput('');
    setPendingAttachments([]);
    setIsChatting(true);

    try {
      const { replyText, revisedContent, updatedOutline, updatedChapters } = await sendChatMessage(
        sendingInput,
        sendingHistory,
        currentDocContent,
        docType,
        customApiKey,
        chatAgent,
        sendingAttachments,
        bookDetails?.language || 'English',
        chapters.map(c => ({ id: c.id, title: c.title, content: c.content })),
        outline,
        activeChapterId
      );

      // Extract learned style/editorial rules from user feedback
      if (sendingInput && sendingInput.trim().length >= 5) {
        const activeChTitle = activeChapterId ? (chapters.find(c => c.id === activeChapterId)?.title || 'Chapter') : 'Manuscript';
        extractLearnedRulesFromFeedback(
          sendingInput,
          currentDocContent,
          revisedContent || (updatedChapters && updatedChapters.length > 0 ? updatedChapters[0].content : ''),
          activeChTitle,
          customApiKey
        ).then(newRules => {
          if (newRules && newRules.length > 0) {
            setContinuityMemory(prev => {
              const existingSet = new Set(prev.learnedRules.map(r => r.rule.toLowerCase().trim()));
              const filtered = newRules.filter(r => !existingSet.has(r.rule.toLowerCase().trim()));
              if (filtered.length === 0) return prev;
              return {
                ...prev,
                learnedRules: [...prev.learnedRules, ...filtered]
              };
            });
          }
        }).catch(err => console.warn("Failed to extract rules from feedback:", err));
      }

      // Save state snapshot before applying AI modifications
      if (updatedOutline || (revisedContent && viewMode === 'outline') || (updatedChapters && updatedChapters.length > 0) || (revisedContent && docType === 'chapter')) {
        pushHistorySnapshot("Before AI document edit");
      }

      // 1. Track applied updates for user feedback
      const appliedTitles: string[] = [];
      let outlineUpdated = false;

      // Update Outline if returned
      if (updatedOutline) {
        setOutline(updatedOutline);
        outlineUpdated = true;
      } else if (revisedContent && viewMode === 'outline') {
        setOutline(revisedContent);
        outlineUpdated = true;
      }

      // 2. Update Chapters if returned
      if (updatedChapters && updatedChapters.length > 0) {
        setChapters(prev => {
          let next = [...prev];
          updatedChapters.forEach(upCh => {
            if (!upCh.content) return;

            let matchIdx = -1;
            // Strategy A: Try exact ID or case-insensitive ID match
            if (upCh.id) {
              matchIdx = next.findIndex(c => c.id === upCh.id || c.id.toLowerCase() === upCh.id.toLowerCase());
            }

            // Strategy B: Try numeric index match (e.g. "Chapter 1", "Ch 1", or ID "1")
            if (matchIdx === -1 && (upCh.id || upCh.title)) {
              const idOrTitle = `${upCh.id || ''} ${upCh.title || ''}`;
              const numMatch = idOrTitle.match(/(?:chapter|ch\.?)\s*(\d+)/i) || idOrTitle.match(/^(\d+)$/);
              if (numMatch) {
                const chNum = parseInt(numMatch[1], 10);
                if (chNum >= 1 && chNum <= next.length) {
                  matchIdx = chNum - 1;
                }
              }
            }

            // Strategy C: Try clean title match
            if (matchIdx === -1 && upCh.title) {
              const cleanTargetTitle = upCh.title.toLowerCase().replace(/^chapter\s*\d+:?\s*/i, '').trim();
              matchIdx = next.findIndex(c => {
                const cleanTitle = c.title.toLowerCase().replace(/^chapter\s*\d+:?\s*/i, '').trim();
                return cleanTitle.length > 2 && (
                  cleanTitle === cleanTargetTitle ||
                  cleanTitle.includes(cleanTargetTitle) ||
                  cleanTargetTitle.includes(cleanTitle)
                );
              });
            }

            // Strategy D: Fallback for single chapter update when viewing a chapter
            if (matchIdx === -1 && updatedChapters.length === 1 && activeChapterId) {
              matchIdx = next.findIndex(c => c.id === activeChapterId);
            }

            // Strategy E: Fallback if only 1 chapter exists in the manuscript
            if (matchIdx === -1 && updatedChapters.length === 1 && next.length === 1) {
              matchIdx = 0;
            }

            if (matchIdx !== -1) {
              next[matchIdx] = {
                ...next[matchIdx],
                content: upCh.content,
                status: 'done'
              };
              appliedTitles.push(next[matchIdx].title);
            } else if (upCh.id === 'NEW_CHAPTER' || (upCh.title && upCh.title.toLowerCase().includes('new chapter'))) {
              const newTitle = upCh.title || `Chapter ${next.length + 1}`;
              next.push({
                id: Math.random().toString(36).substring(7),
                title: newTitle,
                content: upCh.content,
                status: 'done'
              });
              appliedTitles.push(newTitle);
            }
          });
          return next;
        });
      } else if (revisedContent && (activeChapterId || chapters.length === 1)) {
        const targetId = activeChapterId || (chapters.length === 1 ? chapters[0].id : null);
        if (targetId) {
          setChapters(prev => prev.map(c => {
            if (c.id === targetId) {
              appliedTitles.push(c.title);
              return { ...c, content: revisedContent, status: 'done' };
            }
            return c;
          }));
        }
      }

      // Build status badge for chat response
      let finalReplyText = replyText;
      if (outlineUpdated) {
        finalReplyText += `\n\n> ✨ **Live Document Updated**: Book outline has been updated directly in the editor!`;
      } else if (appliedTitles.length > 0) {
        const uniqueTitles = Array.from(new Set(appliedTitles));
        finalReplyText += `\n\n> ✨ **Live Document Updated**: Applied revised content to **${uniqueTitles.join(', ')}** in the manuscript editor!`;
      }

      setChats(prev => ({
        ...prev,
        [docId]: [...updatedHistory, { role: 'model', text: finalReplyText }]
      }));
    } catch (error: any) {
      console.error(error);
      let errorMessage = error?.message || "Sorry, an error occurred.";
      if (typeof errorMessage === 'string' && (errorMessage.includes('<!DOCTYPE html>') || errorMessage.includes('<html'))) {
        if (errorMessage.includes('PayloadTooLargeError') || errorMessage.includes('entity too large')) {
          errorMessage = "Payload Too Large: The request payload exceeded the server body size limit. Please try sending shorter context or smaller attachments.";
        } else {
          errorMessage = "Server Error: The proxy server returned an error page. Please try again.";
        }
      }
      setChats(prev => ({
        ...prev,
        [docId]: [...updatedHistory, { role: 'model', text: `Error: ${errorMessage}` }]
      }));
    } finally {
      setIsChatting(false);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBase64 = (base64Data: string, filename: string) => {
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const generatePlaceholderIsbn = () => {
    // Generate a mathematically valid EAN-13 ISBN-13
    const prefix = "978";
    const group = "1"; // English speaking
    const publisher = Math.floor(100000 + Math.random() * 900000).toString().substring(0, 4);
    const title = Math.floor(1000 + Math.random() * 9000).toString().substring(0, 4);
    
    const first12 = `${prefix}${group}${publisher}${title}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(first12[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    
    setMockIsbn(`${prefix}-${group}-${publisher}-${title}-${check}`);
  };

  const [chatAgent, setChatAgent] = useState<'ghostwriter' | 'art_director'>('ghostwriter');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [coverEditInput, setCoverEditInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setPendingAttachments(prev => [...prev, {
          mimeType: file.type || 'application/octet-stream',
          data: base64,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          setPendingAttachments(prev => [...prev, {
            mimeType: blob.type,
            data: base64,
            name: `pasted-image-${Date.now()}.png`
          }]);
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // We fetch standard chats from state.
  const activeChatHistory = chats[viewMode === 'outline' ? 'outline' : (activeChapterId || '')] || [];

  const handleImageUpload = (altId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageBag(prev => ({ ...prev, [altId]: event.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      if (inline) {
        return (
          <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto my-4 border border-slate-800 leading-relaxed shadow-sm whitespace-pre">
          <code>{children}</code>
        </pre>
      );
    },
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-6 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead className="bg-zinc-100 dark:bg-zinc-800/80 font-semibold text-zinc-900 dark:text-zinc-100">{children}</thead>;
    },
    tbody({ children }: any) {
      return <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">{children}</tbody>;
    },
    th({ children }: any) {
      return <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300">{children}</th>;
    },
    td({ children }: any) {
      return <td className="px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">{children}</td>;
    },
    blockquote({ children }: any) {
      return (
        <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-zinc-700 dark:text-zinc-300 px-4 py-3 my-4 rounded-r-xl italic text-sm">
          {children}
        </blockquote>
      );
    },
    hr() {
      return <hr className="my-8 border-zinc-200 dark:border-zinc-800" />;
    },
    img: ({ node, ...props }: any) => {
      const src = props.src || '';
      const alt = props.alt || 'Visual Illustration';
      const altId = alt || src || Math.random().toString();

      const ImageRenderer = () => {
        const isAsset = src.startsWith('asset:');
        const assetId = isAsset ? src.replace('asset:', '').trim() : '';
        const isPlaceholder = src.startsWith('placeholder:') || src === 'placeholder' || src === '';

        const illustration = isAsset ? chapterIllustrations.find(i => i.id === assetId) : undefined;
        const storedImage = illustration?.imageUrl || imageBag[altId] || (src.startsWith('data:') || src.startsWith('http') ? src : null);

        const [isGenerating, setIsGenerating] = useState(false);
        const [isEditingPrompt, setIsEditingPrompt] = useState(false);
        const [refineText, setRefineText] = useState(illustration?.prompt || alt || '');
        const fileInputRef = useRef<HTMLInputElement>(null);

        // Action: Generate or Re-generate with Nano Banana
        const handleGenerateOrRegenerate = async (customPrompt?: string) => {
          setIsGenerating(true);
          try {
            const promptToUse = customPrompt || refineText || alt || 'Technical Architecture Blueprint';
            const activeChap = chapters.find(c => c.id === activeChapterId);
            const isGuides = category === 'guides' || category === 'white_paper';

            const b64 = await generateSceneIllustrationWithNanoBanana({
              scenePrompt: promptToUse,
              chapterTitle: activeChap?.title || 'Chapter',
              colorMode: illustration?.colorMode || 'color',
              artStyle: illustration?.artStyle || (isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration'),
              aspectRatio: (illustration?.aspectRatio as any) || (isGuides ? '16:9' : '4:3'),
              bookCategory: category,
              apiKey: customApiKey
            });

            if (b64) {
              if (isAsset && illustration) {
                // Update existing illustration in-place
                const updated = chapterIllustrations.map(i => i.id === assetId ? { ...i, imageUrl: b64, prompt: promptToUse } : i);
                setChapterIllustrations(updated);
                setIsEditingPrompt(false);
                pushHistorySnapshot('Regenerated manuscript visual');
              } else {
                // Create new illustration and replace placeholder in markdown
                const newId = 'illus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                const newIll: ChapterIllustration = {
                  id: newId,
                  chapterId: activeChapterId || 'chapter',
                  sceneTitle: (alt || 'Manuscript Visual').slice(0, 50),
                  prompt: promptToUse,
                  imageUrl: b64,
                  colorMode: 'color',
                  artStyle: isGuides ? 'Modern Tech & SaaS Vector' : 'Digital Illustration',
                  aspectRatio: isGuides ? '16:9' : '4:3',
                  characterNamesUsed: [],
                  createdAt: Date.now(),
                  insertedInMarkdown: true
                };
                setChapterIllustrations(prev => [newIll, ...prev]);

                if (activeChapterId) {
                  setChapters(prev => prev.map(c => {
                    if (c.id !== activeChapterId) return c;
                    const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedSrc}\\)`, 'g');
                    let newContent = c.content.replace(pattern, `![${alt}](asset:${newId})`);
                    if (newContent === c.content) {
                      const escapedAlt = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const altPattern = new RegExp(`!\\[${escapedAlt}\\]\\([^\\)]*\\)`, 'g');
                      newContent = c.content.replace(altPattern, `![${alt}](asset:${newId})`);
                    }
                    return { ...c, content: newContent };
                  }));
                }
                pushHistorySnapshot('Generated indicated visual for manuscript');
              }
            } else {
              alert('Image generation returned empty data.');
            }
          } catch (err: any) {
            console.error(err);
            alert('Failed to generate visual: ' + (err.message || 'Unknown error'));
          } finally {
            setIsGenerating(false);
          }
        };

        // Action: Upload custom replacement
        const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (isAsset && illustration) {
              const updated = chapterIllustrations.map(i => i.id === assetId ? { ...i, imageUrl: dataUrl } : i);
              setChapterIllustrations(updated);
            } else {
              const newId = 'illus_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
              const newIll: ChapterIllustration = {
                id: newId,
                chapterId: activeChapterId || 'chapter',
                sceneTitle: (alt || 'Custom Visual').slice(0, 50),
                prompt: alt,
                imageUrl: dataUrl,
                colorMode: 'color',
                artStyle: 'Custom Upload',
                aspectRatio: '16:9',
                characterNamesUsed: [],
                createdAt: Date.now(),
                insertedInMarkdown: true
              };
              setChapterIllustrations(prev => [newIll, ...prev]);
              if (activeChapterId) {
                setChapters(prev => prev.map(c => {
                  if (c.id !== activeChapterId) return c;
                  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedSrc}\\)`, 'g');
                  let newContent = c.content.replace(pattern, `![${alt}](asset:${newId})`);
                  if (newContent === c.content) {
                    const escapedAlt = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const altPattern = new RegExp(`!\\[${escapedAlt}\\]\\([^\\)]*\\)`, 'g');
                    newContent = c.content.replace(altPattern, `![${alt}](asset:${newId})`);
                  }
                  return { ...c, content: newContent };
                }));
              }
            }
            pushHistorySnapshot('Uploaded custom visual into manuscript');
          };
          reader.readAsDataURL(file);
        };

        // Action: Delete from manuscript
        const handleDeleteFromManuscript = () => {
          if (!confirm(`Delete this visual from the manuscript?\n\n"${alt}"`)) return;
          if (activeChapterId) {
            setChapters(prev => prev.map(c => {
              if (c.id !== activeChapterId) return c;
              const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const pattern = new RegExp(`\\n*!\\[[^\\]]*\\]\\(${escapedSrc}\\)\\n*`, 'g');
              let newContent = c.content.replace(pattern, '\n\n');
              if (newContent === c.content) {
                const escapedAlt = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const altPattern = new RegExp(`\\n*!\\[${escapedAlt}\\]\\([^\\)]*\\)\\n*`, 'g');
                newContent = c.content.replace(altPattern, '\n\n');
              }
              return { ...c, content: newContent.trim() };
            }));
          }
          if (isAsset && assetId) {
            setChapterIllustrations(prev => prev.filter(i => i.id !== assetId));
          }
          pushHistorySnapshot('Deleted visual from manuscript');
        };

        // Action: Download high-res PNG
        const handleDownloadPng = () => {
          if (!storedImage) return;
          const a = document.createElement('a');
          a.href = storedImage;
          a.download = `${(alt || 'manuscript_visual').slice(0, 35).replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };

        // CASE 1: Unrendered Placeholder
        if (!storedImage && isPlaceholder) {
          return (
            <div className="my-6 border-2 border-dashed border-amber-300/80 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-indigo-50/50 rounded-2xl p-5 sm:p-6 text-center relative overflow-hidden transition-all shadow-xs">
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Indicated Visual Placeholder
                </h4>
                <p className="text-xs text-zinc-800 font-semibold">
                  "{alt || 'Visual Diagram / Concept'}"
                </p>
                <p className="text-[11px] text-zinc-500">
                  The manuscript indicates an illustrative graphic at this location.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleGenerateOrRegenerate()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-200" />}
                  <span>{isGenerating ? 'Generating Visual...' : '✨ Generate Visual (Nano Banana)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteFromManuscript}
                  className="px-3 py-2 text-zinc-400 hover:text-red-600 text-xs font-medium cursor-pointer"
                  title="Remove this placeholder marker"
                >
                  Dismiss
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </div>
          );
        }

        // CASE 2: Rendered Visual (Asset, Base64, or Stored Image)
        return (
          <div className="my-8 rounded-2xl border border-zinc-200/90 bg-zinc-900/5 p-2 sm:p-3 relative group transition-all hover:shadow-md">
            <div className="relative rounded-xl overflow-hidden bg-zinc-950 flex items-center justify-center border border-zinc-200">
              <img
                src={storedImage || src}
                alt={alt}
                className="w-full max-h-[520px] object-contain transition-transform hover:scale-[1.01]"
              />

              {/* Floating Quick Action Overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/20 shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                  className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Refine Prompt / Regenerate"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[11px] font-medium hidden sm:inline">Refine</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Upload Custom Image to Replace"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[11px] font-medium hidden sm:inline">Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors text-xs cursor-pointer"
                  title="Download High-Res PNG"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-300" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFromManuscript}
                  className="p-1.5 rounded-lg text-white hover:bg-red-500/80 transition-colors text-xs cursor-pointer"
                  title="Delete Image from Manuscript"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-300" />
                </button>
              </div>
            </div>

            {/* Hidden file input for Replace */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomUpload}
              className="hidden"
            />

            {/* Caption & Metadata Bar */}
            <div className="mt-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider border border-indigo-200">
                  {category === 'guides' ? 'Technical Diagram' : 'Manuscript Visual'}
                </span>
                <p className="text-zinc-700 font-medium italic truncate max-w-lg">
                  {alt}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                >
                  {isEditingPrompt ? 'Close Controls' : 'Edit / Refine'}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleDeleteFromManuscript}
                  className="text-red-500 hover:text-red-700 font-semibold underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Inline Refine / Regenerate Drawer */}
            {isEditingPrompt && (
              <div className="mt-3 p-3.5 bg-white border border-amber-200 rounded-xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Refine Visual Prompt (Nano Banana)
                  </span>
                  <span className="text-[10px] text-zinc-400">Category: {category}</span>
                </div>
                <textarea
                  rows={2}
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  placeholder="Refine visual details, composition, lighting, or specific UI elements..."
                  className="w-full text-xs p-2.5 border border-zinc-200 rounded-lg bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingPrompt(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-800 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => handleGenerateOrRegenerate(refineText)}
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isGenerating ? 'Re-rendering Visual...' : 'Re-generate Visual'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      return <ImageRenderer />;
    }
  };

  if (standalonePublishedPage) {
    const pBook = standalonePublishedPage.bookDetails || {};
    const pCopy = standalonePublishedPage.landingCopyData || {};
    const pCover = standalonePublishedPage.coverUrl;
    const pSocials = pBook.socials || {};

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-900 selection:text-purple-100">
        {/* Navigation Bar */}
        <nav className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-sm tracking-tight text-white">{pBook.title || 'Featured Book'}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#buy"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {pCopy.heroCtaText || 'Get Your Copy'}
            </a>
            <button
              onClick={() => {
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors underline"
            >
              Author Portal
            </button>
          </div>
        </nav>

        {/* Main Landing Page Body */}
        <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
          {/* Hero Section */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7 space-y-6">
              <span className="inline-block px-3.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-bold uppercase tracking-wider">
                Official Book Release
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white font-serif leading-tight">
                {pCopy.heroHeadline || pBook.title || 'Transformative New Release'}
              </h1>
              <p className="text-zinc-300 text-base md:text-lg leading-relaxed font-light">
                {pCopy.heroSubheadline || pBook.subtitle || pBook.description}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4" id="buy">
                <a
                  href="#buy"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Redirecting to retailer buy page...');
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:scale-[1.02] text-white font-bold text-sm rounded-2xl shadow-xl transition-all cursor-pointer"
                >
                  {pCopy.heroCtaText || 'Order Your Copy Now'}
                </a>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 pt-2">
                <span>By <strong className="text-white">{pBook.authorName || 'Author'}</strong></span>
                <span>•</span>
                <span>{pBook.category || 'Published Work'}</span>
                <span>•</span>
                <span>Available Worldwide</span>
              </div>
            </div>

            <div className="md:col-span-5 flex justify-center">
              {pCover ? (
                <img
                  src={pCover}
                  alt="Book Cover"
                  className="w-64 md:w-80 rounded-2xl shadow-2xl border border-zinc-700/60 transform hover:rotate-1 transition-transform duration-300"
                />
              ) : (
                <div className="w-64 h-96 rounded-2xl bg-gradient-to-br from-purple-900 via-indigo-950 to-zinc-900 border border-zinc-800 flex flex-col justify-between p-6 shadow-2xl">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Official Release</span>
                    <h3 className="text-xl font-bold font-serif text-white mt-2 leading-snug">{pBook.title || 'Book Title'}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{pBook.subtitle}</p>
                  </div>
                  <div className="text-xs font-semibold text-purple-300 border-t border-zinc-800 pt-3">
                    {pBook.authorName || 'Author Name'}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Description & Overview */}
          <section className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 md:p-10 space-y-6">
            <h2 className="text-2xl font-bold text-white font-serif flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-purple-400" /> About The Book
            </h2>
            <p className="text-zinc-300 leading-relaxed text-sm md:text-base whitespace-pre-line">
              {pBook.description || 'An inspiring and insightful reading journey.'}
            </p>

            {/* Author Social Media Handles & Media Links */}
            {pSocials && Object.values(pSocials).some(Boolean) && (
              <div className="pt-6 border-t border-zinc-800/80">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Connect With The Author</h4>
                <div className="flex flex-wrap gap-2.5">
                  {pSocials.twitter && (
                    <a href={pSocials.twitter.startsWith('http') ? pSocials.twitter : `https://x.com/${pSocials.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <span>𝕏</span> Twitter
                    </a>
                  )}
                  {pSocials.instagram && (
                    <a href={pSocials.instagram.startsWith('http') ? pSocials.instagram : `https://instagram.com/${pSocials.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <span>📸</span> Instagram
                    </a>
                  )}
                  {pSocials.linkedin && (
                    <a href={pSocials.linkedin.startsWith('http') ? pSocials.linkedin : `https://linkedin.com/in/${pSocials.linkedin}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <span>💼</span> LinkedIn
                    </a>
                  )}
                  {pSocials.website && (
                    <a href={pSocials.website.startsWith('http') ? pSocials.website : `https://${pSocials.website}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" /> Website
                    </a>
                  )}
                  {pSocials.newsletter && (
                    <a href={pSocials.newsletter.startsWith('http') ? pSocials.newsletter : `https://${pSocials.newsletter}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-pink-400" /> Substack / Newsletter
                    </a>
                  )}
                  {pSocials.tiktok && (
                    <a href={pSocials.tiktok.startsWith('http') ? pSocials.tiktok : `https://tiktok.com/@${pSocials.tiktok.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <span>🎵</span> TikTok / BookTok
                    </a>
                  )}
                  {pSocials.amazonAuthor && (
                    <a href={pSocials.amazonAuthor.startsWith('http') ? pSocials.amazonAuthor : `https://${pSocials.amazonAuthor}`} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-2">
                      <span>🛒</span> Amazon Author Page
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Sample Chapter Excerpt if available */}
          {standalonePublishedPage.sampleChapterText && (
            <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 md:p-10 space-y-4">
              <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" /> Sample Chapter Preview
              </h3>
              <div className="bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800/80 text-zinc-300 text-sm leading-relaxed prose prose-invert max-w-none">
                <Markdown>{standalonePublishedPage.sampleChapterText}</Markdown>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="text-center text-xs text-zinc-500 pt-8 border-t border-zinc-800 pb-12 space-y-2">
            <p>© {new Date().getFullYear()} {pBook.authorName || 'Author'}. All rights reserved.</p>
            <p className="text-zinc-600">Directly Published & Hosted on Google Cloud Platform</p>
          </footer>
        </main>
      </div>
    );
  }

  if (authChecking) {
    return <div className="flex h-screen items-center justify-center bg-zinc-50"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-zinc-900 text-white p-4 relative overflow-hidden">
        {/* Background gradient orb */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-zinc-800/90 backdrop-blur-xl p-10 rounded-3xl border border-zinc-700 shadow-2xl max-w-md w-full text-center relative z-10 space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg mx-auto mb-2">
              <BookOpen className="w-8 h-8 text-zinc-950" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">manus</h1>
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mt-1">Multi-User SaaS AI Publishing Suite</p>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
              Cloud-synced manuscript generator, 300 DPI print covers, audiobook synthesis, and PayPal subscription integration.
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl transition shadow-lg cursor-pointer text-sm"
              >
                <span>Sign In / Create Account</span>
              </button>
              <button
                onClick={loginWithGoogle}
                className="w-full bg-zinc-700/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-bold flex items-center justify-center gap-2 py-3 px-4 rounded-2xl transition cursor-pointer text-xs"
              >
                <span>Quick Sign in with Google</span>
              </button>
            </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => refreshLibrary()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Left Sidebar */}
      <aside className={`fixed md:relative z-40 bg-white border-r border-zinc-200 flex flex-col h-full flex-shrink-0 transition-all duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'w-[80vw] sm:w-64 md:w-16' : 'w-[80vw] sm:w-64 md:w-64'}`}>
        <div className={`p-4 border-b border-zinc-200 flex items-center ${sidebarCollapsed ? 'justify-between md:justify-center md:px-2' : 'justify-between'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
            {!sidebarCollapsed && <h1 className="text-base font-semibold tracking-tight">manus</h1>}
          </div>
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {/* User Account & Subscription Badge Widget */}
        <div className={`p-3.5 border-b border-zinc-200 flex flex-col ${sidebarCollapsed ? 'items-center justify-center' : 'gap-2.5'} bg-zinc-50/80`}>
           <div className="flex items-center gap-2.5 w-full">
             <img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'Author'}`} alt="User" className="w-8 h-8 rounded-full border border-zinc-200 shrink-0" referrerPolicy="no-referrer" title={user.displayName || 'User'} />
             {!sidebarCollapsed && (
               <div className="flex-1 overflow-hidden">
                   <div className="flex items-center justify-between gap-1">
                     <p className="text-xs font-bold text-zinc-900 truncate">{userProfile?.displayName || user.displayName || 'Author'}</p>
                     <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                       userProfile?.plan === 'agency' ? 'bg-indigo-600 text-white' :
                       userProfile?.plan === 'pro' ? 'bg-emerald-600 text-white' :
                       'bg-zinc-200 text-zinc-700'
                     }`}>
                       {userProfile?.plan || 'Free'}
                     </span>
                   </div>
                   <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
               </div>
             )}
           </div>

           {!sidebarCollapsed && (
             <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-200/80 w-full text-[10px]">
               <button
                 onClick={() => setIsSubscriptionModalOpen(true)}
                 className="text-blue-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                 title="Subscription Plans"
               >
                 <Sparkles className="w-3 h-3 text-amber-500" />
                 <span>PayPal SaaS</span>
               </button>
               <button
                 onClick={() => setIsAdminPayPalModalOpen(true)}
                 className="text-zinc-600 font-bold hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                 title="PayPal Admin API Settings"
               >
                 <Sliders className="w-3 h-3 text-blue-600" />
                 <span>Admin</span>
               </button>
               <button
                 onClick={logoutUser}
                 className="text-zinc-500 hover:text-red-600 font-medium cursor-pointer"
               >
                 Sign Out
               </button>
             </div>
           )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2 mb-6">
            <button
              onClick={() => { setViewMode('library'); setMobileMenuOpen(false); }}
              title={sidebarCollapsed ? "My Library" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Library className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>My Library</span>}
              </div>
            </button>
            <button
              onClick={handleCreateNewProject}
              title={sidebarCollapsed ? "New Manuscript" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'} rounded-lg text-sm font-medium transition-colors text-zinc-600 hover:bg-zinc-100`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Plus className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>New Manuscript</span>}
              </div>
            </button>
            <button
              onClick={() => setIsSupportAssistantOpen(true)}
              title={sidebarCollapsed ? "AI Support Assistant" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'} rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200/60 hover:border-blue-300 shadow-2xs cursor-pointer`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Bot className="w-4 h-4 shrink-0 text-blue-600" />
                {!sidebarCollapsed && (
                  <span className="flex items-center gap-1 font-bold">
                    <span>AI Support Expert</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                )}
              </div>
            </button>
          </nav>

          {projectId && (
            sidebarCollapsed ? (
              <div className="px-2 my-2 border-t border-zinc-100 pt-2 flex justify-center">
                <button 
                  onClick={handleManuscriptAudit}
                  title="manus AI Manuscript Audit"
                  className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors cursor-pointer"
                  disabled={isGenerating}
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="px-4 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                manus AI Pro
                <button 
                  onClick={handleManuscriptAudit}
                  title="manus AI Manuscript Audit"
                  className="text-yellow-600 hover:text-yellow-700 transition-colors cursor-pointer"
                  disabled={isGenerating}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}

          <nav className="space-y-1 px-2">
            <button
              onClick={() => { setViewMode('setup'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Project Setup" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'setup' ? 'bg-indigo-50 text-indigo-700' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Project Setup</span>}
            </button>
            <button
              onClick={() => { setViewMode('details'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Book Details" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'details' ? 'bg-indigo-50 text-indigo-700' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Book Details</span>}
            </button>
            <button
              onClick={() => { setViewMode('outline'); setMobileMenuOpen(false); }}
              disabled={!outline || !projectId}
              title={sidebarCollapsed ? "Outline" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'outline' ? 'bg-indigo-50 text-indigo-700' : 
                (!outline || !projectId) ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <List className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Outline</span>}
            </button>
            <button
              onClick={() => { setViewMode('toc'); setMobileMenuOpen(false); }}
              disabled={!projectId || chapters.length === 0}
              title={sidebarCollapsed ? "Table of Contents" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'toc' ? 'bg-indigo-50 text-indigo-700 font-bold' : 
                (!projectId || chapters.length === 0) ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <AlignLeft className="w-4 h-4 text-indigo-600 shrink-0" />
              {!sidebarCollapsed && <span>Table of Contents</span>}
            </button>
            <button
              onClick={() => { setViewMode('visual_designer'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Visual Designer & Illustrations" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'visual_designer' ? 'bg-pink-50 text-pink-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-pink-50/60'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-pink-600 shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>Visual Designer</span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">Illustrate</span>
                </div>
              )}
            </button>
            <button
              onClick={() => { setViewMode('assets'); setAssetsSubTab('cover'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Cover Studio" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'assets' && assetsSubTab === 'cover' ? 'bg-purple-50 text-purple-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-purple-50/60'
              }`}
            >
              <Palette className="w-4 h-4 text-purple-600 shrink-0" />
              {!sidebarCollapsed && <span>Cover Studio</span>}
            </button>
            <button
              onClick={() => { setViewMode('assets'); setAssetsSubTab('export'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Publish & Export" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'assets' && assetsSubTab === 'export' ? 'bg-emerald-50 text-emerald-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-emerald-50/60'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              {!sidebarCollapsed && <span>Publish & Export</span>}
            </button>
            <button
              onClick={() => { setViewMode('marketing'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Marketing & PR Studio" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'marketing' ? 'bg-purple-50 text-purple-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-purple-50/60'
              }`}
            >
              <Megaphone className="w-4 h-4 text-purple-600 shrink-0" />
              {!sidebarCollapsed && <span>Marketing & PR Studio</span>}
            </button>
            <button
              onClick={() => { setViewMode('humanizer'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Anti-AI Humanizer Studio" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'humanizer' ? 'bg-emerald-50 text-emerald-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-emerald-50/60'
              }`}
            >
              <Wand2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {!sidebarCollapsed && <span>Anti-AI Humanizer Studio</span>}
            </button>
            <button
              onClick={() => { setViewMode('audiobook'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              title={sidebarCollapsed ? "Audiobook Studio" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'audiobook' ? 'bg-indigo-50 text-indigo-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-indigo-50/60'
              }`}
            >
              <Headphones className="w-4 h-4 text-indigo-600 shrink-0" />
              {!sidebarCollapsed && <span>Audiobook Studio</span>}
            </button>
            <button
              onClick={() => { setViewMode('research'); setMobileMenuOpen(false); }}
              title={sidebarCollapsed ? "Amazon Opportunity Spotter" : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'research' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-zinc-700 hover:bg-amber-50/60'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
              {!sidebarCollapsed && <span>Amazon Opportunity Spotter</span>}
            </button>
          </nav>

          {chapters.length > 0 && projectId && (
            sidebarCollapsed ? (
              <div className="mt-4 pt-4 border-t border-zinc-100 px-2 space-y-1">
                <div className="flex justify-center mb-1">
                  <button 
                    onClick={handleAddChapter}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg text-indigo-600 transition-colors cursor-pointer"
                    title="Add Chapter"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {chapters.map((chapter, idx) => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        setActiveChapterId(chapter.id);
                        setViewMode('chapter');
                        setMobileMenuOpen(false);
                      }}
                      title={`Chapter ${idx + 1}: ${chapter.title}`}
                      className={`w-full flex items-center justify-center p-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        viewMode === 'chapter' && activeChapterId === chapter.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 px-4">
                <div className="flex items-center justify-between mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <span>Chapters</span>
                  <button 
                    onClick={handleAddChapter}
                    className="p-1 hover:bg-zinc-100 rounded text-indigo-600 transition-colors cursor-pointer"
                    title="Add Chapter"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {chapters.map((chapter, idx) => {
                    const isAuthorPage = chapter.title.toLowerCase().includes('about the author');
                    return (
                      <div 
                        key={chapter.id} 
                        draggable
                        onDragStart={() => handleDragStartChapter(idx)}
                        onDragOver={handleDragOverChapter}
                        onDrop={() => handleDropChapter(idx)}
                        className={`group relative flex items-center ${draggedChapterIndex === idx ? 'opacity-40 border border-dashed border-indigo-400 rounded-lg' : ''}`}
                      >
                        <div 
                          className="pl-1.5 pr-0.5 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Drag to reorder chapter"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        <button
                          onClick={() => {
                            setActiveChapterId(chapter.id);
                            setViewMode('chapter');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors text-left pr-20 cursor-pointer ${
                            viewMode === 'chapter' && activeChapterId === chapter.id
                              ? 'bg-indigo-50 text-indigo-700 font-medium'
                              : isAuthorPage ? 'bg-amber-50/70 text-amber-900 hover:bg-amber-100/70' : 'text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            {isAuthorPage ? (
                              <>
                                <User className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                <span className="font-medium text-amber-950">About the Author</span>
                              </>
                            ) : (
                              `${idx + 1}. ${chapter.title}`
                            )}
                          </span>
                          {chapter.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 ml-1" />}
                          {chapter.status === 'generating' && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0 ml-1" />}
                        </button>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity pr-1 bg-white/90 backdrop-blur-xs rounded-lg p-0.5 shadow-2xs">
                        {idx > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveChapter(idx, 'up');
                            }}
                            className="p-0.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Move Chapter Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx < chapters.length - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveChapter(idx, 'down');
                            }}
                            className="p-0.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Move Chapter Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {chapter.status === 'generating' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStopGeneration(chapter.id);
                            }}
                            className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors cursor-pointer"
                            title="Stop AI Generation for this Chapter"
                          >
                            <Square className="w-3.5 h-3.5 fill-red-600 text-red-600" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateChapter(chapter.id);
                            }}
                            className="p-1 hover:bg-indigo-100 rounded text-zinc-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Re-generate this Chapter with AI"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newTitle = prompt("Rename Chapter:", chapter.title);
                            if (newTitle) handleRenameChapter(chapter.id, newTitle);
                          }}
                          className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Rename"
                        >
                          <Type className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setChapterToDelete(chapter);
                          }}
                          className="p-1 hover:bg-red-100 rounded text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Chapter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
                {chapters.some(c => c.status === 'idle') && (
                  <button
                    onClick={() => handleGenerateAllChapters(false)}
                    disabled={isGenerating}
                    className="w-full mt-3 flex justify-center items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-100 disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    Generate {chapters.filter(c => c.status === 'idle').length} Unwritten
                  </button>
                )}
              </div>
            )
          )}
        </div>
        
        <div className={`p-3 border-t border-zinc-200 space-y-1 ${sidebarCollapsed ? 'flex flex-col items-center p-2' : ''}`}>
          <button
            onClick={() => setIsUserSettingsOpen(true)}
            title={sidebarCollapsed ? "User Settings" : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer`}
          >
            <User className="w-4 h-4 shrink-0 text-blue-600" />
            {!sidebarCollapsed && <span>User Settings</span>}
          </button>

          <button
            onClick={() => setIsAdminPayPalModalOpen(true)}
            title={sidebarCollapsed ? "App Owner Admin Settings" : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} rounded-lg text-sm font-medium text-indigo-900 bg-indigo-50/60 hover:bg-indigo-100/80 border border-indigo-200/60 transition-colors cursor-pointer`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-indigo-600" />
            {!sidebarCollapsed && <span className="font-extrabold text-xs">App Owner Admin</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 relative min-w-0">
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center px-4 md:px-6 flex-shrink-0 justify-between gap-4">
          <div className="flex items-center gap-3 truncate">
            <button 
              className="md:hidden p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              className="hidden md:flex p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-zinc-800 truncate">
              {viewMode === 'library' && 'My Library'}
              {viewMode === 'setup' && 'Project Setup'}
              {viewMode === 'outline' && 'Book Outline'}
              {viewMode === 'toc' && 'Table of Contents Studio'}
              {viewMode === 'chapter' && (chapters.find(c => c.id === activeChapterId)?.title || 'Chapter View')}
              {viewMode === 'assets' && 'Assets & Export'}
              {viewMode === 'marketing' && 'Marketing & PR Studio'}
              {viewMode === 'humanizer' && 'Anti-AI Humanizer Studio'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* BYOK API Key Quick Button */}
            <button
              onClick={() => {
                setApiKeyModalMessage(null);
                setIsApiKeyModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                customApiKey || localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key')
                  ? 'bg-blue-50 text-blue-800 border border-blue-200/80 hover:bg-blue-100'
                  : 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
              }`}
              title="Configure personal Google Gemini API key (BYOK)"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {customApiKey || localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key') ? 'BYOK Key Active' : 'Set Gemini Key (BYOK)'}
              </span>
            </button>

            {/* Command Palette / Quick Tool Search */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 transition-all shadow-2xs cursor-pointer"
              title="Search tools, chapters, and publishing features (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden lg:inline">Search Tools...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white border border-zinc-200 rounded font-mono text-[10px] text-zinc-500 shadow-2xs">⌘K</kbd>
            </button>

            {/* Amazon Niche Opportunity Spotter */}
            <button
              onClick={() => setViewMode('research')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                viewMode === 'research'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
              title="Amazon KDP Niche Opportunity, Keyword & BSR Research Tool"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Amazon Research</span>
            </button>

            {/* Help & Publishing Center Drawer */}
            <button
              onClick={() => setHelpDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all shadow-2xs cursor-pointer"
              title="Open KDP Publishing Guide & Launch Checklist"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Guide & Checklist</span>
            </button>

            {projectId && (
              <button
                onClick={() => setShowContinuityModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/80 transition-all shadow-2xs cursor-pointer relative"
                title="View & Edit AI Learned Style Rules and Chapter Continuity Memory"
              >
                <Brain className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span className="hidden sm:inline">AI Cohesion</span>
                {continuityMemory.learnedRules.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-purple-600 text-white font-extrabold rounded-full">
                    {continuityMemory.learnedRules.length}
                  </span>
                )}
              </button>
            )}

            {projectId && (
              <>
                <button
                  onClick={() => setViewMode('humanizer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                    viewMode === 'humanizer'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                  }`}
                  title="Detect AI phrase markers & humanize manuscript"
                >
                  <Wand2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">AI Humanizer</span>
                </button>
                <button
                  onClick={() => setViewMode('marketing')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                    viewMode === 'marketing'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80'
                  }`}
                  title="Open Marketing & PR Studio"
                >
                  <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                  <span className="hidden md:inline">Marketing & PR</span>
                </button>
                <button
                  onClick={() => setViewMode('assets')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                    viewMode === 'assets'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                  }`}
                  title="Open Publishing & Export Center (.docx, .zip bundle, store metadata)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Publish & Export</span>
                </button>
              </>
            )}

            <button
              onClick={handleOpenMdImportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all shadow-2xs cursor-pointer"
              title="Upload or paste a .md manuscript file to auto-format and split into chapters"
            >
              <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
              <span>Import .md Manuscript</span>
            </button>

            <button
              onClick={handleOpenRecoveryModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-all shadow-2xs cursor-pointer"
              title="Scan and recover lost manuscripts from browser storage backups"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-amber-600" />
              <span>Recover Lost Manuscript</span>
            </button>

            {projectId && (
              <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 p-1 rounded-xl">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all shadow-2xs"
                  title="Undo last change / Regret (Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Regret / Undo</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= historyStack.length - 1}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all shadow-2xs"
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Redo</span>
                </button>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                  title="Version History / Restore Points"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>
            )}

            {viewMode !== 'library' && viewMode !== 'setup' && (
              <button
                 className="xl:hidden p-1.5 -mr-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md flex items-center gap-2"
                 onClick={() => setMobileRightPanelOpen(!mobileRightPanelOpen)}
              >
                 <Sparkles className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {!(localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key')) && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shadow-sm border-b border-amber-600/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                <strong>Bring Your Own Key (BYOK) Mode:</strong> Connect your personal Google Gemini API key to enable AI manuscript drafting, cover art, and outlining.
              </span>
            </div>
            <button
              onClick={() => setIsUserSettingsOpen(true)}
              className="px-3.5 py-1 bg-white text-amber-950 font-extrabold rounded-lg text-xs hover:bg-amber-50 transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span>Configure Key Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {historyNotice && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border border-zinc-700">
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>{historyNotice}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            
            {viewMode !== 'library' && (
              <PipelineStepper
                activeView={viewMode}
                onNavigate={(v) => setViewMode(v)}
                hasIdea={Boolean(idea || bookDetails.title)}
                hasOutline={Boolean(outline)}
                hasChapters={chapters.length > 0}
              />
            )}

            {viewMode === 'library' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">Your Bookshelf</h2>
                    <p className="text-sm text-zinc-500 mt-1">Manage all your manuscript projects. Changes save automatically.</p>
                  </div>
                  <div className="flex items-center flex-wrap gap-2.5">
                    <button
                      onClick={handleOpenTrashModal}
                      className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer border border-zinc-200"
                      title="View deleted manuscripts & restore them"
                    >
                      <Trash2 className="w-4 h-4 text-zinc-500" />
                      <span>Trash Bin</span>
                    </button>
                    <button
                      onClick={handleOpenMdImportModal}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      <UploadCloud className="w-4 h-4 text-indigo-600" /> Import .md File
                    </button>
                    <button
                      onClick={handleCreateNewProject}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Start New Manuscript
                    </button>
                  </div>
                </div>

                {savedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-zinc-200 border-dashed text-center">
                    <BookOpen className="w-12 h-12 text-zinc-300 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-900">No manuscripts yet</h3>
                    <p className="text-zinc-500 mt-1 mb-6 max-w-sm">Create your first manuscript project and it will be safely saved in your browser storage.</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCreateNewProject}
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        Create Manuscript
                      </button>
                      <button
                        onClick={handleOpenMdImportModal}
                        className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-4 h-4 text-emerald-600" />
                        Import .md File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...savedProjects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(proj => (
                      <div 
                        key={proj.id} 
                        className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer relative flex flex-col h-[210px] overflow-hidden ${projectId === proj.id ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-zinc-200 hover:border-zinc-300'}`}
                        onClick={() => handleOpenProject(proj.id)}
                      >
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-zinc-900 text-lg leading-tight line-clamp-2">{proj.title}</h3>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <div>
                              <p className="text-xs text-zinc-500">
                                Last edited {new Date(proj.updatedAt).toLocaleDateString()}
                              </p>
                              {projectId === proj.id && (
                                <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Current Session</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(proj.id);
                                setViewMode('assets');
                              }}
                              className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Export / Publish this project"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" /> Publish
                            </button>
                          </div>
                        </div>
                        
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDeleteProject(e, proj.id)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                            title="Move to Trash Bin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'setup' && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
                  <h3 className="text-xl font-bold mb-1 text-zinc-900">Define Your Manuscript</h3>
                  <p className="text-sm text-zinc-500 mb-6">Choose a category and write a detailed prompt or brief for your project.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Manuscript Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => {
                          const newCat = e.target.value as Category;
                          setCategory(newCat);
                          if (newCat === 'children_stories') {
                            setBookDetails(prev => ({
                              ...prev,
                              trimSize: '8.5x11',
                              subCategory: prev.subCategory || 'picture_books'
                            }));
                          } else if (BOOK_SUBCATEGORIES[newCat] && BOOK_SUBCATEGORIES[newCat].length > 0) {
                            setBookDetails(prev => ({
                              ...prev,
                              subCategory: BOOK_SUBCATEGORIES[newCat][0].id
                            }));
                          }
                        }}
                        disabled={isGenerating}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-zinc-800"
                      >
                        {Object.entries(CATEGORIES).map(([catKey, label]) => (
                           <option key={catKey} value={catKey}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Language
                      </label>
                      <select
                        value={bookDetails.language || 'English'}
                        onChange={(e) => setBookDetails(prev => ({...prev, language: e.target.value}))}
                        disabled={isGenerating}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-zinc-800"
                      >
                        {LANGUAGES.map((lang) => (
                           <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subcategory Selector for Book Categories */}
                  {BOOK_SUBCATEGORIES[category] && BOOK_SUBCATEGORIES[category].length > 0 && (
                    <div className="mb-5 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                          {category === 'children_stories' ? "Children's Story Subcategory & Age Target" : "Book Subcategory"}
                        </label>
                        <span className="text-[11px] text-indigo-600 font-semibold">
                          Specialized Literary Framework
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {BOOK_SUBCATEGORIES[category].map(sub => {
                          const isSelected = (bookDetails.subCategory || BOOK_SUBCATEGORIES[category][0].id) === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setBookDetails(prev => ({ ...prev, subCategory: sub.id }))}
                              className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                                  : 'bg-white/70 hover:bg-white border-indigo-100 text-zinc-700 hover:border-indigo-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-zinc-800'}`}>
                                  {sub.label}
                                </span>
                                {sub.targetAge && (
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                    {sub.targetAge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-tight">
                                {sub.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-zinc-800 mb-2">
                      What is your {category === 'sales_copy' ? 'sales copy' : category === 'white_paper' ? 'white paper' : category === 'web_copy' ? 'web copy' : category === 'children_stories' ? "children's story" : 'manuscript'} about?
                    </label>
                    <textarea
                      rows={5}
                      className="w-full rounded-xl border border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-zinc-50 resize-y shadow-sm mb-8"
                      placeholder={
                        category === 'sales_copy'
                          ? 'e.g., A high-converting direct-response sales letter for an enterprise B2B SaaS platform targeting Chief Marketing Officers...'
                          : category === 'white_paper'
                          ? 'e.g., An authoritative executive white paper exploring zero-trust cybersecurity architectures and AI compliance for financial institutions...'
                          : category === 'web_copy'
                          ? 'e.g., A complete high-converting landing page and website copy suite for a modern productivity and workflow automation tool...'
                          : category === 'children_stories'
                          ? 'e.g., An enchanting bedtime story about Barnaby, a curious little hedgehog who loses his prickly quills and discovers that true bravery comes from kindness. Includes soothing rhythms, playful animal friends, and vivid illustration cues...'
                          : category === 'fiction'
                          ? 'e.g., A gripping psychological thriller set in an isolated research station in Svalbard...'
                          : category === 'guides'
                          ? 'e.g., A step-by-step masterclass manual on mastering cloud infrastructure and Kubernetes for DevOps engineers...'
                          : 'e.g., A comprehensive non-fiction publication exploring cognitive behavioral frameworks for peak performance...'
                      }
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      disabled={isGenerating}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                          <Link className="w-4 h-4 text-zinc-500" /> Reference URLs
                        </label>
                        <input
                          type="text"
                          disabled={isGenerating}
                          value={sourceUrls}
                          onChange={(e) => setSourceUrls(e.target.value)}
                          placeholder="Comma separated source URLs"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-zinc-500" /> Upload Reference Docs (PDF, DOCX, TXT, EPUB, etc.)
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            multiple
                            accept="*"
                            disabled={isGenerating}
                            onChange={(e) => {
                              if (e.target.files) {
                                setSourceFiles(Array.from(e.target.files));
                              }
                            }}
                            className="w-full text-[11px] text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all border border-zinc-200 rounded-xl bg-zinc-50 px-2 py-1.5 cursor-pointer"
                          />
                          {sourceFiles.length > 0 && (
                            <p className="text-[10px] text-emerald-600 mt-1 font-bold">
                              {sourceFiles.length} file(s) selected: {sourceFiles.map(f => f.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={handleStartProject}
                      disabled={isGenerating || !idea.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 shadow-sm"
                    >
                      {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Researching & Outlining...</> : (outline ? 'Update Knowledge & Regenerate Outline' : 'Start Project')}
                    </button>
                    {outline && (
                      <p className="text-xs text-center text-zinc-500">
                        Warning: This will generate a new outline based on the idea and reference docs.
                        You will need to re-extract chapters if you proceed.
                      </p>
                    )}
                  </div>
                </div>

                {research && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <div className="text-sm font-medium text-zinc-500 mb-1">Demand Score</div>
                      <div className="text-4xl font-semibold text-indigo-600">{research.demand_score}/100</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <div className="text-sm font-medium text-zinc-500 mb-3">Top Keywords</div>
                      <div className="flex flex-wrap gap-2">
                        {research.top_keywords?.map((kw: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-md border border-zinc-200">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'details' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-zinc-900">Book Details</h2>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-saved
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">Fine-tune your KDP metadata for maximum visibility.</p>
                  </div>
                  <button
                    onClick={handleSuggestMetadata}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4" />}
                    Magic Fill
                  </button>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm transition-all hover:shadow-md">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="group">
                        <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                          <Type className="w-4 h-4" /> Book Title
                        </label>
                        <input
                          type="text"
                          value={bookDetails.title}
                          onChange={(e) => setBookDetails(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                          placeholder="Main title of your book"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-sm font-semibold text-zinc-800 mb-2 group-focus-within:text-indigo-600 transition-colors">Book Subtitle</label>
                        <input
                          type="text"
                          value={bookDetails.subtitle}
                          onChange={(e) => setBookDetails(prev => ({ ...prev, subtitle: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          placeholder="Catchy subtitle or hook"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                        <User className="w-4 h-4" /> Author Name
                      </label>
                      <input
                        type="text"
                        value={bookDetails.authorName}
                        onChange={(e) => setBookDetails(prev => ({ ...prev, authorName: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Your pen name or real name"
                      />
                    </div>

                    <div className="group">
                      <label className="block text-sm font-semibold text-zinc-800 mb-2 group-focus-within:text-indigo-600 transition-colors">Description (HTML Ready)</label>
                      <textarea
                        rows={8}
                        value={bookDetails.description}
                        onChange={(e) => setBookDetails(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all scrollbar-hide"
                        placeholder="The blurb that appears on Amazon..."
                      />
                      <div className="mt-2 flex justify-end">
                        <span className="text-[10px] text-zinc-400 font-mono">HTML FORMATTING ENABLED</span>
                      </div>
                    </div>

                    <div className="group border-t border-zinc-100 pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <label className="text-sm font-semibold text-zinc-800 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                          <Settings className="w-4 h-4" /> Global Chapter Instructions & Writing Style
                        </label>
                        <button
                          onClick={() => {
                            setExtractedStyleResult('');
                            setStyleAnalysisNotice(null);
                            setShowStyleExtractorModal(true);
                          }}
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-semibold transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
                        >
                          <Palette className="w-3.5 h-3.5 text-indigo-600" />
                          Copy Style from another Manuscript
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 mb-3">These instructions dictate the voice, tone, sentence pacing, and rules applied every time you generate a chapter.</p>
                      <textarea
                        rows={4}
                        className="w-full rounded-xl border border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-zinc-50 resize-y shadow-sm text-sm transition-all font-mono"
                        placeholder='e.g., "MATCH THIS COPYWRITING STYLE: Write in a punchy, witty tone with short paragraphs and rhetorical hooks..."'
                        value={bookDetails.globalInstructions || ""}
                        onChange={(e) => setBookDetails(prev => ({...prev, globalInstructions: e.target.value}))}
                        disabled={isGenerating}
                      />
                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[11px] text-zinc-400">
                          {bookDetails.globalInstructions ? '✓ Custom writing style instruction active' : 'No custom style instruction set'}
                        </span>
                        {chapters.length > 0 && (
                          <button
                            onClick={() => handleGenerateAllChapters(true)}
                            disabled={isGenerating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                             {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                             Apply & Rewrite All Chapters
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="group border-t border-zinc-100 pt-6">
                      <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2 group-focus-within:text-indigo-600 transition-colors">
                        <User className="w-4 h-4" /> About the Author
                      </label>
                      <textarea
                        rows={5}
                        value={bookDetails.aboutAuthor}
                        onChange={(e) => setBookDetails(prev => ({ ...prev, aboutAuthor: e.target.value }))}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center gap-2"
                        placeholder="Tell your readers about yourself..."
                      />
                    </div>

                    {/* Author Social Media Handles & Media Links */}
                    <div className="border-t border-zinc-100 pt-6">
                      <AuthorSocialsForm
                        socials={bookDetails.socials}
                        onChange={(updated) => setBookDetails(prev => ({ ...prev, socials: updated }))}
                        onSaveDefault={() => {
                          saveUserSettings({ defaultSocials: bookDetails.socials, socials: bookDetails.socials });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-indigo-600" /> Keywords (7 recommended)
                          </label>
                          <button
                            type="button"
                            onClick={handleGenerateKeywordsOnly}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Generate 7 KDP search keywords specific to this book"
                          >
                            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
                            Auto-Generate Keywords
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {[0,1,2,3,4,5,6].map(i => (
                            <input
                              key={i}
                              type="text"
                              value={bookDetails.keywords[i] || ''}
                              onChange={(e) => {
                                const k = [...bookDetails.keywords];
                                k[i] = e.target.value;
                                setBookDetails(prev => ({ ...prev, keywords: k }));
                              }}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              placeholder={`Keyword ${i + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-zinc-800">BISAC Categories</label>
                        <span className="text-[10px] text-zinc-400 font-medium">3 categories selected</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {[0, 1, 2].map(i => {
                          const currentVal = bookDetails.categories[i] || "";
                          const isCustomOption = currentVal && !BISAC_CATEGORIES.includes(currentVal);

                          return (
                            <div key={i} className="relative group">
                              <select
                                value={currentVal}
                                onChange={(e) => {
                                  const c = [...bookDetails.categories];
                                  c[i] = e.target.value;
                                  setBookDetails(prev => ({ ...prev, categories: c }));
                                }}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer pr-10 text-zinc-800 font-medium"
                              >
                                <option value="">Select a Category</option>
                                {isCustomOption && (
                                  <option value={currentVal}>{currentVal} (AI Recommended)</option>
                                )}
                                {BISAC_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>

                    {/* Book & Story Subcategory */}
                    {BOOK_SUBCATEGORIES[category] && BOOK_SUBCATEGORIES[category].length > 0 && (
                      <div className="pt-6 border-t border-zinc-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <label className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-indigo-600" />
                              {category === 'children_stories' ? "Children's Story Age Bracket & Subcategory" : "Book Subcategory"}
                            </label>
                            <p className="text-xs text-zinc-500">Fine-tunes the tone, vocabulary pacing, and story structure for your target audience.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {BOOK_SUBCATEGORIES[category].map(sub => {
                            const isSelected = (bookDetails.subCategory || BOOK_SUBCATEGORIES[category][0].id) === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setBookDetails(prev => ({ ...prev, subCategory: sub.id }))}
                                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50/70 border-indigo-500 shadow-2xs ring-2 ring-indigo-500/20'
                                    : 'bg-zinc-50 hover:bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-zinc-800'}`}>
                                    {sub.label}
                                  </span>
                                  {sub.targetAge && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                      {sub.targetAge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-500 leading-tight">
                                  {sub.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-zinc-100">
                      <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Cover Inspiration (Optional)
                      </label>
                      <p className="text-xs text-zinc-500 mb-4">Upload an existing cover you like. Our AI will analyze its style, composition, and palette to guide your new design.</p>
                      
                      <div className="flex items-start gap-6">
                        {bookDetails.inspirationImage ? (
                          <div className="relative group">
                            <img src={bookDetails.inspirationImage} alt="Inspiration" className="w-32 h-44 object-cover rounded-lg border border-zinc-200 shadow-md" />
                            <button 
                              onClick={() => setBookDetails(prev => ({ ...prev, inspirationImage: null }))}
                              className="absolute -top-2 -right-2 p-1 bg-white border border-zinc-200 rounded-full text-zinc-400 hover:text-red-500 shadow-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="w-32 h-44 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 transition-all group">
                            <UploadCloud className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                            <span className="text-[10px] font-medium text-zinc-500 mt-2">Upload Image</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setBookDetails(prev => ({ ...prev, inspirationImage: ev.target?.result as string }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        )}
                        <div className="flex-1 text-xs text-zinc-600 bg-gradient-to-br from-indigo-50/70 to-amber-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                          <div className="flex items-center gap-2 text-indigo-900 font-bold">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            Amazon Bestseller Style Benchmarking
                          </div>
                          <p className="italic leading-relaxed text-zinc-600">
                            "Top quality covers rely on specific genre conventions. By uploading an example cover (e.g. Napoleon Hill or James Clear), the Art Director agent extracts color palettes, composition geometry, and visual weight to craft your cover."
                          </p>
                          {bookDetails.inspirationImage && (
                            <button
                              type="button"
                              onClick={handleNanoBananaCover}
                              disabled={isGenerating}
                              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                              {isGenerating ? 'Generating Cover...' : '✨ Generate Cover Inspired By This Image'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-100">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-800 mb-2">Target Price (USD)</label>
                        <input
                          type="text"
                          value={bookDetails.pricing}
                          onChange={(e) => setBookDetails(prev => ({ ...prev, pricing: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                          placeholder="$9.99"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-zinc-800 mb-2">Trim Size</label>
                        <select
                          value={bookDetails.trimSize}
                          onChange={(e) => setBookDetails(prev => ({ ...prev, trimSize: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium appearance-none cursor-pointer"
                        >
                          <option value="5x8">5" x 8" (Pocket Fiction)</option>
                          <option value="6x9">6" x 9" (Standard Trade Paperbk)</option>
                          <option value="7x10">7" x 10" (Non-Fiction/Textbook)</option>
                          <option value="8.5x11">8.5" x 11" (Journal/Children's)</option>
                          <option value="8x10">8" x 10" (Photo Book)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'outline' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-500">Review and edit your outline. Chat with the AI on the right to make changes.</p>
                  {chapters.length === 0 ? (
                    <button
                      onClick={handleExtractChapters}
                      disabled={isGenerating}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                      Extract Chapters & Start Writing
                    </button>
                  ) : chapters.some(c => c.status === 'idle') ? (
                    <button
                      onClick={() => handleGenerateAllChapters(false)}
                      disabled={isGenerating}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                      Generate {chapters.filter(c => c.status === 'idle').length} Unwritten Chapters
                    </button>
                  ) : null}
                </div>
                <div className="bg-white p-4 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm prose prose-zinc max-w-none prose-sm sm:prose-base">
                  <Markdown components={MarkdownComponents}>{outline}</Markdown>
                </div>
              </div>
            )}

            {viewMode === 'chapter' && activeChapterId && (
              <div className="space-y-6">
                {(() => {
                  const chapter = chapters.find(c => c.id === activeChapterId);
                  if (!chapter) return null;

                  if (chapter.status === 'idle') {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 h-64 bg-white rounded-2xl border border-zinc-200 border-dashed">
                        <FileText className="w-12 h-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 mb-2">Chapter not written yet</h3>
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => handleGenerateChapter(chapter.id)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <PlayCircle className="w-4 h-4" /> Generate with AI
                          </button>
                          <span className="text-zinc-400 text-sm">or</span>
                          <button
                            onClick={() => setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, content: '# ' + chapter.title + '\n\nStart writing here...', status: 'done' } : c))}
                            className="flex items-center gap-2 bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            Write Manually
                          </button>
                          <span className="text-zinc-400 text-sm">or</span>
                          <button
                            onClick={() => setChapterToDelete(chapter)}
                            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" /> Delete Chapter
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (chapter.status === 'generating') {
                    return (
                      <div className="flex flex-col items-center justify-center p-8 sm:p-12 min-h-[360px] bg-white rounded-2xl border border-zinc-200 shadow-sm text-center">
                        <GenerationProgressLogger
                          isGenerating={true}
                          currentChapterTitle={chapter.title}
                          generatingStep={generatingStep}
                        />

                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                          <button
                            onClick={() => handleStopGeneration(chapter.id)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <Square className="w-4 h-4 fill-red-600 text-red-600" />
                            <span>Stop AI Generation</span>
                          </button>

                          <button
                            onClick={() => handleGenerateChapter(chapter.id)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Restart / Re-generate</span>
                          </button>
                        </div>

                        <p className="text-[11px] text-zinc-400 mt-4 italic">
                          If generation takes too long or appears stuck, click "Stop AI Generation" or "Restart / Re-generate".
                        </p>
                      </div>
                    );
                  }

                  return (
                    <ChapterView 
                      chapter={chapter} 
                      components={MarkdownComponents}
                      onContentChange={(content) => setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, content } : c))}
                      onRegenerate={() => handleGenerateChapter(chapter.id)}
                      onHumanize={() => {
                        setActiveChapterId(chapter.id);
                        setViewMode('humanizer');
                      }}
                      onIllustrate={() => {
                        setActiveChapterId(chapter.id);
                        setViewMode('visual_designer');
                      }}
                      onShowVersionHistory={() => {
                        setVersionHistoryChapterId(chapter.id);
                        setShowVersionHistoryModal(true);
                      }}
                      onDelete={() => setChapterToDelete(chapter)}
                      onUndo={handleUndo}
                      canUndo={historyIndex > 0}
                      onAutoPlaceVisuals={() => handleAutoPlaceVisuals(chapter.id)}
                      onBatchGenerateVisuals={() => handleBatchGenerateVisuals(chapter.id)}
                      isAutoPlacingVisuals={isAutoPlacingVisuals}
                      isBatchGeneratingVisuals={isBatchGeneratingVisuals}
                    />
                  );
                })()}
              </div>
            )}

            {viewMode === 'humanizer' && (
              <HumanizerStudio
                chapters={chapters}
                activeChapterId={activeChapterId}
                customApiKey={customApiKey}
                language={bookDetails.language}
                onUpdateChapterContent={(chId, newContent) => {
                  setChapters(prev => prev.map(c => {
                    if (c.id !== chId) return c;
                    const existingRevs = c.revisions || [
                      {
                        id: generateId(),
                        timestamp: Date.now() - 60000,
                        label: 'Initial AI Draft',
                        content: c.content,
                        wordCount: c.content.trim().split(/\s+/).filter(Boolean).length
                      }
                    ];
                    const newRev: ChapterRevision = {
                      id: generateId(),
                      timestamp: Date.now(),
                      label: 'Anti-AI Humanizer Pass',
                      content: newContent,
                      wordCount: newContent.trim().split(/\s+/).filter(Boolean).length
                    };
                    return { ...c, content: newContent, revisions: [...existingRevs, newRev] };
                  }));
                  pushHistorySnapshot('Humanized chapter prose');
                }}
                onUpdateAllChaptersContent={(updatedList) => {
                  setChapters(prev => prev.map(c => {
                    const found = updatedList.find(u => u.id === c.id);
                    return found ? { ...c, content: found.content } : c;
                  }));
                  pushHistorySnapshot('Humanized entire manuscript');
                }}
              />
            )}

            {viewMode === 'audiobook' && (
              <AudiobookStudio
                bookDetails={bookDetails}
                chapters={chapters}
                activeChapterId={activeChapterId}
                onSelectChapter={(chId) => setActiveChapterId(chId)}
                customApiKey={customApiKey}
              />
            )}

            {viewMode === 'research' && (
              <AmazonNicheResearchStudio
                customApiKey={customApiKey}
                activeBookTitle={bookDetails.title}
                activeBookIdea={idea}
                onApplyKeywordsToBook={(keywords) => {
                  setBookDetails(prev => ({ ...prev, keywords }));
                  pushHistorySnapshot('Applied Amazon keywords');
                }}
                onApplyCategoriesToBook={(categoryPath) => {
                  setBookDetails(prev => ({
                    ...prev,
                    categories: Array.from(new Set([...(prev.categories || []), categoryPath]))
                  }));
                  pushHistorySnapshot('Applied Amazon category');
                }}
                onApplyPriceToBook={(ebook, paperback) => {
                  setBookDetails(prev => ({
                    ...prev,
                    pricing: `$${ebook} eBook / $${paperback} Paperback`
                  }));
                  pushHistorySnapshot('Applied Amazon target list prices');
                }}
                onStartBookFromNiche={(nicheData) => {
                  setIdea(nicheData.richPrompt || nicheData.topic);
                  setBookDetails(prev => ({
                    ...prev,
                    title: nicheData.topic,
                    subtitle: `A Comprehensive Guide & Practical Actionable Framework`,
                    description: nicheData.verdict,
                    keywords: nicheData.keywords,
                    categories: nicheData.categories,
                    pricing: `$${nicheData.ebookPrice} eBook / $${nicheData.paperbackPrice} Paperback`,
                    globalInstructions: `STRATEGIC MARKET POSITIONING (From Amazon Niche Analytics):\n- Target Audience: ${nicheData.targetAudience}\n- Mandatory Reader Content Gaps to Solve (Competitor Fixes):\n  ${nicheData.contentGaps.join('\n  ')}`
                  }));
                  pushHistorySnapshot(`Started book from Niche: ${nicheData.topic}`);
                  setViewMode('setup');
                }}
              />
            )}

            {viewMode === 'toc' && (
              <TableOfContentsStudio
                chapters={chapters}
                bookDetails={bookDetails}
                onSelectChapter={(chapterId) => {
                  setActiveChapterId(chapterId);
                  setViewMode('chapter');
                }}
                onInsertTocChapter={handleInsertTocChapter}
              />
            )}

            {viewMode === 'visual_designer' && (
              <VisualDesignerStudio
                chapters={chapters}
                activeChapterId={activeChapterId}
                bookTitle={bookDetails.title}
                bookCategory={category}
                customApiKey={customApiKey}
                characterBible={characterBible}
                chapterIllustrations={chapterIllustrations}
                onUpdateCharacterBible={(characters) => {
                  setCharacterBible(characters);
                  pushHistorySnapshot('Updated Character Bible');
                }}
                onUpdateIllustrations={(illustrations) => {
                  setChapterIllustrations(illustrations);
                  pushHistorySnapshot('Updated Chapter Illustrations');
                }}
                onInsertIllustrationIntoChapter={handleInsertIllustrationIntoChapter}
                onNavigateToChapter={(chId) => {
                  setActiveChapterId(chId);
                  setViewMode('chapter');
                }}
              />
            )}

            {viewMode === 'assets' && (
              <div className="space-y-8">
                {/* Hero Header & One-Click Zip Bundle */}
                <div className="bg-gradient-to-br from-emerald-900 via-zinc-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-800/40">
                  <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide uppercase">
                        <Sparkles className="w-3.5 h-3.5" /> Direct Publishing & Export Center
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                        {bookDetails.title || 'Your Book Manuscript'}
                      </h3>
                      <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                        Ready to publish on Amazon KDP, IngramSpark, or Apple Books? Download your complete pre-formatted publishing bundle or individual formats below.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto">
                      <button
                        onClick={handleExportPublishingZip}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-3 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-lg shadow-emerald-900/40 text-sm cursor-pointer disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        <span>Download Complete KDP Package (.zip)</span>
                      </button>

                      <button
                        onClick={handleGenerateAssets}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-2 px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl transition-all text-xs border border-white/20 cursor-pointer disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                        <span>Auto-Generate All Assets</span>
                      </button>
                    </div>
                  </div>

                  {/* External Publishing Portals Quick Bar */}
                  <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <a
                      href="https://kdp.amazon.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 transition-colors font-medium"
                    >
                      <span>Amazon KDP</span>
                      <Link className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                    <a
                      href="https://www.ingramspark.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 transition-colors font-medium"
                    >
                      <span>IngramSpark</span>
                      <Link className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                    <a
                      href="https://www.draft2digital.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 transition-colors font-medium"
                    >
                      <span>Draft2Digital</span>
                      <Link className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                    <a
                      href="https://press.barnesandnoble.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-200 border border-white/10 transition-colors font-medium"
                    >
                      <span>Barnes & Noble</span>
                      <Link className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                  </div>
                </div>

                {/* Subtabs for Publish & Export Studio */}
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 flex-wrap">
                  <button
                    onClick={() => setAssetsSubTab('cover')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      assetsSubTab === 'cover'
                        ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-200'
                        : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                    }`}
                  >
                    <Palette className="w-4 h-4 text-purple-200" /> Print Cover & Spine Studio
                  </button>
                  <button
                    onClick={() => setAssetsSubTab('export')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      assetsSubTab === 'export'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                    }`}
                  >
                    <Download className="w-4 h-4" /> KDP Bundle & File Export
                  </button>
                  <button
                    onClick={() => setAssetsSubTab('price_royalty')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      assetsSubTab === 'price_royalty'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" /> Royalty & Price Calculator
                  </button>
                </div>

                {assetsSubTab === 'cover' && (
                  <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-zinc-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                        <Palette className="w-3.5 h-3.5" /> Print Cover & Spine Studio
                      </div>
                      <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                        Amazon KDP Print Cover & 3D Spine Studio
                      </h2>
                      <p className="text-purple-200 text-xs md:text-sm max-w-2xl leading-relaxed">
                        Design 300 DPI print covers, full paperback wrap spreads with spine width calculations, 3D book mockups, custom SVG frames, overlay text positioning, and AI cover art generation.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAssetsSubTab('export')}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Go to File Export Bundle</span>
                      </button>
                    </div>
                  </div>
                )}

                {assetsSubTab === 'price_royalty' && (
                  <PriceRoyaltyCalculator
                    wordCount={chapters.reduce((acc, c) => acc + (c.content ? c.content.split(/\s+/).length : 0), 0)}
                    bookTitle={bookDetails.title}
                    category={bookDetails.categories?.[0] || 'Non-Fiction'}
                  />
                )}

                {chapters.length === 0 && assetsSubTab === 'export' && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs flex items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <strong className="font-bold text-amber-950">No written chapters detected yet</strong>
                        <p className="text-amber-800 mt-0.5">You can still export store metadata or use "Import .md Manuscript" to load existing text chapters.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenMdImportModal}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex-shrink-0 transition-colors"
                    >
                      Import .md
                    </button>
                  </div>
                )}

                {(assetsSubTab === 'export' || assetsSubTab === 'cover') && (

                <div className={assetsSubTab === 'cover' ? "space-y-8 max-w-5xl mx-auto" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
                  {assetsSubTab === 'export' && (
                  <div className="lg:col-span-2 space-y-8">
                    {/* Step 1: KDP Book Details & Copy Controls */}
                    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Step 1: Amazon Store Metadata
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          Ready to Copy & Paste
                        </span>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 relative group">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase">Final Title</label>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(bookDetails.title || assets.metadata?.title || '');
                                  alert("Title copied to clipboard!");
                                }}
                                className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <p className="text-sm font-semibold text-zinc-800">{bookDetails.title || assets.metadata?.title || 'Not set'}</p>
                          </div>

                          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 relative group">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase">Author Name</label>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(bookDetails.authorName || user?.displayName || '');
                                  alert("Author name copied to clipboard!");
                                }}
                                className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <p className="text-sm font-semibold text-zinc-800">{bookDetails.authorName || user?.displayName || 'Not set'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                             <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Pricing</label>
                             <p className="text-sm font-semibold text-zinc-800">{bookDetails.pricing || '$9.99'}</p>
                           </div>
                           <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                             <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Print Specs</label>
                             <p className="text-sm font-semibold text-zinc-800">{bookDetails.trimSize || '6x9'} • NO BLEED</p>
                           </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase">KDP Book Description</label>
                              <div className="flex bg-zinc-100 border border-zinc-200 rounded-lg p-0.5 text-[10px] font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setDescViewTab('formatted')}
                                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    descViewTab === 'formatted' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                                  }`}
                                >
                                  Formatted Reader View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDescViewTab('html')}
                                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                    descViewTab === 'html' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                                  }`}
                                >
                                  Raw KDP HTML
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const textToCopy = bookDetails.description || assets.metadata?.description_html || '';
                                navigator.clipboard.writeText(textToCopy);
                                alert("Description copied to clipboard!");
                              }}
                              className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" /> Copy Text / HTML
                            </button>
                          </div>

                          {descViewTab === 'formatted' ? (
                            <div 
                              className="p-4 bg-zinc-50 text-zinc-800 rounded-xl text-xs max-h-52 overflow-y-auto leading-relaxed border border-zinc-200 shadow-2xs space-y-2 font-sans"
                              dangerouslySetInnerHTML={{ 
                                __html: bookDetails.description || assets.metadata?.description_html || '<p className="text-zinc-400 italic">Write or generate a book description in Book Details or Auto-Generate All Assets.</p>' 
                              }}
                            />
                          ) : (
                            <div className="p-4 bg-zinc-900 text-zinc-300 rounded-xl font-mono text-xs whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed border border-zinc-800">
                              {bookDetails.description || assets.metadata?.description_html || 'Write or generate a book description in Book Details or Auto-Generate All Assets.'}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Backend Keywords</label>
                            <div className="flex flex-wrap gap-1.5">
                              {(bookDetails.keywords.length > 0 ? bookDetails.keywords : assets.metadata?.keywords)?.map((kw: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] rounded font-medium">{kw}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Categories</label>
                            <div className="space-y-1">
                              {(bookDetails.categories.length > 0 ? bookDetails.categories : assets.metadata?.categories)?.map((cat: string, i: number) => (
                                <div key={i} className="text-[10px] text-zinc-600 flex items-center gap-2">
                                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                                  {cat}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
 
                    {/* Step 2: Interior File Downloads & Printable PDF */}
                    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                        <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Step 2: Manuscript Interior Formats
                        </h3>
                        <span className="text-xs text-zinc-500 font-normal">Pre-formatted for Amazon KDP, Ingram & Apple</span>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* KDP Format Clarification Callout */}
                        <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-3">
                          <div className="w-6 h-6 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                            KDP
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-amber-950">Uploading to Amazon KDP?</p>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              Amazon suggests <strong>.kpf</strong> (Kindle Package Format), which is generated by Amazon's desktop program <i>Kindle Create</i>. However, <strong>Amazon KDP natively accepts our exported .docx (Microsoft Word) and .epub files directly!</strong> Simply click Amazon's yellow <strong>"Upload manuscript"</strong> button and select our pre-formatted <strong>.docx</strong> file. KDP will convert it into a perfect Kindle eBook and paperback print interior automatically.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button 
                            onClick={handleExportDocx}
                            disabled={isGenerating}
                            className="flex items-center gap-4 p-4 border border-emerald-300 hover:border-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 rounded-2xl transition-all group cursor-pointer shadow-2xs relative"
                          >
                            <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <strong className="text-sm text-emerald-950 block font-bold">Amazon KDP (.docx)</strong>
                                <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Recommended for KDP</span>
                              </div>
                              <span className="text-[11px] text-emerald-700 font-medium">Direct Upload to KDP "Upload Manuscript" button</span>
                            </div>
                          </button>

                          <button 
                            onClick={handleExportEpub}
                            disabled={isGenerating}
                            className="flex items-center gap-4 p-4 border border-purple-300 hover:border-purple-500 bg-purple-50/60 hover:bg-purple-50 rounded-2xl transition-all group cursor-pointer shadow-2xs relative"
                          >
                            <div className="w-11 h-11 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Book className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <strong className="text-sm text-purple-950 block font-bold">Standard EPUB (.epub)</strong>
                                <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Kindle & Apple Books</span>
                              </div>
                              <span className="text-[11px] text-purple-700 font-medium">EPUB3 Compliant E-Reader Format</span>
                            </div>
                          </button>

                          <button 
                            onClick={() => {
                              const authorSection = bookDetails.aboutAuthor ? `\n\n---\n\n# About the Author\n\n${bookDetails.aboutAuthor}` : '';
                              const mdText = chapters.map(c => `# ${c.title}\n\n${c.content}`).join('\n\n<div style="page-break-after: always;"></div>\n\n') + authorSection;
                              downloadFile(mdText, 'manuscript.md', 'text/markdown');
                            }}
                            className="flex items-center gap-4 p-4 border border-zinc-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 rounded-2xl transition-all group cursor-pointer shadow-2xs"
                          >
                            <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <strong className="text-sm text-zinc-900 block font-bold">Raw Manuscript (.md)</strong>
                              <span className="text-[11px] text-zinc-500">For Kindle Create or Markdown Editors</span>
                            </div>
                          </button>
 
                          <button 
                            onClick={() => {
                              const authorSection = bookDetails.aboutAuthor ? `<h1>About the Author</h1><div>${bookDetails.aboutAuthor.split('\n').map(p => `<p>${p}</p>`).join('')}</div>` : '';
                              const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bookDetails.title || assets.metadata?.title}</title><style>body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2em; } h1 { page-break-before: always; text-align: center; margin-top: 2em; margin-bottom: 1.5em; } p { margin-bottom: 1em; text-indent: 1.5em; }</style></head><body>${chapters.map(c => `<h1>${c.title}</h1>\n<div>${c.content.split('\n\n').map(p => p.startsWith('#') ? `<h3>${p.replace(/#/g, '').trim()}</h3>` : `<p>${p}</p>`).join('')}</div>`).join('')}${authorSection}</body></html>`;
                              downloadFile(htmlContent, 'manuscript.html', 'text/html');
                            }}
                            className="flex items-center gap-4 p-4 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 rounded-2xl transition-all group cursor-pointer shadow-2xs"
                          >
                            <div className="w-11 h-11 bg-zinc-100 text-zinc-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <strong className="text-sm text-zinc-900 block font-bold">Ebook HTML (.html)</strong>
                              <span className="text-[11px] text-zinc-500">Alternative Direct Kindle Upload</span>
                            </div>
                          </button>

                          <div className="flex flex-col gap-2 p-4 border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-2xl transition-all shadow-2xs">
                            <button 
                              onClick={handlePrintPdf}
                              className="flex items-center gap-4 text-left group cursor-pointer w-full"
                            >
                              <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Printer className="w-5 h-5" />
                              </div>
                              <div>
                                <strong className="text-sm text-zinc-900 block font-bold">Print / Save as PDF</strong>
                                <span className="text-[11px] text-zinc-500">Entire Formatted Print-Ready Manuscript</span>
                              </div>
                            </button>
                            <div className="pt-2 border-t border-indigo-100/80 flex items-center gap-2">
                              <input 
                                type="checkbox"
                                id="pdfLinkOption"
                                checked={pdfIncludeHyperlinks}
                                onChange={(e) => setPdfIncludeHyperlinks(e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              <label htmlFor="pdfLinkOption" className="text-[11px] text-indigo-950 font-medium cursor-pointer select-none">
                                Optional: Clickable Table of Contents jump links
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Back Cover & Blurb */}
                    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                         <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Step 3: Back Cover Blurb
                        </h3>
                        <button
                          onClick={handleGenerateBackCover}
                          disabled={isGenerating}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          GENERATE BLURB
                        </button>
                      </div>
                      <div className="p-6 space-y-4">
                        <textarea
                          rows={6}
                          value={assets.backCoverContent || ""}
                          onChange={(e) => setAssets(prev => ({ ...prev, backCoverContent: e.target.value }))}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium leading-relaxed"
                          placeholder="Your compelling back cover text goes here..."
                        />
                        <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => downloadFile(assets.backCoverContent || "", 'back_cover.txt', 'text/plain')}
                             className="text-[10px] font-bold text-zinc-600 flex items-center gap-1 hover:text-zinc-900"
                           >
                              <Download className="w-3 h-3" /> DOWNLOAD TEXT
                           </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Final Launch Checklist */}
                    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
                        <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Step 4: Final Launch Checklist
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            "Manuscript Audit Complete",
                            "Table of Contents Generated",
                            "Cover Art Optimized (manus AI)",
                            "Back Cover Blurb Written",
                            "About the Author Section Written",
                            "Front Matter & Back Matter Verified",
                            "Pricing Strategy Set",
                            "Keywords & Categories Mapped",
                            "Interior Formatting Checked in Kindle Previewer"
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                              <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                              <span className="text-xs text-zinc-700 font-medium">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="space-y-8">
                     {/* Cover Section with Back Cover, Spine, 3D Preview, and PNG Export */}
                     <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden sticky top-6">
                        <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                           <div className="flex items-center gap-2">
                             <Book className="w-4 h-4 text-indigo-600" />
                             <h3 className="font-semibold text-zinc-900 text-sm">Print Cover & Spine Studio</h3>
                             {coverSaveNotice && (
                               <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-fadeIn">
                                 <Check className="w-3 h-3 text-emerald-600" /> Saved!
                               </span>
                             )}
                           </div>
                           
                           {/* View Mode Selector Tabs & Text Overlay Toggle */}
                           <div className="flex items-center gap-2 flex-wrap">
                             <button
                               type="button"
                               onClick={() => setShowCoverTextOverlay(!showCoverTextOverlay)}
                               className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                                 showCoverTextOverlay
                                   ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                   : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                               }`}
                               title={showCoverTextOverlay ? "Text overlay active. Click to hide title/author text on cover artwork." : "Click to overlay title & author text on cover artwork"}
                             >
                               <Type className="w-3 h-3 text-amber-600" />
                               Overlay Text: {showCoverTextOverlay ? 'ON' : 'OFF'}
                             </button>

                             <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5 text-[10px] font-semibold">
                               <button
                                 onClick={() => setCoverViewMode('wrap')}
                                 className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                   coverViewMode === 'wrap' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-100'
                                 }`}
                               >
                                 <Layers className="w-3 h-3" /> Full Spread
                               </button>
                               <button
                                 onClick={() => setCoverViewMode('front')}
                                 className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                   coverViewMode === 'front' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-100'
                                 }`}
                               >
                                 <Eye className="w-3 h-3" /> Front
                               </button>
                               <button
                                 onClick={() => setCoverViewMode('3d')}
                                 className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                   coverViewMode === '3d' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-100'
                                 }`}
                               >
                                 <Box className="w-3 h-3" /> 3D Mockup
                               </button>
                             </div>
                           </div>
                        </div>

                        <div className="p-6 flex flex-col items-center">
                           {assets.coverUrl ? (
                             <div className="space-y-5 w-full flex flex-col items-center">
                                
                                {/* 1. VIEW MODE: Full Print Spread (Back | Spine | Front) */}
                                {coverViewMode === 'wrap' && (
                                  <div className="w-full flex flex-col items-center space-y-2">
                                    <div className="w-full rounded-xl overflow-hidden shadow-2xl border border-zinc-300 bg-zinc-950 p-3 sm:p-4 animate-fadeIn">
                                      <div className="w-full flex rounded-lg overflow-hidden min-h-[300px] sm:min-h-[380px] shadow-lg border border-zinc-700/50">
                                        
                                        {/* Back Cover (Left Side) */}
                                        <div 
                                          style={{ backgroundColor: backBgColor }} 
                                          className="flex-1 p-4 sm:p-6 flex flex-col justify-between text-white border-r border-zinc-700/40 relative overflow-hidden"
                                        >
                                          <div className="space-y-2 text-center">
                                            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-100 line-clamp-2">
                                              {bookDetails.title || assets.metadata?.title || 'Book Title'}
                                            </h2>
                                            {bookDetails.subtitle && (
                                              <p className="text-[9px] sm:text-[10px] text-zinc-300 italic line-clamp-1">
                                                {bookDetails.subtitle}
                                              </p>
                                            )}
                                            <div className="w-12 h-0.5 bg-white/20 mx-auto my-2" />
                                          </div>

                                          {/* Blurb */}
                                          <div className="my-auto py-2">
                                            <p className="text-[9px] sm:text-[10px] text-zinc-200 leading-relaxed line-clamp-8 sm:line-clamp-10 font-sans text-justify">
                                              {stripHtmlTags(assets.backCoverContent || bookDetails.description) || 'A compelling book crafted with manus AI.'}
                                            </p>
                                          </div>

                                          {/* Footer: Publisher & ISBN Barcode */}
                                          <div className="flex items-end justify-between pt-2 border-t border-white/10 text-[8px] text-zinc-400">
                                            <span className="font-semibold tracking-wider uppercase">manus AI Press</span>
                                            {showBarcodeOnBack && (
                                              <div className="bg-white p-1 rounded shadow-xs text-black text-center border border-zinc-300 w-20">
                                                <div className="h-6 flex items-center justify-center gap-0.5 px-0.5">
                                                  {[12,8,16,10,14,8,12,18,10,14,8,12,16].map((w, i) => (
                                                    <div key={i} style={{ width: `${w % 3 + 1}px` }} className="h-full bg-black" />
                                                  ))}
                                                </div>
                                                <span className="text-[7px] font-mono font-bold block mt-0.5 tracking-tighter">
                                                  {mockIsbn || '978-1-960123-45-6'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Spine (Center) */}
                                        <div 
                                          style={{ 
                                            backgroundColor: spineBgColor, 
                                            color: spineTextColor,
                                            width: `${Math.max(28, Math.min(60, Math.round(spinePageCount * 0.15)))}px`
                                          }} 
                                          className="flex flex-col justify-between items-center py-6 border-x border-dashed border-white/20 relative shadow-inner shrink-0 select-none"
                                        >
                                          <div className="writing-vertical text-[9px] sm:text-[11px] font-bold uppercase tracking-widest text-center truncate max-h-[70%] drop-shadow-sm">
                                            {bookDetails.title || 'Book Title'}
                                          </div>
                                          <div className="writing-vertical text-[8px] sm:text-[9px] font-serif italic tracking-wider opacity-90 truncate max-h-[25%]">
                                            {bookDetails.authorName || user?.displayName || 'Author'}
                                          </div>
                                        </div>

                                        {/* Front Cover (Right Side) */}
                                        <div className="flex-1 relative overflow-hidden bg-zinc-900 aspect-[3/4]">
                                          <img src={assets.coverUrl} alt="Front Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          {showCoverTextOverlay && (
                                            <div className={`absolute inset-0 flex flex-col items-center p-4 sm:p-6 text-white text-center transition-all ${
                                              coverOverlayDarkness === 'none' ? 'bg-transparent' :
                                              coverOverlayDarkness === 'subtle' ? 'bg-black/20' :
                                              coverOverlayDarkness === 'dark' ? 'bg-black/60' : 'bg-black/40'
                                            } ${
                                              coverTextPosition === 'top' ? 'justify-start pt-4' :
                                              coverTextPosition === 'bottom' ? 'justify-end pb-4' : 'justify-center'
                                            }`}>
                                              <div className="space-y-1 max-w-full">
                                                <h1 className="text-xs sm:text-sm font-bold leading-tight drop-shadow-xl uppercase tracking-widest px-1">
                                                  {bookDetails.title || assets.metadata?.title || 'Book Title'}
                                                </h1>
                                                <p className="text-[8px] opacity-90 line-clamp-2 drop-shadow-lg italic px-2">
                                                  {bookDetails.subtitle || assets.metadata?.subtitle}
                                                </p>
                                              </div>
                                              <div className="font-serif italic text-[10px] drop-shadow-lg uppercase tracking-widest border-t border-white/20 pt-2 mt-3 w-3/4 mx-auto">
                                                {bookDetails.authorName || user?.displayName || 'Author Name'}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                      </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-400 italic">
                                      Full Print Spread: Back Cover (Left) • Spine (Center) • Front Cover (Right)
                                    </span>
                                  </div>
                                )}

                                {/* 2. VIEW MODE: Single Front Cover */}
                                {coverViewMode === 'front' && (
                                  <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-2xl group border border-zinc-200 bg-zinc-900 animate-fadeIn max-w-sm">
                                    <img src={assets.coverUrl} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    {showCoverTextOverlay && (
                                      <div className={`absolute inset-0 flex flex-col items-center p-6 text-white text-center transition-all ${
                                        coverOverlayDarkness === 'none' ? 'bg-transparent' :
                                        coverOverlayDarkness === 'subtle' ? 'bg-black/20' :
                                        coverOverlayDarkness === 'dark' ? 'bg-black/60' : 'bg-black/40'
                                      } ${
                                        coverTextPosition === 'top' ? 'justify-start pt-6' :
                                        coverTextPosition === 'bottom' ? 'justify-end pb-6' : 'justify-center'
                                      }`}>
                                        <div className="space-y-2 max-w-full">
                                          <h1 className="text-base font-bold leading-tight drop-shadow-xl uppercase tracking-widest px-2">{bookDetails.title || assets.metadata?.title || 'Book Title'}</h1>
                                          <p className="text-[9px] opacity-90 line-clamp-2 drop-shadow-lg italic px-4">{bookDetails.subtitle || assets.metadata?.subtitle}</p>
                                        </div>
                                        <div className="font-serif italic text-xs drop-shadow-lg uppercase tracking-widest border-t border-white/20 pt-3 mt-4 w-2/3 mx-auto">
                                          {bookDetails.authorName || user?.displayName || 'Author Name'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 3. VIEW MODE: Interactive 3D Mockup */}
                                {coverViewMode === '3d' && (
                                  <div className="w-full py-8 flex items-center justify-center perspective-1000 animate-fadeIn">
                                    <div 
                                      className="relative w-48 sm:w-56 aspect-[3/4] shadow-[25px_25px_50px_rgba(0,0,0,0.5)] rounded-r-md transition-transform duration-500 hover:rotate-y-[-15deg]"
                                      style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-28deg) rotateX(8deg)' }}
                                    >
                                      {/* Front Face */}
                                      <div className="absolute inset-0 rounded-r-md overflow-hidden bg-zinc-900 border border-zinc-700/50">
                                        <img src={assets.coverUrl} alt="Front Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        {showCoverTextOverlay && (
                                          <div className="absolute inset-0 bg-black/40 p-4 flex flex-col justify-between text-white text-center">
                                            <h3 className="text-xs font-bold uppercase tracking-widest drop-shadow">{bookDetails.title || 'Book Title'}</h3>
                                            <span className="text-[9px] font-serif italic drop-shadow">{bookDetails.authorName || 'Author Name'}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Spine Left Face */}
                                      <div 
                                        style={{ 
                                          backgroundColor: spineBgColor, 
                                          color: spineTextColor,
                                          transform: 'rotateY(-90deg) translateZ(1px)',
                                          transformOrigin: 'left center'
                                        }} 
                                        className="absolute top-0 bottom-0 left-0 w-8 flex flex-col justify-between items-center py-4 border-r border-zinc-800 shadow-md"
                                      >
                                        <span className="writing-vertical text-[8px] font-bold uppercase tracking-widest truncate">{bookDetails.title || 'Title'}</span>
                                        <span className="writing-vertical text-[7px] italic truncate">{bookDetails.authorName || 'Author'}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Text Overlay Notice Bar if overlay is ON */}
                                {showCoverTextOverlay && (
                                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] px-3.5 py-2 rounded-xl flex items-center justify-between w-full shadow-2xs">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      <Type className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      Title/Author text is currently overlaid on artwork.
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => setShowCoverTextOverlay(false)}
                                      className="text-amber-950 font-bold underline hover:text-black text-[10px] ml-2 shrink-0 cursor-pointer"
                                    >
                                      Remove Text Overlay
                                    </button>
                                  </div>
                                )}

                                {/* Primary Action Bar: Save, Overlay, Studio Controls */}
                                <div className="grid grid-cols-3 gap-2 w-full">
                                  <button 
                                    onClick={handleSaveCover}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <Save className="w-3.5 h-3.5 text-white" /> Save Cover
                                  </button>
                                  <button 
                                    onClick={() => setShowCoverTextOverlay(!showCoverTextOverlay)}
                                    className={`text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 border cursor-pointer ${
                                      showCoverTextOverlay 
                                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' 
                                        : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                                    }`}
                                    title="Toggle title & author text overlay on cover image"
                                  >
                                    <Type className="w-3.5 h-3.5 text-amber-600" /> Overlay: {showCoverTextOverlay ? 'ON' : 'OFF'}
                                  </button>
                                  <button 
                                    onClick={() => setShowCoverEditor(!showCoverEditor)}
                                    className={`text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border ${
                                      showCoverEditor 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" /> {showCoverEditor ? 'Close' : 'Spine Options'}
                                  </button>
                                </div>

                                {/* PNG Download Buttons Row */}
                                <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-center">
                                    Download High-Resolution PNG Assets
                                  </span>
                                  <div className="grid grid-cols-2 gap-1.5 w-full">
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('wrap')}
                                      className="bg-zinc-900 text-white text-[10px] font-semibold py-2 px-2 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                      title="Full Paperback Wrap Spread with spine calculation at 300 DPI"
                                    >
                                      <Download className="w-3 h-3 text-emerald-400" /> KDP Full Wrap (.png)
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('front')}
                                      className="bg-white border border-zinc-200 text-zinc-800 text-[10px] font-semibold py-2 px-2 rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                      title="Amazon Kindle eBook Front Cover (1600x2560 px)"
                                    >
                                      <Download className="w-3 h-3 text-indigo-600" /> Kindle eBook (.jpg)
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('acx')}
                                      className="bg-purple-900 text-white text-[10px] font-semibold py-2 px-2 rounded-lg hover:bg-purple-950 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                      title="ACX Audible Audiobook Square Cover (2400x2400 px @ 300 DPI)"
                                    >
                                      <Download className="w-3 h-3 text-purple-300" /> ACX Audiobook (.jpg)
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('back')}
                                      className="bg-white border border-zinc-200 text-zinc-800 text-[10px] font-semibold py-2 px-2 rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                      title="KDP Back Cover (1800x2700 px @ 300 DPI)"
                                    >
                                      <Download className="w-3 h-3 text-indigo-600" /> Back Cover (.png)
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 w-full">
                                  <button 
                                    onClick={() => coverUploadRef.current?.click()}
                                    className="bg-white border border-zinc-200 text-zinc-700 text-[10px] font-semibold py-2 rounded-lg hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <UploadCloud className="w-3.5 h-3.5 text-zinc-500" /> Upload Custom Cover Artwork
                                    <input 
                                      type="file" 
                                      ref={coverUploadRef}
                                      accept="image/*" 
                                      onChange={(e) => {
                                         const file = e.target.files?.[0];
                                         if(file) {
                                           const reader = new FileReader();
                                           reader.onload = (ev) => {
                                             setAssets(prev => ({ ...prev, coverUrl: ev.target?.result as string }));
                                             setShowCoverTextOverlay(false);
                                             handleSaveCover();
                                           };
                                           reader.readAsDataURL(file);
                                         }
                                      }}
                                      className="hidden" 
                                    />
                                  </button>
                                  <button 
                                    onClick={handleDeleteCover}
                                    className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Artwork
                                  </button>
                                </div>

                                {/* Interactive Cover Customizer Panel */}
                                {showCoverEditor && (
                                  <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-4 text-left animate-fadeIn">
                                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                                      <h4 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                                        <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Print & Spine Controls
                                      </h4>
                                      <button onClick={() => setShowCoverEditor(false)} className="text-zinc-400 hover:text-zinc-600 text-xs">✕</button>
                                    </div>

                                    {/* Back Cover & Spine Theme Presets */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">Spine & Back Cover Background Color</label>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {[
                                          { name: 'Obsidian', hex: '#18181b' },
                                          { name: 'Navy', hex: '#0f172a' },
                                          { name: 'Indigo', hex: '#1e1b4b' },
                                          { name: 'Espresso', hex: '#3f2d20' },
                                          { name: 'Forest', hex: '#022c22' },
                                          { name: 'Slate', hex: '#334155' },
                                          { name: 'Burgundy', hex: '#450a0a' }
                                        ].map(preset => (
                                          <button
                                            key={preset.hex}
                                            onClick={() => {
                                              setBackBgColor(preset.hex);
                                              setSpineBgColor(preset.hex);
                                            }}
                                            style={{ backgroundColor: preset.hex }}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                              backBgColor === preset.hex ? 'border-indigo-500 scale-110 shadow-sm' : 'border-white'
                                            }`}
                                            title={preset.name}
                                          />
                                        ))}
                                        <input 
                                          type="color" 
                                          value={backBgColor} 
                                          onChange={(e) => {
                                            setBackBgColor(e.target.value);
                                            setSpineBgColor(e.target.value);
                                          }} 
                                          className="w-6 h-6 rounded-full cursor-pointer border border-zinc-300 p-0"
                                          title="Custom Color"
                                        />
                                      </div>
                                    </div>

                                    {/* Spine Page Count / Thickness */}
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase">
                                        <span>Spine Page Count ({spinePageCount} pgs)</span>
                                        <span className="text-zinc-400 text-[9px] font-normal">~{(spinePageCount * 0.00225).toFixed(2)}" Spine Width</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="50" 
                                        max="500" 
                                        step="10" 
                                        value={spinePageCount} 
                                        onChange={(e) => setSpinePageCount(parseInt(e.target.value))}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                      />
                                    </div>

                                    {/* Barcode Toggle & ISBN */}
                                    <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg p-2.5">
                                      <div className="flex-1 pr-2">
                                        <span className="text-xs font-semibold text-zinc-800 block">Back Cover ISBN Barcode</span>
                                        <div className="flex items-center gap-2 pt-1">
                                          <input 
                                            type="text" 
                                            value={mockIsbn || '978-1-960123-45-6'}
                                            onChange={(e) => setMockIsbn(e.target.value)}
                                            placeholder="978-X-XXXX-XXXX-X"
                                            className="w-36 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[11px] font-mono focus:ring-1 focus:ring-indigo-500"
                                          />
                                          <button 
                                            type="button"
                                            onClick={() => setMockIsbn(generateValidIsbn13())}
                                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                            title="Generate a mathematically valid ISBN-13 with EAN check digit"
                                          >
                                            <Sparkles className="w-3 h-3 text-indigo-600" /> Auto ISBN-13
                                          </button>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => setShowBarcodeOnBack(!showBarcodeOnBack)}
                                        className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors border ${
                                          showBarcodeOnBack ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                                        }`}
                                      >
                                        {showBarcodeOnBack ? 'ON' : 'OFF'}
                                      </button>
                                    </div>

                                    {/* Back Cover Blurb Editor */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block">Back Cover Blurb Text</label>
                                        <button 
                                          onClick={handleGenerateBackCover}
                                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                          <Sparkles className="w-3 h-3" /> Auto-Generate with AI
                                        </button>
                                      </div>
                                      <textarea 
                                        rows={3}
                                        value={assets.backCoverContent || bookDetails.description || ''}
                                        onChange={(e) => setAssets(prev => ({ ...prev, backCoverContent: e.target.value }))}
                                        placeholder="Enter compelling back cover marketing copy..."
                                        className="w-full bg-white border border-zinc-200 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-indigo-500"
                                      />
                                    </div>

                                    {/* Front Cover Titles */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Text Position</label>
                                        <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5 text-[10px] font-semibold">
                                          {(['top', 'middle', 'bottom'] as const).map(pos => (
                                            <button 
                                              key={pos}
                                              onClick={() => setCoverTextPosition(pos)}
                                              className={`flex-1 py-1 rounded capitalize ${coverTextPosition === pos ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
                                            >
                                              {pos}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Darkness</label>
                                        <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5 text-[10px] font-semibold">
                                          {(['none', 'subtle', 'medium', 'dark'] as const).map(dark => (
                                            <button 
                                              key={dark}
                                              onClick={() => setCoverOverlayDarkness(dark)}
                                              className={`flex-1 py-1 rounded capitalize ${coverOverlayDarkness === dark ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
                                            >
                                              {dark}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <button 
                                      onClick={handleSaveCover}
                                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <Save className="w-3.5 h-3.5" /> Save Changes to Project
                                    </button>
                                  </div>
                                )}
                             </div>
                           ) : (
                             <div className="flex flex-col items-center justify-center aspect-[3/4] w-full bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200 p-6 text-center hover:bg-zinc-100/50 transition-colors group">
                                <ImageIcon className="w-10 h-10 text-zinc-300 mb-2 group-hover:text-indigo-400 transition-colors" />
                                <p className="text-xs font-semibold text-zinc-700 mb-1">No Book Cover Yet</p>
                                <p className="text-[11px] text-zinc-400 mb-4 max-w-[200px] leading-snug">Generate a cover with manus AI or upload your own custom image file.</p>
                                <label className="cursor-pointer bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                                  <UploadCloud className="w-4 h-4 text-indigo-600" /> Upload Custom Cover / Artwork Image
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if(file) {
                                         const reader = new FileReader();
                                         reader.onload = (ev) => {
                                           setAssets(prev => ({ ...prev, coverUrl: ev.target?.result as string }));
                                           setShowCoverTextOverlay(false);
                                           handleSaveCover();
                                         };
                                         reader.readAsDataURL(file);
                                       }
                                    }}
                                    className="hidden" 
                                  />
                                </label>
                             </div>
                           )}

                           <div className="mt-8 w-full">
                               <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3 text-center flex items-center justify-center gap-2">
                                 <Sparkles className="w-3 h-3 text-amber-500" />
                                 manus AI Pro Art Editor
                               </h4>
                               <p className="text-[10px] text-zinc-500 text-center mb-4 leading-relaxed px-4">
                                 Describe changes to the cover or let manus AI benchmark Amazon bestsellers for your manuscript.
                               </p>

                               {/* Cover Style Reference / Example Upload Box */}
                               <div className="bg-gradient-to-br from-indigo-50/80 via-zinc-50 to-amber-50/50 border border-indigo-100 rounded-xl p-3.5 mb-4 space-y-3 text-left shadow-2xs">
                                 <div className="flex items-center justify-between">
                                   <label className="text-[11px] font-bold text-zinc-800 flex items-center gap-1.5">
                                     <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                     Style Reference / Bestseller Example
                                   </label>
                                   {bookDetails.inspirationImage && (
                                     <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                       <Check className="w-2.5 h-2.5 text-emerald-600" /> Style Active
                                     </span>
                                   )}
                                 </div>
                                 <p className="text-[10px] text-zinc-500 leading-tight">
                                   Upload an Amazon bestseller cover (e.g. Napoleon Hill, James Clear) to guide AI style, color palette, and visual composition.
                                 </p>
                                 {bookDetails.inspirationImage ? (
                                   <div className="space-y-2.5">
                                     <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-indigo-100 shadow-xs">
                                       <img src={bookDetails.inspirationImage} alt="Reference" className="w-12 h-16 object-cover rounded-md border border-zinc-200 shadow-xs shrink-0" />
                                       <div className="flex-1 text-[10px]">
                                         <span className="font-bold text-zinc-800 block">Style Reference Saved</span>
                                         <span className="text-indigo-600 text-[9px] font-medium leading-tight block mt-0.5">
                                           AI will benchmark & emulate this cover's aesthetic.
                                         </span>
                                       </div>
                                       <button
                                         type="button"
                                         onClick={() => setBookDetails(prev => ({ ...prev, inspirationImage: null }))}
                                         className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                         title="Remove reference image"
                                       >
                                         <X className="w-4 h-4" />
                                       </button>
                                     </div>

                                     {/* Prominent Action Button: Generate Cover Using This Inspiration */}
                                     <button
                                       type="button"
                                       onClick={handleNanoBananaCover}
                                       disabled={isGenerating}
                                       className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                     >
                                       <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                                       {isGenerating ? 'Generating Cover...' : '✨ Generate Cover Inspired By This Style'}
                                     </button>
                                   </div>
                                 ) : (
                                   <label className="cursor-pointer bg-white border border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all rounded-xl p-3 text-center flex items-center justify-center gap-2 group block shadow-2xs">
                                     <UploadCloud className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                                     <span className="text-[10px] font-bold text-zinc-700 group-hover:text-indigo-700">Upload Amazon Bestseller Example</span>
                                     <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={(e) => {
                                         const file = e.target.files?.[0];
                                         if (!file) return;
                                         const reader = new FileReader();
                                         reader.onload = (ev) => {
                                           setBookDetails(prev => ({ ...prev, inspirationImage: ev.target?.result as string }));
                                         };
                                         reader.readAsDataURL(file);
                                       }}
                                     />
                                   </label>
                                 )}
                               </div>
                               <div className="space-y-3 mb-6">
                                 {assets.coverUrl ? (
                                   <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 shadow-inner">
                                      <div className="max-h-32 overflow-y-auto space-y-2 mb-3 pr-1 custom-scrollbar">
                                        {(chats['cover'] || []).map((m, i) => (
                                          <div key={i} className={`text-[10px] leading-relaxed ${m.role === 'model' ? 'text-indigo-600 font-medium' : 'text-zinc-600'}`}>
                                            <span className="font-bold opacity-50 mr-1">{m.role === 'user' ? 'You:' : 'AI:'}</span>
                                            {m.text}
                                          </div>
                                        ))}
                                        {(chats['cover'] || []).length === 0 && <p className="text-[10px] text-zinc-400 italic text-center">Ask manus AI to refine your cover...</p>}
                                      </div>
                                      <div className="relative">
                                        <input 
                                          type="text" 
                                          value={coverEditInput}
                                          onChange={(e) => setCoverEditInput(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && handleEditCoverWithNanoBanana()}
                                          placeholder="e.g. 'Make it darker and moodier'"
                                          className="w-full bg-white border border-zinc-200 rounded-lg pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                                        />
                                        <button 
                                          onClick={handleEditCoverWithNanoBanana}
                                          disabled={isGenerating || !coverEditInput.trim()}
                                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-indigo-600 disabled:opacity-30 hover:bg-indigo-50 rounded"
                                        >
                                          <Sparkles className="w-4 h-4" />
                                        </button>
                                      </div>
                                   </div>
                                 ) : (
                                    <div className="space-y-2">
                                      <button
                                        onClick={handleNanoBananaCover}
                                        disabled={isGenerating}
                                        className="w-full relative group overflow-hidden bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-amber-950 text-xs font-bold py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-yellow-200/50 shadow-sm"
                                      >
                                        <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                        <Sparkles className="w-4 h-4" />
                                        Generate Premium Cover (manus AI)
                                      </button>
                                      <label className="w-full cursor-pointer bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
                                        <UploadCloud className="w-4 h-4 text-zinc-500" />
                                        Upload Custom Cover Image
                                        <input 
                                          type="file" 
                                          accept="image/*" 
                                          onChange={(e) => {
                                             const file = e.target.files?.[0];
                                             if(file) {
                                               const reader = new FileReader();
                                               reader.onload = (ev) => setAssets(prev => ({ ...prev, coverUrl: ev.target?.result as string }));
                                               reader.readAsDataURL(file);
                                             }
                                          }}
                                          className="hidden" 
                                        />
                                      </label>
                                    </div>
                                 )}
                               </div>

                               {/* Custom Uploaded Cover Design Templates & Overlays */}
                               <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs text-left mb-4">
                                 <div className="flex items-center justify-between">
                                   <label className="text-[11px] font-bold text-zinc-800 flex items-center gap-1.5">
                                     <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                     Custom Cover Templates & Overlays
                                   </label>
                                   <label className="cursor-pointer text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1">
                                     <Plus className="w-3 h-3" /> Upload SVG/Image
                                     <input 
                                       type="file" 
                                       accept="image/*,.svg" 
                                       onChange={handleUploadCoverTemplate} 
                                       className="hidden" 
                                     />
                                   </label>
                                 </div>
                                 <p className="text-[10px] text-zinc-500 leading-normal">
                                   Upload custom SVG or image cover templates/frames. Selecting a template overlays title and author text automatically.
                                 </p>

                                 {uploadedCoverTemplates.length > 0 ? (
                                   <div className="grid grid-cols-3 gap-2 pt-1">
                                     {uploadedCoverTemplates.map((tpl) => (
                                       <div 
                                         key={tpl.id}
                                         onClick={() => {
                                           setAssets(prev => ({ ...prev, coverUrl: tpl.url }));
                                           setShowCoverTextOverlay(true);
                                         }}
                                         className={`group relative rounded-lg border-2 overflow-hidden aspect-[3/4] cursor-pointer transition-all ${
                                           assets.coverUrl === tpl.url ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-sm' : 'border-zinc-200 hover:border-zinc-400'
                                         }`}
                                       >
                                         <img src={tpl.url} alt={tpl.name} className="w-full h-full object-cover" />
                                         <button
                                           type="button"
                                           onClick={(e) => handleDeleteUploadedTemplate(tpl.id, e)}
                                           className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                           title="Delete template"
                                         >
                                           <X className="w-3 h-3" />
                                         </button>
                                         <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-1 text-[8px] font-semibold text-white truncate text-center">
                                           {tpl.name}
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <div className="text-center py-2.5 px-2 border border-dashed border-zinc-200 rounded-lg bg-zinc-50/50">
                                     <p className="text-[10px] text-zinc-400">No custom templates uploaded yet. Click above to add your SVG frame.</p>
                                   </div>
                                 )}
                               </div>

                               <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3 text-center">Launch Instructions</h4>
                               <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-[10px] text-indigo-900 leading-relaxed shadow-sm">
                                 <p className="mb-3 font-bold flex items-center gap-2 text-indigo-950 tracking-tight">
                                   <BookOpen className="w-3.5 h-3.5" />
                                   manus AI Publishing Guide
                                 </p>
                                 <ul className="space-y-3 font-sans">
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">1</span>
                                     <span>Visit <a href="https://kdp.amazon.com" target="_blank" className="font-bold underline text-indigo-900">Amazon KDP</a> and log in.</span>
                                   </li>
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">2</span>
                                     <span>Select <strong>Kindle eBook</strong> or <strong>Paperback</strong> creation.</span>
                                   </li>
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">3</span>
                                     <span>Use <strong>Step 1</strong> for all title, description, and keyword fields.</span>
                                   </li>
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">4</span>
                                     <span>Upload the <strong>DOCX</strong> file (Paperback) or <strong>HTML</strong> file (Kindle) from <strong>Step 2</strong>.</span>
                                   </li>
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">5</span>
                                     <span>Use <strong>Step 3</strong> for your Book Blurb / Back Cover text.</span>
                                   </li>
                                   <li className="flex gap-2">
                                     <span className="w-5 h-5 flex-shrink-0 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[8px]">6</span>
                                     <span>Upload your <strong>manus AI Cover</strong>. Set pricing, and click <strong>Publish</strong>!</span>
                                   </li>
                                 </ul>
                               </div>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Marketing & PR Studio View */}
            {viewMode === 'marketing' && (
              <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">
                  
                  {/* Header Banner */}
                  <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-zinc-900 text-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                        <Megaphone className="w-3.5 h-3.5" /> Book Marketing & PR Studio
                      </div>
                      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                        Launch & PR Campaign Center
                      </h1>
                      <p className="text-purple-200 text-sm max-w-2xl leading-relaxed">
                        Create press releases, generate social media campaigns, draft media pitches, and build high-converting book landing pages to maximize reader reach.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 shrink-0">
                      <BookOpen className="w-8 h-8 text-purple-400" />
                      <div>
                        <div className="text-xs text-purple-200">Active Title</div>
                        <div className="font-bold text-sm max-w-[180px] truncate">{bookDetails.title || 'Untitled Book'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Author Social Accounts Bar */}
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
                    <AuthorSocialsForm
                      socials={bookDetails.socials}
                      onChange={(updated) => setBookDetails(prev => ({ ...prev, socials: updated }))}
                      onSaveDefault={() => {
                        saveUserSettings({ defaultSocials: bookDetails.socials, socials: bookDetails.socials });
                      }}
                    />
                  </div>

                  {/* Top Sub-Navigation Tabs */}
                  <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => setMarketingSubTab('press_release')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'press_release'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <FileText className="w-4 h-4" /> Official Press Release
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('beta_readers')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'beta_readers'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <User className="w-4 h-4" /> Beta Reader Panel
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('audiobook_script')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'audiobook_script'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <Headphones className="w-4 h-4" /> Audiobook Script Assistant
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('social_campaign')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'social_campaign'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <Share2 className="w-4 h-4" /> Social & Email Kit
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('media_pitch')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'media_pitch'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <Mail className="w-4 h-4" /> Media & Podcast Pitches
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('landing_page')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'landing_page'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <Globe className="w-4 h-4" /> Book Landing Page
                    </button>

                    <button
                      onClick={() => setMarketingSubTab('strategy_roadmap')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        marketingSubTab === 'strategy_roadmap'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      <Compass className="w-4 h-4" /> 30-Day Launch Strategy
                    </button>
                  </div>

                  {/* Beta Reader Simulator Tab */}
                  {marketingSubTab === 'beta_readers' && (
                    <BetaReaderSimulator
                      bookDetails={bookDetails}
                      chapters={chapters}
                      customApiKey={customApiKey}
                      onUpdateChapterContent={(chapterId, newContent) => {
                        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: newContent, status: 'done' } : c));
                        pushHistorySnapshot('Applied AI Beta Reader Critique Fixes');
                      }}
                    />
                  )}

                  {/* Audiobook Script Assistant Tab */}
                  {marketingSubTab === 'audiobook_script' && (
                    <AudiobookAssistant
                      bookDetails={bookDetails}
                      chapters={chapters}
                      customApiKey={customApiKey}
                    />
                  )}


                  {/* TAB 1: Official Press Release */}
                  {marketingSubTab === 'press_release' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 h-fit">
                        <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-purple-600" /> Release Parameters
                        </h3>
                        
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Target Audience / Beat</label>
                          <input
                            type="text"
                            value={targetAudienceInput}
                            onChange={(e) => setTargetAudienceInput(e.target.value)}
                            placeholder="e.g. Entrepreneurs, Mystery Readers, Tech Leaders"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Launch Date / Status</label>
                          <input
                            type="text"
                            value={launchDateInput}
                            onChange={(e) => setLaunchDateInput(e.target.value)}
                            placeholder="e.g. FOR IMMEDIATE RELEASE or Oct 15, 2026"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>

                        <button
                          onClick={handleGeneratePR}
                          disabled={isGeneratingPR}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isGeneratingPR ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Drafting Press Release...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" /> Generate Official Press Release
                            </>
                          )}
                        </button>

                        <p className="text-[11px] text-zinc-400 italic leading-snug">
                          Generates a PR Newswire compliant release complete with lead paragraph, author quotes, boilerplate, and media contacts.
                        </p>
                      </div>

                      <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col min-h-[500px]">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-4">
                          <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" /> Press Release Preview
                          </h3>
                          {pressReleaseContent && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigator.clipboard.writeText(pressReleaseContent)}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </button>
                              <button
                                onClick={() => {
                                  const blob = new Blob([pressReleaseContent], { type: 'text/markdown' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${(bookDetails.title || 'Book').replace(/\s+/g, '_')}_Press_Release.md`;
                                  a.click();
                                }}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> Export Markdown
                              </button>
                            </div>
                          )}
                        </div>

                        {pressReleaseContent ? (
                          <div className="prose prose-sm prose-indigo max-w-none flex-1 overflow-y-auto max-h-[600px] p-4 bg-zinc-50 rounded-xl border border-zinc-200 font-serif">
                            <Markdown>{pressReleaseContent}</Markdown>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                            <Megaphone className="w-12 h-12 text-zinc-300 mb-3" />
                            <p className="font-medium text-zinc-600 text-sm mb-1">No Press Release Generated Yet</p>
                            <p className="text-xs max-w-sm">Click "Generate Official Press Release" on the left to create a publication-ready media release using Gemini AI.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Social & Email Campaign Kit */}
                  {marketingSubTab === 'social_campaign' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Social Media Generator */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                              <Share2 className="w-4 h-4 text-purple-600" /> Social Media Posts
                            </h3>
                            {socialPostsContent && (
                              <button
                                onClick={() => navigator.clipboard.writeText(socialPostsContent)}
                                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" /> Copy All
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 mb-1">Platform</label>
                              <select
                                value={socialPlatform}
                                onChange={(e) => setSocialPlatform(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              >
                                <option value="X / Twitter">X / Twitter</option>
                                <option value="Instagram & Threads">Instagram & Threads</option>
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="Facebook">Facebook</option>
                                <option value="TikTok / BookTok Caption">TikTok / BookTok</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-700 mb-1">Tone of Voice</label>
                              <select
                                value={socialTone}
                                onChange={(e) => setSocialTone(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              >
                                <option value="Enthusiastic & Inspiring">Enthusiastic & Inspiring</option>
                                <option value="Professional & Authoritative">Professional & Authoritative</option>
                                <option value="Storytelling & Vulnerable">Storytelling & Personal</option>
                                <option value="Provocative & Bold">Provocative & Bold</option>
                              </select>
                            </div>
                          </div>

                          <button
                            onClick={handleGenerateSocial}
                            disabled={isGeneratingSocial}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isGeneratingSocial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Generate 5 Social Launch Posts
                          </button>

                          {socialPostsContent ? (
                            <div className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                              <Markdown>{socialPostsContent}</Markdown>
                            </div>
                          ) : (
                            <div className="p-8 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50 text-xs">
                              Select platform and tone above to generate tailored social campaign posts.
                            </div>
                          )}
                        </div>

                        {/* Email Launch Sequence */}
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                              <Mail className="w-4 h-4 text-purple-600" /> 4-Part Email Launch Sequence
                            </h3>
                            {emailSequenceContent && (
                              <button
                                onClick={() => navigator.clipboard.writeText(emailSequenceContent)}
                                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" /> Copy All
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-zinc-500 leading-relaxed">
                            Generates an automated 4-email sequence (Announcement, Cover Reveal, Launch Day, & Review Request) for newsletter subscribers.
                          </p>

                          <button
                            onClick={handleGenerateEmailSequence}
                            disabled={isGeneratingEmail}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isGeneratingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Generate Automated Email Launch Sequence
                          </button>

                          {emailSequenceContent ? (
                            <div className="prose prose-sm max-w-none max-h-[400px] overflow-y-auto p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                              <Markdown>{emailSequenceContent}</Markdown>
                            </div>
                          ) : (
                            <div className="p-8 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50 text-xs">
                              Click above to generate subject lines, body copy, and CTAs for your email list launch.
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB 3: Media & Podcast Pitches */}
                  {marketingSubTab === 'media_pitch' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 h-fit">
                        <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-purple-600" /> Pitch Settings
                        </h3>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Recipient Type</label>
                          <select
                            value={pitchRecipientType}
                            onChange={(e) => setPitchRecipientType(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          >
                            <option value="Podcast Hosts & Producers">Podcast Hosts & Producers</option>
                            <option value="Book Reviewers & Literary Bloggers">Book Reviewers & Literary Bloggers</option>
                            <option value="Journalists & Local Newspapers">Journalists & Local Newspapers</option>
                            <option value="Influencers & Content Creators">Influencers & Content Creators</option>
                          </select>
                        </div>

                        <button
                          onClick={handleGeneratePitch}
                          disabled={isGeneratingPitch}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isGeneratingPitch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Generate Targeted Pitch Email
                        </button>

                        <p className="text-[11px] text-zinc-400 italic leading-snug">
                          Creates personalized pitch emails with compelling subject lines, audience relevancy hooks, and suggested interview questions.
                        </p>
                      </div>

                      <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col min-h-[500px]">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-4">
                          <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                            <Mail className="w-4 h-4 text-purple-600" /> Media Pitch Draft
                          </h3>
                          {mediaPitchContent && (
                            <button
                              onClick={() => navigator.clipboard.writeText(mediaPitchContent)}
                              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Pitch Email
                            </button>
                          )}
                        </div>

                        {mediaPitchContent ? (
                          <div className="prose prose-sm max-w-none flex-1 overflow-y-auto max-h-[600px] p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                            <Markdown>{mediaPitchContent}</Markdown>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                            <Mail className="w-12 h-12 text-zinc-300 mb-3" />
                            <p className="font-medium text-zinc-600 text-sm mb-1">No Pitch Generated Yet</p>
                            <p className="text-xs max-w-sm">Select a recipient type on the left to generate customized outreach emails.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Interactive Book Landing Page */}
                  {marketingSubTab === 'landing_page' && (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col gap-5">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-zinc-900 text-base flex items-center gap-2">
                                <Globe className="w-5 h-5 text-purple-600" /> Promotional Book Landing Page Generator
                              </h3>
                              {publishedLandingData && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live & Published
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">
                              Choose a design template, auto-generate sales copy, and instantly publish or export your standalone .html landing page.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <button
                              onClick={handleGenerateLandingCopy}
                              disabled={isGeneratingLanding}
                              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                            >
                              {isGeneratingLanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              <span>Auto-Generate Copy</span>
                            </button>

                            <button
                              onClick={handlePublishLandingPage}
                              disabled={isPublishingLanding}
                              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ring-2 ring-indigo-300/50"
                              title="1-Click Instant Web Publishing"
                            >
                              {isPublishingLanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-purple-200" />}
                              <span>{publishedLandingData ? 'Manage Live Publishing' : '⚡ Instant Publish to Web'}</span>
                            </button>

                            <button
                              onClick={() => exportLandingPageHtml(bookDetails, landingCopyData, assets.coverUrl, selectedLandingTemplate)}
                              className="bg-zinc-800 hover:bg-zinc-900 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-4 h-4 text-emerald-400" /> Export .html
                            </button>
                          </div>
                        </div>

                        {/* Landing Page Design Template Selector */}
                        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            Select Landing Page Template Layout:
                          </span>
                          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedLandingTemplate('classic')}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                selectedLandingTemplate === 'classic'
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                              }`}
                            >
                              <span>🌟</span> Classic Bestseller
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLandingTemplate('modern')}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                selectedLandingTemplate === 'modern'
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                              }`}
                            >
                              <span>⚡</span> Modern Tech
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLandingTemplate('editorial')}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                                selectedLandingTemplate === 'editorial'
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                              }`}
                            >
                              <span>📜</span> Editorial & Author
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Landing Page Live Preview Frame */}
                      <div className="bg-zinc-900 rounded-2xl p-4 shadow-2xl border border-zinc-800">
                        <div className="flex items-center justify-between pb-3 px-2 border-b border-zinc-800 text-zinc-400 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                            <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                            <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
                            <span className="text-zinc-500 font-mono ml-2">https://${(bookDetails.title || 'book').toLowerCase().replace(/[^a-z0-9]/g, '')}.com</span>
                          </div>
                          <span className="text-[10px] bg-zinc-800 px-2.5 py-1 rounded-full text-purple-300 font-semibold uppercase tracking-wider">
                            {selectedLandingTemplate} Template Live Preview
                          </span>
                        </div>

                        <div className="bg-white text-zinc-900 rounded-b-xl overflow-hidden mt-3 shadow-inner">
                          <iframe
                            srcDoc={getLandingPageHtmlString(bookDetails, landingCopyData, assets.coverUrl, selectedLandingTemplate)}
                            className="w-full h-[680px] border-0 rounded-b-xl"
                            title="Landing Page Preview"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: 30-Day Launch Roadmap */}
                  {marketingSubTab === 'strategy_roadmap' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 h-fit">
                        <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                          <Compass className="w-4 h-4 text-purple-600" /> Launch Strategy
                        </h3>

                        <p className="text-xs text-zinc-500 leading-relaxed">
                          Generates a complete 30-day timeline roadmap (T-14 to T+14) including KDP Select pricing promos, ARC reviewer timeline, and grassroots outreach.
                        </p>

                        <button
                          onClick={handleGenerateStrategy}
                          disabled={isGeneratingStrategy}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isGeneratingStrategy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Generate 30-Day Launch Blueprint
                        </button>
                      </div>

                      <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col min-h-[500px]">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-4">
                          <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                            <Compass className="w-4 h-4 text-purple-600" /> Marketing & PR Roadmap
                          </h3>
                          {marketingPlanContent && (
                            <button
                              onClick={() => navigator.clipboard.writeText(marketingPlanContent)}
                              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Strategy
                            </button>
                          )}
                        </div>

                        {marketingPlanContent ? (
                          <div className="prose prose-sm max-w-none flex-1 overflow-y-auto max-h-[600px] p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                            <Markdown>{marketingPlanContent}</Markdown>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                            <Compass className="w-12 h-12 text-zinc-300 mb-3" />
                            <p className="font-medium text-zinc-600 text-sm mb-1">No Strategy Generated Yet</p>
                            <p className="text-xs max-w-sm">Click "Generate 30-Day Launch Blueprint" to generate a tailored step-by-step book launch roadmap.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Right Panel Mobile Overlay */}
      {mobileRightPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 xl:hidden" 
          onClick={() => setMobileRightPanelOpen(false)}
        />
      )}

      {/* Right Sidebar: Chat Interface */}
      {(viewMode === 'outline' || viewMode === 'chapter') && (
        <aside className={`fixed right-0 top-0 xl:relative z-50 w-[85vw] sm:w-96 xl:w-80 bg-white border-l border-zinc-200 flex flex-col h-full flex-shrink-0 shadow-2xl xl:shadow-none transition-transform duration-300 xl:translate-x-0 ${mobileRightPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-sm flex items-center gap-2">
                {chatAgent === 'ghostwriter' ? <MessageSquare className="w-4 h-4 text-indigo-600" /> : <ImageIcon className="w-4 h-4 text-pink-600" />}
                {chatAgent === 'ghostwriter' ? 'AI Co-Writer' : 'AI Art Director'}
              </h3>
              <button 
                className="xl:hidden p-1 -mr-1 text-zinc-400 hover:text-zinc-600 rounded-md"
                onClick={() => setMobileRightPanelOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
           <div className="flex p-1 bg-zinc-200/50 rounded-lg">
               <button onClick={() => setChatAgent('ghostwriter')} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${chatAgent === 'ghostwriter' ? 'bg-white shadow-sm text-indigo-700' : 'text-zinc-500 hover:text-zinc-700'}`}>AI Co-Writer</button>
               <button onClick={() => setChatAgent('art_director')} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${chatAgent === 'art_director' ? 'bg-white shadow-sm text-pink-700' : 'text-zinc-500 hover:text-zinc-700'}`}>Visual Designer</button>
            </div>
            
            <p className="text-xs text-zinc-500 mt-1">
              {chatAgent === 'ghostwriter' 
                ? `AI Co-Writer handles all chapters for general improvement. Ask to "rewrite", "expand", or "audit my manuscript".`
                : 'Chat to brainstorm image placement and visually structure this chapter.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeChatHistory.length === 0 ? (
              <div className="text-center text-sm text-zinc-400 mt-10 p-4">
                {chatAgent === 'ghostwriter' 
                 ? "No messages yet. Ask the AI to write or modify text in the document!"
                 : "I'm the Art Director. Ask me to add screenshots, diagrams, or cover art placeholders throughout this section!"}
              </div>
            ) : (
              activeChatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-zinc-100 text-zinc-800 rounded-bl-none'
                  }`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1 text-[10px]">
                            {att.mimeType.startsWith('image/') ? (
                              <img src={`data:${att.mimeType};base64,${att.data}`} className="w-8 h-8 object-cover rounded" alt="" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            <span className="truncate max-w-[80px] text-white/80">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-sm prose-p:my-1 prose-a:text-indigo-400 max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isChatting && (
              <div className="flex items-start">
                <div className="bg-zinc-100 rounded-2xl rounded-bl-none px-4 py-3">
                  <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-200 bg-white">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-zinc-50 rounded-xl border border-zinc-100">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="relative group bg-white border border-zinc-200 rounded-lg p-2 pr-8 flex items-center gap-2">
                    {att.mimeType.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-pink-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-indigo-500" />
                    )}
                    <span className="text-[10px] text-zinc-600 truncate max-w-[100px]">{att.name}</span>
                    <button 
                      onClick={() => removeAttachment(i)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-100 rounded-full"
                    >
                      <X className="w-3 h-3 text-zinc-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                multiple 
                className="hidden" 
              />
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                onPaste={handlePaste}
                placeholder="Ask AI to edit, or paste screenshot..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={2}
                disabled={isChatting || (viewMode === 'chapter' && chapters.find(c => c.id === activeChapterId)?.status !== 'done')}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isChatting}
                className="absolute left-2.5 bottom-2.5 p-1.5 text-zinc-400 hover:text-indigo-600 transition-colors"
                title="Upload file or image"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={(!chatInput.trim() && pendingAttachments.length === 0) || isChatting || (viewMode === 'chapter' && chapters.find(c => c.id === activeChapterId)?.status !== 'done')}
                className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto pt-24 pb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  User Settings & System Prompts
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
                {/* Social Media & Author Media Handles */}
                <div className="pb-6 border-b border-zinc-100">
                  <AuthorSocialsForm
                    socials={bookDetails.socials}
                    onChange={(updated) => {
                      setBookDetails(prev => ({ ...prev, socials: updated }));
                    }}
                    onSaveDefault={() => {
                      saveUserSettings({ defaultSocials: bookDetails.socials, socials: bookDetails.socials });
                    }}
                  />
                </div>

                {/* BYOK Settings */}
                <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white border border-indigo-100/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-100/60">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-600" />
                        API Key Configuration (Bring Your Own Key - BYOK)
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Use your own Google Gemini API Key for high rate limits, private quotas, and custom AI generation.
                      </p>
                    </div>
                    <div>
                      {customApiKey ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Custom Key Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                          Using Default Platform Key
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-zinc-800">
                        Google Gemini API Key
                      </label>
                      {customApiKey && (
                        <button 
                          type="button"
                          onClick={() => {
                            setCustomApiKey('');
                            saveUserSettings({ customApiKey: null });
                          }}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline uppercase tracking-tight"
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        onBlur={() => {
                            const trimmed = customApiKey.trim();
                            if (trimmed === 'undefined' || trimmed === 'null') {
                              setCustomApiKey('');
                              saveUserSettings({ customApiKey: null });
                            } else {
                              saveUserSettings({ customApiKey: trimmed !== '' ? trimmed : null });
                            }
                        }}
                        placeholder="Paste your key here (e.g. AIzaSy...)"
                        className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono shadow-2xs text-zinc-800"
                      />
                    </div>
                  </div>

                  {/* Step-by-Step Instructions to Obtain Google API Key */}
                  <div className="bg-white/90 border border-indigo-100 rounded-xl p-4 text-xs space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> How to get a free Google Gemini API Key:
                      </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-[11px] shadow-2xs shrink-0"
                      >
                        <span>Get API Key on Google AI Studio</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 pl-1 leading-relaxed">
                      <li>
                        Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5">aistudio.google.com/app/apikey <ExternalLink className="w-2.5 h-2.5" /></a> and log in with your Google account.
                      </li>
                      <li>
                        Click the blue <strong className="text-zinc-800">"Create API key"</strong> button.
                      </li>
                      <li>
                        Choose or create a Google Cloud project and click <strong className="text-zinc-800">"Create API key in existing project"</strong>.
                      </li>
                      <li>
                        Copy the string starting with <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-900 font-mono">AIzaSy...</code> and paste it into the field above.
                      </li>
                    </ol>
                    <div className="pt-2 border-t border-zinc-100 flex items-start gap-1.5 text-zinc-500 text-[11px]">
                      <span className="font-bold text-indigo-600 shrink-0">💡 Note:</span>
                      <span>Your custom key is saved privately in your local browser profile. You can change or reset it at any time.</span>
                    </div>
                  </div>

                  {/* ElevenLabs API Key Setup */}
                  <div className="pt-4 border-t border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-purple-600" /> ElevenLabs Voice Synthesis API Key
                      </label>
                      {elevenLabsApiKey !== DEFAULT_ELEVENLABS_KEY && (
                        <button
                          type="button"
                          onClick={() => {
                            setElevenLabsApiKey(DEFAULT_ELEVENLABS_KEY);
                            localStorage.setItem('elevenlabs_api_key', DEFAULT_ELEVENLABS_KEY);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline uppercase tracking-tight"
                        >
                          Reset to Initial Key
                        </button>
                      )}
                    </div>

                    <input
                      type="password"
                      value={elevenLabsApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setElevenLabsApiKey(val);
                        localStorage.setItem('elevenlabs_api_key', val);
                      }}
                      placeholder="e.g. sk_716bc2b43a089a12f75c..."
                      className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-zinc-800 shadow-2xs"
                    />

                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Used by the <strong className="text-zinc-800">Audiobook Studio</strong> to fetch voice clones and synthesize multi-speaker character audio lines.
                    </p>
                  </div>
                </div>

                {/* Category Prompts */}
                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span>Category AI Training & System Prompts</span>
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">manus engine</span>
                  </h4>
                  <p className="text-xs text-zinc-500 mb-6">
                    Fine-tune and train the specialized system instructions, tone frameworks, and structural rules the AI model executes for each manuscript and copy category.
                  </p>

                  <div className="space-y-6">
                    {Object.entries(CATEGORIES).map(([catKey, label]) => {
                      const typedKey = catKey as Category;
                      const currentVal = categoryPrompts[typedKey] || DEFAULT_CATEGORY_PROMPTS[typedKey] || "";
                      const isCustomized = categoryPrompts[typedKey] && categoryPrompts[typedKey] !== DEFAULT_CATEGORY_PROMPTS[typedKey];
                      
                      const personaTag = {
                        sales_copy: "Direct-Response & Conversion Psychology",
                        white_paper: "B2B Enterprise & Institutional Research",
                        web_copy: "CRO & Digital UX Landing Architecture",
                        children_stories: "Children's Storytelling, Literacy & Illustration Cues",
                        non_fiction: "Thought Leadership & Case Frameworks",
                        fiction: "Literary Fiction & Narrative Immersion",
                        guides: "Action Checklists & Instructional Manuals"
                      }[typedKey];

                      return (
                        <div key={catKey} className="p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200/80 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-bold text-zinc-900">
                                {label}
                              </label>
                              {personaTag && (
                                <span className="text-[10px] font-semibold bg-white text-zinc-600 px-2 py-0.5 rounded-md border border-zinc-200">
                                  {personaTag}
                                </span>
                              )}
                              {isCustomized && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                  Customized
                                </span>
                              )}
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const defaultVal = DEFAULT_CATEGORY_PROMPTS[typedKey];
                                setCategoryPrompts(prev => {
                                  const next = { ...prev, [typedKey]: defaultVal };
                                  saveUserSettings({ prompts: next });
                                  return next;
                                });
                              }}
                              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                            >
                              Reset to Default Training
                            </button>
                          </div>

                          <textarea
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y leading-relaxed"
                            rows={3}
                            value={currentVal}
                            placeholder={`Enter AI system instructions and rules for ${label}...`}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setCategoryPrompts(prev => {
                                const next = { ...prev, [typedKey]: newVal };
                                saveUserSettings({ prompts: next });
                                return next;
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
              <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button
                  onClick={() => {
                    const trimmed = customApiKey.trim();
                    setCustomApiKey(trimmed);
                    saveUserSettings({ customApiKey: trimmed !== '' ? trimmed : null });
                    setIsSettingsOpen(false);
                  }}
                  className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-base">
                <History className="w-5 h-5 text-indigo-600" />
                <h3>Version History & Restore Points</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Every AI generation, chapter extract, or document edit creates a restore snapshot. Select any point below to revert your manuscript state.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {historyStack.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">No restore snapshots created yet.</p>
              ) : (
                historyStack.slice().reverse().map((snap, idx) => {
                  const realIndex = historyStack.length - 1 - idx;
                  const isCurrent = realIndex === historyIndex;
                  return (
                    <div 
                      key={snap.timestamp + idx}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        isCurrent ? 'bg-indigo-50/70 border-indigo-200 font-medium' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-800">{snap.description || 'Snapshot'}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full font-semibold">Active</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(snap.timestamp).toLocaleTimeString()} • {snap.chapters.length} Chapters
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => {
                            restoreHistorySnapshot(realIndex);
                            setShowHistoryModal(false);
                          }}
                          className="px-3 py-1 bg-white border border-zinc-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-zinc-700 font-medium rounded-lg text-xs transition-colors shadow-2xs"
                        >
                          Revert To This
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {chapterToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-base">
                <Trash2 className="w-5 h-5 text-red-600" />
                <h3>Delete Chapter?</h3>
              </div>
              <button onClick={() => setChapterToDelete(null)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-600">
              Are you sure you want to delete <strong className="text-zinc-900 font-semibold">"{chapterToDelete.title}"</strong>? This will remove it from your book manuscript.
            </p>

            <p className="text-xs text-zinc-500 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
              💡 You can easily restore this chapter at any time by clicking the <strong className="text-amber-900">Regret / Undo</strong> button.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setChapterToDelete(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChapter}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copywriting Style Extractor Modal */}
      {showStyleExtractorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 relative my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5 text-zinc-900 font-semibold text-base">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Copywriting Style Transfer</h3>
                  <p className="text-xs text-zinc-500 font-normal">Extract voice, tone & pacing from one manuscript and apply it to another.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStyleExtractorModal(false)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Type Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">1. Select Source Manuscript / Sample</label>
              <div className="grid grid-cols-2 gap-3 bg-zinc-100/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStyleSourceType('bookshelf')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    styleSourceType === 'bookshelf' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  From Bookshelf ({savedProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStyleSourceType('custom_text')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    styleSourceType === 'custom_text' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Paste Custom Excerpt
                </button>
              </div>
            </div>

            {/* Source Content Input */}
            {styleSourceType === 'bookshelf' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 block">Select Book from Your Library</label>
                {savedProjects.length === 0 ? (
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-center text-xs text-zinc-500">
                    No other saved books found in your library yet. Switch to "Paste Custom Excerpt" to input manuscript text.
                  </div>
                ) : (
                  <select
                    value={selectedSourceProjectId}
                    onChange={(e) => setSelectedSourceProjectId(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose a manuscript project --</option>
                    {savedProjects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.title || 'Untitled Book'} ({proj.category || 'non_fiction'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 block">Paste Sample Manuscript Paragraphs / Excerpt</label>
                <textarea
                  rows={5}
                  value={customStyleSampleText}
                  onChange={(e) => setCustomStyleSampleText(e.target.value)}
                  placeholder="Paste 1-3 paragraphs or an excerpt from the source manuscript here..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Analyze Trigger Button */}
            <button
              onClick={handleExtractStyle}
              disabled={isAnalyzingStyle}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isAnalyzingStyle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Copywriting Style...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Analyze & Extract Copywriting Style
                </>
              )}
            </button>

            {/* Status Notice */}
            {styleAnalysisNotice && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>{styleAnalysisNotice}</span>
              </div>
            )}

            {/* Result Box */}
            {extractedStyleResult && (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    2. Extracted Copywriting Style Instructions
                  </label>
                  <span className="text-[10px] text-zinc-400 font-medium">Editable</span>
                </div>
                <textarea
                  rows={6}
                  value={extractedStyleResult}
                  onChange={(e) => setExtractedStyleResult(e.target.value)}
                  className="w-full bg-zinc-900 text-zinc-200 rounded-xl p-3.5 text-xs font-mono border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => handleApplyExtractedStyle(false)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Apply to Book Details Instructions
                  </button>
                  <button
                    onClick={() => handleApplyExtractedStyle(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Apply & Rewrite All Chapters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Emergency Manuscript Recovery Center Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 relative my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Emergency Manuscript Recovery Center</h3>
                  <p className="text-xs text-zinc-500 font-normal">Scans local browser storage, emergency snapshots & backups to restore lost data.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRecoveryModal(false)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                Automatic Local Protection Active
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Even if cloud database writes hit quota limits, all manuscript edits are stored in your local browser storage. Select a backup below to instantly recover your manuscript into the active workspace.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Scanned Local Backups ({recoveredBackupsList.length})
              </span>
              <button
                onClick={() => setRecoveredBackupsList(scanAllLocalBackups())}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Rescan Local Storage
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recoveredBackupsList.length === 0 ? (
                <div className="p-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-600">No previous local snapshots found in this browser context.</p>
                  <p className="text-[11px] text-zinc-400">If you created a manuscript in another browser or incognito window, open that window and use the same recovery tool.</p>
                </div>
              ) : (
                recoveredBackupsList.map((backup, i) => (
                  <div key={backup.key || i} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-4 hover:border-indigo-200 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-zinc-900 truncate flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        {backup.title || 'Untitled Manuscript'}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                        <span>{backup.chapterCount} Chapters</span>
                        <span>•</span>
                        <span>{backup.wordCount.toLocaleString()} Words</span>
                        <span>•</span>
                        <span>{new Date(backup.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestoreBackup(backup)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-2xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore Manuscript
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Recovery Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Manuscript Importer & Formatting Modal */}
      {showMdImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 relative my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Import & Format Markdown Manuscript (.md)</h3>
                  <p className="text-xs text-zinc-500 font-normal">Load any .md or text manuscript, auto-detect chapters or use Gemini AI to structure and format paragraphs.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMdImportModal(false)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Bar */}
            {mdImportNotice && (
              <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <p className="leading-snug">{mdImportNotice}</p>
                </div>
                <button onClick={() => setMdImportNotice(null)} className="text-indigo-400 hover:text-indigo-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: File Upload or Paste */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  1. Load File or Paste Text
                </label>
                
                <div className="border-2 border-dashed border-zinc-200 rounded-xl p-4 bg-zinc-50 hover:bg-zinc-100/80 transition-colors text-center relative cursor-pointer group">
                  <input 
                    type="file" 
                    accept="*" 
                    onChange={handleFileUploadMd} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-indigo-600 mx-auto transition-colors" />
                  <p className="text-xs font-semibold text-zinc-700 mt-2">
                    {mdFileName ? `Loaded: ${mdFileName}` : "Click or drag any manuscript file (.pdf, .docx, .epub, .md, .txt, etc.)"}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Supports PDF, Word (.docx), EPUB, Markdown (.md), Plain Text (.txt), & all document formats</p>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-zinc-600">Or Paste Raw Markdown Manuscript Content:</span>
                    {mdRawText && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {mdRawText.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={mdRawText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMdRawText(val);
                      if (val.trim()) {
                        setMdParsedPreview(parseMarkdownToChaptersLocally(val));
                      } else {
                        setMdParsedPreview(null);
                      }
                    }}
                    placeholder="# Chapter 1: Introduction&#10;&#10;Write or paste your markdown manuscript here..."
                    className="w-full bg-zinc-900 text-zinc-200 rounded-xl p-3 text-xs font-mono border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Right Column: Formatting Mode & Chapter Preview */}
              <div className="space-y-3 flex flex-col min-h-0">
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  2. Choose Formatting Mode
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleProcessMdManuscript(false)}
                    disabled={!mdRawText.trim() || isProcessingMd}
                    className="px-3 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <List className="w-4 h-4 text-zinc-600" />
                    <span>Fast Local Parse</span>
                  </button>
                  <button
                    onClick={() => handleProcessMdManuscript(true)}
                    disabled={!mdRawText.trim() || isProcessingMd}
                    className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1 disabled:opacity-40 shadow-xs cursor-pointer"
                  >
                    {isProcessingMd ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Wand2 className="w-4 h-4 text-indigo-200" />}
                    <span>Gemini AI Format & Polish</span>
                  </button>
                </div>

                <div className="flex-1 flex flex-col bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2.5 overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-800 pb-2 border-b border-zinc-200">
                    <span>Formatted Chapter Preview</span>
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                      {mdParsedPreview?.chapters?.length || 0} Chapter(s) Detected
                    </span>
                  </div>

                  {!mdParsedPreview || !mdParsedPreview.chapters || mdParsedPreview.chapters.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400 space-y-1">
                      <BookOpen className="w-8 h-8 text-zinc-300" />
                      <p className="text-xs font-medium">Upload or paste manuscript text to see detected chapters.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-56">
                      {mdParsedPreview.title && (
                        <div className="p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Detected Book Title: "{mdParsedPreview.title}"</span>
                        </div>
                      )}
                      {mdParsedPreview.chapters.map((ch, idx) => (
                        <div key={idx} className="p-2.5 bg-white border border-zinc-200 rounded-lg space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                            <span className="truncate flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                              {ch.title || `Chapter ${idx + 1}`}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0 ml-2">
                              {ch.content.split(/\s+/).filter(Boolean).length} words
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-tight">
                            {ch.content.substring(0, 150)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowMdImportModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleApplyImportedManuscript}
                disabled={!mdParsedPreview || !mdParsedPreview.chapters || mdParsedPreview.chapters.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply & Load Chapters into Book Workspace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google AI Studio Style Share / Instant Web Publishing Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-zinc-900 p-6 text-white relative">
              <button
                onClick={() => setPublishModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Published & Live on Google Cloud / Web</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight">Instant Web Publishing</h3>
              <p className="text-xs text-zinc-300 mt-1 leading-snug">
                Your promotional book landing page is published and publicly accessible instantly on Google Cloud / Web.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Shareable URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Public Landing Page Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?landingId=${publishedLandingData?.id}`}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-800 focus:outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}${window.location.pathname}?landingId=${publishedLandingData?.id}`;
                      navigator.clipboard.writeText(link);
                      setCopiedLinkNotice(true);
                      setTimeout(() => setCopiedLinkNotice(false), 2500);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    {copiedLinkNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLinkNotice ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <a
                  href={`${window.location.origin}${window.location.pathname}?landingId=${publishedLandingData?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-zinc-200"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-600" />
                  <span>Open Live Page</span>
                </a>

                <button
                  onClick={handlePublishLandingPage}
                  className="flex items-center justify-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-purple-200"
                >
                  <RefreshCw className="w-4 h-4 text-purple-600" />
                  <span>Update Live Site</span>
                </button>
              </div>

              {/* Download or Unpublish */}
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => exportLandingPageHtml(bookDetails, landingCopyData, assets.coverUrl, selectedLandingTemplate)}
                  className="text-zinc-600 hover:text-zinc-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Raw .html File</span>
                </button>

                <button
                  onClick={handleUnpublishLandingPage}
                  className="text-red-500 hover:text-red-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unpublish Page</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Palette Search (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        chapters={chapters}
        onSelectChapter={(id) => {
          setActiveChapterId(id);
          setViewMode('chapter');
        }}
        onNavigateTab={(tab, subTab) => {
          setViewMode(tab as ViewMode);
          if (subTab) {
            if (tab === 'marketing') setMarketingSubTab(subTab as any);
            if (tab === 'assets') setAssetsSubTab(subTab as any);
          }
        }}
      />

      {/* Global KDP Launch & Help Center Drawer */}
      <HelpDrawer
        isOpen={helpDrawerOpen}
        onClose={() => setHelpDrawerOpen(false)}
        onNavigateTab={(tab, subTab) => {
          setViewMode(tab as ViewMode);
          if (subTab) {
            if (tab === 'marketing') setMarketingSubTab(subTab as any);
            if (tab === 'assets') setAssetsSubTab(subTab as any);
          }
        }}
      />

      {/* Version History & Safety Net Modal */}
      {(() => {
        const targetChapterId = versionHistoryChapterId || activeChapterId;
        const vChapter = chapters.find(c => c.id === targetChapterId);
        if (!vChapter) return null;

        const revisions: ChapterRevision[] = vChapter.revisions && vChapter.revisions.length > 0
          ? vChapter.revisions
          : [
              {
                id: 'rev-current',
                timestamp: Date.now(),
                label: 'Current Manuscript Draft',
                content: vChapter.content,
                wordCount: vChapter.content.trim().split(/\s+/).filter(Boolean).length
              }
            ];

        return (
          <VersionHistoryModal
            isOpen={showVersionHistoryModal}
            onClose={() => setShowVersionHistoryModal(false)}
            chapterTitle={vChapter.title}
            revisions={revisions}
            currentContent={vChapter.content}
            onRestoreRevision={(rev) => {
              setChapters(prev => prev.map(c => c.id === vChapter.id ? { ...c, content: rev.content } : c));
              pushHistorySnapshot(`Restored chapter revision: ${rev.label}`);
            }}
          />
        );
      })()}

      {/* Global AI Continuity & Learned Rules Memory Modal */}
      <ContinuityMemoryModal
        isOpen={showContinuityModal}
        onClose={() => setShowContinuityModal(false)}
        learnedRules={continuityMemory.learnedRules}
        chapterSummaries={continuityMemory.chapterSummaries}
        chapters={chapters}
        onUpdateLearnedRules={(rules) => setContinuityMemory(prev => ({ ...prev, learnedRules: rules }))}
        onUpdateChapterSummary={(chId, summary) => setContinuityMemory(prev => ({ ...prev, chapterSummaries: { ...prev.chapterSummaries, [chId]: summary } }))}
        customApiKey={customApiKey}
      />

      {/* Global Active AI Generation Status Bar with Stop & Re-generate Actions */}
      {(isGenerating || chapters.some(c => c.status === 'generating')) && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="w-2 h-2 rounded-full bg-indigo-400 absolute top-0 right-0 animate-ping"></span>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-100">
                {generatingStep || 'Writing Chapter with AI...'}
              </p>
              <p className="text-[10px] text-zinc-400">
                Gemini AI is generating manuscript content
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-700/80 pl-3">
            <button
              onClick={() => handleStopGeneration()}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Stop current AI generation immediately"
            >
              <Square className="w-3.5 h-3.5 fill-white text-white" />
              <span>Stop AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Multi-User SaaS Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => refreshLibrary()}
      />

      {/* PayPal SaaS Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        userProfile={userProfile}
        onPlanUpdated={(updated) => setUserProfile(updated)}
      />

      {/* User Account Settings Modal */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => setUserProfile(updated)}
        onOpenSubscriptions={() => setIsSubscriptionModalOpen(true)}
      />

      {/* App Owner SaaS Admin Settings Modal */}
      <AdminPayPalSettingsModal
        isOpen={isAdminPayPalModalOpen}
        onClose={() => setIsAdminPayPalModalOpen(false)}
      />

      {/* AI Support Assistant Expert Modal */}
      <SupportAiAssistantModal
        isOpen={isSupportAssistantOpen}
        onClose={() => setIsSupportAssistantOpen(false)}
        userProfile={userProfile}
        bookCount={savedProjects.length}
      />

      {/* Floating AI Support Assistant Launch Widget */}
      {!isSupportAssistantOpen && (
        <button
          onClick={() => setIsSupportAssistantOpen(true)}
          className="fixed bottom-4 right-3 z-40 w-11 h-11 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center border border-white/20 group cursor-pointer"
          title="Need Help? Ask AI Expert"
          aria-label="Need Help? Ask AI Expert"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-100 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-zinc-900 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-zinc-900" />
          </div>
        </button>
      )}

      {/* Dedicated Google Gemini API Key Setup & BYOK Modal */}
      <ApiKeyRequiredModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        initialKey={customApiKey}
        errorMessage={apiKeyModalMessage}
        onKeySaved={(newKey) => {
          setCustomApiKey(newKey);
          saveUserSettings({ customApiKey: newKey });
          setHistoryNotice("Google Gemini API Key successfully saved and activated!");
          setTimeout(() => setHistoryNotice(null), 4000);
        }}
      />

      {/* Floating Undo Delete Notification */}
      {undoDeleteToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-zinc-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-800 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span className="text-xs">
              Moved <strong>"{undoDeleteToast.title}"</strong> to Trash Bin
            </span>
          </div>
          <button
            onClick={() => handleUndoDelete(undoDeleteToast.id)}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            onClick={() => setUndoDeleteToast(null)}
            className="text-zinc-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Manuscript Safe Deletion Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Move Manuscript to Trash?</h3>
                  <p className="text-xs text-zinc-500">Safely store in Trash Bin with 1-click restore</p>
                </div>
              </div>
              <button 
                onClick={() => setProjectToDelete(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
              <h4 className="font-bold text-zinc-900 text-sm leading-snug">{projectToDelete.title}</h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span className="bg-zinc-200/80 px-2 py-0.5 rounded font-medium capitalize">
                  {projectToDelete.category?.replace(/_/g, ' ') || 'General'}
                </span>
                <span>•</span>
                <span>{projectToDelete.chapterCount || 0} chapters</span>
                <span>•</span>
                <span>{(projectToDelete.wordCount || 0).toLocaleString()} words</span>
              </div>
            </div>

            {(projectToDelete.chapterCount || 0) > 0 || (projectToDelete.wordCount || 0) > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  This manuscript contains drafted content ({projectToDelete.chapterCount} chapters, {(projectToDelete.wordCount || 0).toLocaleString()} words). It will be safely moved to your <strong>Trash Bin</strong> where you can restore it at any time.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                This empty draft will be moved to your Trash Bin.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Keep Manuscript
              </button>
              <button
                onClick={handleConfirmMoveToTrash}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Move to Trash Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Bin Management & Restore Modal */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 relative my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-zinc-100 text-zinc-700 rounded-xl">
                  <Trash2 className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Manuscript Trash Bin</h3>
                  <p className="text-xs text-zinc-500">Restore deleted manuscripts to your bookshelf or permanently purge them.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTrashModal(false)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {trashList.length === 0 ? (
              <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                <Trash2 className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">Trash Bin is Empty</p>
                <p className="text-xs text-zinc-400 mt-0.5">Any manuscripts you delete will appear here so you never lose work.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {trashList.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-4 hover:bg-zinc-100/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-zinc-900 text-sm truncate">{item.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 mt-1">
                        <span className="capitalize">{item.category?.replace(/_/g, ' ') || 'Manuscript'}</span>
                        <span>•</span>
                        <span>{item.chapterCount || 0} chapters</span>
                        <span>•</span>
                        <span>{(item.wordCount || 0).toLocaleString()} words</span>
                        <span>•</span>
                        <span>Deleted {new Date(item.deletedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestoreFromTrashModal(item.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Restore this manuscript to your active bookshelf"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteFromTrash(item.id, item.title)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Permanently delete forever"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              {trashList.length > 0 ? (
                <button
                  onClick={handleEmptyAllTrash}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Empty Entire Trash Bin
                </button>
              ) : <div />}

              <button
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Trash Bin
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

