import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Sliders,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Globe,
  DollarSign,
  Lock,
  Edit3,
  Layers
} from 'lucide-react';

interface AdminPayPalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const AdminPayPalSettingsModal: React.FC<AdminPayPalSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [activeTab, setActiveTab] = useState<'paypal' | 'tiers' | 'security'>('paypal');

  // Admin Security Passcode state
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Default unlocked for smooth setup

  // PayPal API Credentials
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Tier Pricing & Quotas
  const [freeLimit, setFreeLimit] = useState(10000);
  const [freeBooks, setFreeBooks] = useState(2);

  const [proPrice, setProPrice] = useState(29);
  const [proPlanId, setProPlanId] = useState('');
  const [proLimit, setProLimit] = useState(250000);
  const [proBooks, setProBooks] = useState(10);

  const [agencyPrice, setAgencyPrice] = useState(79);
  const [agencyPlanId, setAgencyPlanId] = useState('');
  const [agencyLimit, setAgencyLimit] = useState(2000000);
  const [agencyBooks, setAgencyBooks] = useState(100);

  const [hasSecretStored, setHasSecretStored] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; appId?: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${window.location.origin}/api/paypal/webhook`;

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/paypal/admin-settings');
      const data = await res.json();
      if (res.ok) {
        setClientId(data.clientId || '');
        setMode(data.mode || 'sandbox');
        setCurrency(data.currency || 'USD');
        setCurrencySymbol(data.currencySymbol || '$');
        setHasSecretStored(data.hasSecret || false);
        if (data.hasSecret) {
          setClientSecret(data.secretMasked || '');
        }

        if (data.tiers) {
          if (data.tiers.free) {
            setFreeLimit(data.tiers.free.wordLimit || 10000);
            setFreeBooks(data.tiers.free.maxProjects || 2);
          }
          if (data.tiers.pro) {
            setProPrice(data.tiers.pro.priceMonthly || 29);
            setProPlanId(data.tiers.pro.planId || '');
            setProLimit(data.tiers.pro.wordLimit || 250000);
            setProBooks(data.tiers.pro.maxProjects || 10);
          }
          if (data.tiers.agency) {
            setAgencyPrice(data.tiers.agency.priceMonthly || 79);
            setAgencyPlanId(data.tiers.agency.planId || '');
            setAgencyLimit(data.tiers.agency.wordLimit || 2000000);
            setAgencyBooks(data.tiers.agency.maxProjects || 100);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch admin settings:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setTestResult(null);

    try {
      const payload = {
        clientId,
        clientSecret,
        mode,
        currency,
        currencySymbol,
        tiers: {
          free: {
            wordLimit: Number(freeLimit),
            maxProjects: Number(freeBooks)
          },
          pro: {
            priceMonthly: Number(proPrice),
            planId: proPlanId,
            wordLimit: Number(proLimit),
            maxProjects: Number(proBooks)
          },
          agency: {
            priceMonthly: Number(agencyPrice),
            planId: agencyPlanId,
            wordLimit: Number(agencyLimit),
            maxProjects: Number(agencyBooks)
          }
        }
      };

      const res = await fetch('/api/paypal/admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setMessage({
        type: 'success',
        text: 'App Owner SaaS & Pricing settings saved successfully! Changes are active immediately across the entire app.'
      });
      setHasSecretStored(data.config.hasSecret);
      setClientSecret(data.config.secretMasked);
      if (onSettingsSaved) onSettingsSaved();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update owner settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/paypal/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
          appId: data.appId
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'PayPal connection test failed'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error reaching PayPal server endpoint'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-zinc-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">App Owner & SaaS Admin Studio</h2>
                <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  Owner Portal
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Set subscription prices, PayPal API keys, tier quotas, and currency settings.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-6 border-b border-white/10 pb-0">
            <button
              onClick={() => setActiveTab('paypal')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                activeTab === 'paypal'
                  ? 'bg-white text-zinc-900 border-t-2 border-blue-500'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              PayPal Merchant API
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                activeTab === 'tiers'
                  ? 'bg-white text-zinc-900 border-t-2 border-blue-500'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Subscription Tiers & Prices
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {message && (
            <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {activeTab === 'paypal' && (
              <>
                {/* Environment Mode Selector */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2">
                  <label className="block text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
                    PayPal Environment Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('sandbox')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        mode === 'sandbox'
                          ? 'bg-amber-500 text-zinc-950 shadow-sm border border-amber-400'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Sandbox / Developer Testing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('live')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        mode === 'live'
                          ? 'bg-emerald-600 text-white shadow-sm border border-emerald-500'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      <span>Live Production Merchant</span>
                    </button>
                  </div>
                </div>

                {/* API Credentials */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    PayPal REST API Keys
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      PayPal Client ID
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="e.g. A21AAFdS3s81k_D85j2X..."
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-zinc-700">
                        PayPal Client Secret
                      </label>
                      {hasSecretStored && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                          ✓ Secret Saved on Server
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showSecret ? "text" : "password"}
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="e.g. EP4v39m13k9..."
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-2.5 text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        {showSecret ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Webhook Helper */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-800 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-blue-600" />
                      PayPal Webhook URL
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWebhook}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWebhook ? 'Copied!' : 'Copy Webhook URL'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-mono bg-white p-2 rounded-xl border border-zinc-200 select-all truncate">
                    {webhookUrl}
                  </p>
                </div>
              </>
            )}

            {activeTab === 'tiers' && (
              <div className="space-y-6">
                {/* Currency settings */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Currency Code
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        if (e.target.value === 'EUR') setCurrencySymbol('€');
                        else if (e.target.value === 'GBP') setCurrencySymbol('£');
                        else setCurrencySymbol('$');
                      }}
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Currency Display Symbol
                    </label>
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Pro Tier Config */}
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-950 text-xs uppercase flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-blue-600" /> Pro Publisher Tier
                    </span>
                    <span className="text-[10px] font-black uppercase bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Price ({currencySymbol}/mo)
                      </label>
                      <input
                        type="number"
                        value={proPrice}
                        onChange={(e) => setProPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-extrabold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Monthly AI Word Limit
                      </label>
                      <input
                        type="number"
                        value={proLimit}
                        onChange={(e) => setProLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        PayPal Pro Plan ID
                      </label>
                      <input
                        type="text"
                        value={proPlanId}
                        onChange={(e) => setProPlanId(e.target.value)}
                        placeholder="P-PRO-PLAN-ID"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Agency Tier Config */}
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-950 text-xs uppercase flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-indigo-600" /> Agency Studio Tier
                    </span>
                    <span className="text-[10px] font-black uppercase bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                      Maximum Power
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Price ({currencySymbol}/mo)
                      </label>
                      <input
                        type="number"
                        value={agencyPrice}
                        onChange={(e) => setAgencyPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-extrabold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Monthly AI Word Limit
                      </label>
                      <input
                        type="number"
                        value={agencyLimit}
                        onChange={(e) => setAgencyLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        PayPal Agency Plan ID
                      </label>
                      <input
                        type="text"
                        value={agencyPlanId}
                        onChange={(e) => setAgencyPlanId(e.target.value)}
                        placeholder="P-AGENCY-PLAN-ID"
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Free Tier Config */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                  <span className="font-extrabold text-zinc-800 text-xs uppercase block">
                    Free Tier Default Quotas
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Free Monthly AI Word Limit
                      </label>
                      <input
                        type="number"
                        value={freeLimit}
                        onChange={(e) => setFreeLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                        Max Free Manuscripts
                      </label>
                      <input
                        type="number"
                        value={freeBooks}
                        onChange={(e) => setFreeBooks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 gap-4">
              {activeTab === 'paypal' ? (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !clientId}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>Test API Credentials</span>
                </button>
              ) : <div />}

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Owner Settings & Publish Tiers</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Test Connection Output */}
          {testResult && (
            <div className={`p-4 rounded-2xl text-xs space-y-1 ${
              testResult.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className="font-bold flex items-center gap-2">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                <span>{testResult.success ? 'PayPal Connection Verified' : 'Connection Error'}</span>
              </div>
              <p>{testResult.message}</p>
              {testResult.appId && <p className="font-mono text-[10px] opacity-80">App ID: {testResult.appId}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
