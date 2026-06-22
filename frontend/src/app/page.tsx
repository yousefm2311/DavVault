'use client';

import React from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  Brain,
  Search,
  MessageSquare,
  Sparkles,
  Database,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Code2
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      title: 'Semantic Vector Search',
      description: 'Find files, functions, and old bug solutions using natural language. Query like "Where did I handle Stripe webhooks?" and get exact files.',
      icon: Search,
    },
    {
      title: 'Code RAG Chatbot',
      description: 'Interact directly with your imported repositories. Ask questions, clarify systems architecture, and receive explained codes citing sources.',
      icon: MessageSquare,
    },
    {
      title: 'Automatic Code DNA Extraction',
      description: 'Upload ZIP folders. The pipeline automatically extracts classes, routes, models, framework structures, and dependency graphs in the background.',
      icon: Brain,
    },
    {
      title: 'Snippet & Bug Vault',
      description: 'Log resolved exceptions and snippet guides. Keep a persistent repository of exceptions, causes, and before/after code fixes.',
      icon: Code2,
    },
    {
      title: 'Secret Leak Prevention',
      description: 'Rest easy with automatic scanner scanning. Secrets (.env keys, database credentials, third-party credentials) are redacted before storage.',
      icon: ShieldCheck,
    },
    {
      title: 'Code Health Metrics',
      description: 'Analyze files for empty catch blocks, dead codes, or technical debt, providing overall project scores and optimization steps.',
      icon: Sparkles,
    },
  ];

  const pricing = [
    {
      name: 'Free Plan',
      price: '$0',
      description: 'For personal developer use',
      features: [
        'Up to 2 active projects',
        '100MB cloud storage limit',
        'Basic keyword search',
        '20 AI questions / month',
        'Standard Local Storage',
      ],
      cta: 'Get Started',
      href: '/signup',
      popular: false,
    },
    {
      name: 'Pro Developer',
      price: '$15',
      description: 'Perfect for freelancers & power developers',
      features: [
        'Up to 100 active projects',
        '50GB cloud storage limits',
        'Full Semantic & Vector Search',
        'Unlimited AI chat & explanations',
        'Code Health analysis',
        'Detailed Developer DNA profile',
      ],
      cta: 'Go Pro',
      href: '/signup',
      popular: true,
    },
    {
      name: 'Team Brain',
      price: '$49',
      description: 'For small development teams & workspaces',
      features: [
        'Unlimited projects',
        'Shared team workspace directory',
        'Company Brain Chatbot integration',
        'RBAC member controls',
        'Employee exit knowledge lock',
        'Priority support SLA',
      ],
      cta: 'Start Team Trial',
      href: '/signup',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-white select-none relative overflow-x-hidden">
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] rounded-full bg-gradient-to-b from-accent-blue/10 via-transparent to-transparent blur-[150px] pointer-events-none"></div>

      {/* Header Navigation bar */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-accent-blue flex items-center justify-center shadow-md shadow-accent-blue/15">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">DevVault AI</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link href="/login">
            <span className="text-sm font-medium text-text-secondary hover:text-white transition-colors cursor-pointer">
              Sign In
            </span>
          </Link>
          <Link href="/signup">
            <span className="text-sm font-semibold bg-accent-blue hover:bg-accent-blue/90 px-4 py-2.5 rounded-xl transition-all shadow-md shadow-accent-blue/10 cursor-pointer">
              Get Started
            </span>
          </Link>
        </div>
      </header>

      {/* Hero Presentation Area */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center relative z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-accent-blue/10 border border-accent-blue/20 rounded-full text-[11px] font-semibold text-accent-blue tracking-wide uppercase mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Engineering Memory</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
          Your codebase is your <br />
          <span className="bg-gradient-to-r from-accent-blue to-[#64D2FF] bg-clip-text text-transparent">
            engineering brain.
          </span>
        </h1>
        
        <p className="text-text-secondary text-sm md:text-base max-w-xl mx-auto mt-6 leading-relaxed">
          Stop digging through old folders or GitHub repos. DevVault AI ingests, summarizes, and indexes your projects so you can find code segments and ask questions using natural language.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link href="/signup">
            <span className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-accent-blue hover:bg-accent-blue/90 text-sm font-semibold rounded-2xl transition-all shadow-lg shadow-accent-blue/25 cursor-pointer">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </span>
          </Link>
          <Link href="/login">
            <span className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-card-bg border border-card-border hover:bg-white/5 text-sm font-semibold rounded-2xl transition-colors cursor-pointer">
              Upload Your First Project
            </span>
          </Link>
        </div>

        {/* Hero Code Preview Window Mock */}
        <div className="mt-16 bg-[#161616] border border-card-border rounded-[28px] p-2 shadow-2xl relative overflow-hidden glass max-w-3xl mx-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-card-border/50">
            <div className="flex space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-danger/70"></span>
              <span className="w-3 h-3 rounded-full bg-warning/70"></span>
              <span className="w-3 h-3 rounded-full bg-success/70"></span>
            </div>
            <span className="text-[10px] font-mono text-text-secondary">RAG Context: firebase_auth.ts</span>
            <div className="w-10"></div>
          </div>
          <div className="p-5 text-left font-mono text-xs text-[#E0E0E0] overflow-x-auto space-y-1.5 select-text">
            <div><span className="text-accent-blue">const</span> <span className="text-success">authenticateUser</span> = <span className="text-warning">async</span> (email, pass) =&gt; &#123;</div>
            <div className="pl-4 text-text-secondary">// Search matches Firebase code from Ecommerce Project</div>
            <div className="pl-4"><span className="text-accent-blue">const</span> auth = getAuth(app);</div>
            <div className="pl-4"><span className="text-accent-blue">try</span> &#123;</div>
            <div className="pl-8"><span className="text-accent-blue">const</span> result = <span className="text-warning">await</span> signInWithEmailAndPassword(auth, email, pass);</div>
            <div className="pl-8"><span className="text-accent-blue">return</span> result.user;</div>
            <div className="pl-4">&#125; <span className="text-accent-blue">catch</span> (err) &#123;</div>
            <div className="pl-8 text-danger">console.error("Auth error:", err);</div>
            <div className="pl-4">&#125;</div>
            <div>&#125;;</div>
          </div>
        </div>
      </section>

      {/* Features Grid Area */}
      <section className="bg-bg-secondary border-t border-b border-card-border/60 py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Supercharge engineering reuse</h2>
            <p className="text-sm text-text-secondary mt-3 leading-relaxed">
              DevVault AI is engineered to parse, extract, index, and organize every helper file or solved error you've ever written.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-card-bg/40 border border-card-border p-6 rounded-[24px] glass hover-scale"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-accent-blue" />
                  </div>
                  <h3 className="font-bold text-sm text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight font-sans">Flexible, Developer-Friendly Plans</h2>
          <p className="text-sm text-text-secondary mt-3">
            Unlock your engineering brain limit depending on your active project scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {pricing.map((tier, i) => (
            <div
              key={i}
              className={`bg-card-bg/50 border rounded-[28px] p-8 flex flex-col justify-between glass hover-scale relative ${
                tier.popular ? 'border-accent-blue ring-1 ring-accent-blue/30' : 'border-card-border'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent-blue text-[10px] font-bold tracking-wide uppercase rounded-full">
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{tier.name}</h3>
                <p className="text-xs text-text-secondary mb-6">{tier.description}</p>
                <div className="flex items-baseline mb-6">
                  <span className="text-4xl font-extrabold text-white">{tier.price}</span>
                  <span className="text-xs text-text-secondary ml-1">/month</span>
                </div>
                
                <ul className="space-y-3.5 mb-8">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start text-xs text-[#E0E0E0]">
                      <CheckCircle2 className="w-4 h-4 text-success mr-2.5 mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href={tier.href}>
                <span
                  className={`w-full py-3 inline-flex justify-center items-center rounded-2xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
                    tier.popular
                      ? 'bg-accent-blue text-white shadow-md shadow-accent-blue/20 hover:bg-accent-blue/90'
                      : 'bg-white/5 border border-card-border text-white hover:bg-white/10'
                  }`}
                >
                  {tier.cta}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer footer */}
      <footer className="border-t border-card-border py-12 max-w-6xl mx-auto px-6 text-center text-xs text-text-secondary">
        <p>© {new Date().getFullYear()} DevVault AI. Built for full stack developers. Designed with Linear + Apple inspiration.</p>
      </footer>
    </div>
  );
}
