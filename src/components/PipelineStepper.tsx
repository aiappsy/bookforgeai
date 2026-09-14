import React from 'react';
import {
  Lightbulb,
  ListTree,
  Edit3,
  Sparkles,
  BookOpen,
  Download,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

export type ViewMode =
  | 'library'
  | 'setup'
  | 'details'
  | 'outline'
  | 'toc'
  | 'chapter'
  | 'visual_designer'
  | 'assets'
  | 'marketing'
  | 'humanizer'
  | 'audiobook'
  | 'research';

interface PipelineStepperProps {
  activeView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  hasIdea?: boolean;
  hasOutline?: boolean;
  hasChapters?: boolean;
}

interface PipelineStep {
  id: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  targetView: ViewMode;
  isComplete: (props: PipelineStepperProps) => boolean;
  isActive: (view: ViewMode) => boolean;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 1,
    label: 'Concept',
    sublabel: 'Idea & Niche',
    icon: Lightbulb,
    targetView: 'setup',
    isComplete: (p) => Boolean(p.hasIdea),
    isActive: (v) => v === 'setup' || v === 'details' || v === 'research'
  },
  {
    id: 2,
    label: 'Outline',
    sublabel: 'Table of Contents',
    icon: ListTree,
    targetView: 'outline',
    isComplete: (p) => Boolean(p.hasOutline),
    isActive: (v) => v === 'outline' || v === 'toc'
  },
  {
    id: 3,
    label: 'Draft',
    sublabel: 'Chapter Engine',
    icon: Edit3,
    targetView: 'chapter',
    isComplete: (p) => Boolean(p.hasChapters),
    isActive: (v) => v === 'chapter'
  },
  {
    id: 4,
    label: 'Humanize',
    sublabel: 'Anti-AI Pass',
    icon: Sparkles,
    targetView: 'humanizer',
    isComplete: (p) => false,
    isActive: (v) => v === 'humanizer'
  },
  {
    id: 5,
    label: 'Review',
    sublabel: 'Cover & Assets',
    icon: BookOpen,
    targetView: 'assets',
    isComplete: (p) => false,
    isActive: (v) => v === 'assets' || v === 'audiobook'
  },
  {
    id: 6,
    label: 'Export',
    sublabel: 'PDF & Marketing',
    icon: Download,
    targetView: 'marketing',
    isComplete: (p) => false,
    isActive: (v) => v === 'marketing'
  }
];

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  activeView,
  onNavigate,
  hasIdea,
  hasOutline,
  hasChapters
}) => {
  if (activeView === 'library') return null;

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 overflow-x-auto select-none shadow-inner">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 min-w-[700px]">
        {PIPELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const active = step.isActive(activeView);
          const completed = step.isComplete({ activeView, onNavigate, hasIdea, hasOutline, hasChapters });

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onNavigate(step.targetView)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer group shrink-0 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-2 ring-blue-400/30'
                    : completed
                    ? 'bg-slate-800/80 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300'
                    : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                    active
                      ? 'bg-white/20 text-white'
                      : completed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-700/60 text-slate-400 group-hover:text-white'
                  }`}
                >
                  {completed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className="w-3.5 h-3.5" />}
                </div>

                <div className="text-left">
                  <div className="text-xs font-extrabold tracking-tight flex items-center gap-1">
                    <span>{step.id}. {step.label}</span>
                  </div>
                  <div
                    className={`text-[9px] font-medium leading-none ${
                      active ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {step.sublabel}
                  </div>
                </div>
              </button>

              {index < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-700 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
