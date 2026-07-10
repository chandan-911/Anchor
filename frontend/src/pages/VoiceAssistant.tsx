import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { 
  Mic, MicOff, Volume2, VolumeX, Square, Play, Sparkles, 
  HelpCircle, LogOut, CheckCircle, Info, ChevronRight, Globe
} from 'lucide-react';

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  speechLang: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English (US)', speechLang: 'en-US' },
  { code: 'pa-IN', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ (Punjabi)', speechLang: 'pa-IN' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)', speechLang: 'hi-IN' }
];

type VoiceState = 'idle' | 'listening' | 'transcribing' | 'speaking';

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, fetchProfile } = useAuthStore();

  // Assistant states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(LANGUAGES[0]);
  const [activeVoiceConvId, setActiveVoiceConvId] = useState<number | null>(null);
  
  // Audio playback and capture references
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Silence auto-detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Transcript feedback
  const [userSpeech, setUserSpeech] = useState<string>('');
  const [assistantReply, setAssistantReply] = useState<string>('');

  // Mic permission status
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // Sync preferred language from profile
  useEffect(() => {
    if (profile?.language_preference) {
      const matched = LANGUAGES.find(l => l.code === profile.language_preference);
      if (matched) {
        setSelectedLanguage(matched);
      }
    }
  }, [profile]);

  // Request/Check permission on mount
  useEffect(() => {
    checkPermission();
    initializeConversation();

    return () => {
      // Clean up SpeechSynthesis on unmount
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const checkPermission = async () => {
    setIsCheckingPermission(true);
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        setMicPermission(status.state as any);
        status.onchange = () => {
          setMicPermission(status.state as any);
        };
      } else {
        // Fallback for browsers that don't support permissions query
        setMicPermission('prompt');
      }
    } catch (e) {
      console.warn("Permissions query API not supported", e);
      setMicPermission('prompt');
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop stream immediately since we just wanted to prompt permission
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
    } catch (e) {
      console.error("Microphone access denied", e);
      setMicPermission('denied');
    }
  };

  // Initialize a temporary conversation session
  const initializeConversation = async () => {
    try {
      const res = await api.post('/chat/conversations/', { title: 'Voice Session' });
      setActiveVoiceConvId(res.data.id);
    } catch (e) {
      console.error("Failed to initialize voice session database record", e);
    }
  };

  // Sync language selection to backend profile
  const handleLanguageChange = async (langCode: string) => {
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (!lang) return;

    setSelectedLanguage(lang);
    
    // Stop playback immediately if language changes
    stopPlayback();

    try {
      await api.patch('/auth/profile/', {
        language_preference: lang.code
      });
      fetchProfile();
    } catch (e) {
      console.error("Failed to sync language preference to profile", e);
    }
  };

  // Browser Text-To-Speech (TTS) Voice Selector
  const getBestVoice = (langCode: string) => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    
    // 1. Direct match
    let match = voices.find(v => v.lang.toLowerCase() === langCode.toLowerCase());
    if (match) return match;
    
    // 2. Prefix match (e.g. 'pa' matches 'pa-IN')
    const prefix = langCode.split('-')[0].toLowerCase();
    match = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (match) return match;

    // 3. Indian accent fallbacks for Hindi/Punjabi
    if (prefix === 'pa' || prefix === 'hi') {
      match = voices.find(v => v.lang.includes('IN'));
      if (match) return match;
    }

    return null;
  };

  // Helper to detect response language script (Hindi vs Punjabi vs English)
  const detectScriptLanguage = (text: string): string => {
    // Gurmukhi characters (Punjabi)
    if (/[\u0A00-\u0A7F]/.test(text)) {
      return 'pa-IN';
    }
    // Devanagari characters (Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hi-IN';
    }
    return 'en-US';
  };

  // Speak AI responses
  const speakResponse = (text: string, forceLang?: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Halt previous speech
    setIsSpeaking(true);
    setVoiceState('speaking');

    const targetLang = forceLang || detectScriptLanguage(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.lang = targetLang;

    const matchedVoice = getBestVoice(targetLang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      setVoiceState('idle');
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error", e);
      setIsSpeaking(false);
      setVoiceState('idle');
    };

    // Garbage collection protection
    (window as any)._activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopPlayback = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      } catch (e) {
        console.error("Speech cancellation error", e);
      }
    }
    setIsSpeaking(false);
    setVoiceState('idle');
  };

  // Toggle voice recording (Listening vs Idle)
  const toggleListening = async () => {
    if (voiceState === 'listening') {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      setVoiceState('idle');
    } else {
      // Clear playback first
      stopPlayback();
      setVoiceState('idle');

      // 350ms delay separates speaker release from microphone hardware activation (crucial for iOS Safari)
      setTimeout(async () => {
        try {
          let stream;
          try {
            // High fidelity constraints for voice audio capturing
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
          } catch (constraintErr) {
            console.warn("Advanced audio constraints failed, loading basic capture", constraintErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }

          let options = {};
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            options = { mimeType: 'audio/ogg' };
          } else if (MediaRecorder.isTypeSupported('audio/wav')) {
            options = { mimeType: 'audio/wav' };
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
          }

          const recorder = new MediaRecorder(stream, options);
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          recorder.onstart = () => {
            setUserSpeech('');
            setVoiceState('listening');

            // Set up volume analyzer loop for auto-silence stop detection
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const source = audioContext.createMediaStreamSource(stream);
              const analyser = audioContext.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              
              audioContextRef.current = audioContext;
              analyserRef.current = analyser;

              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              
              let isSpeakingStarted = false;
              let silenceStart = Date.now();
              const SILENCE_DURATION_MS = 5000; // Auto-stop after 5.0 seconds of silence
              const VOLUME_THRESHOLD = 12; // Lower limit to classify as active talking

              const checkVolume = () => {
                // Terminate loop if recorder stops
                if (recorder.state === 'inactive') {
                  if (audioContext.state !== 'closed') {
                    audioContext.close();
                  }
                  return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const averageVolume = sum / bufferLength;

                if (averageVolume > VOLUME_THRESHOLD) {
                  isSpeakingStarted = true;
                  silenceStart = Date.now();
                } else {
                  if (isSpeakingStarted) {
                    const silentPeriod = Date.now() - silenceStart;
                    if (silentPeriod > SILENCE_DURATION_MS) {
                      console.log("[Auto Voice Assistant] Silence detected for 1.8s, triggering stop...");
                      recorder.stop();
                      if (audioContext.state !== 'closed') {
                        audioContext.close();
                      }
                      return;
                    }
                  }
                }
                requestAnimationFrame(checkVolume);
              };

              requestAnimationFrame(checkVolume);
            } catch (analyserErr) {
              console.warn("Failed to initialize silence detection analyzer context", analyserErr);
            }
          };

          recorder.onstop = async () => {
            setVoiceState('transcribing');

            // Clean up AudioContext if active
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close();
            }
            
            // Kill audio tracks immediately to free mic icon on browser tabs
            stream.getTracks().forEach(track => track.stop());

            const containerType = recorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(chunks, { type: containerType });

            const formData = new FormData();
            let ext = 'webm';
            if (containerType.includes('wav')) ext = 'wav';
            else if (containerType.includes('ogg')) ext = 'ogg';
            else if (containerType.includes('mp4')) ext = 'mp4';
            else if (containerType.includes('m4a')) ext = 'm4a';

            formData.append('audio', audioBlob, `voice.${ext}`);
            formData.append('language', selectedLanguage.code);

            try {
              if (!activeVoiceConvId) {
                alert("Voice session lost. Re-initializing conversation...");
                initializeConversation();
                setVoiceState('idle');
                return;
              }

              const res = await api.post(`/chat/conversations/${activeVoiceConvId}/voice-transcribe/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });

              const userText = res.data.transcription;
              setUserSpeech(userText);

              // Parse structured JSON response
              let replyRaw = res.data.ai_message.content;
              let cleanReply = replyRaw;
              try {
                const parsed = JSON.parse(replyRaw);
                cleanReply = parsed.text || "I have analyzed your request.";
              } catch (e) {
                // Raw fallback
              }

              setAssistantReply(cleanReply);
              speakResponse(cleanReply);

              queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
              fetchProfile();
            } catch (err: any) {
              console.error("Transcription upload failed", err);
              alert(err.response?.data?.detail || "Could not process audio. Please talk closer to your microphone.");
              setVoiceState('idle');
            }
          };

          recorder.start();
          setMediaRecorder(recorder);
        } catch (err) {
          console.error("Microphone hardware launch error", err);
          alert("Microphone connection failed. Verify settings and permissions.");
          setVoiceState('idle');
        }
      }, 350);
    }
  };

  // Save/Discard Session flow
  const handleEndSession = async () => {
    if (!activeVoiceConvId) return;

    stopPlayback();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    const saveFlag = confirm(
      "Would you like to save this reflection session to your permanent AI Chat history?\n\n" +
      "Click 'OK' to save it, or 'Cancel' to delete all logs."
    );

    if (saveFlag) {
      try {
        const timeStr = new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Rename the conversation to promote it out of temporary draft scope
        await api.patch(`/chat/conversations/${activeVoiceConvId}/`, {
          title: `Voice Reflection (${timeStr})`
        });

        alert("Session saved to chat logs successfully!");
        navigate('/chat');
      } catch (e) {
        console.error("Failed to rename voice reflection session", e);
        navigate('/chat');
      }
    } else {
      try {
        await api.delete(`/chat/conversations/${activeVoiceConvId}/`);
        alert("Reflection draft deleted.");
        navigate('/dashboard');
      } catch (e) {
        console.error("Failed to delete voice reflection session", e);
        navigate('/dashboard');
      }
    }
  };

  // --- Rendering UI States ---

  // Check state
  if (isCheckingPermission) {
    return (
      <div className="h-[70vh] flex items-center justify-center text-slate-500 text-sm">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        Checking voice assistant configurations...
      </div>
    );
  }

  // Not Allowed state
  if (micPermission === 'denied') {
    return (
      <div className="max-w-md mx-auto mt-16 glass-card p-8 rounded-3xl text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400">
          <MicOff className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Microphone Access Denied</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            Anchor requires microphone permissions to run the virtual voice assistant. 
            Please open your browser site settings and permit microphone access.
          </p>
        </div>
        <div className="pt-2">
          <button 
            onClick={checkPermission}
            className="w-full bg-slate-900 border border-slate-800 text-white py-3 rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Check Permission Status Again
          </button>
        </div>
      </div>
    );
  }

  // Prompt / Setup state
  if (micPermission === 'prompt') {
    return (
      <div className="max-w-lg mx-auto mt-12 glass-card p-8 rounded-3xl space-y-8 select-none">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white">Activate Multilingual Voice Assistant</h2>
          <p className="text-slate-400 text-xs">Speak naturally in English, Hindi, or Punjabi to receive voice coach reflections.</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 items-start p-4 bg-slate-950/40 rounded-2xl border border-slate-850">
            <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Multilingual Capabilities</div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Tuned to comprehend mixed speech and local regional dialects (Punjabi Gurmukhi, Hindi Devanagari, English Latin).
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 bg-slate-950/40 rounded-2xl border border-slate-850">
            <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Cognitive RAG Recall</div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Seamlessly connects to your goals, SWOT reports, streaks, and journal memories to give personalized insights.
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={requestMicPermission}
          className="w-full glow-btn text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
        >
          <Mic className="w-4 h-4" /> Grant Microphone Access
        </button>
      </div>
    );
  }

  // Active virtual assistant UI
  return (
    <div className="max-w-4xl mx-auto space-y-8 select-none flex flex-col items-center">
      {/* Language Toggle Selector */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/50 border border-slate-850/80 rounded-2xl">
        <Globe className="w-4 h-4 text-indigo-400" />
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Assistant Language:</span>
        <select
          value={selectedLanguage.code}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-slate-900/60 border border-slate-800 rounded-lg text-xs py-1.5 px-3 focus:outline-none text-white font-semibold cursor-pointer"
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.nativeLabel}</option>
          ))}
        </select>
      </div>

      {/* Large Glowing Virtual Assistant Breathing Orb */}
      <div className="relative flex flex-col items-center justify-center my-6">
        <button
          onClick={toggleListening}
          disabled={voiceState === 'transcribing'}
          className="relative flex items-center justify-center h-48 w-48 md:h-56 md:w-56 cursor-pointer focus:outline-none group bg-transparent border-none outline-none select-none"
          title="Talk to Assistant"
        >
          {/* Breathing Neon Outer Aura */}
          <div className={`absolute inset-0 rounded-full transition-all duration-700 pointer-events-none blur-md ${
            voiceState === 'listening' ? 'bg-emerald-500/25 scale-125 animate-ping' :
            voiceState === 'transcribing' ? 'bg-amber-500/25 scale-110 animate-spin [animation-duration:3s]' :
            voiceState === 'speaking' ? 'bg-violet-500/25 scale-125 animate-pulse' :
            'bg-indigo-500/10 scale-90 group-hover:scale-100 group-hover:bg-indigo-500/15'
          }`} />

          {/* Ripple Inner Ring */}
          <div className={`absolute inset-4 rounded-full transition-all duration-700 pointer-events-none ${
            voiceState === 'listening' ? 'bg-emerald-500/20 scale-110 animate-pulse' :
            voiceState === 'transcribing' ? 'bg-amber-500/20 scale-105 animate-pulse' :
            voiceState === 'speaking' ? 'bg-violet-500/20 scale-115 animate-ping' :
            'bg-indigo-500/15 scale-95 group-hover:scale-100'
          }`} />
          
          {/* Main Visualizer Orb Core */}
          <div className={`h-24 w-24 md:h-28 md:w-28 rounded-full flex items-center justify-center text-white transition-all duration-500 shadow-2xl z-10 border border-white/5 ${
            voiceState === 'listening' ? 'bg-emerald-600 group-hover:bg-emerald-500 shadow-emerald-600/40 scale-110' :
            voiceState === 'transcribing' ? 'bg-amber-600 group-hover:bg-amber-500 shadow-amber-600/40' :
            voiceState === 'speaking' ? 'bg-violet-600 group-hover:bg-violet-500 shadow-violet-600/40' :
            'bg-indigo-600 group-hover:bg-indigo-500 shadow-indigo-600/40 group-hover:scale-105'
          }`}>
            {voiceState === 'listening' ? (
              <MicOff className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
            ) : (
              <Mic className="w-8 h-8 md:w-10 md:h-10" />
            )}
          </div>
        </button>

        {/* State Status Text */}
        <div className="text-center mt-6 space-y-1">
          <div className={`text-[10px] md:text-xs uppercase tracking-wider font-bold tracking-widest animate-pulse ${
            voiceState === 'listening' ? 'text-emerald-400' :
            voiceState === 'transcribing' ? 'text-amber-400' :
            voiceState === 'speaking' ? 'text-violet-400' :
            'text-indigo-400'
          }`}>
            {voiceState === 'listening' ? 'Listening...' : 
             voiceState === 'transcribing' ? 'Processing Voice...' : 
             voiceState === 'speaking' ? 'Speaking...' : 'Ready to Talk'}
          </div>
          <p className="text-slate-500 text-[10px]">
            {voiceState === 'listening' ? 'Tap the orb when you are finished speaking' : 'Tap the orb to start conversation'}
          </p>
        </div>

        {/* Audio Waveforms */}
        {(voiceState === 'listening' || voiceState === 'speaking') && (
          <div className="flex items-center gap-1.5 h-6 justify-center mt-4">
            <style>{`
              @keyframes assistant-wave {
                0% { transform: scaleY(0.2); }
                100% { transform: scaleY(1); }
              }
              .assistant-wave-bar {
                animation: assistant-wave 0.4s ease-in-out infinite alternate;
                transform-origin: center;
              }
            `}</style>
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full assistant-wave-bar ${
                  voiceState === 'listening' ? 'bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-violet-500/80 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                }`}
                style={{
                  height: '24px',
                  animationDelay: `${i * 0.06}s`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transcription Feedback Display Panels */}
      {(userSpeech || assistantReply || voiceState === 'transcribing') && (
        <div className="w-full max-w-2xl space-y-4">
          {/* User speech card */}
          {userSpeech && (
            <div className="p-4 bg-slate-900/40 border border-slate-850/80 rounded-2xl text-xs space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <Mic className="w-3 h-3 text-emerald-400" /> You said:
              </span>
              <p className="text-slate-200 leading-relaxed font-medium italic">{userSpeech}</p>
            </div>
          )}

          {/* Assistant thinking card */}
          {voiceState === 'transcribing' && (
            <div className="p-4 bg-slate-900/20 border border-slate-850/50 border-dashed rounded-2xl text-xs flex items-center gap-2.5 text-slate-500">
              <div className="flex gap-1 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
              </div>
              <span>Processing speech and query context...</span>
            </div>
          )}

          {/* Assistant reply card */}
          {assistantReply && (
            <div className="p-5 bg-slate-900/60 border border-indigo-950/80 rounded-2xl text-xs space-y-2 shadow-lg">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Virtual Assistant:
              </span>
              <p className="text-slate-200 leading-relaxed font-semibold">{assistantReply}</p>
            </div>
          )}
        </div>
      )}

      {/* Control Dashboard Panel */}
      <div className="w-full max-w-2xl bg-slate-950/50 border border-slate-850/80 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Playback Volume */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setVolume(v => v === 0 ? 0.85 : 0)} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {volume === 0 ? <VolumeX className="w-4.5 h-4.5 text-rose-500" /> : <Volume2 className="w-4.5 h-4.5 text-indigo-400" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="accent-indigo-500 w-full md:w-36 bg-slate-800 h-1.5 rounded-full cursor-pointer"
            title="Assistant Volume"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
          {/* Stop Playback Button */}
          <button
            onClick={stopPlayback}
            disabled={!isSpeaking}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/15'
                : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5" /> Stop Speech
          </button>

          {/* End/Save Session Button */}
          <button
            onClick={handleEndSession}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" /> End Session
          </button>
        </div>
      </div>
    </div>
  );
}
