import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { BookOpen, Mic, MicOff, Star, AlertTriangle, Battery, Smile, Sparkles, Send, Trash2, Globe, Camera, X, Upload, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Journal() {
  const queryClient = useQueryClient();
  const { fetchProfile } = useAuthStore();
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  const [xpReward, setXpReward] = useState<any>(null);

  // Camera & OCR states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop camera when closing/unmounting
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      setCapturedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed", err);
      alert("Failed to access camera. Please check permissions or upload an image file instead.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const processImageForOCR = async (blob: Blob) => {
    setOcrLoading(true);
    const formData = new FormData();
    formData.append('image', blob, 'diary.jpg');
    try {
      const res = await api.post('/journal/ocr/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const parsedText = res.data.text;
      setContent(prev => prev + (prev ? '\n\n' : '') + parsedText);
      setIsCameraOpen(false);
      setCapturedImage(null);
    } catch (err: any) {
      console.error("OCR failed", err);
      alert(err.response?.data?.detail || "Failed to extract text from the diary image. Please try again with a clearer image.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageForOCR(file);
    }
  };

  const handleConfirmCaptured = () => {
    if (capturedImage) {
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => processImageForOCR(blob));
    }
  };

  // Fetch past journals
  const { data: journals, isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: async () => {
      const res = await api.get('/journal/');
      return res.data;
    }
  });

  // Create Journal Entry mutation
  const createJournalMutation = useMutation({
    mutationFn: async (newEntry: any) => {
      const res = await api.post('/journal/', newEntry);
      return res.data;
    },
    onSuccess: (data) => {
      setContent('');
      setXpReward(data.gamification);
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      fetchProfile(); // reload streak & level

      // Clear toast after 5 seconds
      setTimeout(() => {
        setXpReward(null);
      }, 5000);
    }
  });

  // Delete Journal mutation
  const deleteJournalMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/journal/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    }
  });

  // Speech-to-Text handler using Web Speech API
  const handleVoiceToggle = () => {
    if (isRecording) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition is not supported by your browser. Please try Chrome or Safari.");
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = language === 'hi' ? 'hi-IN' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : language === 'ja' ? 'ja-JP' : 'en-US';

      rec.onresult = (event: any) => {
        const text = event.results[event.results.length - 1][0].transcript;
        setContent((prev) => prev + (prev ? ' ' : '') + text);
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      rec.start();
      setRecognitionInstance(rec);
      setIsRecording(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createJournalMutation.mutate({
      content,
      language
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-400" /> Daily Reflection Journal
        </h2>
        <p className="text-slate-400 text-xs mt-1">Record your thoughts, emotions, and goals to build long-term AI memory.</p>
      </div>

      {/* Gamification Toast Notification */}
      {xpReward && (
        <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/30 text-slate-100 flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
            <div>
              <div className="text-sm font-bold text-white">Journal Logged Successfully!</div>
              <div className="text-xs text-slate-400">Streak: {xpReward.current_streak} Days | XP Gained: +{xpReward.xp_granted} XP</div>
            </div>
          </div>
          {xpReward.leveled_up && (
            <div className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[10px] uppercase">Level Up!</div>
          )}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Left 2 Cols: Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Voice & Lang Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Language</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg text-xs py-1.5 px-3 focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isRecording 
                        ? 'bg-rose-600 animate-pulse text-white shadow-lg shadow-rose-600/20' 
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording ? 'Listening...' : 'Record Voice'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCameraOpen(true);
                      startCamera();
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    Scan Diary
                  </button>
                </div>
              </div>

              {/* Journal Textarea */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={7}
                placeholder="Write down your thoughts, concerns, startup ideas, or whatever is filling your mind..."
                className="w-full glass-input rounded-2xl p-4 text-sm resize-none focus:outline-none"
              />

              {/* AI Automated Analytics Callout */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/10 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-white">Automated AI Analysis</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Our AI cognitive engine automatically extracts your mood, confidence, stress, and energy metrics (1-10) directly from your reflection content. No manual sliders required.
                  </div>
                </div>
              </div>

              {/* Submit btn */}
              <button
                type="submit"
                disabled={createJournalMutation.isPending}
                className="w-full glow-btn text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                {createJournalMutation.isPending ? 'Analyzing and Saving...' : 'Save Journal to AI Memory'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Past Logs */}
        <div className="space-y-4">
          <h3 className="font-bold text-base text-white">Previous Reflections</h3>
          <div className="space-y-3 overflow-y-auto max-h-[500px]">
            {isLoading ? (
              <div className="text-center py-8 text-slate-500 text-xs">Loading logs...</div>
            ) : journals?.map((entry: any) => (
              <div key={entry.id} className="p-4 glass-card rounded-2xl space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">{new Date(entry.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => deleteJournalMutation.mutate(entry.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{entry.content}</p>
                <div className="flex items-center gap-3 pt-2 text-[10px] font-semibold text-slate-400">
                  <span className="text-amber-500">M: {entry.mood_score}</span>
                  <span className="text-indigo-400">C: {entry.confidence_score}</span>
                  <span className="text-rose-400">S: {entry.stress_score}</span>
                  <span className="text-emerald-400">E: {entry.energy_level}</span>
                </div>
              </div>
            ))}
            {(!journals || journals.length === 0) && (
              <div className="text-center py-12 text-slate-500 text-xs bg-slate-900/20 border border-slate-800/40 rounded-2xl">
                No logs recorded yet. Create one!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scan Diary Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-6 border border-slate-800 space-y-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setIsCameraOpen(false);
                setCapturedImage(null);
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                Scan Handwritten Diary
              </h3>
              <p className="text-xs text-slate-400">Position your paper diary page inside the view or upload a photo to transcribe it with AI OCR.</p>
            </div>

            {/* Video preview / Canvas container */}
            <div className="relative aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
              {ocrLoading ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/60 space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-indigo-300 font-medium tracking-wide">AI is reading handwriting...</span>
                </div>
              ) : null}

              {capturedImage ? (
                <img src={capturedImage} alt="Captured diary" className="w-full h-full object-cover" />
              ) : cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              ) : (
                <div className="text-center text-xs text-slate-500 space-y-2">
                  <Camera className="w-8 h-8 text-slate-755 mx-auto animate-pulse" />
                  <span>Camera preview loading...</span>
                </div>
              )}
              
              {/* Canvas helper to pull frames */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-4 justify-between items-center">
              {/* Fallback File Upload Selector */}
              <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:text-slate-100 cursor-pointer text-xs font-semibold transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>

              <div className="flex gap-2">
                {capturedImage ? (
                  <>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCaptured}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirm & Transcribe
                    </button>
                  </>
                ) : cameraStream ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Capture Photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
