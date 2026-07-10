import { create } from 'zustand';
import api from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
}

interface Profile {
  user: User;
  avatar: string;
  current_streak: number;
  longest_streak: number;
  xp_points: number;
  level: number;
  theme_preference: string;
  language_preference: string;
  badges: string[];
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  error: string | null;
  login: (credentials: any) => Promise<any>;
  register: (userData: any) => Promise<any>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (profileData: any) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login/', credentials);
      const { access, refresh } = response.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      set({ isAuthenticated: true, isLoading: false });
      await get().fetchProfile();
      return response.data;
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Invalid credentials';
      set({ error: errMsg, isLoading: false });
      throw err;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register/', userData);
      const { access, refresh, user } = response.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      set({ user, isAuthenticated: true, isLoading: false });
      await get().fetchProfile();
      return response.data;
    } catch (err: any) {
      const data = err.response?.data;
      const errMsg = data?.username?.[0] || data?.email?.[0] || data?.password?.[0] || data?.non_field_errors?.[0] || 'Registration failed';
      set({ error: errMsg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const refresh = localStorage.getItem('refresh_token');
    try {
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch (e) {
      console.warn("Logout failed on server, cleaning local state anyway");
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, profile: null, isAuthenticated: false });
      window.location.href = '/login';
    }
  },

  fetchProfile: async () => {
    try {
      const response = await api.get('/auth/profile/');
      set({ profile: response.data, user: response.data.user });
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await api.patch('/auth/profile/', profileData);
      set({ profile: response.data });
    } catch (err) {
      console.error('Failed to update profile', err);
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      set({ isAuthenticated: true });
      await get().fetchProfile();
    } else {
      set({ isAuthenticated: false });
    }
    set({ isCheckingAuth: false });
  }
}));
