import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, List, Sparkles, Megaphone, Globe, Download, DollarSign, Users, Mic, Settings, X, ArrowRight, TrendingUp } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: { id: string; title: string }[];
  onSelectChapter: (id: string) => void;
  onNavigateTab: (tab: string, subTab?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  chapters,
  onSelectChapter,
  onNavigateTab
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tools = [
    { name: '1. Amazon Niche & Keyword Spotter', desc: 'Search demand, competition BSR, keywords & reader complaint gaps', icon: TrendingUp, tab: 'research' },
    { name: '2. Concept & Audience', desc: 'Target Audience, Niche Research & Positioning', icon: Settings, tab: 'setup' },
    { name: '3. Book Details & Keywords', desc: 'Title, Subtitle, Description, KDP Categories', icon: FileText, tab: 'details' },
    { name: '4. Book Outline', desc: 'Structure chapters, topics & word count goals', icon: List, tab: 'outline' },
    { name: '5. Table of Contents Studio', desc: 'Auto-generate, format & sync interactive TOC for KDP & print', icon: FileText, tab: 'toc' },
    { name: '6. Beta Reader Simulator', desc: 'AI persona feedback, pacing & plot critique', icon: Users, tab: 'marketing', subTab: 'beta_readers' },
    { name: '7. Audiobook Script Assistant', desc: 'ACX voice actor script, tone cues & duration', icon: Mic, tab: 'marketing', subTab: 'audiobook_script' },
    { name: '8. Official Press Release', desc: 'PR Newswire compliant launch release', icon: Megaphone, tab: 'marketing', subTab: 'press_release' },
    { name: '9. Amazon Sales Copy & Blurb', desc: 'High-converting HTML product description', icon: Sparkles, tab: 'marketing', subTab: 'sales_copy' },
    { name: '10. Social Media Campaign', desc: '14-day BookTok & Instagram promo posts', icon: Megaphone, tab: 'marketing', subTab: 'social_media' },
    { name: '11. Instant Web Landing Page', desc: '1-click published book landing page', icon: Globe, tab: 'marketing', subTab: 'landing_page' },
    { name: '12. Royalty & Price Calculator', desc: 'Optimize list price, KDP print fees & profit margin', icon: DollarSign, tab: 'assets', subTab: 'price_royalty' },
    { name: '13. Book Cover Generator', desc: 'AI visual prompts for front & back cover', icon: Sparkles, tab: 'assets', subTab: 'cover' },
    { name: '14. Publish & Export Center', desc: 'KDP validation, .docx & .zip export bundle', icon: Download, tab: 'assets', subTab: 'export' }
  ];

  const filteredTools = tools.filter(t => 
    t.name.toLowerCase().includes(query.toLowerCase()) || 
    t.desc.toLowerCase().includes(query.toLowerCase())
  );

  const filteredChapters = chapters.filter(c => 
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-20 px-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/80">
          <Search className="w-5 h-5 text-indigo-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, tool name, or chapter title... (Esc to close)"
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Tools & Features */}
          {filteredTools.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-2">
                Tools & Workflows
              </div>
              <div className="space-y-1">
                {filteredTools.map((tool, idx) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        onNavigateTab(tool.tab, tool.subTab);
                        onClose();
                      }}
                      className="w-full text-left flex items-center justify-between p-3 hover:bg-indigo-50/70 rounded-xl transition-colors group border border-transparent hover:border-indigo-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-zinc-900 group-hover:text-indigo-900">{tool.name}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{tool.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chapters */}
          {filteredChapters.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 mb-2">
                Manuscript Chapters
              </div>
              <div className="space-y-1">
                {filteredChapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onSelectChapter(ch.id);
                      onClose();
                    }}
                    className="w-full text-left flex items-center justify-between p-2.5 hover:bg-zinc-100 rounded-xl transition-colors text-xs font-medium text-zinc-800"
                  >
                    <span className="truncate flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Chapter {idx + 1}: {ch.title}</span>
                    </span>
                    <span className="text-[10px] text-zinc-400">Jump to Editor</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredTools.length === 0 && filteredChapters.length === 0 && (
            <div className="p-8 text-center text-xs text-zinc-400">
              No matching tools or chapters found for "{query}".
            </div>
          )}
        </div>

        <div className="p-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded font-mono text-[10px] text-zinc-700">Cmd+K</kbd> anywhere to open search</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
