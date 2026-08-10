import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  X,
  CreditCard,
  Crown,
  ShieldCheck,
  Zap,
  BookOpen,
  Headphones,
  FileCheck,
  Palette,
  ExternalLink,
  Info,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, updateUserPlan, PLAN_LIMITS } from '../services/firebase';

import { AdminPayPalSettingsModal } from './AdminPayPalSettingsModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onPlanUpdated: (updated: UserProfile) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onPlanUpdated
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<{ configured: boolean; clientId: string; mode: string; plans: any } | null>(null);
  const [appConfig, setAppConfig] = useState<{ currencySymbol: string; tiers: any } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [isAdminPayPalOpen, setIsAdminPayPalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/app-config')
        .then(res => res.json())
        .then(data => {
          setAppConfig(data);
          setPaypalConfig({
            configured: data.configured,
            clientId: data.paypal?.clientId,
            mode: data.paypal?.mode,
            plans: {
              pro: data.tiers?.pro?.planId,
              agency: data.tiers?.agency?.planId
            }
          });
        })
        .catch(err => console.warn("Failed to fetch app config:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlan = userProfile?.plan || 'free';

  const handleSelectPlan = async (planKey: 'free' | 'pro' | 'agency') => {
    if (planKey === currentPlan) return;
    setLoadingPlan(planKey);
    setError(null);
    setPaymentSuccess(null);

    try {
      if (planKey === 'free') {
        if (userProfile?.uid) {
          const updated = await updateUserPlan(userProfile.uid, 'free');
          onPlanUpdated(updated);
        }
        setPaymentSuccess('Downgraded to Free tier');
        setLoadingPlan(null);
        return;
      }

      // Request PayPal Subscription link/approval
      const response = await fetch('/api/paypal/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile?.uid || 'guest_user',
          userEmail: userProfile?.email || 'author@example.com',
          planName: planKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate PayPal subscription');
      }

      if (data.approveUrl) {
        // Redirect user to PayPal hosted subscription approval page
        window.location.href = data.approveUrl;
      } else {
        // Test / Sandbox mode direct upgrade for instant demonstration
        if (userProfile?.uid) {
          const updated = await updateUserPlan(userProfile.uid, planKey);
          onPlanUpdated(updated);
        }
        setPaymentSuccess(`Successfully upgraded to ${planKey.toUpperCase()} tier via PayPal!`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'PayPal payment initialization failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  const usagePercent = Math.min(
    100,
    Math.round(((userProfile?.monthlyAIWordUsage || 0) / (userProfile?.monthlyAIWordLimit || 10000)) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-zinc-900 to-slate-900 text-white p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
                <PayPalLogo className="w-4 h-4" /> Powered by PayPal
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Upgrade Your Author & Publishing Suite
              </h2>
              <p className="text-zinc-300 text-xs md:text-sm mt-1 max-w-xl">
                Unlock high-speed Gemini 2.5 Pro generation, 300 DPI Print Cover & Spine Studio, Audiobook Synthesis, and Anti-AI Humanizer.
              </p>
            </div>

            {/* Current Usage Widget */}
            {userProfile && (
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-xs w-full md:w-64 shrink-0 space-y-2">
                <div className="flex items-center justify-between text-zinc-200 font-bold">
                  <span>Monthly AI Words</span>
                  <span className="uppercase text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black">
                    {userProfile.plan}
                  </span>
                </div>
                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-300 font-medium">
                  <span>{(userProfile.monthlyAIWordUsage || 0).toLocaleString()} words used</span>
                  <span>{(userProfile.monthlyAIWordLimit || 10000).toLocaleString()} max</span>
                </div>
              </div>
            )}
          </div>

          {/* Billing Cycle Selector */}
          <div className="flex justify-center mt-6">
            <div className="inline-flex items-center bg-white/10 p-1 rounded-2xl border border-white/10 text-xs">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <span>Annual Billing</span>
                <span className="bg-amber-400 text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {paymentSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{paymentSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* FREE PLAN */}
            <div
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                currentPlan === 'free'
                  ? 'border-blue-500 bg-blue-50/20 shadow-md ring-2 ring-blue-200'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-zinc-900 text-lg">Free Starter</h3>
                  {currentPlan === 'free' && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                      Current Plan
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs mb-4">Essential book outlining and basic manuscript writing</p>
                <div className="mb-6">
                  <span className="text-3xl font-black text-zinc-900">$0</span>
                  <span className="text-zinc-500 text-xs font-medium"> / forever</span>
                </div>

                <ul className="space-y-3 text-xs text-zinc-600 mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Up to <strong>2 Manuscripts</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span><strong>10,000 AI words</strong> / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Standard Kindle EPUB & HTML Export</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Basic Amazon Niche Research</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan('free')}
                disabled={currentPlan === 'free' || loadingPlan !== null}
                className={`w-full py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  currentPlan === 'free'
                    ? 'bg-zinc-100 text-zinc-400 cursor-default'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm'
                }`}
              >
                {currentPlan === 'free' ? 'Active Plan' : 'Downgrade to Free'}
              </button>
            </div>

            {/* PRO PUBLISHER (POPULAR) */}
            <div className="p-6 rounded-3xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/40 to-white shadow-xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-sm">
                Most Popular for Authors
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 mt-2">
                  <h3 className="font-extrabold text-zinc-900 text-lg flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    Pro Publisher
                  </h3>
                  {currentPlan === 'pro' && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs mb-4">Complete AI book studio for solo authors and self-publishers</p>
                <div className="mb-6">
                  <span className="text-3xl font-black text-zinc-900">
                    {appConfig?.currencySymbol || '$'}
                    {billingCycle === 'monthly'
                      ? (appConfig?.tiers?.pro?.priceMonthly ?? 29)
                      : Math.round((appConfig?.tiers?.pro?.priceMonthly ?? 29) * 0.8)}
                  </span>
                  <span className="text-zinc-500 text-xs font-medium"> / month</span>
                  {billingCycle === 'annual' && <p className="text-[10px] text-blue-600 font-bold">Billed annually</p>}
                </div>

                <ul className="space-y-3 text-xs text-zinc-700 mb-8 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 font-bold" />
                    <span><strong>Unlimited</strong> Book Manuscripts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>250,000 AI words</strong> / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>300 DPI Print Cover & Spine Studio</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Audiobook Synthesis</strong> & ElevenLabs integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Anti-AI Humanizer Studio</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Complete KDP Zip Publishing Package</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan('pro')}
                disabled={currentPlan === 'pro' || loadingPlan !== null}
                className={`w-full py-3.5 rounded-2xl text-xs font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  currentPlan === 'pro'
                    ? 'bg-blue-100 text-blue-800 cursor-default font-bold'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                }`}
              >
                {loadingPlan === 'pro' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : currentPlan === 'pro' ? (
                  'Active Plan'
                ) : (
                  <>
                    <PayPalLogo className="w-4 h-4" />
                    <span>Subscribe via PayPal ($29/mo)</span>
                  </>
                )}
              </button>
            </div>

            {/* AGENCY & STUDIO */}
            <div
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                currentPlan === 'agency'
                  ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-2 ring-indigo-200'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-zinc-900 text-lg flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    Agency & Studio
                  </h3>
                  {currentPlan === 'agency' && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-xs mb-4">High-volume publishing, ghostwriters & agency suites</p>
                <div className="mb-6">
                  <span className="text-3xl font-black text-zinc-900">
                    {appConfig?.currencySymbol || '$'}
                    {billingCycle === 'monthly'
                      ? (appConfig?.tiers?.agency?.priceMonthly ?? 79)
                      : Math.round((appConfig?.tiers?.agency?.priceMonthly ?? 79) * 0.8)}
                  </span>
                  <span className="text-zinc-500 text-xs font-medium"> / month</span>
                  {billingCycle === 'annual' && <p className="text-[10px] text-indigo-600 font-bold">Billed annually</p>}
                </div>

                <ul className="space-y-3 text-xs text-zinc-600 mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><strong>2,000,000 AI words</strong> / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Priority Gemini 2.5 Pro Speed & Rate Limits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Multi-Author Tenant Collaboration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Custom Branding & Whitelabel Exports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Dedicated VIP Publishing Concierge</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan('agency')}
                disabled={currentPlan === 'agency' || loadingPlan !== null}
                className={`w-full py-3.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  currentPlan === 'agency'
                    ? 'bg-indigo-100 text-indigo-800 cursor-default'
                    : 'bg-indigo-900 hover:bg-indigo-800 text-white shadow-md flex items-center justify-center gap-2'
                }`}
              >
                {loadingPlan === 'agency' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : currentPlan === 'agency' ? (
                  'Active Plan'
                ) : (
                  <>
                    <PayPalLogo className="w-4 h-4" />
                    <span>Subscribe via PayPal ($79/mo)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PayPal Configuration Note & In-App Admin Config Button */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/80 text-xs text-zinc-700 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="font-extrabold text-blue-950 flex items-center gap-1.5">
                <PayPalLogo className="w-4 h-4" /> PayPal Merchant Integration Settings
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  paypalConfig?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {paypalConfig?.configured ? 'Live API Connected' : 'Sandbox / Test Active'}
                </span>
                <button
                  onClick={() => setIsAdminPayPalOpen(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Configure API Credentials (Admin)</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Click <strong>Configure API Credentials</strong> above to set or edit your PayPal Client ID, Client Secret, and Subscription Plan IDs directly within the application without needing to restart servers.
            </p>
          </div>

          {/* Secure Payment Footer */}
          <div className="pt-2 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-zinc-500 text-xs gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>256-bit SSL encrypted subscription checkout processed via <strong>PayPal</strong></span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Instant Upgrade</span>
              <span>•</span>
              <span>Cancel Anytime</span>
              <span>•</span>
              <span>Cloud Firestore Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin PayPal Configuration Modal */}
      <AdminPayPalSettingsModal
        isOpen={isAdminPayPalOpen}
        onClose={() => setIsAdminPayPalOpen(false)}
        onSettingsSaved={() => {
          fetch('/api/paypal/config')
            .then(res => res.json())
            .then(data => setPaypalConfig(data))
            .catch(err => console.warn("Failed to refresh config:", err));
        }}
      />
    </div>
  );
};

function PayPalLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M20.067 8.478c.492.315.844.78.996 1.341.202.736.142 1.581-.17 2.478-.853 2.47-2.923 3.99-5.545 3.99h-1.933a.853.853 0 01-.84-.717l-.853-5.422a.853.853 0 01.84-.988h3.994c1.68 0 3.037-.091 4.511-.682z"
        fill="#0079C1"
      />
      <path
        d="M6.98 3h6.98c2.97 0 5.485.642 6.107 3.478.492.315.844.78.996 1.341.202.736.142 1.581-.17 2.478-.853 2.47-2.923 3.99-5.545 3.99h-1.933a.853.853 0 01-.84-.717l-.853-5.422a.853.853 0 01.84-.988h3.994c.594 0 1.155-.032 1.684-.094C18.665 4.595 16.333 3 13.96 3H6.98z"
        fill="#00457C"
      />
      <path
        d="M8.687 7.152a.853.853 0 00-.84.717L5.02 20.301a.853.853 0 00.84.988h3.535a.853.853 0 00.84-.717l.955-6.07a.853.853 0 01.84-.717h1.411c3.81 0 6.818-2.21 7.671-5.682.02-.083.038-.166.055-.251C19.06 9.4 16.73 9.4 13.96 9.4H8.687z"
        fill="#0079C1"
      />
    </svg>
  );
}
