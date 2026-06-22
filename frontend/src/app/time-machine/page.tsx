'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import {
  History,
  Calendar,
  Sparkles,
  ChevronRight,
  FolderCode,
  Bug,
  Code2,
  HelpCircle,
  Clock
} from 'lucide-react';

export default function TimeMachinePage() {
  const { user, loading, apiFetch } = useAuth();
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);

  // Time Machine AI query helper
  const [timeQuery, setTimeQuery] = useState('');

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = [currentYear - 2, currentYear - 1, currentYear];

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
    } catch (err) {
      console.error('[TimeMachine]: Fetch failed:', err);
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
    const formattedQuery = `In ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}, ${timeQuery}`;
    router.push(`/chat?ask=${encodeURIComponent(formattedQuery)}`);
  };

  const handleEventClick = (event: any) => {
    if (event.type === 'project') {
      router.push(`/projects/${event.id}`);
    } else if (event.type === 'snippet') {
      router.push(`/snippets?id=${event.id}`);
    } else if (event.type === 'error') {
      router.push(`/errors?id=${event.id}`);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary text-white select-none">
      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto max-w-5xl mx-auto flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Time Machine</h2>
            <p className="text-xs text-text-secondary mt-1">Travel back to inspect your past engineering files, bugs solved and stack habits</p>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-accent-blue" />
          </div>
        </div>

        {/* Date Selector bar */}
        <div className="mb-8 bg-card-bg/40 border border-card-border p-5 rounded-[24px] glass flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-accent-blue" />
            <span className="text-xs font-semibold">Select Target Period:</span>
          </div>

          <div className="flex items-center space-x-3 flex-grow md:flex-grow-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-bg-primary border border-card-border rounded-xl py-2 px-3.5 text-xs text-white outline-none focus:border-accent-blue/50"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-bg-primary border border-card-border rounded-xl py-2 px-3.5 text-xs text-white outline-none focus:border-accent-blue/50"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ask Time Machine input */}
        <div className="mb-8 bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass border-l-accent-blue border-l-4">
          <h3 className="font-bold text-xs text-white mb-2 flex items-center">
            <Sparkles className="w-4 h-4 text-accent-blue mr-1.5" />
            Ask your past engineering memory
          </h3>
          <form onSubmit={handleAskTimeMachine} className="flex space-x-3 items-center">
            <input
              type="text"
              placeholder="e.g. How did I solve Authentication/Supabase uploads in this period?"
              value={timeQuery}
              onChange={(e) => setTimeQuery(e.target.value)}
              className="flex-1 bg-bg-primary/50 border border-card-border rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-accent-blue/50"
            />
            <button
              type="submit"
              disabled={!timeQuery.trim()}
              className="px-5 py-3 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white rounded-2xl text-xs font-semibold cursor-pointer"
            >
              Ask AI
            </button>
          </form>
        </div>

        {/* Timeline Events list */}
        <div className="bg-card-bg/40 border border-card-border p-6 rounded-[28px] glass flex-grow">
          <h3 className="font-bold text-sm mb-6">Chronological Activity Log</h3>

          {loadingTimeline ? (
            <div className="py-20 flex justify-center">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
            </div>
          ) : timeline.length > 0 ? (
            <div className="relative border-l border-card-border pl-6 space-y-6 ml-3 select-text">
              {timeline.map((event, idx) => {
                const dateObj = new Date(event.date);
                const isProject = event.type === 'project';
                const isError = event.type === 'error';

                return (
                  <div key={idx} className="relative group">
                    {/* Circle marker on timeline */}
                    <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-bg-primary flex items-center justify-center flex-shrink-0 ${
                      isProject ? 'bg-accent-blue' : isError ? 'bg-danger' : 'bg-warning'
                    }`}></div>

                    {/* Timeline card */}
                    <div
                      onClick={() => handleEventClick(event)}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-card-border/80 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center flex-shrink-0">
                          {isProject ? (
                            <FolderCode className="w-4.5 h-4.5 text-accent-blue" />
                          ) : isError ? (
                            <Bug className="w-4.5 h-4.5 text-danger" />
                          ) : (
                            <Code2 className="w-4.5 h-4.5 text-warning" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white group-hover:text-accent-blue transition-colors">
                            {event.name}
                          </span>
                          <span className="text-[10px] text-text-secondary mt-1 max-w-[480px]">
                            {event.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-text-secondary">
                        <span className="text-[10px] font-mono">
                          {dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-text-secondary flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                <History className="w-5 h-5 text-accent-blue opacity-50" />
              </div>
              <span>No activities logged in this monthly window. Select another date.</span>
            </div>
          )}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
