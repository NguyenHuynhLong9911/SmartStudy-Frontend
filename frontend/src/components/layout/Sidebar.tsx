import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Sparkles,
  TimerReset,
  User as UserIcon,
} from 'lucide-react';
import { clearAuth } from '../../services';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const auth = useAuth();
  const user = {
    email: auth.user?.profile.email,
    name: auth.user?.profile.name || auth.user?.profile.email,
  };

  const handleLogout = async () => {
    clearAuth();
    await auth.signoutRedirect();
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/learning', label: 'Learning Space', icon: BookOpen },
    { to: '/exam-center', label: 'Exam Center', icon: FileQuestion },
    { to: '/study-tools', label: 'Study Tools', icon: TimerReset },
    { to: '/results', label: 'Results', icon: BarChart2 },
  ];

  return (
    <aside
      className={clsx(
        'relative z-30 flex h-screen select-none flex-col border-r border-white/10 bg-[#232F3E] text-white shadow-xl transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-[280px]'
      )}
    >
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <NavLink to="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0073BB] to-[#8A2BE2] shadow-md">
            <Sparkles className="h-5 w-5 animate-pulse text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight tracking-tight text-white">SmartStudy</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#9CCAFF]">PDF Upload</span>
            </div>
          )}
        </NavLink>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="shrink-0 rounded-lg p-1.5 text-[#C0C7D2] transition-colors hover:bg-white/10 hover:text-white"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6">
        {!isCollapsed && (
          <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#707882]">
            Workspace
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-[#0073BB] font-semibold text-white shadow-md'
                    : 'text-[#C0C7D2] hover:bg-white/5 hover:text-white'
                )
              }
              title={isCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && !isCollapsed && (
                    <span className="absolute bottom-2 left-0 top-2 w-1 animate-fadeIn rounded-r-full bg-[#8A2BE2]" />
                  )}
                  <Icon
                    className={clsx(
                      'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
                      isActive ? 'text-white' : 'text-[#9CCAFF]'
                    )}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 bg-black/20 p-4">
        <div className={clsx('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0073BB] bg-[#0073BB]/30 font-semibold text-white">
            {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={18} />}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name || 'User'}</p>
              <p className="truncate text-xs text-[#C0C7D2]">{user.email}</p>
            </div>
          )}
          <button
            onClick={() => void handleLogout()}
            className="shrink-0 rounded-lg p-2 text-[#FFDAD6] transition-colors hover:bg-[#BA1A1A]/20"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
