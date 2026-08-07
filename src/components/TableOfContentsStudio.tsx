import React, { useState, useMemo } from 'react';
import { 
  ListTree, 
  BookOpen, 
  Copy, 
  Check, 
  Plus, 
  ArrowRight, 
  Sparkles, 
  Settings, 
  Eye, 
  RefreshCw, 
  Type, 
  Hash, 
  Clock, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  AlignLeft, 
  FileText,
  Layers,
  Search,
  CheckCircle2
} from 'lucide-react';

export interface Chapter {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
}

export interface BookDetails {
  title?: string;
  subtitle?: string;
  authorName?: string;
  trimSize?: string;
  language?: string;
}

interface TableOfContentsStudioProps {
  chapters: Chapter[];
  bookDetails: BookDetails;
  onSelectChapter: (chapterId: string) => void;
  onInsertTocChapter: (tocMarkdown: string) => void;
  onUpdateChapterTitle?: (chapterId: string, newTitle: string) => void;
}

export interface Subheading {
  level: number; // 2 for H2, 3 for H3
  text: string;
  id: string;
}

export interface TocChapterItem {
  index: number;
  id: string;
  title: string;
  wordCount: number;
  readingTimeMin: number;
  startPage: number;
  subheadings: Subheading[];
}

export const TableOfContentsStudio: React.FC<TableOfContentsStudioProps> = ({
  chapters,
  bookDetails,
  onSelectChapter,
  onInsertTocChapter,
  onUpdateChapterTitle
}) => {
  // Settings State
  const [includeSubheadings, setIncludeSubheadings] = useState<boolean>(false);
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(true);
  const [showWordCount, setShowWordCount] = useState<boolean>(true);
  const [showReadingTime, setShowReadingTime] = useState<boolean>(true);
  const [tocStyle, setTocStyle] = useState<'kdp_dots' | 'modern_clean' | 'academic' | 'hyperlinked'>('kdp_dots');
  const [wordsPerPage, setWordsPerPage] = useState<number>(275);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Helper to format clean chapter titles without duplicate "Chapter X: Chapter X:" or noise
  const formatCleanTitle = (title: string, index: number) => {
    if (!title) return `Chapter ${index}`;
    const trimmed = title.trim();
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
  
  // UI Notice State
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [insertedNotice, setInsertedNotice] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Filter out any existing 'Table of Contents' chapter to avoid self-referencing in calculation
  const contentChapters = useMemo(() => {
    return chapters.filter(c => !c.title.toLowerCase().includes('table of contents') && !c.title.toLowerCase().includes('contents'));
  }, [chapters]);

  // Parse Subheadings and Calculate Word Counts & Page Numbers
  const tocItems: TocChapterItem[] = useMemo(() => {
    let currentCumulativeWords = 0;
    // Assume Front matter (Title, Copyright, TOC) occupies ~4 pages
    const FRONT_MATTER_PAGES = 4;

    return contentChapters.map((ch, idx) => {
      const content = ch.content || '';
      const words = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
      const readingTime = Math.max(1, Math.ceil(words / 220)); // ~220 words per min
      
      const startPage = FRONT_MATTER_PAGES + Math.floor(currentCumulativeWords / wordsPerPage) + 1;
      currentCumulativeWords += words;

      // Extract H2 (##) and H3 (###) subheadings from markdown
      const subheadings: Subheading[] = [];
      const lines = content.split('\n');
      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
          subheadings.push({
            level: 2,
            text: trimmed.replace(/^##\s+/, '').replace(/[\*\_]/g, ''),
            id: `sub-${ch.id}-${lineIdx}`
          });
        } else if (trimmed.startsWith('### ')) {
          subheadings.push({
            level: 3,
            text: trimmed.replace(/^###\s+/, '').replace(/[\*\_]/g, ''),
            id: `sub-${ch.id}-${lineIdx}`
          });
        }
      });

      return {
        index: idx + 1,
        id: ch.id,
        title: ch.title || `Chapter ${idx + 1}`,
        wordCount: words,
        readingTimeMin: readingTime,
        startPage,
        subheadings
      };
    });
  }, [contentChapters, wordsPerPage]);

  // Filtered TOC Items based on search
  const filteredTocItems = useMemo(() => {
    if (!searchQuery.trim()) return tocItems;
    const q = searchQuery.toLowerCase();
    return tocItems.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.subheadings.some(s => s.text.toLowerCase().includes(q))
    );
  }, [tocItems, searchQuery]);

  // Totals
  const totalWords = useMemo(() => tocItems.reduce((acc, item) => acc + item.wordCount, 0), [tocItems]);
  const totalPages = useMemo(() => Math.max(4, 4 + Math.ceil(totalWords / wordsPerPage)), [totalWords, wordsPerPage]);
  const totalReadingTime = useMemo(() => tocItems.reduce((acc, item) => acc + item.readingTimeMin, 0), [tocItems]);
  const totalSubheadings = useMemo(() => tocItems.reduce((acc, item) => acc + item.subheadings.length, 0), [tocItems]);

  // Toggle chapter expansion
  const toggleChapterExpand = (id: string) => {
    setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    tocItems.forEach(item => { next[item.id] = true; });
    setExpandedChapters(next);
  };

  const collapseAll = () => {
    setExpandedChapters({});
  };

  // Generate Formatted Markdown String for inserting or copying
  const generatedTocMarkdown = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# Table of Contents\n`);
    lines.push(`*${bookDetails.title || 'Manuscript'} — ${contentChapters.length} Chapters · ${totalWords.toLocaleString()} Words*\n`);
    lines.push(`---\n`);

    tocItems.forEach((item) => {
      const itemTitle = formatCleanTitle(item.title, item.index);

      if (tocStyle === 'kdp_dots') {
        const pageStr = showPageNumbers ? ` ................................. ${item.startPage}` : '';
        lines.push(`**${itemTitle}**${pageStr}`);
      } else if (tocStyle === 'modern_clean') {
        const metaStr = [
          showPageNumbers ? `Page ${item.startPage}` : null,
          showWordCount ? `${item.wordCount.toLocaleString()} words` : null,
          showReadingTime ? `${item.readingTimeMin} min read` : null
        ].filter(Boolean).join(' · ');
        
        lines.push(`### ${itemTitle}`);
        if (metaStr) lines.push(`*${metaStr}*\n`);
      } else if (tocStyle === 'academic') {
        lines.push(`**${item.index}.0  ${item.title}** ${showPageNumbers ? `(p. ${item.startPage})` : ''}`);
      } else if (tocStyle === 'hyperlinked') {
        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        lines.push(`- [${itemTitle}](#${slug}) ${showPageNumbers ? `— *Page ${item.startPage}*` : ''}`);
      }

      // Add subheadings if enabled
      if (includeSubheadings && item.subheadings.length > 0) {
        item.subheadings.forEach((sub) => {
          const indent = sub.level === 3 ? '    - ' : '  - ';
          lines.push(`${indent}${sub.text}`);
        });
      }
      lines.push('');
    });

    return lines.join('\n');
  }, [tocItems, tocStyle, includeSubheadings, showPageNumbers, showWordCount, showReadingTime, bookDetails, totalWords, contentChapters.length]);

  const handleCopyTocText = () => {
    navigator.clipboard.writeText(generatedTocMarkdown);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 3000);
  };

  const handleInsertTocChapter = () => {
    onInsertTocChapter(generatedTocMarkdown);
    setInsertedNotice(true);
    setTimeout(() => setInsertedNotice(false), 4000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50">
      {/* Studio Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ListTree className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900">Table of Contents Studio</h1>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                KDP & Print Ready
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Auto-generate, format, and synchronize an interactive Table of Contents for Amazon KDP, EPUB, and print manuscripts.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleCopyTocText}
              className="px-3.5 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
            >
              {copiedNotice ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-zinc-500" />}
              {copiedNotice ? 'Copied to Clipboard!' : 'Copy Formatted TOC'}
            </button>

            <button
              onClick={handleInsertTocChapter}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Insert / Sync TOC in Manuscript
            </button>
          </div>
        </div>

        {insertedNotice && (
          <div className="max-w-7xl mx-auto mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Table of Contents synchronized!</strong> A formatted "Table of Contents" chapter has been placed in your book workspace.
            </span>
          </div>
        )}

        {/* Stats Strip */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-zinc-100">
          <div className="bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Chapters</span>
            <span className="text-sm font-bold text-zinc-800">{tocItems.length} Sections</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Subheadings (H2/H3)</span>
            <span className="text-sm font-bold text-zinc-800">{totalSubheadings} Headings</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Total Words</span>
            <span className="text-sm font-bold text-zinc-800">{totalWords.toLocaleString()}</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Est. Print Pages</span>
            <span className="text-sm font-bold text-indigo-700">~{totalPages} Pages</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Est. Reading Time</span>
            <span className="text-sm font-bold text-zinc-800">~{totalReadingTime} Mins</span>
          </div>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Format Controls & Settings (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  Formatting & Display Options
                </h2>
              </div>

              {/* Preset Selector */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-2 block">TOC Design Style</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setTocStyle('kdp_dots')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                      tocStyle === 'kdp_dots' 
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium shadow-2xs' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0 mt-0.5">
                      <AlignLeft className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="block font-bold">Classic KDP Dot Leaders</strong>
                      <span className="text-[11px] text-zinc-500">Traditional print style with right-aligned page numbers</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTocStyle('modern_clean')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                      tocStyle === 'modern_clean' 
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium shadow-2xs' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="block font-bold">Modern Minimalist</strong>
                      <span className="text-[11px] text-zinc-500">Spacious typography with word count & reading time badges</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTocStyle('academic')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                      tocStyle === 'academic' 
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium shadow-2xs' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0 mt-0.5">
                      <Hash className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="block font-bold">Academic / Structured</strong>
                      <span className="text-[11px] text-zinc-500">Numbered hierarchy (1.0, 1.1, 1.2) ideal for guidebooks</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTocStyle('hyperlinked')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all flex items-start gap-3 ${
                      tocStyle === 'hyperlinked' 
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-medium shadow-2xs' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0 mt-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <strong className="block font-bold">Interactive Kindle eBook</strong>
                      <span className="text-[11px] text-zinc-500">Clickable anchor links formatted for EPUB and Kindle devices</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-3 border-t border-zinc-100">
                <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-zinc-800">
                  <span className="flex items-center gap-2">
                    <ListTree className="w-3.5 h-3.5 text-zinc-500" />
                    Include Subheadings (H2 & H3)
                  </span>
                  <input
                    type="checkbox"
                    checked={includeSubheadings}
                    onChange={(e) => setIncludeSubheadings(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-zinc-800">
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    Display Estimated Page Numbers
                  </span>
                  <input
                    type="checkbox"
                    checked={showPageNumbers}
                    onChange={(e) => setShowPageNumbers(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-zinc-800">
                  <span className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-zinc-500" />
                    Display Word Counts
                  </span>
                  <input
                    type="checkbox"
                    checked={showWordCount}
                    onChange={(e) => setShowWordCount(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-zinc-800">
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    Display Reading Time
                  </span>
                  <input
                    type="checkbox"
                    checked={showReadingTime}
                    onChange={(e) => setShowReadingTime(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Words Per Page Calibration */}
              <div className="pt-3 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Page Calculation Density</label>
                  <span className="text-xs font-bold text-indigo-600">{wordsPerPage} words/page</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="400"
                  step="25"
                  value={wordsPerPage}
                  onChange={(e) => setWordsPerPage(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-400 block mt-1">
                  Standard trade paperback (6x9): ~250-280 words per page.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive TOC List & Paper Preview (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Tab Switcher: Outline Tree vs. Print Preview */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-2 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'editor'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <ListTree className="w-3.5 h-3.5" />
                  Interactive TOC Tree ({filteredTocItems.length})
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'preview'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Print & Page Preview
                </button>
              </div>

              {activeTab === 'editor' && (
                <div className="flex items-center gap-2 px-2">
                  <button
                    onClick={expandAll}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Expand All
                  </button>
                  <span className="text-zinc-300">•</span>
                  <button
                    onClick={collapseAll}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: INTERACTIVE TOC TREE VIEW */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chapters or subheadings in TOC..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>

                {/* Chapter List */}
                {filteredTocItems.length === 0 ? (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
                    <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-zinc-700">No chapters found</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Try clearing your search query or add chapters to your book workspace.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTocItems.map((item) => {
                      const isExpanded = expandedChapters[item.id] ?? true;
                      const hasSubheadings = item.subheadings.length > 0;
                      const isAuthor = item.title.toLowerCase().includes('about the author');

                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-zinc-200 hover:border-indigo-300 rounded-2xl p-4 transition-all shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                onClick={() => toggleChapterExpand(item.id)}
                                className={`p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors ${!hasSubheadings && 'opacity-30 cursor-default'}`}
                                disabled={!hasSubheadings}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>

                              <div className="w-7 h-7 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                                {isAuthor ? '★' : item.index}
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-2">
                                  {isAuthor ? 'About the Author' : item.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium mt-0.5">
                                  <span>{item.wordCount.toLocaleString()} words</span>
                                  <span>•</span>
                                  <span>~{item.readingTimeMin} min read</span>
                                  {hasSubheadings && (
                                    <>
                                      <span>•</span>
                                      <span className="text-indigo-600 font-semibold">{item.subheadings.length} subheadings</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Page Badge & Jump Link */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-zinc-200">
                                Page {item.startPage}
                              </div>

                              <button
                                onClick={() => onSelectChapter(item.id)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="Jump to Chapter Editor"
                              >
                                Edit Chapter <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Subheadings (H2, H3) */}
                          {includeSubheadings && hasSubheadings && isExpanded && (
                            <div className="pl-12 pt-2 border-t border-zinc-100 space-y-1.5">
                              {item.subheadings.map((sub) => (
                                <div
                                  key={sub.id}
                                  className={`flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-zinc-50/80 hover:bg-indigo-50/50 text-zinc-700 transition-colors ${
                                    sub.level === 3 ? 'ml-4 border-l-2 border-zinc-300' : 'font-medium'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                      H{sub.level}
                                    </span>
                                    <span className="truncate">{sub.text}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRINT & MANUSCRIPT PAGE MOCKUP PREVIEW */}
            {activeTab === 'preview' && (
              <div className="bg-zinc-200/80 rounded-2xl p-6 sm:p-10 flex justify-center">
                {/* Paper Canvas Container (6x9 aspect ratio feel) */}
                <div className="w-full max-w-[560px] bg-white text-zinc-900 rounded-sm shadow-xl p-8 sm:p-12 font-serif border border-zinc-300 min-h-[680px] flex flex-col justify-between">
                  <div>
                    {/* Running Header */}
                    <div className="text-center text-[10px] uppercase tracking-widest text-zinc-400 font-sans border-b border-zinc-200 pb-2 mb-8">
                      {bookDetails.title || 'MANUSCRIPT TITLE'} — CONTENTS
                    </div>

                    {/* Section Title */}
                    <h2 className="text-center text-xl font-bold tracking-wider uppercase mb-8 text-zinc-900 border-b-2 border-zinc-900 pb-3">
                      Contents
                    </h2>

                    {/* Content Items */}
                    <div className="space-y-4 text-xs leading-relaxed">
                      {tocItems.map((item) => {
                        const isAuthor = item.title.toLowerCase().includes('about the author');
                        const itemTitle = isAuthor ? 'About the Author' : `Chapter ${item.index}: ${item.title}`;

                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-bold text-zinc-900 shrink-0">
                                {itemTitle}
                              </span>

                              {tocStyle === 'kdp_dots' && showPageNumbers && (
                                <span className="flex-1 border-b border-dotted border-zinc-400 mx-1 relative top-[-3px]" />
                              )}

                              {showPageNumbers && (
                                <span className="font-sans text-[11px] font-semibold text-zinc-700 shrink-0">
                                  {item.startPage}
                                </span>
                              )}
                            </div>

                            {/* Subheadings in Preview */}
                            {includeSubheadings && item.subheadings.length > 0 && (
                              <div className="pl-4 space-y-0.5 text-[11px] text-zinc-600 font-sans">
                                {item.subheadings.map((sub) => (
                                  <div key={sub.id} className="flex items-center justify-between text-zinc-500">
                                    <span className={sub.level === 3 ? 'pl-3 italic text-[10px]' : ''}>
                                      • {sub.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Page Number */}
                  <div className="text-center text-[11px] font-sans text-zinc-400 pt-8 border-t border-zinc-100">
                    4
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
};
