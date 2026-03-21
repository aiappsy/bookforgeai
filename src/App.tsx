import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, FileText, Image as ImageIcon, Headphones, Settings, CheckCircle2, Loader2, Download, PlayCircle, MessageSquare, Send, ChevronRight, List, Key, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  researchNiche,
  generateOutline,
  extractChapters,
  generateChapter,
  sendChatMessage,
  createCover,
  synthesizeAudiobook,
  optimizeMetadata
} from './services/geminiService';

type ViewMode = 'setup' | 'outline' | 'chapter' | 'assets';

interface Chapter {
  id: string;
  title: string;
  content: string;
  status: 'idle' | 'generating' | 'done';
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  // Global State
  const [idea, setIdea] = useState('');
  const [research, setResearch] = useState<any>(null);
  const [outline, setOutline] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [assets, setAssets] = useState<{coverUrl?: string | null, audioUrl?: string | null, metadata?: any}>({});
  
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  
  // Chat State
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, viewMode, activeChapterId]);

  const handleStartProject = async () => {
    if (!idea.trim()) return;
    setIsGenerating(true);
    setGeneratingStep('Researching niche...');
    try {
      const res = await researchNiche(idea, customApiKey);
      setResearch(res);
      
      setGeneratingStep('Generating outline...');
      const out = await generateOutline(idea, res.top_keywords || [], customApiKey);
      setOutline(out);
      
      setViewMode('outline');
    } catch (e: any) {
      console.error(e);
      alert("Failed to start project: " + (e.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleExtractChapters = async () => {
    setIsGenerating(true);
    setGeneratingStep('Extracting chapters...');
    try {
      const titles = await extractChapters(outline, customApiKey);
      const newChapters: Chapter[] = titles.map((t: string) => ({
        id: Math.random().toString(36).substring(7),
        title: t,
        content: '',
        status: 'idle'
      }));
      setChapters(newChapters);
      if (newChapters.length > 0) {
        setActiveChapterId(newChapters[0].id);
        setViewMode('chapter');
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to extract chapters: " + (e.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleGenerateChapter = async (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: 'generating' } : c));
    
    try {
      const content = await generateChapter(idea, outline, chapter.title, customApiKey);
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content, status: 'done' } : c));
    } catch (e) {
      console.error(e);
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: 'idle' } : c));
      alert("Failed to generate chapter.");
    }
  };

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setViewMode('assets');
    try {
      const cover = await createCover(idea, customApiKey);
      const meta = await optimizeMetadata(idea, customApiKey);
      
      // Combine all chapters for audio sample
      const fullManuscript = chapters.map(c => c.content).join('\n\n');
      const audio = await synthesizeAudiobook(fullManuscript, customApiKey);
      
      setAssets({ coverUrl: cover, metadata: meta, audioUrl: audio });
    } catch (e) {
      console.error(e);
      alert("Failed to generate assets.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const docId = viewMode === 'outline' ? 'outline' : activeChapterId;
    if (!docId) return;

    const currentDocContent = viewMode === 'outline' ? outline : chapters.find(c => c.id === docId)?.content || '';
    const docType = viewMode === 'outline' ? 'outline' : 'chapter';

    const newMessage: ChatMessage = { role: 'user', text: chatInput };
    const history = chats[docId] || [];
    const updatedHistory = [...history, newMessage];
    
    setChats(prev => ({ ...prev, [docId]: updatedHistory }));
    setChatInput('');
    setIsChatting(true);

    try {
      const { replyText, revisedContent } = await sendChatMessage(
        newMessage.text,
        history,
        currentDocContent,
        docType,
        customApiKey
      );

      if (revisedContent) {
        if (viewMode === 'outline') {
          setOutline(revisedContent);
        } else {
          setChapters(prev => prev.map(c => c.id === docId ? { ...c, content: revisedContent } : c));
        }
      }

      setChats(prev => ({
        ...prev,
        [docId]: [...updatedHistory, { role: 'model', text: replyText }]
      }));
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "Sorry, an error occurred.";
      setChats(prev => ({
        ...prev,
        [docId]: [...updatedHistory, { role: 'model', text: `Error: ${errorMessage}` }]
      }));
    } finally {
      setIsChatting(false);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBase64 = (base64Data: string, filename: string) => {
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeChatHistory = chats[viewMode === 'outline' ? 'outline' : (activeChapterId || '')] || [];

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-zinc-200 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <h1 className="text-lg font-semibold tracking-tight">BookForge AI</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            <button
              onClick={() => setViewMode('setup')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'setup' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Settings className="w-4 h-4" /> Project Setup
            </button>
            <button
              onClick={() => setViewMode('outline')}
              disabled={!outline}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'outline' ? 'bg-indigo-50 text-indigo-700' : 
                !outline ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <List className="w-4 h-4" /> Outline
            </button>
            <button
              onClick={() => setViewMode('assets')}
              disabled={chapters.length === 0}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'assets' ? 'bg-indigo-50 text-indigo-700' : 
                chapters.length === 0 ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Assets & Export
            </button>
          </nav>

          {chapters.length > 0 && (
            <div className="mt-8 px-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Chapters</h3>
              <div className="space-y-1">
                {chapters.map((chapter, idx) => (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      setActiveChapterId(chapter.id);
                      setViewMode('chapter');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      viewMode === 'chapter' && activeChapterId === chapter.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="truncate pr-2">{idx + 1}. {chapter.title}</span>
                    {chapter.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    {chapter.status === 'generating' && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-200">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <Key className="w-4 h-4" /> API Settings
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 relative">
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center px-6 flex-shrink-0">
          <h2 className="text-sm font-medium text-zinc-800">
            {viewMode === 'setup' && 'Project Setup'}
            {viewMode === 'outline' && 'Book Outline'}
            {viewMode === 'chapter' && chapters.find(c => c.id === activeChapterId)?.title}
            {viewMode === 'assets' && 'Assets & Export'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            
            {viewMode === 'setup' && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-medium mb-4">What's your book about?</h3>
                  <textarea
                    rows={4}
                    className="w-full rounded-xl border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 border bg-zinc-50 mb-4"
                    placeholder="e.g., A comprehensive guide to intermittent fasting for seniors..."
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleStartProject}
                    disabled={isGenerating || !idea.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Researching & Outlining...</> : 'Start Project'}
                  </button>
                </div>

                {research && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <div className="text-sm font-medium text-zinc-500 mb-1">Demand Score</div>
                      <div className="text-4xl font-semibold text-indigo-600">{research.demand_score}/100</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <div className="text-sm font-medium text-zinc-500 mb-3">Top Keywords</div>
                      <div className="flex flex-wrap gap-2">
                        {research.top_keywords?.map((kw: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-md border border-zinc-200">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'outline' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-500">Review and edit your outline. Chat with the AI on the right to make changes.</p>
                  {chapters.length === 0 && (
                    <button
                      onClick={handleExtractChapters}
                      disabled={isGenerating}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                      Extract Chapters & Start Writing
                    </button>
                  )}
                </div>
                <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm prose prose-zinc max-w-none">
                  <Markdown>{outline}</Markdown>
                </div>
              </div>
            )}

            {viewMode === 'chapter' && activeChapterId && (
              <div className="space-y-6">
                {(() => {
                  const chapter = chapters.find(c => c.id === activeChapterId);
                  if (!chapter) return null;

                  if (chapter.status === 'idle') {
                    return (
                      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-zinc-200 border-dashed">
                        <FileText className="w-12 h-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 mb-2">Chapter not written yet</h3>
                        <button
                          onClick={() => handleGenerateChapter(chapter.id)}
                          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" /> Generate Chapter
                        </button>
                      </div>
                    );
                  }

                  if (chapter.status === 'generating') {
                    return (
                      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-zinc-200">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                        <p className="text-zinc-600 font-medium">Writing chapter...</p>
                        <p className="text-sm text-zinc-400 mt-2">This may take a minute for long chapters.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm prose prose-zinc max-w-none">
                      <Markdown>{chapter.content}</Markdown>
                    </div>
                  );
                })()}
              </div>
            )}

            {viewMode === 'assets' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <div>
                    <h3 className="text-lg font-medium">Finalize Your Book</h3>
                    <p className="text-sm text-zinc-500 mt-1">Generate cover, metadata, and audio samples.</p>
                  </div>
                  <button
                    onClick={handleGenerateAssets}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                    Generate Assets
                  </button>
                </div>

                {assets.coverUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center">
                      <h4 className="font-medium mb-4 w-full">Cover Design</h4>
                      <img src={assets.coverUrl} alt="Cover" className="w-64 rounded-lg shadow-md mb-4" referrerPolicy="no-referrer" />
                      <button onClick={() => downloadBase64(assets.coverUrl!, 'cover.jpg')} className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:underline">
                        <Download className="w-4 h-4" /> Download JPG
                      </button>
                    </div>

                    <div className="space-y-8">
                      {assets.audioUrl && (
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                          <h4 className="font-medium mb-4">Audiobook Sample</h4>
                          <audio controls src={assets.audioUrl} className="w-full mb-4" />
                          <button onClick={() => downloadBase64(assets.audioUrl!, 'audio.mp3')} className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:underline">
                            <Download className="w-4 h-4" /> Download MP3
                          </button>
                        </div>
                      )}

                      {assets.metadata && (
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                          <h4 className="font-medium mb-4">KDP Metadata</h4>
                          <div className="space-y-3 text-sm">
                            <div><strong className="text-zinc-700">Title:</strong> {assets.metadata.title}</div>
                            <div><strong className="text-zinc-700">Subtitle:</strong> {assets.metadata.subtitle}</div>
                            <div><strong className="text-zinc-700">Keywords:</strong> {assets.metadata.keywords?.join(', ')}</div>
                          </div>
                          <button onClick={() => downloadFile(JSON.stringify(assets.metadata, null, 2), 'metadata.json', 'application/json')} className="mt-4 text-sm text-indigo-600 font-medium flex items-center gap-1 hover:underline">
                            <Download className="w-4 h-4" /> Download JSON
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {chapters.length > 0 && chapters.every(c => c.status === 'done') && (
                  <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Full Manuscript</h4>
                      <p className="text-sm text-zinc-500">Download the complete book as a Markdown file.</p>
                    </div>
                    <button 
                      onClick={() => {
                        const fullText = chapters.map(c => `# ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
                        downloadFile(fullText, 'manuscript.md', 'text/markdown');
                      }}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download Full MD
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Right Sidebar: Chat Interface */}
      {(viewMode === 'outline' || viewMode === 'chapter') && (
        <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col h-full flex-shrink-0 shadow-xl z-20">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              AI Co-Writer
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Chat to edit the current {viewMode}. Ask to "rewrite", "expand", or "change the tone".
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeChatHistory.length === 0 ? (
              <div className="text-center text-sm text-zinc-400 mt-10">
                No messages yet. Ask the AI to modify the document!
              </div>
            ) : (
              activeChatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-zinc-100 text-zinc-800 rounded-bl-none'
                  }`}>
                    <div className="prose prose-sm prose-p:my-1 prose-a:text-indigo-400 max-w-none">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isChatting && (
              <div className="flex items-start">
                <div className="bg-zinc-100 rounded-2xl rounded-bl-none px-4 py-3">
                  <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-200 bg-white">
            <div className="relative">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask AI to edit..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={2}
                disabled={isChatting || (viewMode === 'chapter' && chapters.find(c => c.id === activeChapterId)?.status !== 'done')}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isChatting || (viewMode === 'chapter' && chapters.find(c => c.id === activeChapterId)?.status !== 'done')}
                className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  API Settings
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Custom Gemini API Key (Optional)
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border bg-zinc-50"
                />
                <p className="mt-3 text-xs text-zinc-500">
                  If you are hitting quota limits, you can provide your own Google Cloud API key here. It will be used for all generations in this session.
                </p>
              </div>
              <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
