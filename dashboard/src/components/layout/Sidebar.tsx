import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Play, Clock, BarChart3, Bug, LogOut } from 'lucide-react';

interface SidebarProps {
  userEmail: string | null;
  onLogout: () => void;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: <LayoutGrid size={18} /> },
  { path: "/runs/new", label: "New Run", icon: <Play size={18} /> },
  { path: "/runs", label: "Run History", icon: <Clock size={18} /> },
  { path: "/reports", label: "Coverage", icon: <BarChart3 size={18} /> },
  { path: "/bugs", label: "Bug Reports", icon: <Bug size={18} /> },
];

export function Sidebar({ userEmail, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = userEmail ? userEmail[0].toUpperCase() : "?";
  const displayName = userEmail ? userEmail.split("@")[0] : "User";

  return (
    <div className="w-60 h-screen fixed left-0 top-0 flex flex-col" style={{ background: "#0d1219", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <img src="/spa-marketing-logo.jpg" alt="SpaMarketing.com" className="h-8 w-auto rounded" />
          <p className="text-slate-600 text-[10px] uppercase tracking-widest">Waterfaller</p>
        </div>
      </div>

      <div className="px-3 mt-2 flex-1">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest font-medium px-3 mb-2">Navigation</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                }`}
                style={isActive ? { background: "rgba(62,207,173,0.1)", color: "#3ecfad" } : {}}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3">
        <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" }}>
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{displayName}</p>
              <p className="text-slate-600 text-[10px] truncate">{userEmail}</p>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-white/[0.02] transition-all"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
