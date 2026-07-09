import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { 
  BarChart2, RefreshCw, Download, FileText, 
  Settings, Award, AlertTriangle, ShieldAlert, Sparkles, CheckCircle2 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function SWOTAnalysis() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [period, setPeriod] = useState('monthly');
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Fetch SWOT logs
  const { data: reports, isLoading } = useQuery({
    queryKey: ['swotReports'],
    queryFn: async () => {
      const res = await api.get('/swot/');
      return res.data;
    }
  });

  // Generate SWOT mutation
  const generateSWOTMutation = useMutation({
    mutationFn: async (periodStr: string) => {
      const res = await api.post('/swot/generate/', { period: periodStr });
      return res.data;
    },
    onSuccess: (data) => {
      setSelectedReport(data.report);
      queryClient.invalidateQueries({ queryKey: ['swotReports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  const handleExport = (format: string) => {
    if (!selectedReport) return;
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/swot/${selectedReport.id}/export/?format=${format}${token ? `&token=${token}` : ''}`;
    window.open(url, '_blank');
  };

  // Set first report active automatically
  React.useEffect(() => {
    if (reports?.length > 0 && !selectedReport) {
      setSelectedReport(reports[0]);
    }
  }, [reports]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-400" /> AI SWOT & Growth Dashboard
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Auto-generate monthly, quarterly, or yearly SWOT reports from your journal logs and activities.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl text-xs py-2 px-4 focus:outline-none"
          >
            <option value="weekly">Weekly SWOT</option>
            <option value="monthly">Monthly SWOT</option>
            <option value="quarterly">Quarterly SWOT</option>
            <option value="yearly">Yearly SWOT</option>
          </select>
          <button
            onClick={() => generateSWOTMutation.mutate(period)}
            disabled={generateSWOTMutation.isPending}
            className="glow-btn px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateSWOTMutation.isPending ? 'animate-spin' : ''}`} />
            {generateSWOTMutation.isPending ? 'Analyzing...' : 'Generate report'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Reports History */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-white">Report History</h3>
          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {isLoading ? (
              <div className="text-center py-6 text-slate-500 text-xs">Loading history...</div>
            ) : reports?.map((rep: any) => (
              <button
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  selectedReport?.id === rep.id
                    ? 'bg-slate-900 border-indigo-500/30'
                    : 'bg-slate-950/40 border-slate-900/60 hover:bg-slate-900/30'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 capitalize">{rep.period} SWOT Analysis</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{new Date(rep.created_at).toLocaleDateString()}</div>
                </div>
                <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400"><FileText className="w-3.5 h-3.5" /></span>
              </button>
            ))}
            {(!reports || reports.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-xs bg-slate-900/20 border border-slate-850 rounded-2xl">
                No reports generated yet. Click generate!
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Quadrants and Export */}
        <div className="md:col-span-2 space-y-6">
          {selectedReport ? (
            <div className="space-y-6">
              {/* Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-card rounded-2xl">
                <div className="text-xs text-slate-300">
                  Active Report: <span className="font-bold capitalize text-white">{selectedReport.period} Analysis</span> (Generated {new Date(selectedReport.created_at).toLocaleDateString()})
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExport('pdf')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-[10px] font-bold text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button 
                    onClick={() => handleExport('csv')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-[10px] font-bold text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button 
                    onClick={() => handleExport('json')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-[10px] font-bold text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> JSON
                  </button>
                </div>
              </div>

              {/* SWOT Quadrants grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="glass-card p-5 rounded-2xl border-emerald-500/10 shadow-emerald-500/2 bg-slate-950/20">
                  <h4 className="font-bold text-xs text-accent-emerald flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                    💪 Strengths
                  </h4>
                  <ul className="space-y-2">
                    {selectedReport.strengths?.map((s: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {s}</li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="glass-card p-5 rounded-2xl border-rose-500/10 shadow-rose-500/2 bg-slate-950/20">
                  <h4 className="font-bold text-xs text-accent-rose flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                    🧠 Weaknesses
                  </h4>
                  <ul className="space-y-2">
                    {selectedReport.weaknesses?.map((w: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {w}</li>
                    ))}
                  </ul>
                </div>

                {/* Opportunities */}
                <div className="glass-card p-5 rounded-2xl border-violet-500/10 shadow-violet-500/2 bg-slate-950/20">
                  <h4 className="font-bold text-xs text-violet-400 flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                    📈 Opportunities
                  </h4>
                  <ul className="space-y-2">
                    {selectedReport.opportunities?.map((o: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {o}</li>
                    ))}
                  </ul>
                </div>

                {/* Threats */}
                <div className="glass-card p-5 rounded-2xl border-amber-500/10 shadow-amber-500/2 bg-slate-950/20">
                  <h4 className="font-bold text-xs text-accent-amber flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                    ⚡ Threats & Risks
                  </h4>
                  <ul className="space-y-2">
                    {selectedReport.threats?.map((t: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {t}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Growth Recommendations */}
              <div className="glass-card p-6 rounded-3xl border-indigo-500/15">
                <h4 className="font-bold text-sm text-white mb-4 flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-400" /> Actionable Growth Roadmap
                </h4>
                <div className="space-y-2.5">
                  {selectedReport.growth_recommendations?.map((rec: string, i: number) => (
                    <div key={i} className="flex gap-2.5 items-start p-3 bg-slate-900/60 border border-slate-850 rounded-xl">
                      <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5"><Award className="w-3.5 h-3.5" /></span>
                      <p className="text-slate-300 text-xs leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/10 border border-slate-850 border-dashed rounded-3xl p-12">
              <BarChart2 className="w-10 h-10 text-slate-700 animate-pulse" />
              <div>
                <div className="text-sm font-semibold text-slate-400">Generate SWOT Report</div>
                <div className="text-[10px] text-slate-600">Analyze your recent growth logs and dilemmas.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
