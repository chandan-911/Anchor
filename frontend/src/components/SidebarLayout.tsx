import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, BookOpen, MessageSquare, Mic, HelpCircle, 
  BarChart2, FileText, Compass, Award, LogOut, Flame, Menu, X, Sun, Moon 
} from 'lucide-react';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const { profile, updateProfile, logout } = useAuthStore();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Journal', path: '/journal', icon: BookOpen },
    { name: 'AI Chat', path: '/chat', icon: MessageSquare },
    { name: 'Voice Coach', path: '/voice', icon: Mic },
    { name: 'Decisions', path: '/decisions', icon: HelpCircle },
    { name: 'SWOT Radar', path: '/swot', icon: BarChart2 },
    { name: 'Opportunity', path: '/opportunities', icon: Compass },
    { name: 'Analytics & Reports', path: '/analytics', icon: FileText },
    { name: 'Profile & Badges', path: '/profile', icon: Award },
  ];

  const toggleTheme = () => {
    if (!profile) return;
    const nextTheme = profile.theme_preference === 'light' ? 'dark' : 'light';
    updateProfile({ theme_preference: nextTheme });
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background-dark text-slate-100 font-sans">
      
      {/* Mobile Top Navigation Bar */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
            ⚓
          </div>
          <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-indigo-200 to-violet-400 bg-clip-text text-transparent">
            Anchor
          </span>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"
              title="Toggle Theme"
            >
              {profile.theme_preference === 'light' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer Sidebar */}
      <aside className={`md:hidden fixed top-[53px] bottom-0 left-0 w-64 bg-slate-950 border-r border-slate-800 z-40 transform transition-transform duration-300 ease-in-out p-4 flex flex-col justify-between ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          {/* User Streak status */}
          {profile && (
            <div className="mb-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500/10 animate-pulse" />
                <div className="text-[11px] font-bold text-slate-200">{profile.current_streak} days</div>
              </div>
              <div className="text-[10px] text-indigo-400 font-semibold">Level {profile.level}</div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 overflow-y-auto max-h-[65vh]">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600/15 border-l-2 border-indigo-500 text-indigo-200 font-semibold' 
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-900">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar (Hidden on mobile) */}
      <aside className="hidden md:flex w-64 border-r border-slate-800/80 bg-slate-950/40 backdrop-blur-md flex flex-col p-4 justify-between sticky top-0 h-screen shrink-0">
        <div>
          {/* Logo / Title Row with Theme Switcher */}
          <div className="flex items-center justify-between px-3 py-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/20">
                ⚓
              </div>
              <div>
                <h1 className="font-extrabold text-lg bg-gradient-to-r from-indigo-200 to-violet-400 bg-clip-text text-transparent font-sans">
                  Anchor
                </h1>
                <span className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase">Clarity SaaS</span>
              </div>
            </div>
            {profile && (
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-450 hover:text-slate-100 hover:bg-slate-800 transition-all cursor-pointer"
                title="Toggle Theme"
              >
                {profile.theme_preference === 'light' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>
            )}
          </div>

          {/* User Streak & Level Status */}
          {profile && (
            <div className="mx-2 mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500 fill-amber-500/10 animate-pulse" />
                <div>
                  <div className="text-xs text-slate-400">Streak</div>
                  <div className="text-sm font-bold text-slate-200">{profile.current_streak} days</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Level {profile.level}</div>
                <div className="text-[10px] text-indigo-400 font-semibold">{profile.xp_points} / {profile.level * 100} XP</div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-600/15 border-l-2 border-indigo-500 text-indigo-200 font-semibold' 
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/30 border border-slate-800/50">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-semibold text-slate-300">
              {profile?.user.username[0]?.toUpperCase() || 'U'}
            </div>
            <div className="truncate w-36">
              <div className="text-xs font-semibold text-slate-300 truncate">{profile?.user.username}</div>
              <div className="text-[10px] text-slate-500 truncate">{profile?.user.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 min-h-screen bg-gradient-to-tr from-[#02050f] via-[#040816] to-[#0a0f29] p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
