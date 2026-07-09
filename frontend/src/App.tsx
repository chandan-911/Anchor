import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

// Layout & Components
import SidebarLayout from './components/SidebarLayout';

// Public Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

// Protected Pages
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import AIChat from './pages/AIChat';
import VoiceAssistant from './pages/VoiceAssistant';
import DecisionAssistant from './pages/DecisionAssistant';
import SWOTAnalysis from './pages/SWOTAnalysis';
import OpportunityRadar from './pages/OpportunityRadar';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';

const queryClient = new QueryClient();

// Auth Protection Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <p className="text-slate-400 text-xs font-semibold animate-pulse uppercase tracking-wider">Anchoring Context...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <SidebarLayout>{children}</SidebarLayout> : <Navigate to="/login" replace />;
}

export default function App() {
  const { checkAuth, profile } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (profile?.theme_preference === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [profile?.theme_preference]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
          <Route path="/voice" element={<ProtectedRoute><VoiceAssistant /></ProtectedRoute>} />
          <Route path="/decisions" element={<ProtectedRoute><DecisionAssistant /></ProtectedRoute>} />
          <Route path="/swot" element={<ProtectedRoute><SWOTAnalysis /></ProtectedRoute>} />
          <Route path="/opportunities" element={<ProtectedRoute><OpportunityRadar /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
