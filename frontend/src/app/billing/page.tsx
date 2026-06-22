'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { AppPageSkeleton } from '@/components/LoadingStates';
import { CreditCard, Check, Zap, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

type Plan = 'free' | 'pro' | 'team';

type SubscriptionData = {
  plan: Plan;
  status?: string;
  limits: {
    projectsCount: number;
    storageBytes: number;
    aiQuestionsPerMonth: number;
  };
  usage: {
    projectsCount: number;
    storageBytes: number;
    aiQuestionsUsed: number;
  };
};

type CheckoutResponse = {
  checkoutUrl?: string;
};

type UpgradeResponse = {
  message?: string;
};

export default function BillingPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();

  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch('/subscription') as SubscriptionData;
      setSubData(data);
    } catch (err) {
      console.error('[Billing]: Fetch failed:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSubscription();
  }, [user]);

  const handleUpgrade = async (plan: Plan) => {
    setError(null);
    setSuccess(null);
    setUpgradingPlan(plan);
    try {
      if (plan !== 'free') {
        try {
          const checkout = await apiFetch('/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ plan }),
          }) as CheckoutResponse;
          if (checkout.checkoutUrl) {
            window.location.assign(checkout.checkoutUrl);
            return;
          }
        } catch (checkoutErr: unknown) {
          const message = checkoutErr instanceof Error ? checkoutErr.message : t('stripeInitFailed');
          if (!message.toLowerCase().includes('stripe')) {
            throw checkoutErr;
          }
          setSuccess(t('stripeNotConfigured'));
        }
      }

      const res = await apiFetch('/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }) as UpgradeResponse;
      setSuccess(res.message || t('upgradePlanSuccess', { plan: plan.toUpperCase() }));
      // Reload sub data and trigger context update by reload (or state sync)
      await fetchSubscription();
      // Simple page refresh or context update to let the header show the new plan
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('upgradePlanFailed'));
    } finally {
      setUpgradingPlan(null);
    }
  };

  if (loading || !user || loadingData) {
    return <AppPageSkeleton label={t('loadingBillingData')} />;
  }

  const { plan, limits, usage } = subData || {
    plan: 'free',
    limits: { projectsCount: 2, storageBytes: 100 * 1024 * 1024, aiQuestionsPerMonth: 20 },
    usage: { projectsCount: 0, storageBytes: 0, aiQuestionsUsed: 0 }
  };

  // Convert bytes to MB
  const storageMB = (usage.storageBytes / (1024 * 1024)).toFixed(1);
  const limitMB = (limits.storageBytes / (1024 * 1024)).toFixed(1);

  // Compute percentages for usage bars
  const projectPct = Math.min(100, (usage.projectsCount / limits.projectsCount) * 100);
  const storagePct = Math.min(100, (usage.storageBytes / limits.storageBytes) * 100);
  const aiPct = Math.min(100, (usage.aiQuestionsUsed / limits.aiQuestionsPerMonth) * 100);

  const planTiers = [
    {
      id: 'free',
      name: t('pricingFreeStarter'),
      description: t('pricingFreeStarterDesc'),
      price: '$0',
      period: t('pricingFreeStarterPeriod'),
      icon: Zap,
      accentColor: 'text-text-secondary',
      btnText: t('pricingCurrentPlan'),
      features: [
        t('quotaActiveRepos'),
        t('quotaCloudStorageFree'),
        t('quotaRagFree'),
        t('quotaSecretScan'),
        t('quotaLocalSearch'),
      ]
    },
    {
      id: 'pro',
      name: t('pricingProName'),
      description: t('pricingProDesc'),
      price: '$15',
      period: t('pricingProPeriod'),
      icon: Sparkles,
      accentColor: 'text-accent-blue',
      btnText: t('pricingProCTA'),
      features: [
        t('quotaActiveReposPro'),
        t('quotaCloudStoragePro'),
        t('quotaRagPro'),
        t('quotaDependencyGraph'),
        t('quotaProjectReplay'),
        t('quotaStyleMatch'),
      ]
    },
    {
      id: 'team',
      name: t('pricingTeamName'),
      description: t('pricingTeamDesc'),
      price: '$49',
      period: t('pricingTeamPeriod'),
      icon: ShieldCheck,
      accentColor: 'text-success',
      btnText: t('pricingTeamCTA'),
      features: [
        t('quotaActiveReposTeam'),
        t('quotaCloudStorageTeam'),
        t('quotaRagTeam'),
        t('quotaTeamInvites'),
        t('quotaSharedCatalog'),
        t('quotaRbac'),
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-bg-primary text-white overflow-hidden" dir={dir}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Dynamic ambient lights */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none"></div>

        {/* Title Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('billingAndPlans')}</h1>
            <p className="text-xs text-text-secondary mt-1">
              {t('billingMonitorDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card-bg/50 border border-card-border rounded-2xl glass">
            <CreditCard className="w-4 h-4 text-accent-blue" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {t('planLabel', { plan: plan.toUpperCase() })}
            </span>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/25 text-danger rounded-2xl text-xs font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success/10 border border-success/25 text-success rounded-2xl text-xs font-medium">
            {success}
          </div>
        )}

        {/* Quotas / Usage Meters Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Meter 1: Projects Count */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-secondary uppercase">{t('activeReposLabel')}</span>
              <span className="text-xs font-bold text-white">{usage.projectsCount} / {limits.projectsCount}</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${projectPct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              {t('reposIndexedDesc')}
            </p>
          </div>

          {/* Meter 2: Cloud Storage */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-secondary uppercase">{t('indexedCodeStorage')}</span>
              <span className="text-xs font-bold text-white">{storageMB} MB / {limitMB} MB</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${storagePct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              {t('fileSizeExtractedDesc')}
            </p>
          </div>

          {/* Meter 3: AI Questions */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-secondary uppercase">{t('monthlyQueriesLabel')}</span>
              <span className="text-xs font-bold text-white">{usage.aiQuestionsUsed} / {limits.aiQuestionsPerMonth}</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${aiPct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              {t('queriesRagDesc')}
            </p>
          </div>
        </div>

        {/* Plan Tiers Grid */}
        <h2 className="text-lg font-bold mb-6">{t('choosePlan')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planTiers.map((tier) => {
            const TierIcon = tier.icon;
            const isCurrent = plan === tier.id;
            const canUpgrade = !isCurrent && (plan === 'free' || (plan === 'pro' && tier.id === 'team'));

            return (
              <div
                key={tier.id}
                className={`bg-card-bg/40 border p-8 rounded-[28px] glass flex flex-col justify-between relative hover-scale transition-all duration-300 ${
                  isCurrent ? 'border-accent-blue shadow-lg shadow-accent-blue/5' : 'border-card-border'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent-blue rounded-full text-[10px] font-bold uppercase tracking-wider text-white">
                    {t('activePlan')}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">{tier.name}</span>
                    <TierIcon className={`w-5 h-5 ${tier.accentColor}`} />
                  </div>

                  <p className="text-xs text-text-secondary mb-6 min-h-[32px]">{tier.description}</p>

                  <div className="flex items-baseline mb-8">
                    <span className="text-4xl font-extrabold tracking-tight text-white">{tier.price}</span>
                    <span className="text-text-secondary text-xs mr-1">/{tier.period}</span>
                  </div>

                  <div className="border-t border-card-border/60 pt-6 mb-8">
                    <p className="text-[10px] font-bold text-text-disabled uppercase tracking-wider mb-4">{t('whatYouGet')}</p>
                    <ul className="space-y-3.5 text-xs text-text-secondary">
                      {tier.features.map((feat, i) => (
                        <li key={i} className="flex items-start">
                          <Check className="w-4 h-4 text-accent-blue ml-2.5 flex-shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleUpgrade(tier.id as any)}
                    disabled={isCurrent || upgradingPlan !== null || (plan === 'team' && tier.id === 'pro') || (plan === 'pro' && tier.id === 'free')}
                    className={`w-full py-3.5 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer flex justify-center items-center ${
                      isCurrent
                        ? 'bg-white/5 border border-card-border text-text-secondary cursor-default'
                        : canUpgrade
                        ? 'bg-accent-blue hover:bg-accent-blue/90 text-white shadow-lg shadow-accent-blue/10'
                        : 'bg-white/5 text-text-disabled cursor-not-allowed border border-card-border/40'
                    }`}
                  >
                    {upgradingPlan === tier.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        {isCurrent ? t('pricingCurrentPlan') : tier.btnText}
                        {!isCurrent && canUpgrade && <ArrowRight className="w-4 h-4 mr-1.5 ltr:ml-1.5 ltr:mr-0 rtl:rotate-180" />}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
