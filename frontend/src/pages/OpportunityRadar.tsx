import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { 
  Compass, RefreshCw, Zap, TrendingUp, AlertTriangle, 
  ExternalLink, CheckCircle, CheckCircle2, EyeOff 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function OpportunityRadar() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch opportunities
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const res = await api.get('/opportunities/');
      return res.data;
    }
  });

  // Scan opportunities mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/opportunities/scan/');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  // Update status mutation (applied/completed/ignored)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await api.patch(`/opportunities/${id}/`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  const categories = [
    { id: 'all', name: 'All Discoveries' },
    { id: 'job', name: 'Jobs' },
    { id: 'internship', name: 'Internships' },
    { id: 'startup', name: 'Startups' },
    { id: 'learning', name: 'Learning' },
    { id: 'networking', name: 'Networking' },
  ];

  const filteredOpportunities = selectedCategory === 'all' 
    ? opportunities 
    : opportunities?.filter((o: any) => o.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" /> Opportunity Radar Discovery
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Analyze your goals, journals, and reflections to auto-discover career, learning, and networking growth paths.
          </p>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="glow-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Scanning Context...' : 'Scan reflections for opportunities'}
        </button>
      </div>

      {/* Categories select row */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-900/60">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Opportunities list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOpportunities?.map((opp: any) => (
            <div key={opp.id} className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4">
              {/* Category, scores, and status */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400">{opp.category}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    opp.status === 'open' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-slate-900 text-slate-500'
                  }`}>{opp.status}</span>
                </div>
                
                <h3 className="font-bold text-sm text-slate-200">{opp.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{opp.description}</p>
              </div>

              {/* Priority / Action points */}
              <div className="space-y-4 pt-3 border-t border-slate-850">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-900/60 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-semibold uppercase">Impact</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{opp.impact_score}%</div>
                  </div>
                  <div className="p-2 bg-slate-900/60 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-semibold uppercase">Urgency</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{opp.urgency_score}%</div>
                  </div>
                  <div className="p-2 bg-indigo-950/20 border border-indigo-500/10 rounded-xl">
                    <div className="text-[9px] text-indigo-400 font-semibold uppercase">Priority</div>
                    <div className="text-xs font-extrabold text-indigo-300 mt-0.5">{opp.priority_score}%</div>
                  </div>
                </div>

                {/* Actions */}
                {opp.status === 'open' && (
                  <div className="flex flex-col gap-2 w-full">
                    {opp.external_link && (
                      <a
                        href={opp.external_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-[10px] font-extrabold uppercase transition-all shadow-md shadow-indigo-650/20 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Explore Opportunity
                      </a>
                    )}
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: opp.id, status: 'applied' })}
                        className="flex-1 py-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 rounded-xl text-[10px] font-bold uppercase hover:bg-indigo-600/15 transition-colors"
                      >
                        Mark Pursued
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: opp.id, status: 'completed' })}
                        className="p-2 bg-emerald-600/10 border border-emerald-500/20 text-accent-emerald rounded-xl hover:bg-emerald-600/15 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: opp.id, status: 'ignored' })}
                        className="p-2 bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-xl"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {opp.status !== 'open' && (
                  <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-900/50 py-2 rounded-xl">
                    Closed: {opp.status}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!filteredOpportunities || filteredOpportunities.length === 0) && (
            <div className="md:col-span-2 lg:col-span-3 text-center py-20 text-slate-500 text-xs bg-slate-900/10 border border-slate-850 border-dashed rounded-3xl">
              No matching discoveries. Tap 'Scan' to run the radar scanner!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
