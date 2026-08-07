import React, { useState } from 'react';
import { Users, Sparkles, Loader2, CheckCircle2, MessageSquare, Star, ArrowRight, Lightbulb, AlertTriangle, ShieldCheck, Wand2, RefreshCw } from 'lucide-react';
import { generateBetaReaderCritique, autoFixChapterFromCritique } from '../services/geminiService';

interface BetaReaderSimulatorProps {
  bookDetails: any;
  chapters: { id: string; title: string; content: string }[];
  customApiKey?: string;
  onUpdateChapterContent?: (chapterId: string, newContent: string) => void;
}

export const BetaReaderSimulator: React.FC<BetaReaderSimulatorProps> = ({
  bookDetails,
  chapters,
  customApiKey,
  onUpdateChapterContent
}) => {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(chapters[0]?.id || '');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isAutoFixing, setIsAutoFixing] = useState<boolean>(false);
  const [fixingPersonaIdx, setFixingPersonaIdx] = useState<number | null>(null);
  const [critiqueResult, setCritiqueResult] = useState<any>(null);
  const [fixNotification, setFixNotification] = useState<string | null>(null);

  const activeChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0];

  const handleRunCritique = async () => {
    const textToReview = activeChapter?.content || bookDetails.description || '';
    if (!textToReview) {
      alert("Please write or select a chapter with manuscript content to analyze!");
      return;
    }

    setIsSimulating(true);
    setFixNotification(null);
    try {
      const res = await generateBetaReaderCritique(
        bookDetails,
        textToReview,
        bookDetails.category,
        customApiKey
      );
      if (res) {
        setCritiqueResult(res);
      } else {
        alert("Could not parse critique result. Please try again.");
      }
    } catch (e: any) {
      alert("Beta reader simulation failed: " + e.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApplyFixes = async (specificPersonaIndex?: number) => {
    if (!activeChapter || !activeChapter.content) {
      alert("No active chapter content available to fix!");
      return;
    }

    if (!onUpdateChapterContent) {
      alert("Chapter update handler is missing.");
      return;
    }

    if (specificPersonaIndex !== undefined) {
      setFixingPersonaIdx(specificPersonaIndex);
    } else {
      setIsAutoFixing(true);
    }
    setFixNotification(null);

    try {
      const targetCritique = specificPersonaIndex !== undefined && critiqueResult?.personas?.[specificPersonaIndex]
        ? critiqueResult.personas[specificPersonaIndex].critique
        : undefined;

      const revisedText = await autoFixChapterFromCritique(
        bookDetails,
        activeChapter.title,
        activeChapter.content,
        critiqueResult,
        targetCritique,
        customApiKey
      );

      if (revisedText && revisedText.length > 50) {
        onUpdateChapterContent(activeChapter.id, revisedText);
        setFixNotification(
          specificPersonaIndex !== undefined
            ? `✨ Successfully revised "${activeChapter.title}" incorporating Reader #${specificPersonaIndex + 1}'s feedback!`
            : `🚀 Successfully revised "${activeChapter.title}" with all panel critiques applied!`
        );
      } else {
        alert("Failed to auto-fix chapter content. Please try again.");
      }
    } catch (e: any) {
      alert("Auto-fix failed: " + e.message);
    } finally {
      setIsAutoFixing(false);
      setFixingPersonaIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-zinc-900 p-6 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-lg tracking-tight">AI Beta Reader Critique Simulator</h3>
          </div>
          <p className="text-xs text-purple-100 leading-relaxed">
            Simulate a focus group panel of 3 target readers & literary editors to catch pacing flaws, plot holes, and engagement drops.
          </p>
        </div>

        <button
          onClick={handleRunCritique}
          disabled={isSimulating || !activeChapter}
          className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Convening Reader Panel...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-purple-200" /> Run Beta Reader Panel
            </>
          )}
        </button>
      </div>

      {/* Chapter Selection Controls */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-zinc-700">Select Manuscript Chapter:</label>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {chapters.map((ch, idx) => (
              <option key={ch.id} value={ch.id}>
                Chapter {idx + 1}: {ch.title} ({ch.content ? ch.content.split(/\s+/).length : 0} words)
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-zinc-400">
          Analyzing: <strong className="text-zinc-700">{activeChapter?.title || 'None'}</strong>
        </p>
      </div>

      {/* Notification Banner */}
      {fixNotification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{fixNotification}</span>
          </div>
          <button
            onClick={() => setFixNotification(null)}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-extrabold cursor-pointer underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Results Display */}
      {critiqueResult ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Executive Summary & Scores Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Scores Overview */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Quantitative Reader Ratings
              </h4>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-zinc-700">Pacing & Flow</span>
                    <span className="text-purple-600">{critiqueResult.pacingScore} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-600 h-full rounded-full" style={{ width: `${critiqueResult.pacingScore * 10}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-zinc-700">Emotional Resonance</span>
                    <span className="text-indigo-600">{critiqueResult.emotionalResonance} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${critiqueResult.emotionalResonance * 10}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-zinc-700">Plot Logic & Clarity</span>
                    <span className="text-emerald-600">{critiqueResult.plotClarity} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${critiqueResult.plotClarity * 10}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-zinc-700">Opening Hook Strength</span>
                    <span className="text-pink-600">{critiqueResult.overallHookScore} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-pink-600 h-full rounded-full" style={{ width: `${critiqueResult.overallHookScore * 10}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" /> Executive Panel Report
                  </h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">
                  {critiqueResult.executiveSummary}
                </p>
              </div>

              {onUpdateChapterContent && (
                <div className="pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => handleApplyFixes()}
                    disabled={isAutoFixing || fixingPersonaIdx !== null || !activeChapter?.content}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAutoFixing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Rewriting Chapter to Fix Critiques...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 text-purple-200" /> Automatically Fix & Apply Panel Changes to "{activeChapter?.title}"
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reader Persona Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
              Detailed Beta Reader Persona Breakdown
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {critiqueResult.personas?.map((p: any, idx: number) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-purple-50 text-purple-700 rounded-xl font-bold text-xs">
                        Reader #{idx + 1}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-zinc-900">{p.name}</h5>
                        <p className="text-[10px] text-zinc-400">Persona Profile</p>
                      </div>
                    </div>

                    <p className="text-xs text-indigo-900 font-semibold bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 italic leading-snug mb-3">
                      "{p.verdict}"
                    </p>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> What Loved:
                        </span>
                        <ul className="list-disc list-inside text-zinc-600 space-y-0.5 text-[11px] pl-1">
                          {p.likes?.map((like: string, i: number) => (
                            <li key={i}>{like}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-zinc-100">
                        <span className="font-bold text-amber-800 text-[11px] flex items-center gap-1 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Critique / Fixes:
                        </span>
                        <ul className="list-disc list-inside text-zinc-600 space-y-0.5 text-[11px] pl-1">
                          {p.critique?.map((crit: string, i: number) => (
                            <li key={i}>{crit}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {onUpdateChapterContent && (
                    <div className="pt-3 border-t border-zinc-100">
                      <button
                        onClick={() => handleApplyFixes(idx)}
                        disabled={isAutoFixing || fixingPersonaIdx !== null || !activeChapter?.content}
                        className="w-full bg-zinc-50 hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-300 disabled:opacity-50 font-extrabold text-[11px] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {fixingPersonaIdx === idx ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" /> Applying Reader #{idx + 1} Fixes...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5 text-purple-600" /> Apply Reader #{idx + 1} Fixes
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-zinc-300 text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-purple-400 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-800">No Beta Critique Generated Yet</h4>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Click <strong className="text-purple-600">"Run Beta Reader Panel"</strong> above to trigger an AI review panel on Chapter 1 ({activeChapter?.title}).
          </p>
        </div>
      )}
    </div>
  );
};
