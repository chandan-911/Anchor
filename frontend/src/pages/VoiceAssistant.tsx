import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Mic, MicOff, Volume2, VolumeX, Square, Play, Pause, Sparkles, User, RefreshCw, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function VoiceAssistant() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [aiSpeechResponse, setAiSpeechResponse] = useState('');
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [activeVoiceConvId, setActiveVoiceConvId] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState('en-US');

  const LANGUAGES = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'es-ES', label: 'Español (España)' },
    { code: 'fr-FR', label: 'Français (France)' },
    { code: 'de-DE', label: 'Deutsch (Deutschland)' },
    { code: 'hi-IN', label: 'हिन्दी (India)' },
    { code: 'ja-JP', label: '日本語 (日本)' },
  ];

  const playChime = (type: 'start' | 'stop') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'start') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (err) {
      console.error("Failed to play chime", err);
    }
  };

  // Initialize a new conversation for voice session automatically
  useEffect(() => {
    const initVoiceSession = async () => {
      try {
        const res = await api.post('/chat/conversations/', { title: 'Voice Session' });
        setActiveVoiceConvId(res.data.id);
      } catch (e) {
        console.error("Failed to init voice session", e);
      }
    };
    initVoiceSession();
  }, []);

  // Send transcription mutation
  const speakToAIMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!activeVoiceConvId) return null;
      const res = await api.post(`/chat/conversations/${activeVoiceConvId}/ask/`, { message: messageText });
      return res.data;
    },
    onSuccess: (data) => {
      if (data) {
        let aiMessageText = data.ai_message.content;
        try {
          const parsed = JSON.parse(aiMessageText);
          aiMessageText = parsed.text || "I have analyzed your situation and updated your memory.";
        } catch (e) {
          // Keep raw content
        }
        setAiSpeechResponse(aiMessageText);
        speakResponse(aiMessageText);
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        fetchProfile();
      }
    }
  });

  // Browser Text-to-Speech (TTS)
  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = voiceVolume;
    utterance.rate = 1.0;
    utterance.lang = selectedLang;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  // Browser Speech-to-Text (STT)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      playChime('stop');
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition not supported in this browser.");
        return;
      }

      // If AI is speaking, stop it
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = selectedLang;

      rec.onstart = () => {
        setSpokenText('');
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSpokenText(transcript);
        speakToAIMutation.mutate(transcript);
      };

      rec.onerror = (e: any) => {
        console.error("STT Error", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      playChime('start');
      setRecognitionInstance(rec);
    }
  };

  const stopPlayback = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!activeVoiceConvId) return;
    if (!confirm("Are you sure you want to delete this voice session and clear the transcript?")) return;
    
    try {
      await api.delete(`/chat/conversations/${activeVoiceConvId}/`);
      setSpokenText('');
      setAiSpeechResponse('');
      stopPlayback();
      
      // Initialize a new session
      const res = await api.post('/chat/conversations/', { title: 'Voice Session' });
      setActiveVoiceConvId(res.data.id);
      alert("Voice session cleared and reset successfully!");
    } catch (e) {
      console.error("Failed to delete voice session", e);
      alert("Failed to reset session.");
    }
  };

  const voiceStatus = isListening 
    ? 'listening' 
    : speakToAIMutation.isPending 
      ? 'thinking' 
      : isSpeaking 
        ? 'speaking' 
        : 'idle';

  return (
    <div className="max-w-4xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="text-center flex flex-col items-center">
        <h2 className="text-2xl font-bold text-white">Continuous Voice Coach</h2>
        <p className="text-slate-400 text-xs mt-1">Speak your reflections or dilemmas, and receive conversational guidance.</p>
      </div>

      {/* Main interface */}
      <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
        {/* Language selector */}
        <div className="flex items-center gap-2 bg-slate-900/60 px-4 py-2 rounded-2xl border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Coach Language:</span>
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-950 text-slate-350">
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Pulse Visualizer */}
        <div className="relative flex items-center justify-center h-48 w-48">
          <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
            voiceStatus === 'listening' ? 'bg-emerald-500/15 scale-125 animate-ping' :
            voiceStatus === 'thinking' ? 'bg-amber-500/15 scale-110 animate-pulse' :
            voiceStatus === 'speaking' ? 'bg-violet-500/15 scale-125 animate-ping' :
            'bg-indigo-500/10 scale-75'
          }`} />
          <div className={`absolute inset-4 rounded-full transition-all duration-700 ${
            voiceStatus === 'listening' ? 'bg-emerald-500/20 scale-110 animate-pulse' :
            voiceStatus === 'thinking' ? 'bg-amber-500/20 scale-105 animate-pulse' :
            voiceStatus === 'speaking' ? 'bg-violet-500/20 scale-110 animate-pulse' :
            'bg-indigo-500/15 scale-90'
          }`} />
          
          <button
            onClick={toggleListening}
            disabled={speakToAIMutation.isPending}
            className={`h-24 w-24 rounded-full flex items-center justify-center text-white transition-all shadow-xl ${
              voiceStatus === 'listening' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30' :
              voiceStatus === 'thinking' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 animate-pulse' :
              voiceStatus === 'speaking' ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30' :
              'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className={`text-xs uppercase tracking-wider font-bold animate-pulse ${
            voiceStatus === 'listening' ? 'text-emerald-400' :
            voiceStatus === 'thinking' ? 'text-amber-400' :
            voiceStatus === 'speaking' ? 'text-violet-400' :
            'text-indigo-400'
          }`}>
            {voiceStatus === 'listening' ? 'Listening to your thoughts...' : 
             voiceStatus === 'thinking' ? 'Formulating advice...' : 
             voiceStatus === 'speaking' ? 'Speaking...' : 'Ready to talk'}
          </div>
          <p className="text-slate-400 text-xs">Tap the mic button to start or stop speaking.</p>
        </div>

        {/* Audio control bars */}
        <div className="w-full max-w-sm p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={voiceVolume}
              onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              className="accent-indigo-500 h-1 w-24 bg-slate-800"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={stopPlayback}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] font-semibold text-slate-300 flex items-center gap-1 transition-all"
            >
              <Square className="w-3 h-3 text-rose-500 fill-rose-500" /> Stop Speech
            </button>
            <button 
              onClick={handleDeleteSession}
              className="px-3 py-1.5 rounded-lg bg-rose-950/20 border border-rose-900/30 hover:bg-rose-900/20 text-[10px] font-bold text-rose-400 flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Clear Session
            </button>
          </div>
        </div>

        {/* Live transcriptions display */}
        <div className="w-full space-y-4 pt-6 border-t border-slate-850">
          {spokenText && (
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><User className="w-3.5 h-3.5" /> You said:</span>
              <p className="text-xs text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-850 italic">"{spokenText}"</p>
            </div>
          )}
          
          {aiSpeechResponse && (
            <div className="space-y-1 text-left">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Mentor:</span>
              <p className="text-xs text-indigo-200 bg-indigo-950/10 p-3 rounded-xl border border-indigo-950/30">"{aiSpeechResponse}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
