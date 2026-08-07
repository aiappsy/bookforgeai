import React, { useState } from 'react';
import { Sparkles, Brain, Plus, Trash2, CheckCircle2, ShieldCheck, ArrowRight, BookOpen, Layers, X, Edit3, RotateCw } from 'lucide-react';
import { LearnedRule, summarizeChapterForContinuity } from '../services/geminiService';

interface ChapterItem {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
}

interface ContinuityMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedRules: LearnedRule[];
  chapterSummaries: Record<string, string>;
  chapters: ChapterItem[];
  onUpdateLearnedRules: (rules: LearnedRule[]) => void;
  onUpdateChapterSummary: (chapterId: string, summary: string) => void;
  customApiKey?: string;
}

export const ContinuityMemoryModal: React.FC<ContinuityMemoryModalProps> = ({
  isOpen,
  onClose,
  learnedRules,
  chapterSummaries,
  chapters,
  onUpdateLearnedRules,
  onUpdateChapterSummary,
  customApiKey
}) => {
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<'style' | 'tone' | 'character' | 'plot' | 'formatting'>('style');
  const [isSummarizingMap, setIsSummarizingMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    const ruleObj: LearnedRule = {
      id: 'rule_manual_' + Date.now(),
      rule: newRuleText.trim(),
      category: newRuleCategory,
      learnedFromChapterTitle: 'Author Direct Input',
      createdAt: Date.now()
    };
    onUpdateLearnedRules([...learnedRules, ruleObj]);
    setNewRuleText('');
  };

  const handleDeleteRule = (id: string) => {
    onUpdateLearnedRules(learnedRules.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all learned editorial rules?")) {
      onUpdateLearnedRules([]);
    }
  };

  const handleResummarize = async (ch: ChapterItem) => {
    if (!ch.content || ch.content.trim().length < 30) return;
    setIsSummarizingMap(prev => ({ ...prev, [ch.id]: true }));
    try {
      const summary = await summarizeChapterForContinuity(ch.title, ch.content, customApiKey);
      if (summary) {
        onUpdateChapterSummary(ch.id, summary);
      }
    } catch (e) {
      console.warn("Failed to summarize chapter:", e);
    } finally {
      setIsSummarizingMap(prev => ({ ...prev, [ch.id]: false }));
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'character': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'tone': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'plot': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'formatting': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-400/30 text-amber-300">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                AI Cross-Chapter Cohesion & Editorial Memory
              </h2>
              <p className="text-xs text-indigo-200">
                The AI automatically learns from your corrections and enforces rules across all upcoming chapters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">

          {/* Section 1: Learned Editorial Rules */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Learned Style & Editorial Rules ({learnedRules.length})
                </h3>
                <p className="text-xs text-zinc-500">
                  Rules extracted from your chapter critiques and chat edits. Enforced automatically when writing new chapters.
                </p>
              </div>
              {learnedRules.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Rules
                </button>
              )}
            </div>

            {/* Rules List */}
            {learnedRules.length === 0 ? (
              <div className="p-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
                <p className="text-sm font-semibold text-zinc-700">No Learned Rules Yet</p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  As you give feedback in chapter chat or request AI edits, the ghostwriter will automatically learn your preferences and list them here! You can also manually add rules below.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {learnedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3.5 bg-zinc-50 hover:bg-indigo-50/40 rounded-xl border border-zinc-200 flex items-start justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${getCategoryBadgeClass(rule.category)}`}>
                          {rule.category}
                        </span>
                        {rule.learnedFromChapterTitle && (
                          <span className="text-[11px] text-zinc-400">
                            Learned from: <strong className="text-zinc-600 font-medium">{rule.learnedFromChapterTitle}</strong>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-zinc-800 leading-relaxed">
                        "{rule.rule}"
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      title="Remove rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Rule Form */}
            <div className="p-4 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-pink-50/50 rounded-xl border border-indigo-100 space-y-3">
              <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> Add Custom Rule / Style Directive Manually
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as any)}
                  className="px-3 py-2 text-xs bg-white border border-zinc-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="style">Style</option>
                  <option value="tone">Tone</option>
                  <option value="character">Character</option>
                  <option value="plot">Plot</option>
                  <option value="formatting">Formatting</option>
                </select>
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                  placeholder="e.g., Protagonist Jack always uses metric measurements and concise sentences..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddRule}
                  disabled={!newRuleText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                >
                  Add Rule
                </button>
              </div>
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* Section 2: Chapter Continuity & Narrative Progression Map */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" /> Manuscript Continuity & Narrative Bridge Map
              </h3>
              <p className="text-xs text-zinc-500">
                The AI maintains a continuous memory of events, decisions, and endings across all completed chapters.
              </p>
            </div>

            <div className="space-y-3">
              {chapters.map((ch, idx) => {
                const summary = chapterSummaries[ch.id];
                const isGenerated = ch.status === 'done' && ch.content && ch.content.trim().length > 50;
                const isLoading = !!isSummarizingMap[ch.id];

                return (
                  <div key={ch.id} className="relative pl-6 pb-2 border-l-2 border-indigo-200 last:border-l-transparent">
                    {/* Circle Node */}
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-sm flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-indigo-200 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-500" />
                          Chapter {idx + 1}: {ch.title}
                        </span>
                        {isGenerated ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Generated ({ch.content.split(/\s+/).length} words)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-100 text-zinc-500 rounded-full">
                            Not Generated Yet
                          </span>
                        )}
                      </div>

                      {summary ? (
                        <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 italic">
                          "{summary}"
                        </p>
                      ) : isGenerated ? (
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>Continuity snapshot available.</span>
                          <button
                            onClick={() => handleResummarize(ch)}
                            disabled={isLoading}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                            {isLoading ? 'Generating Summary...' : 'Generate Summary'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">
                          Will automatically link continuity when this chapter is generated.
                        </p>
                      )}

                      {idx < chapters.length - 1 && isGenerated && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold">
                          <ArrowRight className="w-3.5 h-3.5" /> Bridges smoothly into Chapter {idx + 2}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Enforced during AI Chapter Generation & Ghostwriter Chat.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
