'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { AppPageSkeleton, SectionSkeleton } from '@/components/LoadingStates';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  History,
  Calendar,
  Sparkles,
  ChevronRight,
  FolderCode,
  Bug,
  Code2,
  Boxes,
  Search,
  Filter,
  Clock,
  GitBranch,
  HardDrive,
  Tag,
  X,
} from 'lucide-react';

type TimelineType = 'all' | 'project' | 'snippet' | 'error' | 'system' | 'file' | 'auth';

interface TimelineEvent {
  type: TimelineType;
  id?: string;
  name: string;
  description: string;
  date: string;
  action?: string;
  importance?: 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

interface TimelineSummary {
  total: number;
  highImpact: number;
  byType: Record<string, number>;
  byDay: Record<string, number>;
}

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function TimeMachinePage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();
  const { t, dir, language } = useLanguage();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [summary, setSummary] = useState<TimelineSummary>({ total: 0, highImpact: 0, byType: {}, byDay: {} });
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [activeType, setActiveType] = useState<TimelineType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  // Time Machine AI query helper
  const [timeQuery, setTimeQuery] = useState('');

  const months = [
    { value: 1, label: t('january') },
    { value: 2, label: t('february') },
    { value: 3, label: t('march') },
    { value: 4, label: t('april') },
    { value: 5, label: t('may') },
    { value: 6, label: t('june') },
    { value: 7, label: t('july') },
    { value: 8, label: t('august') },
    { value: 9, label: t('september') },
    { value: 10, label: t('october') },
    { value: 11, label: t('november') },
    { value: 12, label: t('december') },
  ];

  const years = [currentYear - 2, currentYear - 1, currentYear];

  const eventTypeMeta = {
    all: { label: language === 'ar' ? 'الكل' : 'All', icon: Activity, tone: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20' },
    project: { label: language === 'ar' ? 'مشاريع' : 'Projects', icon: FolderCode, tone: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20' },
    snippet: { label: language === 'ar' ? 'مقاطع' : 'Snippets', icon: Code2, tone: 'text-warning bg-warning/10 border-warning/20' },
    error: { label: language === 'ar' ? 'أخطاء' : 'Errors', icon: Bug, tone: 'text-danger bg-danger/10 border-danger/20' },
    system: { label: language === 'ar' ? 'أنظمة' : 'Systems', icon: Boxes, tone: 'text-success bg-success/10 border-success/20' },
    file: { label: language === 'ar' ? 'ملفات' : 'Files', icon: GitBranch, tone: 'text-text-secondary bg-white/5 border-card-border' },
    auth: { label: language === 'ar' ? 'جلسات' : 'Auth', icon: Clock, tone: 'text-text-secondary bg-white/5 border-card-border' },
  };

  const filteredTimeline = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return timeline.filter((event) => {
      const typeMatch = activeType === 'all' || event.type === activeType;
      const queryMatch =
        !query ||
        [event.name, event.description, event.action, ...(Object.values(event.details || {}).map((value) => String(value)))]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return typeMatch && queryMatch;
    });
  }, [activeType, searchQuery, timeline]);

