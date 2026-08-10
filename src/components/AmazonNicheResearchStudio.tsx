import React, { useState, useEffect } from 'react';
import { 
  Search, Sparkles, TrendingUp, Target, DollarSign, BookOpen, Layers, 
  CheckCircle2, Copy, ArrowRight, ShieldCheck, Zap, AlertTriangle, BarChart3,
  Award, RefreshCw, Star, Info, ChevronRight, Hash, ArrowUpRight
} from 'lucide-react';
import { analyzeAmazonNicheOpportunity, AmazonNicheOpportunityResult } from '../services/geminiService';

interface AmazonNicheResearchStudioProps {
  customApiKey?: string;
  activeBookTitle?: string;
  activeBookIdea?: string;
  onApplyKeywordsToBook?: (keywords: string[]) => void;
  onApplyCategoriesToBook?: (categoryPath: string) => void;
  onApplyPriceToBook?: (ebookPrice: number, paperbackPrice: number) => void;
  onStartBookFromNiche?: (nicheData: {
    topic: string;
    richPrompt?: string;
    keywords: string[];
    categories: string[];
    ebookPrice: number;
    paperbackPrice: number;
    targetAudience: string;
    description: string;
    verdict: string;
    contentGaps: string[];
  }) => void;
}

const PRESET_NICHES = [
  "AI & Machine Learning for Beginners",
  "Cozy Mystery & Small Town Secrets",
  "Habit Stacking & High Performance Routine",
  "Dark Romance & Fantasy Academy",
  "Personal Finance & Passive Dividend Income",
  "High-Protein Slow Cooker Meal Prep",
  "Cybersecurity & Ethical Hacking Guide"
];

