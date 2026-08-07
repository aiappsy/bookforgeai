import React, { useState } from 'react';
import { Mic, Sparkles, Loader2, Copy, Check, Download, Clock, Volume2, FileText, HelpCircle, Send, BookOpen } from 'lucide-react';
import Markdown from 'react-markdown';
import { generateAudiobookScript, queryPublishingExpertKnowledge } from '../services/geminiService';

interface AudiobookAssistantProps {
  bookDetails: any;
  chapters: { id: string; title: string; content: string }[];
  customApiKey?: string;
}

export const AudiobookAssistant: React.FC<AudiobookAssistantProps> = ({
  bookDetails,
  chapters,
  customApiKey
}) => {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(chapters[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [audioScript, setAudioScript] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Publishing Knowledge Assistant state
  const [expertQuery, setExpertQuery] = useState<string>('');
  const [expertAnswer, setExpertAnswer] = useState<string>('');
  const [isQueryingExpert, setIsQueryingExpert] = useState<boolean>(false);

  const activeChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0];

  const handleGenerateScript = async () => {
    const textToConvert = activeChapter?.content || '';
    if (!textToConvert) {
      alert("Please write content for this chapter first!");
      return;
    }

    setIsGenerating(true);
    try {
      const script = await generateAudiobookScript(
        bookDetails,
        activeChapter.title,
        textToConvert,
        customApiKey
      );
      setAudioScript(script);
    } catch (e: any) {
      alert("Audiobook script generation failed: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQueryExpert = async (customQuestion?: string) => {
    const q = customQuestion || expertQuery;
    if (!q || !q.trim()) return;

    setIsQueryingExpert(true);
    try {
      const ans = await queryPublishingExpertKnowledge(q, customApiKey);
      setExpertAnswer(ans);
    } catch (e: any) {
      alert("Expert query failed: " + e.message);
    } finally {
      setIsQueryingExpert(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(audioScript);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([audioScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookDetails.title || 'Book'}_${activeChapter?.title || 'Chapter'}_Audiobook_Script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Word count & duration estimate
  const wordCount = activeChapter?.content ? activeChapter.content.split(/\s+/).length : 0;
  const estDurationMin = Math.ceil(wordCount / 150);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-zinc-900 p-6 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg tracking-tight">ACX Master Audiobook Director & Publishing AI</h3>
          </div>
          <p className="text-xs text-indigo-100 leading-relaxed">
            Powered by high-reasoning Gemini AI for ACX narration scripts, voice directing, SSML phonetics, and expert publishing guidance.
          </p>
        </div>

        <button
          onClick={handleGenerateScript}
          disabled={isGenerating || !activeChapter}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Directing Voice Script...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" /> Generate Voice Script
            </>
          )}
        </button>
      </div>

      {/* Controls & Metrics */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-zinc-700">Select Chapter:</label>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {chapters.map((ch, idx) => (
              <option key={ch.id} value={ch.id}>
                Chapter {idx + 1}: {ch.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-zinc-600">
          <span className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" /> ~{estDurationMin} mins narration (@150 wpm)
          </span>
          <span className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200">
            <FileText className="w-3.5 h-3.5 text-purple-600" /> {wordCount.toLocaleString()} words
          </span>
        </div>
      </div>

      {/* Ask Publishing Expert AI Bar */}
      <div className="bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-white p-5 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Ask Publishing & Audio Director AI</h4>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={expertQuery}
            onChange={(e) => setExpertQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQueryExpert()}
            placeholder="Ask anything (e.g. 'What are ACX audio specs?', 'How to structure dual-narrator casting?', 'KDP pricing tips')..."
            className="w-full bg-white px-3.5 py-2 border border-indigo-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          <button
            onClick={() => handleQueryExpert()}
            disabled={isQueryingExpert || !expertQuery.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
          >
            {isQueryingExpert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Ask</span>
          </button>
        </div>

        {/* Quick Question Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-zinc-400">Quick Prompts:</span>
          {[
            'What are ACX technical audio requirements?',
            'How to write SSML phoneme tags for fantasy names?',
            'What is the ideal KDP pricing & royalty strategy?',
            'How to balance multi-character voice contrast?'
          ].map((promptText, i) => (
            <button
              key={i}
              onClick={() => {
                setExpertQuery(promptText);
                handleQueryExpert(promptText);
              }}
              className="text-[10px] font-semibold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Expert Answer Display */}
        {expertAnswer && (
          <div className="mt-4 p-5 bg-white rounded-xl border border-indigo-200 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-100">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" /> Master Publishing Executive Answer
              </span>
              <button
                onClick={() => setExpertAnswer('')}
                className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <div className="prose prose-xs text-zinc-800 leading-relaxed max-h-[400px] overflow-y-auto pr-1">
              <Markdown>{expertAnswer}</Markdown>
            </div>
          </div>
        )}
      </div>

      {/* Generated Script Display */}
      {audioScript ? (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-600" /> ACX Performance Script
            </h4>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-600" />}
                <span>{copiedNotice ? 'Copied' : 'Copy Script'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Script (.txt)</span>
              </button>
            </div>
          </div>

          <div className="bg-zinc-950 text-zinc-200 p-6 rounded-xl font-mono text-xs leading-relaxed max-h-[500px] overflow-y-auto border border-zinc-800 prose prose-invert max-w-none">
            <Markdown>{audioScript}</Markdown>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-zinc-300 text-center space-y-3">
          <Mic className="w-10 h-10 text-indigo-400 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-800">No Audiobook Script Generated Yet</h4>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Select a chapter and click <strong className="text-indigo-600">"Generate Voice Script"</strong> to format performance cues for narrator recording.
          </p>
        </div>
      )}
    </div>
  );
};
