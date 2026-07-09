import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { 
  FileText, RefreshCw, Download, Award, Compass, 
  Target, Sparkles, Star, ShieldAlert, CheckCircle2 
} from 'lucide-react';

export default function Analytics() {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState('weekly');
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Fetch reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['growthReports'],
    queryFn: async () => {
      const res = await api.get('/analytics/reports/');
      return res.data;
    }
  });

  // Generate Report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (typeStr: string) => {
      const res = await api.post('/analytics/reports/generate/', { report_type: typeStr });
      return res.data;
    },
    onSuccess: (data) => {
      setSelectedReport(data);
      queryClient.invalidateQueries({ queryKey: ['growthReports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });

  const handleExport = (format: string) => {
    if (!selectedReport) return;
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/analytics/reports/${selectedReport.id}/export/?format=${format}${token ? `&token=${token}` : ''}`;
    window.open(url, '_blank');
  };

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
            <FileText className="w-6 h-6 text-indigo-400" /> Reflection & Growth Reports
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Generate and export weekly or monthly reflection reports summarizing wins, lessons, and focus areas.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl text-xs py-2 px-4 focus:outline-none"
          >
            <option value="weekly">Weekly Reflection</option>
            <option value="monthly">Monthly Growth</option>
          </select>
          <button
            onClick={() => generateReportMutation.mutate(reportType)}
            disabled={generateReportMutation.isPending}
            className="glow-btn px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generateReportMutation.isPending ? 'animate-spin' : ''}`} />
            {generateReportMutation.isPending ? 'Synthesizing...' : 'Generate report'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: Reports list */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-white">Previous Reports</h3>
          <div className="space-y-2 overflow-y-auto max-h-[450px]">
            {isLoading ? (
              <div className="text-center py-6 text-slate-500 text-xs">Loading reports...</div>
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
                  <div className="text-xs font-bold text-slate-200 capitalize">{rep.report_type} growth report</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{rep.start_date} to {rep.end_date}</div>
                </div>
                <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400"><FileText className="w-3.5 h-3.5" /></span>
              </button>
            ))}
            {(!reports || reports.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-xs bg-slate-900/20 border border-slate-850 rounded-2xl">
                No reports compiled yet. Click Generate!
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Selected Report details */}
        <div className="md:col-span-2">
          {selectedReport ? (
            <div className="glass-card p-6 rounded-3xl space-y-6">
              {/* Header and exports */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/85">
                <div>
                  <h3 className="text-lg font-bold text-white capitalize">{selectedReport.report_type} Reflection Report</h3>
                  <p className="text-slate-400 text-xs mt-1">Period: {selectedReport.start_date} to {selectedReport.end_date}</p>
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

              {/* Wins & Challenges */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-emerald-400 mb-3 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Wins & Milestones</h4>
                  <ul className="space-y-1.5">
                    {selectedReport.content?.wins?.map((win: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {win}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-rose-400 mb-3 flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Blockers & Challenges</h4>
                  <ul className="space-y-1.5">
                    {selectedReport.content?.challenges?.map((c: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Lessons Learned & Focus Areas */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-indigo-400 mb-3 flex items-center gap-1"><Star className="w-4 h-4" /> Lessons Learned</h4>
                  <ul className="space-y-1.5">
                    {selectedReport.content?.lessons_learned?.map((l: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {l}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-850">
                  <h4 className="font-bold text-xs text-violet-400 mb-3 flex items-center gap-1"><Compass className="w-4 h-4" /> Focus Areas</h4>
                  <ul className="space-y-1.5">
                    {selectedReport.content?.focus_areas?.map((f: string, i: number) => (
                      <li key={i} className="text-slate-300 text-xs leading-relaxed">• {f}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested next actions */}
              <div className="p-4 rounded-2xl bg-indigo-950/10 border border-indigo-500/10">
                <h4 className="font-bold text-xs text-indigo-300 mb-3 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-indigo-400" /> AI Growth Suggestions</h4>
                <div className="space-y-2">
                  {selectedReport.content?.suggested_actions?.map((act: string, i: number) => (
                    <div key={i} className="flex gap-2.5 items-start p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                      <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5"><Target className="w-3.5 h-3.5" /></span>
                      <p className="text-slate-300 text-xs leading-relaxed">{act}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/10 border border-slate-850 border-dashed rounded-3xl p-12">
              <FileText className="w-10 h-10 text-slate-700 animate-pulse" />
              <div>
                <div className="text-sm font-semibold text-slate-400">Reflection Reports</div>
                <div className="text-[10px] text-slate-600">Select a report or click 'Generate' to compile growth data.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
