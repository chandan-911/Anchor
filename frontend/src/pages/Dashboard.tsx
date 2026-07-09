import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Flame, Award, BookOpen, Compass, CheckCircle2, TrendingUp, 
  ArrowRight, ShieldAlert, Zap, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { profile } = useAuthStore();

  // Fetch Dashboard Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/analytics/dashboard/');
      return res.data;
    }
  });

  // Fetch Goals
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['dashboardGoals'],
    queryFn: async () => {
      const res = await api.get('/streaks/goals/');
      return res.data;
    }
  });

  const isLoading = statsLoading || goalsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  // Fallback data if none exists yet
  const chartData = stats?.mood_trends?.length > 0 ? stats.mood_trends : [
    { date: 'Day 1', mood: 5, confidence: 5, stress: 5 },
    { date: 'Day 2', mood: 6, confidence: 5, stress: 4 },
    { date: 'Day 3', mood: 7, confidence: 6, stress: 3 },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-violet-900/30 to-slate-900/20 border border-indigo-500/10">
        <div>
          <h2 className="text-2xl font-bold text-white font-sans">
            Welcome back, {profile?.user.username}!
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Analyze your goals, evaluate SWOT trends, and stop analysis paralysis.
          </p>
        </div>
        <div className="flex gap-4">
          <Link to="/journal" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-semibold text-white rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Daily Reflection
          </Link>
          <Link to="/chat" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-colors text-xs font-semibold text-slate-200 rounded-xl flex items-center gap-1.5">
            Consult Mentor <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Grid: Core Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Clarity Level</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400"><Award className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white">Level {profile?.level}</div>
          <p className="text-[10px] text-slate-400 mt-1">{profile?.xp_points} / {profile ? profile.level * 100 : 100} XP for next level</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reflective Streak</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><Flame className="w-4 h-4 animate-pulse" /></span>
          </div>
          <div className="text-2xl font-bold text-white">{profile?.current_streak} days</div>
          <p className="text-[10px] text-slate-400 mt-1">Longest streak: {profile?.longest_streak} days</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Growth Indicator</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-accent-emerald"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white">{stats?.growth_score}%</div>
          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-accent-emerald h-full" style={{ width: `${stats?.growth_score || 0}%` }} />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Dilemmas</span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-accent-rose"><ShieldAlert className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl font-bold text-white">{stats?.decision_stats?.pending || 0}</div>
          <p className="text-[10px] text-slate-400 mt-1">{stats?.decision_stats?.completed || 0} decisions resolved</p>
        </div>
      </div>

      {/* Grid: Charts & Goals list */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Recharts Area Chart for Mood/Stress trends */}
        <div className="md:col-span-2 glass-card p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Mental Clarity Trends</h3>
            <p className="text-slate-400 text-xs mt-1">Mood, confidence, and stress trends over the last 14 reflections.</p>
          </div>
          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="moodColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="stressColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={[0, 10]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#moodColor)" name="Mood" />
                <Area type="monotone" dataKey="stress" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#stressColor)" name="Stress" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Goals list */}
        <div className="glass-card p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Focus Commitments</h3>
            <p className="text-slate-400 text-xs mt-1">Track your pending targets and goals.</p>
            <div className="space-y-3 mt-6">
              {goals?.slice(0, 3).map((goal: any) => (
                <div key={goal.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3">
                  <div className="flex gap-2">
                    <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5"><Target className="w-3.5 h-3.5" /></span>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{goal.title}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{goal.category}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full ${
                    goal.status === 'completed' ? 'bg-emerald-500/15 text-accent-emerald' : 'bg-amber-500/15 text-accent-amber'
                  }`}>{goal.status}</span>
                </div>
              ))}
              {(!goals || goals.length === 0) && (
                <div className="text-center py-6 text-slate-500 text-xs">No commitments set. Add a goal in Profile page!</div>
              )}
            </div>
          </div>
          <Link to="/profile" className="w-full text-center py-2.5 rounded-xl border border-slate-800/80 hover:bg-slate-900/40 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mt-4">
            Manage Commitments
          </Link>
        </div>
      </div>

      {/* Badges Display Row */}
      {profile?.badges && profile.badges.length > 0 && (
        <div className="glass-card p-6 rounded-3xl">
          <h3 className="font-bold text-base text-white mb-4">Achievements Unlocked</h3>
          <div className="flex flex-wrap gap-3">
            {profile.badges.map((badge: string) => (
              <span key={badge} className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 font-semibold text-xs flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
