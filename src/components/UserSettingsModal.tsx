import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Key,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Save,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Sliders,
  HelpCircle,
  RefreshCw,
  Crown,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Check,
  ArrowRight
} from 'lucide-react';
import { UserProfile } from '../services/firebase';
import { testGeminiApiKey } from '../services/geminiService';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
  onOpenSubscriptions?: () => void;
  initialTab?: 'profile' | 'api' | 'subscription';
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
  onOpenSubscriptions,
  initialTab = 'api'
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'subscription'>(initialTab);

  // Profile Fields
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [penName, setPenName] = useState(localStorage.getItem('user_pen_name') || '');
  const [authorBio, setAuthorBio] = useState(localStorage.getItem('user_author_bio') || '');
  const [favoriteGenre, setFavoriteGenre] = useState(localStorage.getItem('user_favorite_genre') || 'Fiction');
  const [defaultLanguage, setDefaultLanguage] = useState(localStorage.getItem('user_default_language') || 'English');

  // BYOK API Keys
  const [userGeminiKey, setUserGeminiKey] = useState(
    localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key') || ''
  );
  const [userElevenLabsKey, setUserElevenLabsKey] = useState(
    localStorage.getItem('user_custom_elevenlabs_key') || localStorage.getItem('elevenlabs_api_key') || ''
  );

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElevenKey, setShowElevenKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (userProfile) {
        setDisplayName(userProfile.displayName || '');
      }
      setUserGeminiKey(
        localStorage.getItem('user_custom_gemini_key') || localStorage.getItem('gemini_api_key') || ''
      );
      setUserElevenLabsKey(
        localStorage.getItem('user_custom_elevenlabs_key') || localStorage.getItem('elevenlabs_api_key') || ''
      );
    }
  }, [isOpen, initialTab, userProfile]);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const trimmedGemini = userGeminiKey.trim();
      const trimmedEleven = userElevenLabsKey.trim();

      localStorage.setItem('user_pen_name', penName);
      localStorage.setItem('user_author_bio', authorBio);
      localStorage.setItem('user_favorite_genre', favoriteGenre);
      localStorage.setItem('user_default_language', defaultLanguage);

      // Save BYOK Keys across standard local storage identifiers
      if (trimmedGemini) {
        localStorage.setItem('user_custom_gemini_key', trimmedGemini);
        localStorage.setItem('gemini_api_key', trimmedGemini);
      } else {
        localStorage.removeItem('user_custom_gemini_key');
        localStorage.removeItem('gemini_api_key');
      }

      if (trimmedEleven) {
        localStorage.setItem('user_custom_elevenlabs_key', trimmedEleven);
        localStorage.setItem('elevenlabs_api_key', trimmedEleven);
      } else {
        localStorage.removeItem('user_custom_elevenlabs_key');
        localStorage.removeItem('elevenlabs_api_key');
      }

      if (userProfile && onProfileUpdated) {
        onProfileUpdated({
          ...userProfile,
          displayName
        });
      }

      setMessage({ type: 'success', text: 'BYOK API keys & author preferences saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update user profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestGeminiKey = async () => {
    if (!userGeminiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter a Gemini API Key first.'
      });
      return;
    }
    setTestingGemini(true);
    setTestResult(null);

    const result = await testGeminiApiKey(userGeminiKey.trim());
    setTestResult(result);
    setTestingGemini(false);
  };

  const isGeminiConfigured = Boolean(userGeminiKey.trim());
  const isElevenConfigured = Boolean(userElevenLabsKey.trim());

  const usagePercent = Math.min(
    100,
    Math.round(((userProfile?.monthlyAIWordUsage || 0) / (userProfile?.monthlyAIWordLimit || 10000)) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-blue-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">User Settings & BYOK API Keys</h2>
                <span className="text-[10px] font-black uppercase bg-blue-500/30 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  BYOK Enabled
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Connect your personal API keys for unlimited Google Gemini AI generation and ElevenLabs speech synthesis.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 border-b border-white/10 pb-0">
            <button
              onClick={() => setActiveTab('api')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'api'
                  ? 'bg-white text-zinc-900 border-t-2 border-blue-500 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>Personal API Keys (BYOK)</span>
              {isGeminiConfigured ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-white text-zinc-900 border-t-2 border-blue-500 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <span>Author Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'subscription'
                  ? 'bg-white text-zinc-900 border-t-2 border-blue-500 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Subscription & Usage</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {message && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'api' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* BYOK Explanation Banner */}
              <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50/70 to-slate-50 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-extrabold text-blue-950 uppercase tracking-tight">
                      Bring Your Own Key (BYOK) Model
                    </h3>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Direct API Connection
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed">
                  This application uses a <strong>Bring Your Own Key (BYOK)</strong> architecture. You supply your own personal API keys, which are stored securely in your browser session. Your keys grant you full control and direct access to Google Gemini models and ElevenLabs audio generation.
                </p>
              </div>

              {/* Step 1: Google Gemini API Key */}
              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-200 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                        1
                      </span>
                      <h4 className="text-sm font-extrabold text-zinc-900">
                        Google Gemini API Key <span className="text-red-500">*</span>
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 pl-7">
                      Required for AI chapter generation, book outliner, cover creation, and anti-AI humanizer.
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border shrink-0 ${
                      isGeminiConfigured
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {isGeminiConfigured ? '✓ Key Saved' : '⚠️ Required Key Missing'}
                  </span>
                </div>

                {/* Instructions Box for Gemini Key */}
                <div className="bg-white p-4 rounded-xl border border-zinc-200/80 space-y-2 text-xs text-zinc-700 pl-4 border-l-4 border-l-blue-600">
                  <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span>How to get your free Google Gemini API Key:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 pl-1">
                    <li>
                      Go to Google AI Studio at{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
                      >
                        aistudio.google.com/app/apikey
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Sign in with your Google account.</li>
                    <li>Click the blue <strong>"Create API key"</strong> button (Google provides free usage tier).</li>
                    <li>Copy your API key (starts with <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-[10px]">AIzaSy...</code>).</li>
                    <li>Paste your key into the field below and click <strong>"Test Key"</strong> to verify.</li>
                  </ol>

                  <div className="pt-2">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-lg text-xs border border-blue-200 transition-colors cursor-pointer"
                    >
                      <span>Open Google AI Studio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Input Field */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700">
                    Paste Google Gemini API Key:
                  </label>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={userGeminiKey}
                        onChange={(e) => setUserGeminiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestGeminiKey}
                      disabled={testingGemini || !userGeminiKey.trim()}
                      className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-40 cursor-pointer"
                    >
                      {testingGemini ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>Test Key</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: ElevenLabs API Key (Optional) */}
              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-200 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                        2
                      </span>
                      <h4 className="text-sm font-extrabold text-zinc-900">
                        ElevenLabs API Key <span className="text-zinc-400 font-normal">(Optional for Audiobooks)</span>
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 pl-7">
                      Used for converting manuscript chapters into voice audiobooks with natural AI voices.
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border shrink-0 ${
                      isElevenConfigured
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    {isElevenConfigured ? '✓ Voice Key Set' : 'Optional'}
                  </span>
                </div>

                {/* Instructions Box for ElevenLabs Key */}
                <div className="bg-white p-4 rounded-xl border border-zinc-200/80 space-y-2 text-xs text-zinc-700 pl-4 border-l-4 border-l-indigo-600">
                  <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    <span>How to get your ElevenLabs API Key:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 pl-1">
                    <li>
                      Visit ElevenLabs at{' '}
                      <a
                        href="https://elevenlabs.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline"
                      >
                        elevenlabs.io
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Log in or create a free/pro account.</li>
                    <li>Click your Profile Avatar (bottom left or top right) and select <strong>"Profile & API Keys"</strong>.</li>
                    <li>Copy your API key and paste it below.</li>
                  </ol>

                  <div className="pt-2">
                    <a
                      href="https://elevenlabs.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-lg text-xs border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <span>Open ElevenLabs</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Input Field */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700">
                    Paste ElevenLabs API Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showElevenKey ? 'text' : 'password'}
                      value={userElevenLabsKey}
                      onChange={(e) => setUserElevenLabsKey(e.target.value)}
                      placeholder="eleven_..."
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowElevenKey(!showElevenKey)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showElevenKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-zinc-200 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save BYOK API Keys & Preferences</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Display Name / Account Email
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Jane Doe"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Email: {userProfile?.email || 'Author Account'}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Author Pen Name (Publishing Brand)
                  </label>
                  <input
                    type="text"
                    value={penName}
                    onChange={(e) => setPenName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. J.D. Vance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Author Biography (Included in Back Cover & Metadata)
                </label>
                <textarea
                  rows={3}
                  value={authorBio}
                  onChange={(e) => setAuthorBio(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell your readers about yourself, past publications, and writing style..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Favorite Primary Genre
                  </label>
                  <select
                    value={favoriteGenre}
                    onChange={(e) => setFavoriteGenre(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Fiction">Fiction & Literature</option>
                    <option value="Non-Fiction">Non-Fiction & Self-Help</option>
                    <option value="Sci-Fi">Sci-Fi & Fantasy</option>
                    <option value="Thriller">Mystery, Crime & Thriller</option>
                    <option value="Romance">Romance & Contemporary</option>
                    <option value="Business">Business, Finance & Entrepreneurship</option>
                    <option value="Memoir">Memoir & Biography</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Default Publishing Language
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English (US/UK)</option>
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="Italian">Italian (Italiano)</option>
                    <option value="Portuguese">Portuguese (Português)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Profile Preferences</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 rounded-2xl border border-blue-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-extrabold text-blue-950 uppercase">
                      Current Account Plan: {userProfile?.plan || 'Free'} Tier
                    </span>
                  </div>
                  <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase border border-emerald-300">
                    {userProfile?.subscriptionStatus || 'Active'}
                  </span>
                </div>

                {/* Usage Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                    <span>AI Words Used This Month</span>
                    <span>
                      {(userProfile?.monthlyAIWordUsage || 0).toLocaleString()} / {(userProfile?.monthlyAIWordLimit || 10000).toLocaleString()} words
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Resets automatically at the start of your billing cycle.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-4">
                  <p className="text-xs text-zinc-600">
                    Need higher AI word quotas, 300 DPI Cover Studio, or ElevenLabs Voice Synthesis?
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenSubscriptions) onOpenSubscriptions();
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>View Subscription Plans</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
