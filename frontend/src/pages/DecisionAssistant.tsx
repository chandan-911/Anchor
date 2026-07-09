import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { 
  HelpCircle, CheckCircle, ArrowRight, ShieldAlert, 
  Compass, AlertTriangle, Send, Trash2, CheckCircle2, RefreshCw 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function DecisionAssistant() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [xpReward, setXpReward] = useState<any>(null);

  // Fetch previous decisions
  const { data: decisions, isLoading } = useQuery({
    queryKey: ['decisions'],
    queryFn: async () => {
      const res = await api.get('/decisions/');
      return res.data;
    }
  });

  // Create Decision mutation
  const createDecisionMutation = useMutation({
    mutationFn: async (newDecision: any) => {
      const res = await api.post('/decisions/', newDecision);
      return res.data;
    },
    onSuccess: (data) => {
      setTitle('');
      setDescription('');
      setSelectedDecision(data.decision);
      setXpReward(data.gamification);
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();

      setTimeout(() => {
        setXpReward(null);
      }, 5000);
    }
  });

  // Update Decision status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await api.patch(`/decisions/${id}/`, { status });
      return res.data;
    },
    onSuccess: (data) => {
      setSelectedDecision(data);
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    createDecisionMutation.mutate({ title, description });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-indigo-400" /> Decision Intelligence Assistant
        </h2>
        <p className="text-slate-400 text-xs mt-1">Break analysis paralysis. Map out pros, cons, risks, and next steps.</p>
      </div>

      {/* Gamification popup */}
      {xpReward && (
        <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 text-slate-100 flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-sm font-bold text-white">Decision Analysis Rendered!</div>
              <div className="text-xs text-slate-400">Streak Level: {xpReward.current_streak} | XP Reward: +{xpReward.xp_granted} XP</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Form & History */}
        <div className="space-y-6">
          {/* Form */}
          <div className="glass-card p-6 rounded-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-sm text-white mb-2">New Dilemma</h3>
              
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Decision Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Should I leave my job to start a startup?"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Details / dilemma Context</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={5}
                  placeholder="Details of your dilemma (e.g. current salary, savings, goals, market validation)..."
                  className="w-full glass-input rounded-xl p-4 text-xs resize-none focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={createDecisionMutation.isPending}
                className="w-full glow-btn text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                {createDecisionMutation.isPending ? 'Analyzing Options...' : 'Run Decision strategist'}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-white">Previous Decisions</h3>
            <div className="space-y-2 overflow-y-auto max-h-[300px]">
              {isLoading ? (
                <div className="text-center py-4 text-slate-500 text-xs">Loading...</div>
              ) : decisions?.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDecision(d)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    selectedDecision?.id === d.id
                      ? 'bg-slate-900 border-indigo-500/30'
                      : 'bg-slate-950/40 border-slate-900/60 hover:bg-slate-900/30'
                  }`}
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 truncate">{d.title}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    d.status === 'completed' 
                      ? 'bg-emerald-500/10 text-accent-emerald' 
                      : d.status === 'abandoned'
                      ? 'bg-rose-500/10 text-accent-rose'
                      : 'bg-amber-500/10 text-accent-amber'
                  }`}>{d.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Selected Decision Details */}
        <div className="md:col-span-2">
          {selectedDecision ? (
            <div className="glass-card p-6 rounded-3xl space-y-6">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedDecision.title}</h3>
                  <p className="text-slate-400 text-xs mt-1">Dilemma analysis from {new Date(selectedDecision.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {selectedDecision.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: selectedDecision.id, status: 'completed' })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-accent-emerald text-[10px] font-bold uppercase transition-colors"
                      >
                        Mark Resolved
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: selectedDecision.id, status: 'abandoned' })}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/10 border border-rose-500/20 text-accent-rose text-[10px] font-bold uppercase transition-colors"
                      >
                        Abandon
                      </button>
                    </>
                  )}
                  {selectedDecision.status !== 'pending' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-900 border border-slate-850 py-1.5 px-3 rounded-lg">
                      Status: {selectedDecision.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Recommendation Choice */}
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 grid md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Recommended Path</div>
                  <div className="text-sm font-extrabold text-white mt-1">{selectedDecision.recommended_choice || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Confidence Rating</div>
                  <div className="text-xl font-black text-indigo-200 mt-1">{selectedDecision.confidence_score}%</div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="font-bold text-xs text-slate-200 mb-2">Dilemma Summary</h4>
                <p className="text-slate-300 text-xs leading-relaxed">{selectedDecision.summary}</p>
              </div>

              {/* Advantages / Disadvantages */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-emerald-400 mb-3 flex items-center gap-1">✔ Advantages</h4>
                  <ul className="space-y-1.5">
                    {selectedDecision.advantages?.map((adv: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {adv}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-rose-400 mb-3 flex items-center gap-1">⚠ Disadvantages & Downsides</h4>
                  <ul className="space-y-1.5">
                    {selectedDecision.disadvantages?.map((dis: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {dis}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Risks / Opportunities */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-amber-500 mb-3 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Risk Map</h4>
                  <ul className="space-y-1.5">
                    {selectedDecision.risks?.map((risk: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {risk}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-violet-400 mb-3 flex items-center gap-1"><Compass className="w-4 h-4" /> Growth Opportunities</h4>
                  <ul className="space-y-1.5">
                    {selectedDecision.opportunities?.map((opp: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {opp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Long term impact */}
              {selectedDecision.long_term_impact && (
                <div>
                  <h4 className="font-bold text-xs text-slate-200 mb-2">Long-Term Impact (5-10 Years)</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">{selectedDecision.long_term_impact}</p>
                </div>
              )}

              {/* Next Action checklist */}
              <div>
                <h4 className="font-bold text-xs text-slate-200 mb-3">Immediate Next Actions to Stop Analysis Paralysis</h4>
                <div className="space-y-2">
                  {selectedDecision.immediate_next_actions?.map((act: string, i: number) => (
                    <label key={i} className="flex items-center gap-2.5 p-3 bg-slate-900/60 border border-slate-850 rounded-xl cursor-pointer hover:bg-slate-900 transition-colors select-none text-xs text-slate-300">
                      <input type="checkbox" className="rounded accent-indigo-500 bg-slate-950 border-slate-800" />
                      <span>{act}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3 bg-slate-900/10 border border-slate-850 border-dashed rounded-3xl p-12">
              <HelpCircle className="w-10 h-10 text-slate-700 animate-pulse" />
              <div>
                <div className="text-sm font-semibold text-slate-400">Run Decision strategist</div>
                <div className="text-[10px] text-slate-600">Select a decision from history or analyze a new dilemma.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
