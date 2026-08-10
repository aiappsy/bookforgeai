import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Brain,
  Layers,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface GenerationProgressLoggerProps {
  isGenerating: boolean;
  title?: string;
  subtitle?: string;
  currentChapterTitle?: string;
  generatingStep?: string;
}

const GENERATION_LOG_STEPS = [
  { time: 0, text: 'Connecting to Google Gemini Flash API...' },
  { time: 3, text: 'Analyzing preceding chapter endings & narrative continuity memory...' },
  { time: 8, text: 'Loading author learned style rules & tone preferences...' },
  { time: 15, text: 'Drafting scene outline & character dialogue dynamics...' },
  { time: 25, text: 'Synthesizing main chapter prose with high burstiness & flow...' },
  { time: 40, text: 'Verifying anti-AI detection phrasing & vocabulary patterns...' },
  { time: 60, text: 'Structuring formatting, headers, & line spacing...' },
  { time: 80, text: 'Finalizing chapter manuscript output & word count metrics...' }
];

export const GenerationProgressLogger: React.FC<GenerationProgressLoggerProps> = ({
  isGenerating,
  title = 'AI Chapter Generation in Progress',
  subtitle = 'Writing structured chapter manuscript with continuity tracking...',
  currentChapterTitle
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  const currentStep =
    GENERATION_LOG_STEPS.slice()
      .reverse()
      .find((step) => elapsedSeconds >= step.time) || GENERATION_LOG_STEPS[0];

  return (
    <div className="p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl border border-indigo-500/30 shadow-xl space-y-4 my-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>{title}</span>
              {currentChapterTitle && (
                <span className="text-xs font-normal text-blue-300">
                  — {currentChapterTitle}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-blue-300 shrink-0">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{elapsedSeconds}s elapsed</span>
        </div>
      </div>

      {/* Live Step Progress Banner */}
      <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <span>{currentStep.text}</span>
        </div>

        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, Math.max(10, (elapsedSeconds / 90) * 100))}%` }}
          />
        </div>
      </div>

      {/* Mini Step Logs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Continuity & learned rules applied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>BYOK Google Gemini API active</span>
        </div>
      </div>
    </div>
  );
};
