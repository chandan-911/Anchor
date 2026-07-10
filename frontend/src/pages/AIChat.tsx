import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { 
  MessageSquare, Send, Sparkles, AlertTriangle, CheckCircle, 
  ChevronDown, ChevronUp, Plus, Star, Award, Compass, Eye, Play, ArrowUpRight, Trash2, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Helper component to render AI Responses as structured UI Cards
function AIResponseRenderer({ jsonContent }: { jsonContent: string }) {
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (e) {
    // Fallback if not valid JSON
    return <p className="text-slate-300 text-xs leading-relaxed">{jsonContent}</p>;
  }

  const { text, summary, blocks } = data;

  return (
    <div className="space-y-4">
      {/* Intro Text */}
      {text && <p className="text-slate-300 text-sm leading-relaxed">{text}</p>}

      {/* Summary Focus */}
      {summary && (
        <div className="p-3 bg-indigo-500/10 border-l-2 border-indigo-500 rounded-r-xl text-[11px] text-indigo-300 font-semibold italic">
          Focus: {summary}
        </div>
      )}

      {/* Blocks */}
      {blocks && blocks.map((block: any, idx: number) => {
        switch (block.type) {
          case 'insight_card':
            return (
              <div key={idx} className="glass-card p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Star className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                  <span>{block.title || 'Clarity Insight'}</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{block.content}</p>
              </div>
            );

          case 'warning_card':
            return (
              <div key={idx} className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>{block.title || 'Attention Required'}</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{block.content}</p>
              </div>
            );

          case 'action_card':
            return (
              <div key={idx} className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/15 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-accent-emerald">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{block.title || 'Suggested Actions'}</span>
                </div>
                {block.content && <p className="text-slate-300 text-xs leading-relaxed">{block.content}</p>}
                <div className="space-y-1.5">
                  {block.actions && block.actions.map((act: string, actIdx: number) => (
                    <label key={actIdx} className="flex items-center gap-2 text-xs text-slate-300 select-none cursor-pointer">
                      <input type="checkbox" className="rounded accent-emerald-500 bg-slate-900 border-slate-800" />
                      <span>{act}</span>
                    </label>
                  ))}
                </div>
              </div>
            );

          case 'decision_card':
            return <DecisionCard key={idx} block={block} />;

          case 'opportunity_card':
            return (
              <div key={idx} className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/15 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-violet-300">
                  <Compass className="w-4 h-4 text-violet-400" />
                  <span>{block.title || 'Detected Opportunity'}</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{block.content}</p>
                {block.actions && (
                  <div className="pt-1 flex flex-col gap-1.5">
                    {block.actions.map((a: string, i: number) => (
                      <span key={i} className="text-[10px] text-violet-400">• {a}</span>
                    ))}
                  </div>
                )}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// Collapsible Decision Card inside AI response
function DecisionCard({ block }: { block: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-card rounded-xl border border-indigo-500/20 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-900/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Award className="w-4.5 h-4.5 text-indigo-400" />
          <span>Decision framework: {block.title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 space-y-4 text-xs">
          {block.content && <p className="text-slate-300">{block.content}</p>}
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="font-bold text-emerald-400">✔ Advantages</div>
              {block.advantages?.map((adv: string, i: number) => (
                <div key={i} className="text-slate-300 text-[11px]">• {adv}</div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="font-bold text-rose-400">⚠ Risks</div>
              {block.risks?.map((risk: string, i: number) => (
                <div key={i} className="text-slate-300 text-[11px]">• {risk}</div>
              ))}
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="font-bold text-violet-400">📈 Opportunities</div>
              {block.opportunities?.map((opp: string, i: number) => (
                <div key={i} className="text-slate-300 text-[11px]">• {opp}</div>
              ))}
            </div>
          </div>

          {block.actions && (
            <div className="pt-2 border-t border-slate-800/50 space-y-2">
              <div className="font-bold text-slate-200">🎯 Action Roadmap</div>
              <div className="space-y-1">
                {block.actions.map((act: string, i: number) => (
                  <div key={i} className="text-slate-300 text-[11px]">• {act}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIChat() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);

  // Fetch conversations
  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/chat/conversations/');
      return res.data;
    }
  });

  // Fetch messages
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await api.get(`/chat/conversations/${activeConvId}/messages/`);
      return res.data;
    },
    enabled: !!activeConvId
  });

  // Create conversation mutation
  const createConvMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/chat/conversations/');
      return res.data;
    },
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConvId(newConv.id);
    }
  });

  // Delete conversation mutation
  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/chat/conversations/${id}/`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConvId(null);
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/chat/conversations/${activeConvId}/ask/`, { message: content });
      return res.data;
    },
    onSuccess: () => {
      setInputMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile();
    }
  });

  // Auto Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessageMutation.isPending]);

  // Set first conversation active automatically
  useEffect(() => {
    if (conversations?.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarCollapsed(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConvId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(inputMessage);
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] md:h-[80vh] flex flex-col md:flex-row gap-4 md:gap-6 select-none">
      
      {/* Sidebar: Conversations List (Visible only when not collapsed) */}
      {!isSidebarCollapsed && (
        <div className="w-full md:w-64 glass-card p-4 rounded-3xl flex flex-col justify-between shrink-0 h-auto md:h-full">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => createConvMutation.mutate()}
                className="flex-1 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-600/10 hover:bg-indigo-600/15 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Session
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Hide Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1.5 overflow-y-auto max-h-[30vh] md:max-h-[50vh]">
              {convsLoading ? (
                <div className="text-center py-4 text-slate-500 text-xs">Loading conversations...</div>
              ) : conversations?.map((conv: any) => (
                <div 
                  key={conv.id}
                  className={`group flex items-center justify-between p-1 rounded-xl transition-all ${
                    activeConvId === conv.id 
                      ? 'bg-slate-900 text-slate-100 font-semibold border-l-2 border-indigo-500' 
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <button
                    onClick={() => setActiveConvId(conv.id)}
                    className="flex items-center gap-2.5 flex-1 text-left p-1 text-xs truncate"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Are you sure you want to delete this session?")) {
                        deleteConvMutation.mutate(conv.id);
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-500 transition-opacity rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Box */}
      <div className="flex-1 glass-card rounded-3xl flex flex-col justify-between overflow-hidden h-full">
        {/* Chat Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-slate-850 shrink-0 w-full">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button (Visible when sidebar is collapsed) */}
            {isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Show Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            
            {/* Active Conv Title */}
            <span className="text-xs font-semibold text-slate-400 truncate max-w-[200px]">
              {conversations?.find((c: any) => c.id === activeConvId)?.title || "AI Reflection Coach"}
            </span>
          </div>
          
          <button
            onClick={() => createConvMutation.mutate()}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition-all cursor-pointer"
            title="New Chat Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
          {activeConvId ? (
            <>
              {messagesLoading ? (
                <div className="text-center py-12 text-slate-500 text-xs">Loading messages...</div>
              ) : messages?.map((msg: any) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] p-4 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800/80 rounded-tl-none space-y-3'
                  }`}>
                    {msg.sender === 'user' ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <AIResponseRenderer jsonContent={msg.content} />
                    )}
                  </div>
                </div>
              ))}

              {/* Typing loader */}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">Consulting memory...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
              <Sparkles className="w-8 h-8 text-slate-700 animate-spin" />
              <div>
                <div className="text-sm font-semibold text-slate-400">Consult your AI Coach</div>
                <div className="text-[10px] text-slate-600">Choose a session or create a new one to begin.</div>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        {activeConvId && (
          <form onSubmit={handleSend} className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex gap-3 items-center">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything (e.g. 'Why am I stuck?', 'Which job should I choose?')..."
              className="flex-1 glass-input rounded-xl py-3 px-4 text-xs focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || sendMessageMutation.isPending}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
