'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sidebar } from '@/components/Sidebar';
import { AppPageSkeleton } from '@/components/LoadingStates';
import { 
  User, 
  ShieldCheck, 
  Settings2, 
  CreditCard, 
  Camera, 
  Check, 
  Lock, 
  Mail, 
  Sparkles, 
  Bell, 
  Layout, 
  HelpCircle,
  Database,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type Plan = 'free' | 'pro' | 'team';

type SubscriptionData = {
  plan: Plan;
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

const avatarPresets = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', // Male Dev
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', // Female Dev
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=150&h=150&q=80', // Minimal Avatar
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', // Classic Dev
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80', // Senior Eng
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80'  // Full Stack
];

export default function ProfilePage() {
  const { user, loading, apiFetch, updateUserState } = useAuth();
  const { t, dir, language } = useLanguage();
  const router = useRouter();

  const isRtl = dir === 'rtl';

  // State
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'billing'>('profile');
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  
  // Profile settings state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  
  // Security settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preference settings state
  const [accentColor, setAccentColor] = useState('blue');
  const [notifWeeklyEmail, setNotifWeeklyEmail] = useState(true);
  const [notifAIInsights, setNotifAIInsights] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);

  // Status indicators
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchProfile = async () => {
    try {
      const data = await apiFetch('/user/profile');
      if (data.user) {
        setName(data.user.name);
        setEmail(data.user.email);
        setBio(data.user.bio || '');
        setAvatar(data.user.avatar || 'https://lh3.googleusercontent.com/a/default-user');
        updateUserState({
          ...user!,
          name: data.user.name,
          email: data.user.email,
          avatar: data.user.avatar,
          bio: data.user.bio,
          createdAt: data.user.createdAt
        });
      }
    } catch (err) {
      console.error('[Profile]: Failed to load profile:', err);
    }
  };

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch('/subscription') as SubscriptionData;
      setSubData(data);
    } catch (err) {
      console.error('[Profile/Billing]: Failed to load usage metrics:', err);
    }
  };

  const hasFetched = useRef(false);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      setName(user.name);
      setEmail(user.email);
      setBio(user.bio || '');
      setAvatar(user.avatar || 'https://lh3.googleusercontent.com/a/default-user');
      
      const storedAccent = localStorage.getItem('accentColor') || 'blue';
      setAccentColor(storedAccent);
      
      fetchProfile();
      fetchSubscription();
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await apiFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email, avatar, bio }),
      });

      updateUserState({
        ...user!,
        name: res.user.name,
        email: res.user.email,
        avatar: res.user.avatar,
        bio: res.user.bio
      });

      // Update tokens if returned
      if (res.tokens?.accessToken) {
        localStorage.setItem('accessToken', res.tokens.accessToken);
        localStorage.setItem('refreshToken', res.tokens.refreshToken);
      }

      setSuccess(t('saveSuccess'));
    } catch (err: any) {
      setError(err.message || t('errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      setSaving(false);
      return;
    }

    try {
      await apiFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setSuccess(t('passwordUpdatedSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || t('errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccentChange = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('accentColor', color);
    
    // Apply immediate global override
    document.documentElement.classList.remove('accent-blue', 'accent-purple', 'accent-amber', 'accent-green');
    document.documentElement.classList.add(`accent-${color}`);
  };

  const handlePreferencesSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Typically saved to local settings or a preference collection.
    // For local MVP, we preserve locally and show success
    localStorage.setItem('notifWeeklyEmail', JSON.stringify(notifWeeklyEmail));
    localStorage.setItem('notifAIInsights', JSON.stringify(notifAIInsights));
    localStorage.setItem('notifSecurity', JSON.stringify(notifSecurity));

    setSuccess(t('saveSuccess'));
  };

  if (loading || !user) {
    return <AppPageSkeleton label={t('loadingProfileSettings')} />;
  }

  // Format storage helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'profile', name: t('personalInfo'), icon: User },
    { id: 'security', name: t('security'), icon: ShieldCheck },
    { id: 'preferences', name: t('preferences'), icon: Settings2 },
    { id: 'billing', name: t('billing'), icon: CreditCard }
  ];

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 overflow-y-auto pb-28 lg:pb-10">
        {/* Navigation path header */}
        <div className="sticky top-0 z-20 hidden border-b border-card-border bg-bg-primary/80 px-10 py-4 backdrop-blur-xl lg:flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-muted">{t('settings')}</span>
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            <span className="font-semibold text-white">{t('profileTitle')}</span>
          </div>
        </div>

        <div className="mx-auto max-w-4xl p-6 lg:p-10">
          <div className="mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">{t('profileTitle')}</h2>
            <p className="text-sm text-text-secondary">{t('profileSubtitle')}</p>
          </div>

          {/* Settings Shell Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
            
            {/* Sidebar navigation tabs */}
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-4 md:pb-0 border-b md:border-b-0 md:border-l ltr:md:border-l-0 ltr:md:border-r border-card-border/60">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                      isActive 
                        ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' 
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 flex-shrink-0" />
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Config details section */}
            <div className="space-y-6">
              
              {/* Alert Feedback Messages */}
              {error && (
                <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger"></span>
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-success text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  {success}
                </div>
              )}

              {/* Tab 1: Personal Profile */}
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileSave} className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-card-border/60">
                    <div className="relative group">
                      <img 
                        src={avatar} 
                        alt="Profile Avatar" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-accent-blue/45 shadow-lg shadow-accent-blue/5"
                      />
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left ltr:sm:text-left rtl:sm:text-right space-y-1">
                      <h4 className="text-lg font-bold text-white">{name || 'Your Name'}</h4>
                      <p className="text-xs text-text-secondary font-mono">{email}</p>
                      <p className="text-[10px] text-text-muted mt-1">
                        {t('joinedDate')}: {user.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : ''}
                      </p>
                    </div>
                  </div>

                  {/* Preset Avatars Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-text-secondary block">{t('avatarPresets')}</label>
                    <div className="flex flex-wrap gap-3">
                      {avatarPresets.map((presetUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatar(presetUrl)}
                          className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all duration-200 relative ${
                            avatar === presetUrl ? 'border-accent-blue scale-105 shadow-md shadow-accent-blue/20' : 'border-card-border hover:border-white/40'
                          }`}
                        >
                          <img src={presetUrl} alt={`preset-${idx}`} className="w-full h-full object-cover" />
                          {avatar === presetUrl && (
                            <div className="absolute inset-0 bg-accent-blue/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-secondary block">{t('nameLabel')}</label>
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-secondary block">{t('emailLabel')}</label>
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-secondary block">{t('bioLabel')}</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition resize-none"
                      placeholder={t('bioPlaceholder')}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-accent-blue hover:bg-accent-blue/90 text-xs font-bold text-white py-3.5 shadow-lg shadow-accent-blue/10 transition cursor-pointer"
                  >
                    {saving ? t('updating') : t('saveSettings')}
                  </button>
                </form>
              )}

              {/* Tab 2: Security & Password */}
              {activeTab === 'security' && (
                <form onSubmit={handlePasswordSave} className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-card-border/60">
                    <Lock className="w-5 h-5 text-accent-blue" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{t('security')}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {t('passwordSecurityNote')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-secondary block">{t('currentPassword')}</label>
                      <input 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition font-mono"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-secondary block">{t('newPassword')}</label>
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-secondary block">{t('confirmPassword')}</label>
                        <input 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-bg-primary/50 border border-card-border focus:border-accent-blue/50 px-4 py-3 rounded-xl text-xs text-white outline-none transition font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-accent-blue hover:bg-accent-blue/90 text-xs font-bold text-white py-3.5 shadow-lg shadow-accent-blue/10 transition cursor-pointer"
                  >
                    {saving ? t('updating') : t('saveSettings')}
                  </button>
                </form>
              )}

              {/* Tab 3: Preference / Custom Theme Accent */}
              {activeTab === 'preferences' && (
                <form onSubmit={handlePreferencesSave} className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-card-border/60">
                    <Layout className="w-5 h-5 text-accent-blue" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{t('preferences')}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {t('preferencesSubtitle')}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Theme color switcher */}
                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-text-secondary block">{t('accentColor')}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'blue', name: t('accentBlue'), color: '#0A84FF', bgClass: 'bg-[#0A84FF]' },
                        { id: 'purple', name: t('accentPurple'), color: '#BF5AF2', bgClass: 'bg-[#BF5AF2]' },
                        { id: 'amber', name: t('accentAmber'), color: '#FFD60A', bgClass: 'bg-[#FFD60A]' },
                        { id: 'green', name: t('accentGreen'), color: '#30D158', bgClass: 'bg-[#30D158]' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAccentChange(item.id)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                            accentColor === item.id 
                              ? 'bg-white/5 border-accent-blue text-white shadow-md' 
                              : 'border-card-border text-text-secondary hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded-full ${item.bgClass}`}></span>
                            {item.name}
                          </span>
                          {accentColor === item.id && <Check className="w-3.5 h-3.5 text-accent-blue" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notification checkboxes settings */}
                  <div className="space-y-4 pt-4 border-t border-card-border/60">
                    <label className="text-xs font-semibold text-text-secondary block flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-accent-blue" />
                      {t('notificationsTitle')}
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3.5 bg-bg-primary/30 border border-card-border/60 rounded-xl cursor-pointer hover:bg-bg-primary/50 transition">
                        <input 
                          type="checkbox"
                          checked={notifWeeklyEmail}
                          onChange={(e) => setNotifWeeklyEmail(e.target.checked)}
                          className="rounded border-card-border text-accent-blue focus:ring-accent-blue focus:ring-opacity-20 w-4 h-4"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{t('emailNotifications')}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5">
                            {t('weeklyEmailDesc')}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 bg-bg-primary/30 border border-card-border/60 rounded-xl cursor-pointer hover:bg-bg-primary/50 transition">
                        <input 
                          type="checkbox"
                          checked={notifAIInsights}
                          onChange={(e) => setNotifAIInsights(e.target.checked)}
                          className="rounded border-card-border text-accent-blue focus:ring-accent-blue focus:ring-opacity-20 w-4 h-4"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{t('aiInsights')}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5">
                            {t('aiInsightsDesc')}
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 bg-bg-primary/30 border border-card-border/60 rounded-xl cursor-pointer hover:bg-bg-primary/50 transition">
                        <input 
                          type="checkbox"
                          checked={notifSecurity}
                          onChange={(e) => setNotifSecurity(e.target.checked)}
                          className="rounded border-card-border text-accent-blue focus:ring-accent-blue focus:ring-opacity-20 w-4 h-4"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{t('securityAlerts')}</span>
                          <span className="text-[10px] text-text-secondary mt-0.5">
                            {t('securityAlertsDesc')}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-accent-blue hover:bg-accent-blue/90 text-xs font-bold text-white py-3.5 shadow-lg shadow-accent-blue/10 transition cursor-pointer"
                  >
                    {t('saveSettings')}
                  </button>
                </form>
              )}

              {/* Tab 4: Subscriptions Limits Metrics */}
              {activeTab === 'billing' && (
                <div className="bg-card-bg/40 border border-card-border p-7 rounded-[28px] glass space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-card-border/60">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-accent-blue" />
                      <div>
                        <h4 className="text-sm font-bold text-white">{t('billing')}</h4>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {t('billingQuotaDesc')}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-[10px] font-extrabold bg-accent-blue/15 text-accent-blue border border-accent-blue/20 rounded-full tracking-wider">
                      {user.plan.toUpperCase()}
                    </span>
                  </div>

                  {subData ? (
                    <div className="space-y-6">
                      {/* Meter 1: Projects count */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-white">{t('projects')}</span>
                          <span className="text-text-secondary font-mono">
                            {subData.usage.projectsCount} / {subData.limits.projectsCount}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-accent-blue transition-all duration-300"
                            style={{ width: `${Math.min(100, (subData.usage.projectsCount / subData.limits.projectsCount) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Meter 2: AI Queries */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-white">{t('monthlyQueriesLabel')}</span>
                          <span className="text-text-secondary font-mono">
                            {subData.usage.aiQuestionsUsed} / {subData.limits.aiQuestionsPerMonth}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-accent-blue transition-all duration-300"
                            style={{ width: `${Math.min(100, (subData.usage.aiQuestionsUsed / subData.limits.aiQuestionsPerMonth) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Meter 3: Storage */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-white">{t('storageUsed')}</span>
                          <span className="text-text-secondary font-mono">
                            {formatBytes(subData.usage.storageBytes)} / {formatBytes(subData.limits.storageBytes)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-accent-blue transition-all duration-300"
                            style={{ width: `${Math.min(100, (subData.usage.storageBytes / subData.limits.storageBytes) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-card-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left ltr:sm:text-left rtl:sm:text-right">
                          <span className="text-xs text-text-secondary block">
                            {t('needMoreResources')}
                          </span>
                          <span className="text-[10px] text-text-muted mt-0.5">
                            {t('upgradeForHigherLimits')}
                          </span>
                        </div>
                        <button
                          onClick={() => router.push('/billing')}
                          className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-xs font-bold text-white rounded-2xl shadow-lg shadow-accent-blue/10 transition cursor-pointer"
                        >
                          {t('upgradeBtn')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-text-secondary flex flex-col items-center justify-center gap-2">
                      <Database className="w-8 h-8 text-text-secondary opacity-60 animate-pulse" />
                      {t('loading')}
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
