import React, { useState } from 'react';
import { X, CheckCircle2, Circle, HelpCircle, BookOpen, Sparkles, Rocket, DollarSign, Megaphone, Info, ExternalLink } from 'lucide-react';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string, subTab?: string) => void;
}

export const HelpDrawer: React.FC<HelpDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    step1: true,
    step2: true,
  });

  if (!isOpen) return null;

  const toggleStep = (id: string) => {
    setCheckedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checklist = [
    {
      id: 'step1',
      title: 'Define Niche & Target Audience',
      desc: 'Use Stage 1 (Concept) to analyze Amazon KDP keyword competition and target reader hook.',
      tab: 'setup'
    },
    {
      id: 'step2',
      title: 'Complete Book Metadata',
      desc: 'Fill in Title, Subtitle, Author Name, 7 Amazon Keywords, and 2 Primary KDP Categories.',
      tab: 'details'
    },
    {
      id: 'step3',
      title: 'Generate or Edit Chapter Outline',
      desc: 'Structure your book chapters, assign target word counts, and organize key plot points.',
      tab: 'outline'
    },
    {
      id: 'step4',
      title: 'Write & Polish Manuscript Drafts',
      desc: 'Draft chapters using manus AI writing assistant, check formatting, and eliminate plot holes.',
      tab: 'chapter'
    },
    {
      id: 'step5',
      title: 'Run Beta Reader Critique Simulator',
      desc: 'Get instant feedback from 3 AI reader personas on pacing, emotional resonance, and hooks.',
      tab: 'marketing',
      subTab: 'beta_readers'
    },
    {
      id: 'step6',
      title: 'Design Front/Back Cover Prompts & A+ Content',
      desc: 'Generate visual AI cover artwork and Amazon A+ editorial banners for your product page.',
      tab: 'assets',
      subTab: 'cover'
    },
    {
      id: 'step7',
      title: 'Optimize List Price & Royalty Margin',
      desc: 'Use KDP Royalty Calculator to calculate delivery fees, print costs, and maximum net profit.',
      tab: 'assets',
      subTab: 'price_royalty'
    },
    {
      id: 'step8',
      title: '1-Click Instant Web Publishing & Bundle Export',
      desc: 'Publish your live promotional landing page to web and download formatted .docx & .zip bundle.',
      tab: 'marketing',
      subTab: 'landing_page'
    }
  ];

  const completedCount = Object.values(checkedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <HelpCircle className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">KDP Publishing Center & Guide</h3>
              <p className="text-xs text-indigo-200">Step-by-step assistant from raw idea to Amazon release</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress Card */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-white p-5 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Rocket className="w-4 h-4 text-indigo-600" /> Launch Readiness Checklist
              </span>
              <span className="font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                {progressPercent}% Done
              </span>
            </div>
            <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              {completedCount} of {checklist.length} publishing steps completed. Click items to mark done.
            </p>
          </div>

          {/* Interactive Step-by-Step List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Master Roadmap</h4>
            <div className="space-y-2">
              {checklist.map((item, index) => {
                const isDone = !!checkedSteps[item.id];
                return (
                  <div 
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isDone 
                        ? 'bg-emerald-50/50 border-emerald-200/80' 
                        : 'bg-white border-zinc-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => toggleStep(item.id)}
                        className="mt-0.5 shrink-0 text-zinc-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-bold ${isDone ? 'text-emerald-900 line-through' : 'text-zinc-900'}`}>
                            {index + 1}. {item.title}
                          </p>
                          {item.tab && (
                            <button
                              onClick={() => {
                                onNavigateTab(item.tab, item.subTab);
                                onClose();
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
                            >
                              Go to Tool →
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Workflow Stages Overview */}
          <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-200 space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" /> Navigating manus AI Studio
            </h4>
            <ul className="text-xs text-zinc-600 space-y-2 leading-relaxed">
              <li>
                <strong className="text-zinc-800">1. Concept & Audience:</strong> Set up your hook, genre, and target reader personas.
              </li>
              <li>
                <strong className="text-zinc-800">2. Write & Outline:</strong> Auto-generate chapter outlines and draft prose with AI writing assistance.
              </li>
              <li>
                <strong className="text-zinc-800">3. Cover & Design:</strong> Create visual prompts for front/back covers and editorial A+ banners.
              </li>
              <li>
                <strong className="text-zinc-800">4. Launch & Marketing:</strong> Run Beta Reader critiques, produce Audiobook Voice Scripts, PR Releases, and Instant Landing Pages.
              </li>
              <li>
                <strong className="text-zinc-800">5. Publish & Royalty:</strong> Pre-flight KDP inspector, net profit dynamic calculator, and full .docx / .zip bundle exports.
              </li>
            </ul>
          </div>

          {/* External KDP Link */}
          <div className="pt-2 text-center">
            <a
              href="https://kdp.amazon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
            >
              <span>Visit Official Amazon KDP Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
