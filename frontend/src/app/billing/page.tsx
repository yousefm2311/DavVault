'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CreditCard, Check, Zap, Sparkles, ShieldCheck, Activity, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BillingPage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();

  const [subData, setSubData] = useState<any>(null);
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
      const data = await apiFetch('/subscription');
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

  const handleUpgrade = async (plan: 'free' | 'pro' | 'team') => {
    setError(null);
    setSuccess(null);
    setUpgradingPlan(plan);
    try {
      const res = await apiFetch('/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      setSuccess(res.message || `Upgraded to ${plan.toUpperCase()} successfully!`);
      // Reload sub data and trigger context update by reload (or state sync)
      await fetchSubscription();
      // Simple page refresh or context update to let the header show the new plan
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setUpgradingPlan(null);
    }
  };

  if (loading || !user || loadingData) {
    return (
      <div className="flex h-screen bg-bg-primary text-white justify-center items-center">
        <div className="w-8 h-8 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
      </div>
    );
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
      name: 'Free Starter',
      description: 'Test the memory indexing workflow',
      price: '$0',
      period: 'forever',
      icon: Zap,
      accentColor: 'text-text-secondary',
      btnText: 'Current Plan',
      features: [
        'Up to 2 active repositories',
        '100 MB safe storage size limit',
        '20 AI code RAG queries / month',
        'Secret leaks scanner detector',
        'Local keyword & semantic search',
      ]
    },
    {
      id: 'pro',
      name: 'Pro Developer',
      description: 'Our most popular tier for active developers',
      price: '$15',
      period: 'month',
      icon: Sparkles,
      accentColor: 'text-accent-blue',
      btnText: 'Upgrade to Pro',
      features: [
        'Up to 15 active repositories',
        '2 GB cloud storage size limits',
        '250 AI code RAG queries / month',
        'Visual file dependency graph',
        'Interactive Project Replays',
        'Code DNA styles comparisons',
      ]
    },
    {
      id: 'team',
      name: 'Team Workspace',
      description: 'Complete engineering brain sharing for small squads',
      price: '$49',
      period: 'month',
      icon: ShieldCheck,
      accentColor: 'text-success',
      btnText: 'Upgrade to Team',
      features: [
        'Up to 100 active repositories',
        '20 GB workspace storage size',
        '1,500 AI RAG queries / month',
        'Teammates invitation & membership',
        'Shared snippet and error catalog',
        'RBAC roles management access',
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-bg-primary text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Dynamic ambient lights */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none"></div>

        {/* Title Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscription & Billing</h1>
            <p className="text-xs text-text-secondary mt-1">
              Monitor plan resource quotas, view usages meters, and upgrade subscriptions tiers.
            </p>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 bg-card-bg/50 border border-card-border rounded-2xl glass">
            <CreditCard className="w-4 h-4 text-accent-blue" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Active Tier: <span className="text-white">{plan.toUpperCase()}</span>
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
              <span className="text-xs font-semibold text-text-secondary uppercase">Active Repositories</span>
              <span className="text-xs font-bold text-white">{usage.projectsCount} / {limits.projectsCount}</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${projectPct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              Active repositories indexed in search and chat sessions.
            </p>
          </div>

          {/* Meter 2: Cloud Storage */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-secondary uppercase">Indexed Code Storage</span>
              <span className="text-xs font-bold text-white">{storageMB} MB / {limitMB} MB</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${storagePct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              Total file content size extracted from repository ZIP uploads.
            </p>
          </div>

          {/* Meter 3: AI Questions */}
          <div className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-secondary uppercase">Monthly AI Queries</span>
              <span className="text-xs font-bold text-white">{usage.aiQuestionsUsed} / {limits.aiQuestionsPerMonth}</span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
              <div
                className="bg-accent-blue h-full rounded-full transition-all duration-500"
                style={{ width: `${aiPct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary">
              Questions directed to the RAG chat assistant or explainers this month.
            </p>
          </div>
        </div>

        {/* Plan Tiers Grid */}
        <h2 className="text-lg font-bold mb-6">Choose Your Plan</h2>
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
                    Active Plan
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
                    <span className="text-text-secondary text-xs ml-1">/{tier.period}</span>
                  </div>

                  <div className="border-t border-card-border/60 pt-6 mb-8">
                    <p className="text-[10px] font-bold text-text-disabled uppercase tracking-wider mb-4">What's included</p>
                    <ul className="space-y-3.5 text-xs text-text-secondary">
                      {tier.features.map((feat, i) => (
                        <li key={i} className="flex items-start">
                          <Check className="w-4 h-4 text-accent-blue mr-2.5 flex-shrink-0 mt-0.5" />
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
                        {isCurrent ? 'Current Plan' : tier.btnText}
                        {!isCurrent && canUpgrade && <ArrowRight className="w-4 h-4 ml-1.5" />}
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
