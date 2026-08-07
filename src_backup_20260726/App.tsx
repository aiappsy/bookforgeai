import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { BookOpen, FileText, Image as ImageIcon, Headphones, Settings, CheckCircle2, Loader2, Download, PlayCircle, MessageSquare, Send, ChevronRight, List, Key, X, UploadCloud, Library, Plus, Paperclip, User, Tag, Type, Sparkles, Link, Menu, Trash2, Save, Edit3, Sliders, Check, RotateCcw, RotateCw, History, SlidersHorizontal, Palette, Copy, Wand2, LifeBuoy, AlertTriangle, RefreshCw, Layers, Box, Eye, Book, Megaphone, Share2, Mail, Globe, Compass, ExternalLink, Calendar, Award } from 'lucide-react';
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
  Attachment,
  generateBackCover,
  extractWritingStyle,
  formatAndStructureManuscriptWithAI,
  generatePressRelease,
  generateSocialCampaign,
  generateEmailLaunchSequence,
  generateMediaPitch,
  generateLandingPageCopy,
  generateMarketingStrategyPlan
} from './services/geminiService';
import { exportToDocx, exportPublishingZipBundle, exportLandingPageHtml } from './services/exportService';
import { saveProject, loadProject, getProjectsList, deleteProject, getUserSettings, saveUserSettings, saveEmergencySnapshot, scanAllLocalBackups, savePublishedLandingPage, getPublishedLandingPage, deletePublishedLandingPage, PublishedLandingData } from './services/storage';
import { auth, loginWithGoogle, logoutUser } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type ViewMode = 'library' | 'setup' | 'details' | 'outline' | 'chapter' | 'assets' | 'marketing';

type Category = 'non_fiction' | 'fiction' | 'guides';

