import React, { useState, useMemo } from 'react';
import { ShieldAlert, Wand2, Sparkles, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Zap, BarChart3, ArrowRight, FileText, Layers, Eye, Check, Copy, Info } from 'lucide-react';
import { analyzeAiScore, humanizeManuscript, AiScoreReport } from '../services/geminiService';

interface ChapterItem {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
}

interface HumanizerStudioProps {
  chapters: ChapterItem[];
  activeChapterId?: string | null;
  customApiKey?: string;
  language?: string;
  onUpdateChapterContent: (chapterId: string, newContent: string) => void;
  onUpdateAllChaptersContent: (updatedChapters: { id: string; content: string }[]) => void;
}

export function HumanizerStudio({
  chapters,
  activeChapterId,
  customApiKey,
  language = 'English',
  onUpdateChapterContent,
  onUpdateAllChaptersContent
}: HumanizerStudioProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    activeChapterId || (chapters.length > 0 ? chapters[0].id : '')
  );
  const [scope, setScope] = useState<'single' | 'all'>('single');
  const [mode, setMode] = useState<'bypass' | 'natural' | 'authorial'>('bypass');
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [humanizeProgress, setHumanizeProgress] = useState<string>('');
  const [humanizedResult, setHumanizedResult] = useState<string | null>(null);
  const [lastOriginalText, setLastOriginalText] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [justAppliedNotice, setJustAppliedNotice] = useState<boolean>(false);

  const selectedChapter = useMemo(() => {
    return chapters.find(c => c.id === selectedChapterId) || (chapters.length > 0 ? chapters[0] : null);
  }, [chapters, selectedChapterId]);

  const sourceTextToAnalyze = useMemo(() => {
    if (scope === 'single') {
      return selectedChapter?.content || '';
    } else {
      return chapters
        .filter(c => c.status === 'done')
        .map(c => `# ${c.title}\n\n${c.content}`)
        .join('\n\n');
    }
  }, [scope, selectedChapter, chapters]);

  // Live Analysis of the target text
  const originalAiReport: AiScoreReport = useMemo(() => {
    return analyzeAiScore(sourceTextToAnalyze);
  }, [sourceTextToAnalyze]);

  const resultAiReport: AiScoreReport | null = useMemo(() => {
    if (!humanizedResult) return null;
    return analyzeAiScore(humanizedResult);
  }, [humanizedResult]);

  const handleRunHumanize = async () => {
    if (!sourceTextToAnalyze.trim()) return;

    setIsHumanizing(true);
    setLastOriginalText(sourceTextToAnalyze);
    setHumanizedResult(null);
    setJustAppliedNotice(false);

    try {
      if (scope === 'single' && selectedChapter) {
        setHumanizeProgress(`Humanizing "${selectedChapter.title}" with Gemini AI...`);
        const res = await humanizeManuscript(selectedChapter.content, mode, customApiKey, language);
        setHumanizedResult(res);

        if (autoApply) {
          onUpdateChapterContent(selectedChapter.id, res);
          setJustAppliedNotice(true);
        }
      } else {
        // Humanize all chapters sequentially with pacing delay
        const doneChapters = chapters.filter(c => c.status === 'done');
        const results: { id: string; content: string }[] = [];
        let combined = "";

        for (let i = 0; i < doneChapters.length; i++) {
          const ch = doneChapters[i];
          setHumanizeProgress(`Humanizing Chapter ${i + 1} of ${doneChapters.length}: "${ch.title}"...`);
          
          try {
            const res = await humanizeManuscript(ch.content, mode, customApiKey, language);
            results.push({ id: ch.id, content: res });
            combined += `# ${ch.title}\n\n${res}\n\n`;
            setHumanizedResult(combined);
          } catch (err: any) {
            console.error(`Rate limit or error on chapter ${i + 1}:`, err);
            if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
              alert(`Rate limit reached on Chapter ${i + 1} of ${doneChapters.length}.\n\n` +
                    `Chapters 1 to ${i} have been saved in the output studio below!\n\n` +
                    `Tip: Wait 1 minute or add your free Gemini API key in API Settings for higher rate limits.`);
              break;
            } else {
              throw err;
            }
          }

          if (i < doneChapters.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        if (autoApply && results.length > 0) {
          onUpdateAllChaptersContent(results);
          setJustAppliedNotice(true);
        }
      }
    } catch (e: any) {
      console.error("Humanizer error:", e);
      alert("Failed to humanize manuscript: " + (e.message || "API Error"));
    } finally {
      setIsHumanizing(false);
      setHumanizeProgress('');
    }
  };

  const handleApplyResultToManuscript = () => {
    if (!humanizedResult) return;

    if (scope === 'single' && selectedChapter) {
      onUpdateChapterContent(selectedChapter.id, humanizedResult);
      setJustAppliedNotice(true);
      alert(`Applied humanized manuscript to "${selectedChapter.title}"!`);
    } else {
      const doneChapters = chapters.filter(c => c.status === 'done');
      const updated: { id: string; content: string }[] = [];
      const sections = humanizedResult.split(/(?=\n#\s+)/);
      
      doneChapters.forEach((ch, idx) => {
        if (idx < sections.length) {
          const sec = sections[idx].replace(/^#\s+.*?\n/, '').trim();
          updated.push({ id: ch.id, content: sec || sections[idx] });
        }
      });

      if (updated.length > 0) {
        onUpdateAllChaptersContent(updated);
        setJustAppliedNotice(true);
        alert(`Successfully applied humanized prose across all ${updated.length} chapters!`);
      }
    }
  };

  const [viewTab, setViewTab] = useState<'output' | 'diff'>('output');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide uppercase">
              <ShieldAlert className="w-3.5 h-3.5" /> AI Detector Bypass & Manuscript Humanizer
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Anti-AI Prose & Cadence Studio
            </h2>
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
              Detect robotic AI phrase markers (Turnitin, GPTZero, CopyLeaks), analyze sentence rhythm burstiness, and humanize your manuscript into publication-grade authentic prose.
            </p>
          </div>

          <div className="flex flex-col items-center sm:items-end justify-center bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 text-center sm:text-right w-full sm:w-auto">
            <div className="text-[10px] text-zinc-300 uppercase tracking-wider font-bold">Original AI Probability</div>
            <div className={`text-3xl font-black mt-0.5 ${
              originalAiReport.aiProbability > 70 ? 'text-red-400' :
              originalAiReport.aiProbability > 40 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {originalAiReport.aiProbability}%
            </div>
            <div className="text-[11px] text-zinc-300 font-medium">
              Human Cadence: <span className="font-bold text-white">{originalAiReport.humanProbability}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Controls & Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Controls and Analysis Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Target Selection & Mode Bar */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Scope */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  1. Target Manuscript Scope
                </label>
                <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                  <button
                    onClick={() => setScope('single')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      scope === 'single' ? 'bg-white text-emerald-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Single Chapter</span>
                  </button>
                  <button
                    onClick={() => setScope('all')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      scope === 'all' ? 'bg-white text-emerald-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Entire Manuscript</span>
                  </button>
                </div>
              </div>

              {/* Chapter Select if Single Scope */}
              {scope === 'single' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Select Chapter to Humanize
                  </label>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {chapters.map((ch, idx) => (
                      <option key={ch.id} value={ch.id}>
                        Chapter {idx + 1}: {ch.title} ({ch.content.split(/\s+/).filter(Boolean).length} words)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Humanization Mode Selection */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                2. Humanization Strategy & Voice Tone
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setMode('bypass')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    mode === 'bypass'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 font-bold text-xs text-emerald-950">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span>Bypass AI Detectors</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Max sentence burstiness, zero clichés, highly varied cadence.
                  </p>
                </button>

                <button
                  onClick={() => setMode('natural')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    mode === 'natural'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 font-bold text-xs text-indigo-950">
                    <Wand2 className="w-4 h-4 text-indigo-600" />
                    <span>Natural Flow</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Direct, conversational human voice, active verbs, zero corporate AI-speak.
                  </p>
                </button>

                <button
                  onClick={() => setMode('authorial')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                    mode === 'authorial'
                      ? 'bg-purple-50 border-purple-400 text-purple-950 ring-2 ring-purple-500/20'
                      : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 font-bold text-xs text-purple-950">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Authorial Polish</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Publication-grade literary prose, emotional depth, vivid narrative rhythm.
                  </p>
                </button>
              </div>
            </div>

            {/* Auto-Apply Checkbox Option */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-700 select-none">
                <input
                  type="checkbox"
                  checked={autoApply}
                  onChange={(e) => setAutoApply(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Automatically update active chapter manuscript text when humanization finishes</span>
              </label>
            </div>

            {/* Run Action Button */}
            <button
              onClick={handleRunHumanize}
              disabled={isHumanizing || !sourceTextToAnalyze.trim()}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isHumanizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{humanizeProgress || 'Humanizing Manuscript...'}</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Humanize & Remove AI Markers ({scope === 'single' ? 'Selected Chapter' : 'All Chapters'})</span>
                </>
              )}
            </button>

            {justAppliedNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Humanized prose applied directly to manuscript workspace!</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                  {resultAiReport ? `${resultAiReport.aiProbability}% AI Score` : 'Updated'}
                </span>
              </div>
            )}
          </div>

          {/* Detailed Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Burstiness Score</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-zinc-900">{originalAiReport.burstinessScore}/100</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  originalAiReport.burstinessScore > 65 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {originalAiReport.burstinessScore > 65 ? 'High (Human)' : 'Low (Robotic)'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">Measures sentence length variation & cadence rhythm.</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Perplexity / Lexical</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-zinc-900">{originalAiReport.perplexityScore}/100</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  originalAiReport.perplexityScore > 60 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {originalAiReport.perplexityScore > 60 ? 'Diverse' : 'Predictable'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">Vocabulary richness & natural word choice.</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Flagged AI Buzzwords</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-zinc-900">
                  {originalAiReport.flaggedBuzzwords.reduce((a, b) => a + b.count, 0)}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded">
                  {originalAiReport.flaggedBuzzwords.length} distinct types
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">Known AI phrase patterns & corporate clichés.</p>
            </div>
          </div>

          {/* AI Buzzwords & Suggestions List */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Detected AI Phrase Markers & Clichés ({originalAiReport.flaggedBuzzwords.length})
            </h3>

            {originalAiReport.flaggedBuzzwords.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>No common AI phrase markers detected in this text!</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {originalAiReport.flaggedBuzzwords.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold"
                  >
                    <span>"{item.word}"</span>
                    <span className="w-4 h-4 bg-red-200 text-red-900 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {item.count}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-zinc-100 space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Humanization Recommendations</span>
              <ul className="space-y-1">
                {originalAiReport.suggestions.map((sug, i) => (
                  <li key={i} className="text-xs text-zinc-600 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    {sug}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

        {/* Column 3: Comparison & Apply Result Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Humanized Output Studio
              </h3>
              {resultAiReport && (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-extrabold">
                  {resultAiReport.aiProbability}% AI Score
                </span>
              )}
            </div>

            {!humanizedResult ? (
              <div className="p-8 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-center space-y-3">
                <Wand2 className="w-8 h-8 text-zinc-300 mx-auto animate-pulse" />
                <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                  Click <strong>"Humanize & Remove AI Markers"</strong> to generate authentic prose with high burstiness.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score Comparison Summary */}
                {resultAiReport && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                      <span>AI Score Reduced:</span>
                      <span className="line-through text-red-500 mr-1">{originalAiReport.aiProbability}%</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-600 inline" />
                      <span className="text-emerald-700 text-sm ml-1 font-extrabold">{resultAiReport.aiProbability}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-emerald-800">
                      <span>Burstiness Improvement:</span>
                      <span className="font-bold">{originalAiReport.burstinessScore} → {resultAiReport.burstinessScore}/100</span>
                    </div>
                  </div>
                )}

                {/* View Mode Toggle: Output vs Diff */}
                <div className="flex items-center justify-between bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setViewTab('output')}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                      viewTab === 'output' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Humanized Output
                  </button>
                  <button
                    onClick={() => setViewTab('diff')}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                      viewTab === 'diff' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Side-by-Side Diff
                  </button>
                </div>

                {viewTab === 'output' ? (
                  /* Output Preview Box */
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                      <span>Revised Manuscript Text</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(humanizedResult);
                          setCopiedNotice(true);
                          setTimeout(() => setCopiedNotice(false), 2000);
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedNotice ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedNotice ? 'Copied!' : 'Copy Text'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={14}
                      value={humanizedResult}
                      onChange={(e) => setHumanizedResult(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 rounded-xl p-3.5 text-xs font-mono border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ) : (
                  /* Side-by-Side Comparison Box */
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Original Draft</span>
                      <div className="h-44 overflow-y-auto bg-red-50/50 p-3 rounded-xl border border-red-200/60 font-mono text-[11px] text-zinc-700 whitespace-pre-wrap">
                        {lastOriginalText || sourceTextToAnalyze}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Humanized Draft</span>
                      <div className="h-44 overflow-y-auto bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/60 font-mono text-[11px] text-zinc-800 whitespace-pre-wrap">
                        {humanizedResult}
                      </div>
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <button
                  onClick={handleApplyResultToManuscript}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply Humanized Text to Active Workspace</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
