import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Mic, MicOff, Volume2, VolumeX, Square, Play, Pause, Sparkles, User, RefreshCw, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function VoiceAssistant() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile, fetchProfile } = useAuthStore();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [aiSpeechResponse, setAiSpeechResponse] = useState('');
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeVoiceConvId, setActiveVoiceConvId] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [micPermission, setMicPermission] = useState<'granted' | 'prompt' | 'denied' | 'checking'>('checking');

  const LANGUAGES = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'hi-IN', label: 'हिन्दी (India)' },
    { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'es-ES', label: 'Español (España)' },
    { code: 'fr-FR', label: 'Français (France)' },
    { code: 'de-DE', label: 'Deutsch (Deutschland)' },
    { code: 'ja-JP', label: '日本語 (日本)' },
  ];

  // Sync with user's preferred language from profile
  useEffect(() => {
    if (profile?.language_preference) {
      const mapping: Record<string, string> = {
        en: 'en-US',
        es: 'es-ES',
        fr: 'fr-FR',
        de: 'de-DE',
        hi: 'hi-IN',
        pa: 'pa-IN',
        ja: 'ja-JP',
      };
      const mapped = mapping[profile.language_preference];
      if (mapped) {
        setSelectedLang(mapped);
      }
    }
  }, [profile?.language_preference]);

  // Check microphone permissions on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any })
        .then((permissionStatus) => {
          setMicPermission(permissionStatus.state as any);
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state as any);
          };
        })
        .catch(() => {
          setMicPermission('prompt');
        });
    } else {
      // iOS Safari fallback
      setMicPermission('prompt');
    }
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
      return true;
    } catch (err) {
      console.error("Microphone permission denied", err);
      setMicPermission('denied');
      return false;
    }
  };

  const playChime = async (type: 'start' | 'stop') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Crucial for iOS Safari support
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
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
      setIsTranscribing(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition not supported in this browser.");
        return;
      }

      // If AI is speaking, stop it
      if (isSpeaking) {
        stopPlayback();
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = selectedLang;

      rec.onstart = () => {
        setSpokenText('');
        setIsListening(true);
        setIsTranscribing(false);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        setIsTranscribing(true);
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (interimTranscript) {
          setSpokenText(interimTranscript);
        }
        
        if (finalTranscript) {
          setSpokenText(finalTranscript);
          setIsTranscribing(false);
          speakToAIMutation.mutate(finalTranscript);
        }
      };

      rec.onerror = (e: any) => {
        console.error("STT Error", e);
        setIsListening(false);
        setIsTranscribing(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setIsTranscribing(false);
      };

      rec.start();
      playChime('start');
      setRecognitionInstance(rec);
    }
  };

  const stopPlayback = () => {
    if ('speechSynthesis' in window) {
      try {
        // Resume before cancel fixes a well-known Chrome/Safari SpeechSynthesis freeze bug
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      } catch (err) {
        console.error("Failed to cancel speech synthesis", err);
      }
      setIsSpeaking(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeVoiceConvId) return;
    
    // Stop listening and speaking first
    stopPlayback();
    if (isListening && recognitionInstance) {
      recognitionInstance.stop();
      setIsListening(false);
      setIsTranscribing(false);
    }

    const saveSession = confirm(
      "Would you like to save this voice session in your conversation history?\n\n" +
      "Click 'OK' to save it to your history, or click 'Cancel' to discard it."
    );

    if (saveSession) {
      alert("Session saved successfully!");
      navigate('/chat');
    } else {
      try {
        await api.delete(`/chat/conversations/${activeVoiceConvId}/`);
        alert("Session discarded and cleared.");
        navigate('/dashboard');
      } catch (e) {
        console.error("Failed to delete voice session", e);
        navigate('/dashboard');
      }
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
    <div className="max-w-4xl mx-auto px-4 md:px-0 space-y-6 select-none">
      {/* Header */}
      <div className="text-center flex flex-col items-center">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" /> Continuous Voice Coach
        </h2>
        <p className="text-slate-400 text-[11px] md:text-xs mt-1 max-w-md">
          Speak your reflections, dilemmas, or stress triggers, and receive conversational voice guidance.
        </p>
      </div>

      {micPermission === 'checking' && (
        <div className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center min-h-[350px] space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider animate-pulse">Initializing Audio Context...</p>
        </div>
      )}

      {micPermission === 'denied' && (
        <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center min-h-[350px] text-center space-y-6 max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <MicOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-base text-white">Microphone Access Denied</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Anchor requires microphone permissions to hear your voice and provide real-time coaching. Please enable microphone access in your browser or device settings, then refresh the page.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all"
          >
            Refresh Page
          </button>
        </div>
      )}

      {micPermission === 'prompt' && (
        <div className="glass-card rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center min-h-[350px] text-center space-y-6 max-w-lg mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5">
            <Mic className="w-8 h-8 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-lg text-white">Activate Voice Coach</h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
              Unlock a hands-free conversational coaching experience. Speak naturally in your preferred language to reflect on decisions, log stress, and review goals.
            </p>
          </div>
          <button
            onClick={requestMicPermission}
            className="w-full max-w-xs glow-btn text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg shadow-indigo-600/20"
          >
            <Mic className="w-4 h-4" /> Grant Microphone Access
          </button>
        </div>
      )}

      {micPermission === 'granted' && (
        <div className="glass-card rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
          {/* Language selector */}
          <div className="flex items-center gap-2 bg-slate-900/60 px-4 py-2 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Language:</span>
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
          <div className="relative flex items-center justify-center h-40 w-40 md:h-48 md:w-48">
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
              className={`h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center text-white transition-all shadow-xl ${
                voiceStatus === 'listening' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30' :
                voiceStatus === 'thinking' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' :
                voiceStatus === 'speaking' ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30' :
                'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              {isListening ? <MicOff className="w-6 h-6 md:w-8 md:h-8" /> : <Mic className="w-6 h-6 md:w-8 md:h-8" />}
            </button>
          </div>

          <div className="text-center space-y-2">
            <div className={`text-[10px] md:text-xs uppercase tracking-wider font-bold animate-pulse ${
              voiceStatus === 'listening' ? 'text-emerald-400' :
              voiceStatus === 'thinking' ? 'text-amber-400' :
              voiceStatus === 'speaking' ? 'text-violet-400' :
              'text-indigo-400'
            }`}>
              {voiceStatus === 'listening' ? 'Listening to your thoughts...' : 
               voiceStatus === 'thinking' ? 'Formulating advice...' : 
               voiceStatus === 'speaking' ? 'Speaking...' : 'Ready to talk'}
            </div>
            <p className="text-slate-400 text-[10px] md:text-xs">Tap the mic button to start or stop speaking.</p>
          </div>

          {/* Audio control bars */}
          <div className="w-full max-w-md p-3 md:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={voiceVolume}
                onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                className="accent-indigo-500 h-1 w-28 bg-slate-800 cursor-pointer"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={stopPlayback}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] font-semibold text-slate-300 flex items-center justify-center gap-1 transition-all"
              >
                <Square className="w-3 h-3 text-rose-500 fill-rose-500" /> Stop Speech
              </button>
              <button 
                onClick={handleEndSession}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-indigo-950/20 border border-indigo-900/30 hover:bg-indigo-900/20 text-[10px] font-bold text-indigo-400 flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-indigo-400" /> End Session
              </button>
            </div>
          </div>

          {/* Live transcriptions display */}
          <div className="w-full space-y-4 pt-6 border-t border-slate-850">
            {spokenText && (
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> 
                  {isTranscribing ? (
                    <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Transcribing...
                    </span>
                  ) : (
                    "You said:"
                  )}
                </span>
                <p className={`text-xs p-3 rounded-xl border italic transition-all ${
                  isTranscribing 
                    ? 'text-slate-400 bg-slate-900/30 border-slate-900/40' 
                    : 'text-slate-350 bg-slate-900/50 border-slate-850'
                }`}>
                  "{spokenText}"
                </p>
              </div>
            )}
            
            {aiSpeechResponse && (
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI Mentor:
                </span>
                <p className="text-xs text-indigo-200 bg-indigo-950/10 p-3 rounded-xl border border-indigo-950/30 leading-relaxed">
                  "{aiSpeechResponse}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