const CATEGORIES: Record<Category, string> = {
  non_fiction: "Non-Fiction Publication",
  fiction: "Fiction & Storytelling",
  guides: "How-to Guides & Manuals"
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

function ChapterView({ chapter, onContentChange, onRegenerate, onDelete, onUndo, canUndo, components }: { chapter: Chapter, onContentChange: (c: string) => void, onRegenerate: () => void, onDelete?: () => void, onUndo?: () => void, canUndo?: boolean, components: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const isAuthorPage = chapter.title.toLowerCase().includes('about the author');

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

interface BookSnapshot {
  chapters: Chapter[];
  outline: string;
  bookDetails: BookDetails;
  timestamp: number;
  description: string;
}

export default function App() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Mobile UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);

  // Global State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [sourceUrls, setSourceUrls] = useState<string>('');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<Category>('non_fiction');
  const [research, setResearch] = useState<any>(null);
  const [outline, setOutline] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
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

  // History & Regret (Undo / Redo) State
  const [historyStack, setHistoryStack] = useState<BookSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
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
  const [imageBag, setImageBag] = useState<Record<string, string>>({});
  const [mockIsbn, setMockIsbn] = useState<string | null>(null);

  // Marketing & PR Studio State
  const [marketingSubTab, setMarketingSubTab] = useState<'press_release' | 'social_campaign' | 'email_sequence' | 'media_pitch' | 'landing_page' | 'strategy_roadmap'>('press_release');
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
        const conf = await getUserSettings();
        if (conf?.customApiKey) setCustomApiKey(conf.customApiKey);
        if (conf?.socials || conf?.defaultSocials) {
          const userSocials = conf.socials || conf.defaultSocials;
          setBookDetails(prev => ({
            ...prev,
            socials: { ...userSocials, ...prev.socials }
          }));
        }
        getProjectsList().then(setSavedProjects);
      }
      setAuthChecking(false);
    });
    return unsub;
  }, []);

  const refreshLibrary = async () => setSavedProjects(await getProjectsList());

  // Debounced Auto-saver to protect storage quotas & maintain instant local persistence
  useEffect(() => {
    if (!projectId) return;

    const currentData = {
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
    };

    saveEmergencySnapshot(currentData);

    const saveTimer = setTimeout(async () => {
      await saveProject(currentData);
      refreshLibrary();
    }, 1500);

    return () => clearTimeout(saveTimer);
  }, [idea, category, research, outline, chapters, assets, bookDetails, chats, projectId, user]);

  const handleOpenRecoveryModal = () => {
    const backups = scanAllLocalBackups();
    setRecoveredBackupsList(backups);
    setShowRecoveryModal(true);
  };

  const handleRestoreBackup = (backup: any) => {
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

    setHistoryNotice(`Successfully restored manuscript: "${backup.title}" (${backup.chapterCount} chapters, ${backup.wordCount} words)`);
    setTimeout(() => setHistoryNotice(null), 5000);
    setShowRecoveryModal(false);
  };

  const handleOpenMdImportModal = () => {
    setShowMdImportModal(true);
    setMdImportNotice(null);
  };

  const handleFileUploadMd = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMdFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      setMdRawText(text);
      const parsed = parseMarkdownToChaptersLocally(text);
      setMdParsedPreview(parsed);
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      setMdImportNotice(`Successfully loaded "${file.name}" (${wordCount.toLocaleString()} words). Found ${parsed.chapters.length} chapters.`);
    };
    reader.readAsText(file);
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
          const mappedCategories = (meta.categories || []).map((c: string) => {
            if (c.includes("FICTION")) {
              if (c.includes("Fantasy")) return "FICTION / Fantasy / Epic";
              if (c.includes("Mystery")) return "FICTION / Mystery & Detective / General";
              if (c.includes("Romance")) return "FICTION / Romance / Contemporary";
              if (c.includes("Science Fiction") || c.includes("Sci-Fi")) return "FICTION / Science Fiction / General";
              if (c.includes("Thriller")) return "FICTION / Thrillers / Suspense";
              return "FICTION / General";
            }
            if (c.includes("Business")) return "NON-FICTION / Business & Economics / General";
            if (c.includes("Health") || c.includes("Fitness")) return "NON-FICTION / Health & Fitness / General";
            if (c.includes("Self-Help")) return "NON-FICTION / Self-Help / General";
            if (c.includes("Tech") || c.includes("Computer")) return "NON-FICTION / Technology / General";
            if (c.includes("Education")) return "NON-FICTION / Education / General";
            return "NON-FICTION / General";
          });

          setBookDetails(prev => ({
            ...prev,
            title: prev.title || meta.title || mdParsedPreview.title || '',
            subtitle: prev.subtitle || meta.subtitle || '',
            authorName: prev.authorName || meta.author_name || user?.displayName || '',
            description: prev.description || meta.description_html || '',
            keywords: prev.keywords.length > 0 ? prev.keywords : (meta.keywords || []),
            categories: prev.categories.length > 0 ? prev.categories : (mappedCategories.length > 0 ? mappedCategories : []),
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
    setViewMode('setup');
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
      refreshLibrary();
      if (projectId === id) {
        setViewMode('library');
        setProjectId(null);
      }
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
      const customPrompt = conf?.prompts?.[category] || "You are an expert Ghostwriter.";

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
        setGeneratingStep('Reading files...');
        for (const file of sourceFiles) {
          const text = await file.text();
          context += `\n\n--- Content from file: ${file.name} ---\n${text.substring(0, 15000)}`;
        }
      }

      let fullIdea = idea;
      if (context) {
        fullIdea = `${idea}\n\n### ADDITIONAL INFLUENCE / SOURCES:\n${context}`;
      }

      setGeneratingStep('Researching niche...');
      const res = await researchNiche(fullIdea, customApiKey);
      setResearch(res);
      
      setGeneratingStep('Generating outline...');
      const languagePrompt = bookDetails.language ? `\n\nCRITICAL: You MUST write the entire outline in ${bookDetails.language}. All chapter titles and bullet points MUST be in ${bookDetails.language}.` : '';
      const out = await generateOutline(fullIdea, res.top_keywords || [], customApiKey, customPrompt + languagePrompt);
      setOutline(out);
      
      setIdea(fullIdea);
      setViewMode('outline');
    } catch (e: any) {
      console.error(e);
      alert("Failed to start project: " + (e.message || "Unknown error"));
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
      console.error(e);
      alert("Failed to extract chapters: " + (e.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    pushHistorySnapshot(`Before generating ${chapter.title}`);
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: 'generating' } : c));
    
    try {
      const conf = await getUserSettings();
      const customPrompt = conf?.prompts?.[category] || "Write in a clear, practical, encouraging tone.";
      
      let combinedPrompt = `${customPrompt}\n${bookDetails?.globalInstructions ? 'Also explicitly follow these overall instructions for this chapter: ' + bookDetails.globalInstructions : ''}`;
      
      if (bookDetails?.language) {
          combinedPrompt += `\n\nCRITICAL: The entire chapter MUST be written in ${bookDetails.language}. Do not use English unless quoting or if strictly necessary.`;
      }

      const effectiveTopic = (idea && idea.trim()) || (bookDetails?.title && bookDetails.title.trim()) || bookDetails?.description || 'the manuscript topic';
      const content = await generateChapter(effectiveTopic, outline, chapter.title, customApiKey, combinedPrompt);
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content, status: 'done' } : c));
    } catch (e: any) {
      console.error(e);
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: 'idle' } : c));
      alert("Failed to generate chapter: " + (e.message || "Unknown error"));
    }
  };

  const handleGenerateAllChapters = async (overwrite: boolean = false) => {
    const targets = overwrite ? chapters : chapters.filter(c => c.status === 'idle');
    if (!targets.length) return;
    setIsGenerating(true);
    
    // We process sequentially to avoid rate limits
    for (let i = 0; i < targets.length; i++) {
        const chap = targets[i];
        setGeneratingStep(`Writing chapter ${i + 1} of ${targets.length}...`);
        await handleGenerateChapter(chap.id);
    }
    
    setIsGenerating(false);
    setGeneratingStep('');
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
      meta = await optimizeMetadata(idea, customApiKey);
      if (meta) {
        setBookDetails(prev => ({
          ...prev,
          title: prev.title || meta.title || '',
          subtitle: prev.subtitle || meta.subtitle || '',
          authorName: prev.authorName || meta.author_name || '',
          description: prev.description || meta.description_html || '',
          keywords: prev.keywords.length > 0 ? prev.keywords : (meta.keywords || []),
          categories: prev.categories.length > 0 ? prev.categories : (meta.categories || []),
          pricing: prev.pricing || meta.suggested_price || '$9.99',
          trimSize: prev.trimSize || meta.trim_size || '6x9',
          metadata: meta
        }));
      }
    } catch (e: any) {
      console.warn("Metadata failed:", e);
      alert("Metadata generation failed. Make sure your API key has text generation enabled. " + (e.message || ""));
    }

    try {
      setGeneratingStep('Agent: Art Director is designing Cover...');
      cover = await createCover(idea, customApiKey, bookDetails.inspirationImage || undefined);
    } catch (e: any) {
      console.warn("Cover generation failed or forbidden:", e);
    }

    try {
      setGeneratingStep('Generating Audio Sample...');
      const fullManuscript = chapters.map(c => c.content).join('\n\n');
      audio = await synthesizeAudiobook(fullManuscript, customApiKey);
    } catch (e: any) {
      console.warn("Audio generation failed or forbidden:", e);
    }

    setAssets({ coverUrl: cover, metadata: meta || undefined, audioUrl: audio });
    setIsGenerating(false);
    setGeneratingStep('');
  };

  const handleNanoBananaCover = async () => {
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Consulting manus AI for a Premium Cover...');
    try {
      const promptText = (bookDetails.title || "Bestselling Book") + (bookDetails.subtitle ? ": " + bookDetails.subtitle : "");
      const cover = await createCover(promptText, customApiKey, bookDetails.inspirationImage || undefined, true);
      if (cover) {
        setAssets(prev => ({ ...prev, coverUrl: cover }));
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
      const newCover = await createCover(instruction, customApiKey, assets.coverUrl || undefined, true);
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

  const handleDownloadCanvasPng = async (mode: 'front' | 'back' | 'wrap') => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentIsbn = mockIsbn || '978-1-960123-45-6';
    const titleText = bookDetails.title || assets.metadata?.title || 'Book Title';
    const subtitleText = bookDetails.subtitle || assets.metadata?.subtitle || '';
    const authorText = bookDetails.authorName || user?.displayName || 'Author Name';
    const blurbText = assets.backCoverContent || bookDetails.description || 'A compelling narrative crafted with manus AI.';

    if (mode === 'front') {
      canvas.width = 1200;
      canvas.height = 1800;

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

        ctx.font = 'bold 72px sans-serif';
        fillWrappedCanvasText(ctx, titleText.toUpperCase(), 600, 240, 1000, 85);

        if (subtitleText) {
          ctx.font = 'italic 36px sans-serif';
          fillWrappedCanvasText(ctx, subtitleText, 600, 520, 1000, 48);
        }

        ctx.font = 'bold 42px serif';
        ctx.fillText(authorText.toUpperCase(), 600, 1600);
      }

      downloadBase64(canvas.toDataURL('image/png'), `${titleText.toLowerCase().replace(/\s+/g, '_')}_front_cover.png`);
    } else if (mode === 'back') {
      canvas.width = 1200;
      canvas.height = 1800;

      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';

      ctx.font = 'bold 54px sans-serif';
      fillWrappedCanvasText(ctx, titleText.toUpperCase(), 600, 180, 1040, 68);

      if (subtitleText) {
        ctx.font = 'italic 30px sans-serif';
        ctx.fillStyle = '#e4e4e7';
        fillWrappedCanvasText(ctx, subtitleText, 600, 320, 1000, 42);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(200, 380);
      ctx.lineTo(1000, 380);
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'left';
      fillWrappedCanvasText(ctx, blurbText, 120, 450, 960, 44);

      if (showBarcodeOnBack) {
        drawBarcodeOnCanvas(ctx, currentIsbn, 820, 1500, 260, 180);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("PUBLISHED WITH MANUS AI", 120, 1680);

      downloadBase64(canvas.toDataURL('image/png'), `${titleText.toLowerCase().replace(/\s+/g, '_')}_back_cover.png`);
    } else {
      const frontWidth = 1200;
      const backWidth = 1200;
      const spineWidth = Math.max(160, Math.min(600, Math.round(100 + spinePageCount * 1.25)));
      const totalWidth = backWidth + spineWidth + frontWidth;
      const canvasHeight = 1800;

      canvas.width = totalWidth;
      canvas.height = canvasHeight;

      // 1. Back Cover
      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(0, 0, backWidth, canvasHeight);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px sans-serif';
      fillWrappedCanvasText(ctx, titleText.toUpperCase(), 600, 180, 1040, 66);

      if (subtitleText) {
        ctx.font = 'italic 28px sans-serif';
        ctx.fillStyle = '#e4e4e7';
        fillWrappedCanvasText(ctx, subtitleText, 600, 320, 1000, 40);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(200, 380);
      ctx.lineTo(1000, 380);
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'left';
      fillWrappedCanvasText(ctx, blurbText, 120, 450, 960, 44);

      if (showBarcodeOnBack) {
        drawBarcodeOnCanvas(ctx, currentIsbn, 820, 1500, 260, 180);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText("PUBLISHED WITH MANUS AI", 120, 1680);

      // 2. Spine
      const spineX = backWidth;
      ctx.fillStyle = spineBgColor || '#18181b';
      ctx.fillRect(spineX, 0, spineWidth, canvasHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(spineX, 0);
      ctx.lineTo(spineX, canvasHeight);
      ctx.moveTo(spineX + spineWidth, 0);
      ctx.lineTo(spineX + spineWidth, canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      const spineCenterX = spineX + spineWidth / 2;
      ctx.translate(spineCenterX, canvasHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = spineTextColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`${titleText.toUpperCase()}  —  ${authorText}`, 0, 12);
      ctx.restore();

      // 3. Front Cover
      const frontX = spineX + spineWidth;
      ctx.fillStyle = backBgColor || '#18181b';
      ctx.fillRect(frontX, 0, frontWidth, canvasHeight);

      if (assets.coverUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, frontX, 0, frontWidth, canvasHeight);
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
          ctx.fillRect(frontX, 0, frontWidth, canvasHeight);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = 'bold 72px sans-serif';
        fillWrappedCanvasText(ctx, titleText.toUpperCase(), frontX + 600, 240, 1000, 85);

        if (subtitleText) {
          ctx.font = 'italic 36px sans-serif';
          fillWrappedCanvasText(ctx, subtitleText, frontX + 600, 520, 1000, 48);
        }

        ctx.font = 'bold 42px serif';
        ctx.fillText(authorText.toUpperCase(), frontX + 600, 1600);
      }

      downloadBase64(canvas.toDataURL('image/png'), `${titleText.toLowerCase().replace(/\s+/g, '_')}_full_wrap_cover.png`);
    }
  };

  const handleSuggestMetadata = async () => {
    let sourceConcept = idea.trim();

    if (!sourceConcept) {
      if (chapters.length > 0) {
        const titleHeader = bookDetails.title ? `Book Title: ${bookDetails.title}\n\n` : '';
        const chapterTitles = `Chapter Overview:\n` + chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
        const excerpts = chapters.slice(0, 4).map(c => `Chapter: ${c.title}\nExcerpt:\n${c.content.substring(0, 800)}`).join('\n\n');
        sourceConcept = `${titleHeader}${chapterTitles}\n\nManuscript Excerpts:\n${excerpts}`;
      } else if (outline.trim()) {
        sourceConcept = `Book Outline:\n${outline}`;
      } else if (bookDetails.title.trim()) {
        sourceConcept = `Book Title: ${bookDetails.title}`;
      }
    }

    if (!sourceConcept) {
      alert("Please define your book idea in Project Setup or import a manuscript first.");
      return;
    }
    
    setIsGenerating(true);
    setGeneratingStep('KDP Agent: Scanning Manuscript & Researching Market Trends...');
    try {
      const meta = await optimizeMetadata(sourceConcept, customApiKey, bookDetails?.language || 'English');
      if (meta) {
        // Map AI categories to dropdown if possible
        const mappedCategories = (meta.categories || []).map((c: string) => {
          if (c.includes("FICTION")) {
            if (c.includes("Fantasy")) return "FICTION / Fantasy / Epic";
            if (c.includes("Mystery")) return "FICTION / Mystery & Detective / General";
            if (c.includes("Romance")) return "FICTION / Romance / Contemporary";
            if (c.includes("Science Fiction") || c.includes("Sci-Fi")) return "FICTION / Science Fiction / General";
            if (c.includes("Thriller")) return "FICTION / Thrillers / Suspense";
            return "FICTION / General";
          }
          if (c.includes("Business")) return "NON-FICTION / Business & Economics / General";
          if (c.includes("Health") || c.includes("Fitness")) return "NON-FICTION / Health & Fitness / General";
          if (c.includes("Self-Help")) return "NON-FICTION / Self-Help / General";
          if (c.includes("Tech") || c.includes("Computer")) return "NON-FICTION / Technology / General";
          if (c.includes("Education")) return "NON-FICTION / Education / General";
          return "NON-FICTION / General";
        });

        setBookDetails(prev => ({
          ...prev,
          title: prev.title || meta.title || '',
          subtitle: prev.subtitle || meta.subtitle || '',
          authorName: prev.authorName || meta.author_name || user?.displayName || '',
          description: meta.description_html || prev.description,
          keywords: meta.keywords || prev.keywords,
          categories: mappedCategories.length > 0 ? mappedCategories : prev.categories,
          pricing: meta.suggested_price || prev.pricing,
          trimSize: meta.trim_size || prev.trimSize,
          metadata: meta
        }));
      }
    } catch (e: any) {
      const msg = e.message || "Unknown error";
      if (msg.includes("not valid") || msg.includes("API_KEY_INVALID")) {
        alert("Magic Fill failed: The API key is invalid. Please check your Gemini API key in Settings (bottom left gear icon).");
      } else if (msg.includes("quota") || msg.includes("429")) {
        alert("Magic Fill failed: Rate limit exceeded. Please wait a moment and try again.");
      } else {
        alert("Failed to suggest metadata: " + msg);
      }
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
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
      const errorMessage = error?.message || "Sorry, an error occurred.";
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
    img: ({ node, ...props }: any) => {
      const altId = props.alt || props.src || Math.random().toString();
      
      // Inline component to use state safely for each image instance.
      const ImageRenderer = () => {
        const storedImage = imageBag[altId] || (props.src && props.src.startsWith('data:') ? props.src : null);
        const [isGeneratingImg, setIsGeneratingImg] = useState(false);

        const handleGenerateAI = async () => {
          setIsGeneratingImg(true);
          try {
            const b64 = await generateInlineImage(`A clean, high quality editorial image or illustrative graphic for: ${props.alt}`, customApiKey);
            if (b64) {
              setImageBag((prev: any) => ({ ...prev, [altId]: b64 }));
            } else {
              alert("Image generation failed. AI returned empty data.");
            }
          } catch (e: any) {
            console.error(e);
            alert("Failed to generate image: " + (e.message || "Unknown error"));
          } finally {
            setIsGeneratingImg(false);
          }
        };

        if (!storedImage && (!props.src || props.src === '')) {
          return (
            <div className="my-6 border-2 border-dashed border-zinc-300 rounded-xl max-w-2xl mx-auto p-6 flex flex-col items-center justify-center text-center bg-zinc-50 relative overflow-hidden transition-colors">
              <UploadCloud className="w-8 h-8 text-indigo-400 mb-3" />
              <h4 className="text-sm font-semibold text-zinc-700">Add Image / Screenshot</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mb-5">
                The AI wanted to insert an image here: <br/><strong className="text-zinc-700">{props.alt || "Image Placeholder"}</strong>
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 relative z-20">
                  <label className="cursor-pointer bg-white border border-zinc-200 text-zinc-700 text-xs font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
                    Upload Custom
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(altId, e)}
                      className="hidden" 
                    />
                  </label>
                  <button 
                    onClick={handleGenerateAI}
                    disabled={isGeneratingImg}
                    className="bg-indigo-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                   >
                    {isGeneratingImg ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3" />}
                    {isGeneratingImg ? "Consulting Art Director..." : "Agent: Generate Image"}
                  </button>
              </div>
            </div>
          );
        }

        return <img src={storedImage || props.src} alt={props.alt} className="rounded-xl shadow-sm border border-zinc-200 my-6 max-w-full h-auto" />;
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
      <div className="flex flex-col h-screen items-center justify-center bg-zinc-50">
        <div className="bg-white p-10 rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full text-center">
            <BookOpen className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">manus</h1>
            <p className="text-zinc-500 mb-8">(byaiappsy) — Multi-user BYOK publication suite.</p>
            <button
                onClick={loginWithGoogle}
                className="w-full bg-indigo-600 text-white font-semibold flex items-center justify-center gap-3 py-3 rounded-xl hover:bg-indigo-700 transition"
            >
                Sign in with Google
            </button>
        </div>
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
      <aside className={`fixed md:relative z-40 w-[80vw] sm:w-64 bg-white border-r border-zinc-200 flex flex-col h-full flex-shrink-0 transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h1 className="text-base font-semibold tracking-tight">manus</h1>
          </div>
        </div>
        
        <div className="p-4 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50">
           <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
           <div className="flex-1 overflow-hidden">
               <p className="text-xs font-semibold text-zinc-900 truncate">{user.displayName}</p>
               <button onClick={logoutUser} className="text-[10px] text-zinc-500 hover:text-indigo-600 transition">Sign Out</button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2 mb-6">
            <button
              onClick={() => { setViewMode('library'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Library className="w-4 h-4" /> My Library
              </div>
            </button>
            <button
              onClick={handleCreateNewProject}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-zinc-600 hover:bg-zinc-100`}
            >
              <div className="flex items-center gap-3">
                <Plus className="w-4 h-4" /> New Book
              </div>
            </button>
          </nav>

          {projectId && (
            <div className="px-4 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              manus AI Pro
              <button 
                onClick={handleManuscriptAudit}
                title="manus AI Manuscript Audit"
                className="text-yellow-600 hover:text-yellow-700 transition-colors"
                disabled={isGenerating}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <nav className="space-y-1 px-2">
            <button
              onClick={() => { setViewMode('setup'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'setup' ? 'bg-indigo-50 text-indigo-700' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Settings className="w-4 h-4" /> Project Setup
            </button>
            <button
              onClick={() => { setViewMode('details'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'details' ? 'bg-indigo-50 text-indigo-700' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <FileText className="w-4 h-4" /> Book Details
            </button>
            <button
              onClick={() => { setViewMode('outline'); setMobileMenuOpen(false); }}
              disabled={!outline || !projectId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'outline' ? 'bg-indigo-50 text-indigo-700' : 
                (!outline || !projectId) ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <List className="w-4 h-4" /> Outline
            </button>
            <button
              onClick={() => { setViewMode('assets'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'assets' ? 'bg-emerald-50 text-emerald-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-emerald-50/60'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-600" /> Publish & Export
            </button>
            <button
              onClick={() => { setViewMode('marketing'); setMobileMenuOpen(false); }}
              disabled={!projectId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'marketing' ? 'bg-purple-50 text-purple-800 font-bold' : 
                !projectId ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-700 hover:bg-purple-50/60'
              }`}
            >
              <Megaphone className="w-4 h-4 text-purple-600" /> Marketing & PR Studio
            </button>
          </nav>

          {chapters.length > 0 && projectId && (
            <div className="mt-8 px-4">
              <div className="flex items-center justify-between mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <span>Chapters</span>
                <button 
                  onClick={handleAddChapter}
                  className="p-1 hover:bg-zinc-100 rounded text-indigo-600 transition-colors"
                  title="Add Chapter"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {chapters.map((chapter, idx) => {
                  const isAuthorPage = chapter.title.toLowerCase().includes('about the author');
                  return (
                    <div key={chapter.id} className="group relative">
                      <button
                        onClick={() => {
                          setActiveChapterId(chapter.id);
                          setViewMode('chapter');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left pr-14 ${
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
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt("Rename Chapter:", chapter.title);
                          if (newTitle) handleRenameChapter(chapter.id, newTitle);
                        }}
                        className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-indigo-600 transition-colors"
                        title="Rename"
                      >
                        <Type className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setChapterToDelete(chapter);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-zinc-400 hover:text-red-600 transition-colors"
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
                  className="w-full mt-3 flex justify-center items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-100 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  Generate {chapters.filter(c => c.status === 'idle').length} Unwritten
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-200">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <Key className="w-4 h-4" /> API Settings
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 relative min-w-0">
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center px-4 md:px-6 flex-shrink-0 justify-between gap-4">
          <div className="flex items-center gap-3 truncate">
            <button 
              className="md:hidden p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-zinc-800 truncate">
              {viewMode === 'library' && 'My Library'}
              {viewMode === 'setup' && 'Project Setup'}
              {viewMode === 'outline' && 'Book Outline'}
              {viewMode === 'chapter' && (chapters.find(c => c.id === activeChapterId)?.title || 'Chapter View')}
              {viewMode === 'assets' && 'Assets & Export'}
              {viewMode === 'marketing' && 'Marketing & PR Studio'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {projectId && (
              <>
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
                  <span>Marketing & PR</span>
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
                  <span>Publish & Export</span>
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

        {historyNotice && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border border-zinc-700">
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>{historyNotice}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            
            {viewMode === 'library' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">Your Bookshelf</h2>
                    <p className="text-sm text-zinc-500 mt-1">Manage all your generated projects. Projects save automatically.</p>
                  </div>
                  <div className="flex items-center gap-2.5">
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
                      <Plus className="w-4 h-4" /> Start New Book
                    </button>
                  </div>
                </div>

                {savedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-zinc-200 border-dashed text-center">
                    <BookOpen className="w-12 h-12 text-zinc-300 mb-4" />
                    <h3 className="text-lg font-medium text-zinc-900">No books yet</h3>
                    <p className="text-zinc-500 mt-1 mb-6 max-w-sm">Create your first project and it will be safely saved in your browser storage.</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCreateNewProject}
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        Create Project
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
                    {savedProjects.sort((a, b) => b.updatedAt - a.updatedAt).map(proj => (
                      <div 
                        key={proj.id} 
                        className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer relative flex flex-col h-[210px] overflow-hidden ${projectId === proj.id ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-zinc-200 hover:border-zinc-300'}`}
                        onClick={() => handleOpenProject(proj.id)}
                      >
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="font-semibold text-zinc-900 text-lg leading-tight line-clamp-2 mb-2">{proj.title}</h3>
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
                            title="Delete Project"
                          >
                            <X className="w-4 h-4" />
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
                  <p className="text-sm text-zinc-500 mb-6">Choose a category and write a detailed prompt for your book idea.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Manuscript Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
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

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-zinc-800 mb-2">
                      What is your book about?
                    </label>
                    <textarea
                      rows={5}
                      className="w-full rounded-xl border border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-zinc-50 resize-y shadow-sm mb-8"
                      placeholder="e.g., A comprehensive guide to intermittent fasting for seniors..."
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
                          <FileText className="w-4 h-4 text-zinc-500" /> Upload Reference Docs
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            multiple
                            accept=".txt,.md,.csv"
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
                              {sourceFiles.length} file(s) selected
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
                        <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                          <Tag className="w-4 h-4" /> Keywords (7 recommended)
                        </label>
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
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">BISAC Categories</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[0,1,2].map(i => (
                          <div key={i} className="relative group">
                            <select
                              value={bookDetails.categories[i] || ""}
                              onChange={(e) => {
                                const c = [...bookDetails.categories];
                                c[i] = e.target.value;
                                setBookDetails(prev => ({ ...prev, categories: c }));
                              }}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer pr-10"
                            >
                              <option value="">Select a Category</option>
                              <option value="FICTION / General">FICTION / General</option>
                              <option value="FICTION / Fantasy / Epic">FICTION / Fantasy / Epic</option>
                              <option value="FICTION / Mystery & Detective / General">FICTION / Mystery / General</option>
                              <option value="FICTION / Romance / Contemporary">FICTION / Romance / General</option>
                              <option value="FICTION / Science Fiction / General">FICTION / Sci-Fi / General</option>
                              <option value="FICTION / Thrillers / Suspense">FICTION / Thriller / Suspense</option>
                              <option value="NON-FICTION / General">NON-FICTION / General</option>
                              <option value="NON-FICTION / Business & Economics / General">BUSINESS / Economics</option>
                              <option value="NON-FICTION / Health & Fitness / General">HEALTH / Fitness</option>
                              <option value="NON-FICTION / Self-Help / General">SELF-HELP / Personal Growth</option>
                              <option value="NON-FICTION / Technology / General">TECHNOLOGY / Computers</option>
                              <option value="NON-FICTION / Education / General">EDUCATION / General</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </div>

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
                        <div className="flex-1 text-xs text-zinc-600 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 italic leading-relaxed">
                          "Top quality covers often rely on specific genre conventions. By providing an inspiration image, you help the Art Director agent understand the exact 'vibe' you are targeting."
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
                      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-zinc-200">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                        <p className="text-zinc-600 font-medium">Writing chapter...</p>
                        <p className="text-sm text-zinc-400 mt-2">This may take a minute for long chapters.</p>
                      </div>
                    );
                  }

                  return (
                    <ChapterView 
                      chapter={chapter} 
                      components={MarkdownComponents}
                      onContentChange={(content) => setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, content } : c))}
                      onRegenerate={() => handleGenerateChapter(chapter.id)} 
                      onDelete={() => setChapterToDelete(chapter)}
                      onUndo={handleUndo}
                      canUndo={historyIndex > 0}
                    />
                  );
                })()}
              </div>
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

                {chapters.length === 0 && (
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">KDP Book Description (HTML)</label>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(bookDetails.description || assets.metadata?.description_html || '');
                                alert("Description HTML copied to clipboard!");
                              }}
                              className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> Copy HTML
                            </button>
                          </div>
                          <div className="p-4 bg-zinc-900 text-zinc-300 rounded-xl font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border border-zinc-800">
                            {bookDetails.description || assets.metadata?.description_html || 'Write or generate a book description in Book Details or Auto-Generate All Assets.'}
                          </div>
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
                      <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button 
                            onClick={handleExportDocx}
                            disabled={isGenerating}
                            className="flex items-center gap-4 p-4 border border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50 rounded-2xl transition-all group cursor-pointer shadow-2xs"
                          >
                            <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <strong className="text-sm text-emerald-950 block font-bold">Amazon KDP (.docx)</strong>
                              <span className="text-[11px] text-emerald-700 font-medium">Formatted Print & eBook Ready</span>
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
                              <span className="text-[11px] text-zinc-500">Kindle Create & Editor Friendly</span>
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
                              <span className="text-[11px] text-zinc-500">Direct Kindle / ePub Upload</span>
                            </div>
                          </button>

                          <button 
                            onClick={() => {
                              window.print();
                            }}
                            className="flex items-center gap-4 p-4 border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 rounded-2xl transition-all group cursor-pointer shadow-2xs"
                          >
                            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                              <LifeBuoy className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <strong className="text-sm text-zinc-900 block font-bold">Print / Save as PDF</strong>
                              <span className="text-[11px] text-zinc-500">Print or Save PDF via Browser</span>
                            </div>
                          </button>
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
                           
                           {/* View Mode Selector Tabs */}
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
                                              {assets.backCoverContent || bookDetails.description || 'A compelling book crafted with manus AI.'}
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

                                {/* Primary Action Bar: Save, Edit, Overlay Toggle */}
                                <div className="grid grid-cols-2 gap-2 w-full">
                                  <button 
                                    onClick={handleSaveCover}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <Save className="w-3.5 h-3.5" /> Save Cover
                                  </button>
                                  <button 
                                    onClick={() => setShowCoverEditor(!showCoverEditor)}
                                    className={`text-[10px] font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 border ${
                                      showCoverEditor 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" /> {showCoverEditor ? 'Close Studio Controls' : 'Edit Print & Spine Options'}
                                  </button>
                                </div>

                                {/* PNG Download Buttons Row */}
                                <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-center">
                                    Download High-Resolution PNG Assets
                                  </span>
                                  <div className="grid grid-cols-3 gap-1.5 w-full">
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('wrap')}
                                      className="bg-zinc-900 text-white text-[10px] font-semibold py-2 px-1 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                      <Download className="w-3 h-3 text-emerald-400" /> Full Wrap (.png)
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('back')}
                                      className="bg-white border border-zinc-200 text-zinc-800 text-[10px] font-semibold py-2 px-1 rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                      <Download className="w-3 h-3 text-indigo-600" /> Back Cover (.png)
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadCanvasPng('front')}
                                      className="bg-white border border-zinc-200 text-zinc-800 text-[10px] font-semibold py-2 px-1 rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                      <Download className="w-3 h-3 text-indigo-600" /> Front Cover (.png)
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 w-full">
                                  <button 
                                    onClick={() => coverUploadRef.current?.click()}
                                    className="bg-white border border-zinc-200 text-zinc-700 text-[10px] font-semibold py-2 rounded-lg hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <UploadCloud className="w-3.5 h-3.5 text-zinc-500" /> Upload Custom Artwork
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
                                  <UploadCloud className="w-4 h-4 text-indigo-600" /> Upload Cover Image
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if(file) {
                                         const reader = new FileReader();
                                         reader.onload = (ev) => {
                                           setAssets(prev => ({ ...prev, coverUrl: ev.target?.result as string }));
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
                                 Describe changes to the cover or let manus AI design a modern bestseller cover for your manuscript.
                               </p>
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
                      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
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
                            Instantly publish your responsive book landing page to Google Cloud/Web or download standalone HTML for custom hosting.
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
                            title="1-Click Instant Web Publishing like Google AI Studio"
                          >
                            {isPublishingLanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-purple-200" />}
                            <span>{publishedLandingData ? 'Manage Live Publishing' : '⚡ Instant Publish to Web'}</span>
                          </button>

                          <button
                            onClick={() => exportLandingPageHtml(bookDetails, landingCopyData, assets.coverUrl)}
                            className="bg-zinc-800 hover:bg-zinc-900 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-emerald-400" /> Export .html
                          </button>
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
                          <span className="text-[10px] bg-zinc-800 px-2.5 py-1 rounded-full text-purple-300 font-semibold">Live Interactive Preview</span>
                        </div>

                        <div className="bg-zinc-50 text-zinc-900 rounded-b-xl overflow-hidden mt-3 max-h-[650px] overflow-y-auto custom-scrollbar">
                          {/* Live Preview Content */}
                          <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-12">
                            
                            {/* Hero */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-zinc-200 pb-12">
                              <div className="md:col-span-7 space-y-4">
                                <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
                                  Official Book Launch
                                </span>
                                <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 leading-tight font-serif">
                                  {landingCopyData?.heroHeadline || bookDetails.title || 'Transformative New Release'}
                                </h1>
                                <p className="text-zinc-600 text-sm md:text-base leading-relaxed">
                                  {landingCopyData?.heroSubheadline || bookDetails.subtitle || bookDetails.description || 'Discover key insights and practical strategies in this groundbreaking book.'}
                                </p>
                                <div className="pt-2 flex flex-wrap gap-3">
                                  <a href="#buy" onClick={(e) => { e.preventDefault(); alert('In your exported HTML file, this button redirects readers to your Amazon/Barnes & Noble buy page!'); }} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl text-xs shadow-md">
                                    {landingCopyData?.heroCtaText || 'Buy Now on Amazon'}
                                  </a>
                                  <button onClick={() => alert("Free sample preview active!")} className="bg-white border border-zinc-300 text-zinc-800 font-semibold px-5 py-3 rounded-xl text-xs hover:bg-zinc-100">
                                    Read Sample Chapter
                                  </button>
                                </div>
                              </div>

                              <div className="md:col-span-5 flex justify-center">
                                {assets.coverUrl ? (
                                  <img src={assets.coverUrl} alt="Cover" className="w-48 md:w-56 rounded-xl shadow-2xl border border-zinc-200 object-cover" />
                                ) : (
                                  <div className="w-48 h-64 bg-zinc-200 rounded-xl border border-zinc-300 flex items-center justify-center text-zinc-400 text-xs font-bold">
                                    Book Cover Image
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Takeaways */}
                            <div className="space-y-4">
                              <h2 className="text-xl font-bold text-zinc-900 font-serif text-center">What You Will Discover</h2>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {(landingCopyData?.keyTakeaways || [
                                  "Actionable strategies to accelerate personal and professional growth",
                                  "Real-world frameworks tested across thousands of readers",
                                  "Proven methods to overcome obstacles and master key skills",
                                  "Step-by-step guidance designed for practical application"
                                ]).map((item: string, idx: number) => (
                                  <div key={idx} className="bg-white p-3 rounded-xl border border-zinc-200 flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="text-zinc-700">{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Testimonials */}
                            <div className="space-y-4">
                              <h2 className="text-xl font-bold text-zinc-900 font-serif text-center">Early Praise</h2>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(landingCopyData?.testimonials || [
                                  { quote: "An absolute game-changer. I could not put it down!", name: "Elena Rostova", title: "Literary Reviewer" },
                                  { quote: "Required reading for anyone serious about mastering this subject.", name: "David Chen", title: "Bestselling Author" }
                                ]).map((t: any, idx: number) => (
                                  <div key={idx} className="bg-white p-4 rounded-xl border border-zinc-200 text-xs space-y-2">
                                    <p className="text-zinc-600 italic">"{t.quote}"</p>
                                    <div className="font-bold text-zinc-800">{t.name} <span className="text-purple-600 font-normal">({t.title})</span></div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
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
                </div>

                {/* Category Prompts */}
                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center justify-between mb-4">
                    Category System Prompts
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full normal-case">manus config</span>
                  </h4>
                  <p className="text-xs text-zinc-500 mb-6">Define the specific rules, tone, and system prompt the AI should follow when generating chapters for each specific manuscript category.</p>

                  <div className="space-y-6">
                    {Object.entries(CATEGORIES).map(([catKey, label]) => {
                      return (
                        <div key={catKey}>
                          <label className="block text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                            {label}
                          </label>
                          <textarea
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                            rows={3}
                            placeholder={`Enter formatting rules for ${label} (e.g. "Always use academic tone...")`}
                            defaultValue={"You are an expert ghostwriter. Output strictly formatted markdown without filler."}
                            onChange={(e) => {
                               getUserSettings().then((s) => {
                                 const currentPrompts = s?.prompts || {};
                                 saveUserSettings({ prompts: { ...currentPrompts, [catKey]: e.target.value } });
                               });
                            }}
                          ></textarea>
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
                    accept=".md,.markdown,.txt" 
                    onChange={handleFileUploadMd} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-indigo-600 mx-auto transition-colors" />
                  <p className="text-xs font-semibold text-zinc-700 mt-2">
                    {mdFileName ? `Loaded: ${mdFileName}` : "Click or drag .md / .txt manuscript file"}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Supports Markdown (.md) and plain text (.txt)</p>
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
                  onClick={() => exportLandingPageHtml(bookDetails, landingCopyData, assets.coverUrl)}
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

    </div>
  );
}