  const groupedTimeline = useMemo(() => {
    const groups = filteredTimeline.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
      const key = new Date(event.date).toISOString().slice(0, 10);
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {});

    return Object.entries(groups)
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTimeline]);

  const monthDays = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const key = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = summary.byDay[key] || 0;
      return { day, key, count };
    });
  }, [selectedMonth, selectedYear, summary.byDay]);

  const peakDay = monthDays.reduce((max, day) => Math.max(max, day.count), 0);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const data = await apiFetch(`/time-machine?month=${selectedMonth}&year=${selectedYear}`);
      setTimeline(data.events || []);
      setSummary(data.summary || { total: 0, highImpact: 0, byType: {}, byDay: {} });
      setSelectedEvent((data.events || [])[0] || null);
      setCollapsedDays({});
    } catch (err) {
      console.error('[TimeMachine]: Fetch failed:', err);
      setTimeline([]);
      setSummary({ total: 0, highImpact: 0, byType: {}, byDay: {} });
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTimeline();
  }, [user, selectedMonth, selectedYear]);

  const handleAskTimeMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeQuery.trim()) return;

    // Direct to chat with contextual time filter prompt
    const formattedQuery = language === 'ar'
      ? `في ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}: ${timeQuery}`
      : `In ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}: ${timeQuery}`;
    router.push(`/chat?ask=${encodeURIComponent(formattedQuery)}`);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    if (event.type === 'project') {
      router.push(`/projects/${event.id}`);
    } else if (event.type === 'snippet') {
      router.push(`/snippets?id=${event.id}`);
    } else if (event.type === 'error') {
      router.push(`/errors?id=${event.id}`);
    } else if (event.type === 'system') {
      router.push(`/systems?id=${event.id}`);
    }
  };

  if (loading || !user) return <AppPageSkeleton label={t('loadingTimeMachine')} />;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none" dir={dir}>
      <Sidebar />

      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex-1 overflow-y-auto px-5 py-6 pb-28 lg:px-10 lg:py-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent-blue">
                <History className="h-3.5 w-3.5" />
                Git-style Memory Ledger
              </div>
              <h2 className="text-3xl font-bold tracking-tight">{t('timeMachineTitle')}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{t('timeMachineSubtitle')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-card-border bg-card-bg/40 p-2 glass">
              <Calendar className="mx-2 h-4 w-4 text-accent-blue" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-2xl border border-card-border bg-bg-primary px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent-blue/50"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-2xl border border-card-border bg-bg-primary px-3.5 py-2.5 text-xs text-white outline-none focus:border-accent-blue/50"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            initial="hidden"
            animate="show"
            className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            {[
              { label: language === 'ar' ? 'إجمالي الأحداث' : 'Total Events', value: summary.total, icon: Activity, tone: 'text-accent-blue' },
              { label: language === 'ar' ? 'أيام نشطة' : 'Active Days', value: Object.keys(summary.byDay).length, icon: Calendar, tone: 'text-success' },
              { label: language === 'ar' ? 'أحداث مؤثرة' : 'High Impact', value: summary.highImpact, icon: AlertTriangle, tone: 'text-warning' },
              { label: language === 'ar' ? 'المعروض الآن' : 'Visible Now', value: filteredTimeline.length, icon: Filter, tone: 'text-text-secondary' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    show: { opacity: 1, y: 0 }
                  }}
                  className="rounded-[24px] border border-card-border bg-card-bg/40 p-5 glass"
                >
                  <Icon className={`mb-5 h-5 w-5 ${item.tone}`} />
                  <p className="text-2xl font-bold text-white select-all">
                    <AnimatedCounter value={item.value} />
                  </p>
                  <p className="mt-1 text-[11px] text-text-secondary">{item.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <aside className="space-y-6">
              <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-5 glass">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <BarChart3 className="h-4 w-4 text-accent-blue" />
                  {language === 'ar' ? 'خريطة نشاط الشهر' : 'Monthly Activity Map'}
                </h3>
                <div className="grid grid-cols-7 gap-1.5">
                  {monthDays.map((day) => {
                    const intensity = peakDay ? day.count / peakDay : 0;
                    const color =
                      day.count === 0
                        ? 'bg-white/[0.04] border-white/[0.04]'
                        : intensity > 0.66
                          ? 'bg-accent-blue border-accent-blue'
                          : intensity > 0.33
                            ? 'bg-accent-blue/55 border-accent-blue/60'
                            : 'bg-accent-blue/25 border-accent-blue/30';
                    return (
                      <button
                        key={day.key}
                        type="button"
                        title={`${day.key}: ${day.count}`}
                        onClick={() => {
                          setSearchQuery('');
                          setCollapsedDays((prev) => ({ ...prev, [day.key]: false }));
                        }}
                        className={`aspect-square rounded-md border text-[9px] font-mono text-white/70 transition hover:scale-110 ${color}`}
                      >
                        {day.day}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-text-secondary">
                  <span>{language === 'ar' ? 'أقل' : 'Less'}</span>
                  <div className="flex gap-1">
                    <span className="h-3 w-3 rounded bg-white/[0.04]" />
                    <span className="h-3 w-3 rounded bg-accent-blue/25" />
                    <span className="h-3 w-3 rounded bg-accent-blue/55" />
                    <span className="h-3 w-3 rounded bg-accent-blue" />
                  </div>
                  <span>{language === 'ar' ? 'أكثر' : 'More'}</span>
                </div>
              </div>

              <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-5 glass">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Filter className="h-4 w-4 text-accent-blue" />
                  {language === 'ar' ? 'فلترة النشاط' : 'Activity Filters'}
                </h3>
                <div className="relative mb-4">
                  <Search className={`absolute top-3.5 h-4 w-4 text-text-secondary ${dir === 'rtl' ? 'right-4' : 'left-4'}`} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={language === 'ar' ? 'ابحث في الماضي...' : 'Search past work...'}
                    className={`w-full rounded-2xl border border-card-border bg-bg-primary/50 py-3 text-xs text-white outline-none focus:border-accent-blue/50 ${dir === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
                  />
                </div>
                <div className="space-y-2">
                  {(Object.keys(eventTypeMeta) as TimelineType[]).map((type) => {
                    const meta = eventTypeMeta[type];
                    const Icon = meta.icon;
                    const count = type === 'all' ? summary.total : summary.byType[type] || 0;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-xs transition ${
                          activeType === type ? meta.tone : 'border-card-border bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {meta.label}
                        </span>
                        <span className="font-mono text-[10px]">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-accent-blue/25 bg-accent-blue/[0.06] p-5 glass">
                <h3 className="mb-3 flex items-center text-xs font-bold text-white">
                  <Sparkles className="h-4 w-4 text-accent-blue ml-1.5 ltr:mr-1.5 ltr:ml-0" />
                  {t('askPastMemory')}
                </h3>
                <form onSubmit={handleAskTimeMachine} className="space-y-3">
                  <textarea
                    rows={4}
                    placeholder={t('askPastMemoryPlaceholder')}
                    value={timeQuery}
                    onChange={(e) => setTimeQuery(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-card-border bg-bg-primary/50 px-4 py-3 text-xs text-white outline-none focus:border-accent-blue/50"
                  />
                  <button
                    type="submit"
                    disabled={!timeQuery.trim()}
                    className="w-full rounded-2xl bg-accent-blue px-5 py-3 text-xs font-semibold text-white transition hover:bg-accent-blue/90 disabled:bg-accent-blue/50"
                  >
                    {t('askAi')}
                  </button>
                </form>
              </div>
            </aside>

            <section className="min-w-0 overflow-hidden rounded-[24px] border border-card-border bg-card-bg/35 glass">
              <div className="flex flex-col gap-3 border-b border-card-border bg-bg-primary/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">{t('timelineActivityLog')}</h3>
                  <p className="mt-0.5 text-[10px] text-text-secondary">
                    {groupedTimeline.length} {language === 'ar' ? 'أيام' : 'days'} • {filteredTimeline.length} {language === 'ar' ? 'حدث' : 'events'}
                  </p>
                </div>
                {(searchQuery || activeType !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveType('all');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-white/5 px-2.5 py-1.5 text-[10px] text-text-secondary hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    {language === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}
                  </button>
                )}
              </div>

              {loadingTimeline ? (
                <div className="p-4">
                  <SectionSkeleton rows={7} className="border-0 bg-transparent p-0" />
                </div>
              ) : groupedTimeline.length > 0 ? (
                <div className="max-h-[calc(100vh-290px)] overflow-y-auto select-text">
                  {groupedTimeline.map((group) => {
                    const isCollapsed = collapsedDays[group.date];
                    const dayDate = new Date(group.date);
                    return (
                      <div key={group.date} className="border-b border-card-border/70 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setCollapsedDays((prev) => ({ ...prev, [group.date]: !prev[group.date] }))}
                          className="flex w-full items-center justify-between gap-4 bg-white/[0.025] px-4 py-3 text-left transition hover:bg-white/[0.045] rtl:text-right"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-card-border bg-bg-primary text-[11px] font-bold text-accent-blue">
                              {dayDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit' })}
                            </span>
                            <div className="min-w-0">
                            <h4 className="truncate text-xs font-bold text-white">
                              {dayDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                                weekday: 'long',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </h4>
                            <p className="mt-0.5 text-[10px] text-text-secondary">
                              {group.events.length} {language === 'ar' ? 'حدث في هذا اليوم' : 'events on this day'}
                            </p>
                            </div>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-text-secondary transition ${isCollapsed ? '' : 'rotate-90'} rtl:rotate-180`} />
                        </button>

                        {!isCollapsed && (
                          <div className="divide-y divide-card-border/60">
                            {group.events.map((event) => {
                              const meta = eventTypeMeta[event.type] || eventTypeMeta.all;
                              const Icon = meta.icon;
                              const isSelected = selectedEvent?.id === event.id && selectedEvent?.date === event.date;
                              return (
                                <button
                                  key={`${event.type}-${event.id}-${event.date}`}
                                  type="button"
                                  onClick={() => setSelectedEvent(event)}
                                  className={`group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition rtl:text-right ${
                                    isSelected
                                      ? 'bg-accent-blue/10'
                                      : 'hover:bg-white/[0.045]'
                                  }`}
                                >
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${meta.tone}`}>
                                    <Icon className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="truncate text-xs font-semibold text-white group-hover:text-accent-blue">
                                        {event.name}
                                      </span>
                                      {event.importance === 'high' && (
                                        <span className="shrink-0 rounded-full bg-warning/10 px-1.5 py-0.5 text-[8px] font-bold text-warning">
                                          {language === 'ar' ? 'مؤثر' : 'Impact'}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-[10px] leading-relaxed text-text-secondary">
                                      {event.description}
                                    </p>
                                    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-mono text-text-secondary">
                                        {new Date(event.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {event.details?.language && (
                                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] text-text-secondary">
                                          {event.details.language}
                                        </span>
                                      )}
                                      {event.details?.framework && (
                                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] text-text-secondary">
                                          {event.details.framework}
                                        </span>
                                      )}
                                      {Array.isArray(event.details?.tags) && event.details.tags.slice(0, 2).map((tag: string) => (
                                        <span key={tag} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] text-text-secondary">
                                          #{tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className={`hidden rounded-full border px-2 py-1 text-[9px] font-semibold sm:inline-flex ${meta.tone}`}>
                                      {meta.label}
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary rtl:rotate-180" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center text-xs text-text-secondary">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-white/5">
                    <History className="h-6 w-6 text-accent-blue opacity-60" />
                  </div>
                  <span>{t('noActivitiesPeriod')}</span>
                </div>
              )}
            </section>

            <aside className="xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-[28px] border border-card-border bg-card-bg/40 p-5 glass">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-accent-blue" />
                  {language === 'ar' ? 'تفاصيل الحدث' : 'Event Details'}
                </h3>
                {selectedEvent ? (
                  <div className="space-y-4">
                    {(() => {
                      const meta = eventTypeMeta[selectedEvent.type] || eventTypeMeta.all;
                      const Icon = meta.icon;
                      return (
                        <div className={`rounded-2xl border p-4 ${meta.tone}`}>
                          <div className="mb-3 flex items-center gap-3">
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-bold">{meta.label}</span>
                          </div>
                          <h4 className="text-base font-bold text-white">{selectedEvent.name}</h4>
                          <p className="mt-2 text-xs leading-relaxed text-text-secondary">{selectedEvent.description}</p>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="rounded-2xl border border-card-border bg-bg-primary/40 p-3">
                        <span className="block text-text-secondary">{language === 'ar' ? 'التاريخ' : 'Date'}</span>
                        <strong className="mt-1 block text-white">
                          {new Date(selectedEvent.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-card-border bg-bg-primary/40 p-3">
                        <span className="block text-text-secondary">{language === 'ar' ? 'الوقت' : 'Time'}</span>
                        <strong className="mt-1 block text-white">
                          {new Date(selectedEvent.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                      </div>
                    </div>

                    {selectedEvent.details && (
                      <div className="space-y-2">
                        {Object.entries(selectedEvent.details)
                          .filter(([key, value]) => key !== 'link' && value !== undefined && value !== null && value !== '')
                          .slice(0, 12)
                          .map(([key, value]) => {
                            const displayValue = Array.isArray(value)
                              ? value.join(', ')
                              : key.toLowerCase().includes('bytes')
                                ? formatBytes(Number(value))
                                : String(value);
                            if (!displayValue) return null;
                            return (
                              <div key={key} className="rounded-2xl border border-card-border bg-bg-primary/35 p-3">
                                <span className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-secondary">
                                  {key.toLowerCase().includes('tag') ? <Tag className="h-3 w-3" /> : key.toLowerCase().includes('storage') ? <HardDrive className="h-3 w-3" /> : null}
                                  {key.replace(/([A-Z])/g, ' $1')}
                                </span>
                                <p className="break-words text-xs leading-relaxed text-white">{displayValue}</p>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {selectedEvent.details?.link && (
                      <button
                        type="button"
                        onClick={() => router.push(selectedEvent.details?.link)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-blue px-4 py-3 text-xs font-semibold text-white transition hover:bg-accent-blue/90"
                      >
                        {language === 'ar' ? 'فتح العنصر' : 'Open item'}
                        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-text-secondary">
                    {language === 'ar' ? 'اختر حدثًا من السجل لعرض التفاصيل.' : 'Select an event from the ledger to inspect details.'}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </motion.main>

      <CommandPalette />
    </div>
  );
}
