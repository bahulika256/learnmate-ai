import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  History,
  Home,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const links = [
  ['/dashboard', 'Dashboard', Home],
  ['/tutor', 'AI Tutor', Brain],
  ['/practice', 'Practice', BookOpen],
  ['/progress', 'Progress', ChartNoAxesCombined],
  ['/history', 'History', History],
  ['/profile', 'Profile', UserCircle],
  ['/settings', 'Settings', Settings],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    nav('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar / Mobile Drawer */}
      <aside
        className={`fixed z-50 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 p-5
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        transition-transform duration-200 ease-in-out`}
      >
        <div className="flex items-center gap-2 font-black text-xl text-indigo-600 mb-8">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center">
            L
          </div>
          LearnMate
        </div>

        <nav className="space-y-1">
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={logout}
          className="absolute bottom-5 left-5 right-5 btn btn-ghost justify-start"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Mobile menu button */}
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 bg-white rounded-xl p-2 shadow"
      >
        <Menu size={22} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        >
          <X className="absolute top-4 right-4 text-white" size={24} />
        </button>
      )}

      {/* Main content */}
      <main className="min-h-screen md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}