export const AmazonNicheResearchStudio: React.FC<AmazonNicheResearchStudioProps> = ({
  customApiKey,
  activeBookTitle,
  activeBookIdea,
  onApplyKeywordsToBook,
  onApplyCategoriesToBook,
  onApplyPriceToBook,
  onStartBookFromNiche
}) => {
  const [searchTerm, setSearchTerm] = useState<string>(activeBookTitle || activeBookIdea || "AI & Machine Learning for Beginners");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AmazonNicheOpportunityResult | null>(null);
  const [activeTab, setActiveTab] = useState<'keywords' | 'categories' | 'gaps' | 'competitors'>('keywords');
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const handleRunAnalysis = async (termToAnalyze?: string) => {
    const query = termToAnalyze || searchTerm;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAppliedNotice(null);

    try {
      const data = await analyzeAmazonNicheOpportunity(query, customApiKey);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze Amazon market opportunity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial run on mount if not analyzed yet
    handleRunAnalysis(searchTerm);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyword(text);
    setTimeout(() => setCopiedKeyword(null), 2000);
  };

  const handleApplyAllKeywords = () => {
    if (!result || !onApplyKeywordsToBook) return;
    const kwList = result.top_keywords.slice(0, 7).map(k => k.keyword);
    onApplyKeywordsToBook(kwList);
    setAppliedNotice("Successfully applied top 7 Amazon KDP keywords to your manuscript metadata!");
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const handleApplyCategory = (catPath: string) => {
    if (!onApplyCategoriesToBook) return;
    onApplyCategoriesToBook(catPath);
    setAppliedNotice(`Applied "${catPath}" to book publishing settings!`);
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const handleApplyPrices = () => {
    if (!result || !onApplyPriceToBook) return;
    onApplyPriceToBook(result.recommended_list_price.ebook, result.recommended_list_price.paperback);
    setAppliedNotice(`Updated target list prices: $${result.recommended_list_price.ebook} (eBook) / $${result.recommended_list_price.paperback} (Paperback)!`);
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-amber-900 via-zinc-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Market Opportunity Model (Web Grounded)
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Amazon Market Opportunity & Keyword Intelligence Model
            </h1>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Synthesizes real-time web search grounding, Amazon reader search volume patterns, keyword competition levels, BSR rank thresholds, and reader review content gaps to formulate high-profit book strategies.
            </p>
          </div>

          {(activeBookTitle || activeBookIdea) && (
            <button
              onClick={() => {
                const term = activeBookTitle || activeBookIdea || "";
                setSearchTerm(term);
                handleRunAnalysis(term);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-extrabold text-xs px-4 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Zap className="w-4 h-4 fill-amber-950" />
              <span>Scan Active Manuscript Niche</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {appliedNotice && (
        <div className="bg-emerald-900/90 text-emerald-100 border border-emerald-500/40 p-4 rounded-xl text-sm font-semibold flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Search Bar & Preset Pills */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAnalysis();
          }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter any book niche, keyword, or title (e.g., 'Cozy Mystery', 'Python for Finance')..."
              className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchTerm.trim()}
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Scanning Amazon Market...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 text-amber-400" />
                <span>Analyze Opportunity</span>
              </>
            )}
          </button>
        </form>

        {/* Preset Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-zinc-500">
          <span className="font-bold shrink-0 text-zinc-700">Explore Hot Niches:</span>
          {PRESET_NICHES.map((niche) => (
            <button
              key={niche}
              onClick={() => {
                setSearchTerm(niche);
                handleRunAnalysis(niche);
              }}
              className={`px-3 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                searchTerm === niche
                  ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                  : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-medium'
              }`}
            >
              {niche}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl text-rose-800 text-sm font-medium flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Workspace */}
      {result && !loading && (
        <div className="space-y-8 animate-fadeIn">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Opportunity Score */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Greenfield Opportunity</span>
                <Target className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900">{result.opportunity_score}</span>
                <span className="text-xs font-extrabold text-zinc-400">/ 100</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    result.opportunity_score >= 70 ? 'bg-emerald-500' : result.opportunity_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, result.opportunity_score))}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                {result.opportunity_score >= 70 ? '🔥 High Demand & Moderate Competition' : result.opportunity_score >= 50 ? '⚡ Balanced Market Opportunity' : '⚠️ Highly Saturated Market'}
              </p>
            </div>

            {/* Demand & Search Volume */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Monthly Search Demand</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900">
                  {result.market_size_monthly_searches.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-zinc-400">searches/mo</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-extrabold">
                <span>Demand Score: {result.demand_score}/100</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">Estimated reader queries on Amazon</p>
            </div>

            {/* Competition Level */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Competition Level</span>
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black ${
                  result.competition_level === 'Low' ? 'text-emerald-600' : result.competition_level === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {result.competition_level}
                </span>
                <span className="text-xs font-bold text-zinc-400">({result.competition_score}/100)</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Difficulty ranking in Amazon search results
              </p>
            </div>

            {/* Monthly Royalty Potential */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>Top 20 Royalty Potential</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-emerald-700">
                  ${result.est_monthly_royalty_potential.top_20_bestsellers.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-zinc-400">/mo</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Top 5: ${result.est_monthly_royalty_potential.top_5_bestsellers.toLocaleString()}/mo • Avg: ${result.est_monthly_royalty_potential.average_author.toLocaleString()}/mo
              </p>
            </div>
          </div>

          {/* Actionable Verdict Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center shrink-0 shadow-xs">
                <Award className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-amber-950">Strategic Bestseller Verdict for "{result.niche_topic}"</h3>
                <p className="text-sm text-amber-900/90 leading-relaxed font-medium">
                  {result.actionable_verdict}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {onStartBookFromNiche && (
                <button
                  onClick={() => {
                    const richPrompt = `Write a market-validated, high-converting book on: "${result.niche_topic}"

STRATEGIC MARKET POSITIONING & EXECUTIVE VERDICT:
${result.actionable_verdict}

KEY TARGET READERS & MARKET DEMAND:
- Monthly Search Volume: ~${(result.market_size_monthly_searches || 100000).toLocaleString()} searches/month (Demand Score: ${result.demand_score}/100)
- Competition Level: ${result.competition_level} (Opportunity Score: ${result.opportunity_score}/100)
- Target Manuscript Length: ~${(result.target_word_count || 40000).toLocaleString()} words
- Pricing Strategy: $${result.recommended_list_price.ebook} eBook / $${result.recommended_list_price.paperback} Paperback

CRITICAL READER CONTENT GAPS TO DIRECTLY ADDRESS (SOLVING COMPETITOR COMPLAINTS):
${result.content_gaps_and_opportunities?.map((g, i) => `${i + 1}. [${g.angle_title}] Reader Pain Point: "${g.reader_complaint_addressed}" -> SOLUTION FIX: ${g.suggested_feature}`).join('\n') || ''}

HIGH-VOLUME AMAZON TARGET KEYWORDS TO WEAVE THROUGHOUT MANUSCRIPT:
${result.top_keywords?.map(k => `- "${k.keyword}" (~${(k.monthly_searches || 0).toLocaleString()} searches/mo | ${k.opportunity_tip})`).join('\n') || ''}

LOW-COMPETITION KDP CATEGORIES TO TARGET:
${result.recommended_categories?.map(c => `- ${c.category_path} (Avg BSR #${c.bsr_for_top_10})`).join('\n') || ''}`;

                    onStartBookFromNiche({
                      topic: result.niche_topic,
                      richPrompt: richPrompt,
                      keywords: result.top_keywords.map(k => k.keyword),
                      categories: result.recommended_categories.map(c => c.category_path),
                      ebookPrice: result.recommended_list_price.ebook,
                      paperbackPrice: result.recommended_list_price.paperback,
                      targetAudience: `Readers searching for ${result.niche_topic} seeking practical, non-generic frameworks.`,
                      description: result.actionable_verdict,
                      verdict: result.actionable_verdict,
                      contentGaps: result.content_gaps_and_opportunities.map(g => `${g.angle_title}: ${g.reader_complaint_addressed} -> ${g.suggested_feature}`)
                    });
                    setAppliedNotice("🚀 Bootstrapping new book project from Niche Analytics...");
                    setTimeout(() => setAppliedNotice(null), 3000);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
                  <span>Start Book Project from this Niche</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {onApplyPriceToBook && (
                <button
                  onClick={handleApplyPrices}
                  className="bg-white hover:bg-amber-100/80 text-amber-950 border border-amber-300 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>Apply Prices (${result.recommended_list_price.ebook} / ${result.recommended_list_price.paperback})</span>
                </button>
              )}
            </div>
          </div>

          {/* Subtabs Navigation */}
          <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 overflow-x-auto border border-zinc-200">
            <button
              onClick={() => setActiveTab('keywords')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'keywords' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Hash className="w-4 h-4 text-indigo-600" />
              <span>Amazon KDP Keywords ({result.top_keywords.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'categories' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Low-Competition Categories ({result.recommended_categories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('gaps')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'gaps' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span>Reader Content Gaps ({result.content_gaps_and_opportunities.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('competitors')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'competitors' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>Competitor Benchmarks ({result.competitor_benchmarks.length})</span>
            </button>
          </div>

          {/* Tab 1: Amazon KDP Backend Keywords */}
          {activeTab === 'keywords' && (
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs space-y-4 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-zinc-900">Amazon KDP Backend Search Keywords</h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Amazon allows exactly 7 backend search phrases (up to 50 characters each). Use these high-conversion long-tail search terms.
                  </p>
                </div>

                {onApplyKeywordsToBook && (
                  <button
                    onClick={handleApplyAllKeywords}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Top 7 Keywords to My Book</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                      <th className="py-3 px-4">Search Keyword Phrase</th>
                      <th className="py-3 px-4">Est. Monthly Searches</th>
                      <th className="py-3 px-4">Competition</th>
                      <th className="py-3 px-4">Relevance</th>
                      <th className="py-3 px-4">Strategic Tip</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {result.top_keywords.map((kw, i) => (
                      <tr key={i} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-zinc-900 flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-[10px]">#{i + 1}</span>
                          <span>{kw.keyword}</span>
                        </td>
                        <td className="py-3.5 px-4 font-black text-zinc-800">
                          {kw.monthly_searches.toLocaleString()} / mo
                        </td>
                        <td className="py-3.5 px-4 font-extrabold">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase border ${
                            kw.competition === 'Low' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            kw.competition === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {kw.competition}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-indigo-600">
                          {kw.relevance_score}%
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 font-medium max-w-xs">
                          {kw.opportunity_tip}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleCopy(kw.keyword)}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKeyword === kw.keyword ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                            <span>{copiedKeyword === kw.keyword ? 'Copied' : 'Copy'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: KDP Categories & BSR Targets */}
          {activeTab === 'categories' && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-black text-zinc-900">Recommended Low-Competition KDP Categories</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Target these specific Amazon browse paths to achieve the official Amazon #1 Best Seller badge with lower sales volume requirements.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.recommended_categories.map((cat, i) => (
                  <div key={i} className="bg-zinc-50 rounded-2xl border border-zinc-200 p-5 space-y-4 hover:border-emerald-300 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                          {cat.competition_difficulty} Competition
                        </span>
                        <h4 className="text-sm font-black text-zinc-900 leading-snug">
                          {cat.category_path}
                        </h4>
                      </div>
                      
                      {onApplyCategoriesToBook && (
                        <button
                          onClick={() => handleApplyCategory(cat.category_path)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                        >
                          Select Category
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-zinc-200 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block">Top 10 BSR Threshold</span>
                        <span className="text-sm font-black text-zinc-800">#{cat.bsr_for_top_10.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-600 uppercase block">#1 Bestseller Badge BSR</span>
                        <span className="text-sm font-black text-amber-900">#{cat.bsr_for_number_1.toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                      💡 {cat.opportunity_reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Reader Content Gaps */}
          {activeTab === 'gaps' && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-black text-zinc-900">Unfair Advantage: Reader Complaints & Content Gaps</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  We analyzed 1-star to 3-star Amazon reviews of competing books in this niche. Include these features in your manuscript outline to dominate reader reviews.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {result.content_gaps_and_opportunities.map((gap, i) => (
                  <div key={i} className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl border border-amber-200 p-5 space-y-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-amber-950 font-black text-xs flex items-center justify-center">
                      #{i + 1}
                    </div>
                    <h4 className="text-sm font-extrabold text-amber-950">{gap.angle_title}</h4>
                    
                    <div className="space-y-1 bg-white/80 p-3 rounded-xl border border-amber-200/60 text-xs">
                      <span className="text-[10px] font-bold text-rose-600 uppercase block">Reader Pain Point in Top Competitors</span>
                      <p className="text-zinc-700 italic">"{gap.reader_complaint_addressed}"</p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Suggested Value Proposition</span>
                      <p className="text-emerald-950 font-semibold">{gap.suggested_feature}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Competitor Benchmarks */}
          {activeTab === 'competitors' && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-black text-zinc-900">Amazon Competitor Benchmarks & Price Strategy</h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Analysis of current bestseller book titles, pricing structures, and weakness patterns on Amazon KDP.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.competitor_benchmarks.map((comp, i) => (
                  <div key={i} className="bg-zinc-50 rounded-2xl border border-zinc-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-zinc-900">{comp.title_pattern}</h4>
                      <span className="text-xs font-extrabold text-zinc-600 bg-white px-2.5 py-1 rounded-lg border border-zinc-200">
                        Avg Price: {comp.avg_price}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-zinc-600">
                      <span>⭐ Reviews: ~{comp.avg_reviews.toLocaleString()}</span>
                    </div>

                    <p className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
                      ⚠️ <strong>Key Competitor Weakness:</strong> {comp.key_weakness}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
