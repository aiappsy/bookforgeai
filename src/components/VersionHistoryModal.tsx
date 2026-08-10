import React, { useState } from 'react';
import {
  X,
  History,
  RotateCcw,
  Check,
  FileText,
  Sparkles,
  Clock,
  ShieldCheck,
  ArrowRight,
  Eye,
  AlertCircle
} from 'lucide-react';

export interface ChapterRevision {
  id: string;
  timestamp: number;
  label: string; // e.g., "Original Draft", "Humanized Pass", "Manual Edit"
  content: string;
  wordCount: number;
  aiScore?: number;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  revisions: ChapterRevision[];
  currentContent: string;
  onRestoreRevision: (revision: ChapterRevision) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  chapterTitle,
  revisions,
  currentContent,
  onRestoreRevision
}) => {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    revisions.length > 0 ? revisions[revisions.length - 1].id : ''
  );
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('preview');
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedRevision = revisions.find((r) => r.id === selectedRevisionId) || revisions[revisions.length - 1];

  const handleRestore = (rev: ChapterRevision) => {
    onRestoreRevision(rev);
    setRestoredNotice(`Successfully restored "${rev.label}"!`);
    setTimeout(() => {
      setRestoredNotice(null);
      onClose();
    }, 1500);
  };

  const getWordCount = (str: string) => str.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-6 flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-indigo-950 text-white p-6 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Chapter Revision History & Safety Net</h2>
                <span className="text-[10px] font-black uppercase bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  {revisions.length} Snapshot{revisions.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Compare drafts, review humanizer changes, or revert to any previous snapshot for: <strong>{chapterTitle}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {restoredNotice && (
          <div className="bg-emerald-500 text-white px-6 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{restoredNotice}</span>
          </div>
        )}

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Sidebar List of Revisions */}
          <div className="md:col-span-4 border-r border-zinc-200 bg-zinc-50/70 p-4 overflow-y-auto space-y-3">
            <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider px-2">
              Saved Snapshots
            </h3>

            {revisions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-2xl">
                No previous snapshots available yet. Revisions are created automatically when you generate, humanize, or save changes.
              </div>
            ) : (
              revisions.map((rev, idx) => {
                const isSelected = rev.id === selectedRevisionId || (!selectedRevisionId && idx === revisions.length - 1);
                const isCurrent = rev.content === currentContent;

                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelectedRevisionId(rev.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                      isSelected
                        ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-white/80 hover:bg-white border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{rev.label}</span>
                      </span>

                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                          Active Draft
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>{getWordCount(rev.content).toLocaleString()} words</span>
                    </div>

                    {typeof rev.aiScore === 'number' && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 self-start">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>AI Score: {rev.aiScore}%</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Main Inspection Area */}
          <div className="md:col-span-8 p-6 overflow-y-auto flex flex-col justify-between space-y-4">
            {selectedRevision ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div>
                    <h3 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                      <span>{selectedRevision.label}</span>
                      <span className="text-xs font-normal text-zinc-500">
                        ({new Date(selectedRevision.timestamp).toLocaleString()})
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Word Count: {getWordCount(selectedRevision.content).toLocaleString()} words
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(selectedRevision)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore This Snapshot</span>
                    </button>
                  </div>
                </div>

                {/* Content Viewer Box */}
                <div className="flex-1 bg-zinc-50 p-5 rounded-2xl border border-zinc-200 overflow-y-auto max-h-[50vh] font-serif text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap select-text">
                  {selectedRevision.content}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-200 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Safety Net Active: All edits create recoverable snapshots automatically.</span>
                  </span>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs">
                Select a revision snapshot from the left panel to inspect.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
