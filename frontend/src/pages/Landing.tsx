import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Shield, Sparkles, CheckCircle2, Mic, FileText, ChevronRight, HelpCircle } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background-dark text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/20 backdrop-blur-md border-b border-slate-900/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚓</span>
            <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-200 to-violet-400 bg-clip-text text-transparent">
              Anchor
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-200 transition-colors">Features</a>
            <a href="#benefits" className="hover:text-slate-200 transition-colors">Benefits</a>
            <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-slate-200 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors">
              Login
            </Link>
            <Link to="/register" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 shadow-lg shadow-indigo-600/20">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[80px] -z-10" />
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-violet-500/10 rounded-full blur-[60px] -z-10" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-300 mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" /> Introducing Anchor AI SaaS
        </div>

        <h1 className="font-extrabold text-5xl md:text-6xl tracking-tight text-white mb-6 font-sans max-w-4xl leading-tight">
          Stop Overthinking. <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            Start Moving Forward.
          </span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Transform scattered thoughts and analysis paralysis into clear decisions using AI-powered reflection, semantic memory, opportunity analysis, and growth coaching.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-16">
          <Link to="/register" className="glow-btn px-6 py-3.5 rounded-xl font-bold text-white flex items-center gap-2 group">
            Start Free Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#how-it-works" className="px-6 py-3.5 rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/40 text-slate-300 hover:text-slate-200 transition-all font-semibold">
            Watch Demo
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
            Designed for Deep Clarity & Focused Growth
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Anchor is your Personal Mentor, Decision Strategist, and Accountability Partner built into a single workspace.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass-card p-6 rounded-2xl">
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 flex items-center justify-center rounded-xl mb-6">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Long-Term AI Memory</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Anchor references your SWOT logs, goals, journal history, and previous dilemmas to build context over time.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-xl mb-6">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Decision Intelligence</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Input dilemmas to obtain structured breakdowns of pros, cons, long-term impact analysis, next actions, and recommendations.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="h-10 w-10 bg-violet-500/10 text-violet-400 flex items-center justify-center rounded-xl mb-6">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Voice Assistant AI</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Express reflections or request guidance vocally. Anchor supports hands-free continuous speech-to-text conversations.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-slate-950/20 border-y border-slate-900/60 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Transform your Routine</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2 mb-6">
              Overthinking → Clarity → Decision → Action
            </h2>
            <div className="space-y-4">
              {[
                "Defeat analysis paralysis by prioritizing high-impact decisions",
                "Uncover learning, internship, and startup opportunities from reflections",
                "Stay consistent using XP levels, achievements, and habit streaks",
                "Weekly & monthly growth reports to track confidence, mood, and stress evolution"
              ].map((benefit, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-sm">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-8 rounded-2xl border-indigo-500/10 shadow-indigo-500/5 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-[40px]" />
            <h3 className="font-bold text-xl text-white mb-4">Clarity Radar Score</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Anchor automatically measures your personal Growth Indicator across journal count, goals achieved, and decision completion rate.
            </p>
            <div className="w-full bg-slate-900 rounded-full h-2.5 mb-2 overflow-hidden border border-slate-800">
              <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full w-[78%]" />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-indigo-300">
              <span>Current clarity score: 78%</span>
              <span>Level 4 Thinker</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 py-12 px-6 bg-slate-950/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span>⚓</span>
            <span className="font-extrabold text-white">Anchor</span>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Anchor Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
