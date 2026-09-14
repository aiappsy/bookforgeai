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
  Layers,
  Eye,
  EyeOff,
  LogOut,
  Shield,
  Crown
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

  // Admin Security Authentication state
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);

  // Change Passcode state
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [changingPasscode, setChangingPasscode] = useState(false);

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
      // Check stored session passcode
      const storedPasscode = sessionStorage.getItem('admin_session_passcode');
      if (storedPasscode) {
        setPasscode(storedPasscode);
        fetchSettings(storedPasscode);
      } else {
        setIsAuthenticated(false);
      }
    } else {
      setAuthError(null);
      setMessage(null);
    }
  }, [isOpen]);

  const handleUnlockAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passcode.trim()) {
      setAuthError('Please enter the Admin Security Passcode');
      return;
    }

    setVerifyingPasscode(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() })
      });

      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_session_passcode', passcode.trim());
        fetchSettings(passcode.trim());
      } else {
        setIsAuthenticated(false);
        setAuthError(data.error || 'Invalid Admin Security Passcode');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authenticate admin session');
    } finally {
      setVerifyingPasscode(false);
    }
  };

  const handleLockSession = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_session_passcode');
    setPasscode('');
    setMessage(null);
  };

  const fetchSettings = async (activePasscode: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/paypal/admin-settings', {
        headers: { 'x-admin-passcode': activePasscode }
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
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
      } else {
        setIsAuthenticated(false);
        setAuthError(data.error || 'Admin session expired or invalid passcode');
      }
    } catch (err) {
      console.warn('Failed to fetch admin settings:', err);
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
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setMessage({
        type: 'success',
        text: 'App Owner SaaS & Pricing settings saved successfully! Changes are active immediately.'
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
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        }
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

  const handleChangePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode !== confirmPasscode) {
      setMessage({ type: 'error', text: 'New passcodes do not match' });
      return;
    }
    if (newPasscode.trim().length < 4) {
      setMessage({ type: 'error', text: 'New passcode must be at least 4 characters long' });
      return;
    }

    setChangingPasscode(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/change-passcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': passcode
        },
        body: JSON.stringify({
          currentPasscode: currentPasscode.trim(),
          newPasscode: newPasscode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update passcode');

      setPasscode(newPasscode.trim());
      sessionStorage.setItem('admin_session_passcode', newPasscode.trim());
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setMessage({ type: 'success', text: 'Admin Security Passcode updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error changing passcode' });
    } finally {
      setChangingPasscode(false);
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
            className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
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
                <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Owner Security Secured
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Set global subscription prices, PayPal API keys, tier quotas, and admin security settings.
              </p>
            </div>
          </div>

          {isAuthenticated && (
            <div className="flex items-center justify-between mt-6 border-b border-white/10 pb-0">
              <div className="flex gap-2">
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
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'security'
                      ? 'bg-white text-zinc-900 border-t-2 border-blue-500'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Admin Security</span>
                </button>
              </div>

              <button
                onClick={handleLockSession}
                className="mb-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="Lock Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock Portal</span>
              </button>
            </div>
          )}
        </div>

        {/* Locked Screen */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 bg-blue-50 border border-blue-200 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-zinc-900">Admin Authentication Required</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Enter the App Owner Admin Security Passcode to access merchant credentials, SaaS pricing, and tier quotas.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockAdmin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Admin Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter admin passcode (default: admin123)"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Default passcode: <code className="font-mono text-zinc-700 font-bold bg-zinc-100 px-1 py-0.5 rounded">admin123</code>
                </span>
              </div>

              <button
                type="submit"
                disabled={verifyingPasscode}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifyingPasscode ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Admin Studio</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
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

            {activeTab === 'security' ? (
              /* Security Tab */
              <div className="space-y-6">
                <div className="p-5 bg-gradient-to-r from-slate-900 to-zinc-900 text-white rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Admin Security & Access Controls</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Protect your SaaS platform configuration with a secure passcode. Changes take effect immediately.
                  </p>
                </div>

                <form onSubmit={handleChangePasscodeSubmit} className="space-y-4 max-w-lg bg-zinc-50 p-5 rounded-2xl border border-zinc-200">
                  <h4 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
                    Change Admin Security Passcode
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Current Passcode
                    </label>
                    <input
                      type="password"
                      value={currentPasscode}
                      onChange={(e) => setCurrentPasscode(e.target.value)}
                      placeholder="Enter current passcode"
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      New Admin Passcode
                    </label>
                    <input
                      type="password"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      placeholder="Enter new passcode (min 4 chars)"
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Confirm New Passcode
                    </label>
                    <input
                      type="password"
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Re-enter new passcode"
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={changingPasscode}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {changingPasscode ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Update Admin Passcode</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
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
                          <Zap className="w-4 h-4" />
                          <span>Sandbox Test Mode</span>
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
                          <span>Live Production Mode</span>
                        </button>
                      </div>
                    </div>

                    {/* PayPal Credentials Inputs */}
                    <div className="space-y-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">
                          PayPal Client ID
                        </label>
                        <input
                          type="text"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="Paste your PayPal REST API Client ID"
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-zinc-800">
                            PayPal Client Secret
                          </label>
                          {hasSecretStored && (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Secret Stored
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showSecret ? 'text' : 'password'}
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder={hasSecretStored ? '••••••••••••••••' : 'Paste PayPal REST API Client Secret'}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600"
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">
                            Currency Code
                          </label>
                          <input
                            type="text"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                            placeholder="USD, EUR, GBP, NOK"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-800 mb-1">
                            Currency Symbol
                          </label>
                          <input
                            type="text"
                            value={currencySymbol}
                            onChange={(e) => setCurrencySymbol(e.target.value)}
                            placeholder="$, €, £, kr"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Webhook URL Helper */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-600" />
                          PayPal Webhook Notification URL
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyWebhook}
                          className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
                        </button>
                      </div>
                      <code className="block p-2 bg-white border border-blue-100 rounded-xl text-[11px] font-mono text-blue-950 truncate">
                        {webhookUrl}
                      </code>
                    </div>
                  </>
                )}

                {activeTab === 'tiers' && (
                  /* Tiers Configuration Tab */
                  <div className="space-y-4">
                    {/* Pro Tier Config */}
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-zinc-800 text-xs uppercase flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-500" />
                          Pro Publisher Tier
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Recommended Default
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                            Monthly Price ({currencySymbol})
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
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <span className="font-extrabold text-zinc-800 text-xs uppercase flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-purple-600" />
                        Agency Studio Tier
                      </span>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                            Monthly Price ({currencySymbol})
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
            )}

            {/* Test Connection Output */}
            {testResult && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-1 ${
                  testResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>{testResult.success ? 'PayPal Connection Verified' : 'Connection Error'}</span>
                </div>
                <p>{testResult.message}</p>
                {testResult.appId && <p className="font-mono text-[10px] opacity-80">App ID: {testResult.appId}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
