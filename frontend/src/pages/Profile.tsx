import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { 
  Award, Target, Settings, User, Key, CheckCircle, 
  Trash2, Plus, Sparkles, Zap, Flame, Calendar 
} from 'lucide-react';

export default function Profile() {
  const queryClient = useQueryClient();
  const { profile, updateProfile, fetchProfile } = useAuthStore();
  
  // Theme and language prefs
  const [theme, setTheme] = useState(profile?.theme_preference || 'dark');
  const [language, setLanguage] = useState(profile?.language_preference || 'en');
  const [avatar, setAvatar] = useState(profile?.avatar || '');

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  // Goal commitments fields
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('personal');
  const [goalDate, setGoalDate] = useState('');

  // Fetch Goals
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await api.get('/streaks/goals/');
      return res.data;
    }
  });

  // Create Goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (newGoal: any) => {
      const res = await api.post('/streaks/goals/', newGoal);
      return res.data;
    },
    onSuccess: () => {
      setGoalTitle('');
      setGoalDate('');
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });

  // Update Goal status (complete goal)
  const completeGoalMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await api.patch(`/streaks/goals/${id}/`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  // Delete Goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/streaks/goals/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    }
  });

  // Update Profile Preferences mutation
  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        theme_preference: theme,
        language_preference: language,
        avatar
      });
      alert('Preferences updated successfully!');
    } catch (e) {
      alert('Failed to update preferences');
    }
  };

  // Change Password handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    try {
      await api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setOldPassword('');
      setNewPassword('');
      setPwSuccess('Password updated successfully!');
    } catch (err: any) {
      setPwError(err.response?.data?.old_password?.[0] || 'Password change failed');
    }
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    createGoalMutation.mutate({
      title: goalTitle,
      category: goalCategory,
      target_date: goalDate || null
    });
  };

  const badgesCatalog = [
    { name: '7 Day Thinker', desc: 'Maintain a reflection streak of 7 days.' },
    { name: '30 Day Reflector', desc: 'Maintain a reflection streak of 30 days.' },
    { name: '100 Day Builder', desc: 'Maintain a reflection streak of 100 days.' },
    { name: 'Self-Reflector', desc: 'Log more than 10 daily journal entries.' },
    { name: 'Decision Master', desc: 'Resolve at least 5 major decisions.' },
    { name: 'Opportunity Hunter', desc: 'Pursue at least 3 discovered opportunities.' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" /> Profile & Focus Center
        </h2>
        <p className="text-slate-400 text-xs mt-1">Manage your commitments, track unlocked badges, and update preferences.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Profile Preferences & Security */}
        <div className="space-y-6">
          {/* Preferences */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-1.5"><User className="w-4.5 h-4.5 text-indigo-400" /> Preferences</h3>
            <form onSubmit={handleSavePrefs} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Avatar image URL</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Theme Preference</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs py-2 px-3 focus:outline-none"
                >
                  <option value="dark">Sleek Dark Mode</option>
                  <option value="light">Crisp Light Mode</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs py-2 px-3 focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="pa">Punjabi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full glow-btn text-white py-2.5 rounded-xl font-bold text-xs"
              >
                Save Preferences
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-1.5"><Key className="w-4.5 h-4.5 text-indigo-400" /> Security</h3>
            {pwSuccess && <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald text-[10px] rounded-lg mb-4">{pwSuccess}</div>}
            {pwError && <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-accent-rose text-[10px] rounded-lg mb-4">{pwError}</div>}
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Old Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 rounded-xl font-bold text-xs transition-colors"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>

        {/* Right 2 Columns: Commitments & Achievements */}
        <div className="md:col-span-2 space-y-6">
          {/* Commitments / Goals */}
          <div className="glass-card p-6 rounded-3xl space-y-6">
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5"><Target className="w-4.5 h-4.5 text-indigo-400" /> Focus Commitments</h3>
            
            {/* Create Goal Form */}
            <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Commitment Title</label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  required
                  placeholder="e.g. Learn React state management"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl text-xs py-2 px-3 focus:outline-none"
                >
                  <option value="personal">Personal</option>
                  <option value="career">Career</option>
                  <option value="health">Health</option>
                  <option value="financial">Financial</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={createGoalMutation.isPending}
                className="glow-btn text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Goal
              </button>
            </form>

            {/* List Goals */}
            <div className="space-y-2">
              {goalsLoading ? (
                <div className="text-center py-4 text-slate-500 text-xs">Loading commitments...</div>
              ) : goals?.map((goal: any) => (
                <div key={goal.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-850 flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5"><Target className="w-4 h-4" /></span>
                    <div>
                      <div className={`text-xs font-semibold text-slate-200 ${goal.status === 'completed' ? 'line-through text-slate-500' : ''}`}>{goal.title}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{goal.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {goal.status === 'active' && (
                      <button
                        onClick={() => completeGoalMutation.mutate({ id: goal.id, status: 'completed' })}
                        className="p-1.5 bg-emerald-600/10 border border-emerald-500/20 text-accent-emerald rounded-lg hover:bg-emerald-600/15 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteGoalMutation.mutate(goal.id)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors border border-slate-850 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Badge Achievements */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-1.5"><Award className="w-4.5 h-4.5 text-indigo-400" /> Milestones & Badges</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {badgesCatalog.map((b) => {
                const isUnlocked = profile?.badges.includes(b.name);
                return (
                  <div 
                    key={b.name} 
                    className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                      isUnlocked 
                        ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-300' 
                        : 'bg-slate-900/40 border-slate-850 opacity-40 text-slate-500'
                    }`}
                  >
                    <span className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isUnlocked ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-900 text-slate-600'
                    }`}>
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">{b.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{b.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
