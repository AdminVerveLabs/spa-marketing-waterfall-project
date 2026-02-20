import { useState, useEffect, useCallback } from "react";

// ============================================================
// MOCK DATA
// ============================================================
const METROS = {
  US: {
    TX: { name: "Texas", cities: [
      { city: "Austin", lat: 30.2672, lng: -97.7431, metro_name: "Austin, TX", yelp_location: "Austin, TX" },
      { city: "Houston", lat: 29.7604, lng: -95.3698, metro_name: "Houston, TX", yelp_location: "Houston, TX" },
      { city: "Dallas", lat: 32.7767, lng: -96.797, metro_name: "Dallas, TX", yelp_location: "Dallas, TX" },
      { city: "San Antonio", lat: 29.4241, lng: -98.4936, metro_name: "San Antonio, TX", yelp_location: "San Antonio, TX" },
    ]},
    CA: { name: "California", cities: [
      { city: "Los Angeles", lat: 34.0522, lng: -118.2437, metro_name: "Los Angeles, CA", yelp_location: "Los Angeles, CA" },
      { city: "San Francisco", lat: 37.7749, lng: -122.4194, metro_name: "San Francisco, CA", yelp_location: "San Francisco, CA" },
      { city: "San Diego", lat: 32.7157, lng: -117.1611, metro_name: "San Diego, CA", yelp_location: "San Diego, CA" },
    ]},
    NY: { name: "New York", cities: [
      { city: "New York City", lat: 40.7128, lng: -74.006, metro_name: "New York City, NY", yelp_location: "New York, NY" },
      { city: "Buffalo", lat: 42.8864, lng: -78.8784, metro_name: "Buffalo, NY", yelp_location: "Buffalo, NY" },
    ]},
    FL: { name: "Florida", cities: [
      { city: "Miami", lat: 25.7617, lng: -80.1918, metro_name: "Miami, FL", yelp_location: "Miami, FL" },
      { city: "Orlando", lat: 28.5383, lng: -81.3792, metro_name: "Orlando, FL", yelp_location: "Orlando, FL" },
      { city: "Tampa", lat: 27.9506, lng: -82.4572, metro_name: "Tampa, FL", yelp_location: "Tampa, FL" },
    ]},
    CO: { name: "Colorado", cities: [
      { city: "Denver", lat: 39.7392, lng: -104.9903, metro_name: "Denver, CO", yelp_location: "Denver, CO" },
    ]},
  },
  CA: {
    ON: { name: "Ontario", cities: [
      { city: "Toronto", lat: 43.6532, lng: -79.3832, metro_name: "Toronto, ON", yelp_location: "Toronto, ON" },
      { city: "Ottawa", lat: 45.4215, lng: -75.6972, metro_name: "Ottawa, ON", yelp_location: "Ottawa, ON" },
    ]},
    AB: { name: "Alberta", cities: [
      { city: "Edmonton", lat: 53.5461, lng: -113.4938, metro_name: "Edmonton, AB", yelp_location: "Edmonton, AB" },
      { city: "Calgary", lat: 51.0447, lng: -114.0719, metro_name: "Calgary, AB", yelp_location: "Calgary, AB" },
    ]},
    BC: { name: "British Columbia", cities: [
      { city: "Vancouver", lat: 49.2827, lng: -123.1207, metro_name: "Vancouver, BC", yelp_location: "Vancouver, BC" },
    ]},
    QC: { name: "Quebec", cities: [
      { city: "Montreal", lat: 45.5017, lng: -73.5673, metro_name: "Montreal, QC", yelp_location: "Montreal, QC" },
    ]},
  },
};

const QUERY_TEMPLATES = [
  { id: "1", name: "Default Massage/Spa", queries: ["massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist"], is_default: true },
  { id: "2", name: "Spa Focus", queries: ["day spa", "med spa", "wellness spa", "beauty spa"], is_default: false },
  { id: "3", name: "Wellness Broad", queries: ["wellness center", "holistic healing", "bodywork", "therapeutic massage"], is_default: false },
];

const MOCK_RUNS = [
  { id: "r1", country: "US", state: "TX", city: "Austin", metro_name: "Austin, TX", status: "completed", total_discovered: 58, new_records: 50, contacts_found: 45, duplicates_merged: 8, search_queries: ["massage therapy", "massage clinic", "RMT", "spa massage"], radius_meters: 10000, created_at: "2026-02-15T14:30:00Z", completed_at: "2026-02-15T14:52:00Z", triggered_by: "Zack" },
  { id: "r2", country: "US", state: "TX", city: "Houston", metro_name: "Houston, TX", status: "running", total_discovered: null, new_records: null, contacts_found: null, duplicates_merged: null, search_queries: ["massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist"], radius_meters: 15000, created_at: "2026-02-18T09:15:00Z", completed_at: null, triggered_by: "Zack" },
  { id: "r3", country: "US", state: "TX", city: "Dallas", metro_name: "Dallas, TX", status: "failed", total_discovered: null, new_records: null, contacts_found: null, duplicates_merged: null, search_queries: ["massage therapy", "massage clinic"], radius_meters: 10000, created_at: "2026-02-17T11:00:00Z", completed_at: "2026-02-17T11:03:00Z", errors: ["Google Places API rate limit exceeded"], triggered_by: "Riley" },
  { id: "r4", country: "US", state: "CA", city: "Los Angeles", metro_name: "Los Angeles, CA", status: "completed", total_discovered: 142, new_records: 130, contacts_found: 98, duplicates_merged: 12, search_queries: ["massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist"], radius_meters: 25000, created_at: "2026-02-14T10:00:00Z", completed_at: "2026-02-14T10:45:00Z", triggered_by: "Zack" },
  { id: "r5", country: "US", state: "CA", city: "San Francisco", metro_name: "San Francisco, CA", status: "completed", total_discovered: 67, new_records: 60, contacts_found: 48, duplicates_merged: 7, search_queries: ["massage therapy", "day spa", "wellness spa"], radius_meters: 10000, created_at: "2026-02-13T16:00:00Z", completed_at: "2026-02-13T16:28:00Z", triggered_by: "Zack" },
  { id: "r6", country: "CA", state: "AB", city: "Edmonton", metro_name: "Edmonton, AB", status: "completed", total_discovered: 41, new_records: 38, contacts_found: 30, duplicates_merged: 3, search_queries: ["massage therapy", "RMT", "massage clinic"], radius_meters: 10000, created_at: "2026-02-12T08:00:00Z", completed_at: "2026-02-12T08:22:00Z", triggered_by: "Riley" },
  { id: "r7", country: "CA", state: "AB", city: "Calgary", metro_name: "Calgary, AB", status: "completed", total_discovered: 53, new_records: 48, contacts_found: 36, duplicates_merged: 5, search_queries: ["massage therapy", "RMT", "spa massage"], radius_meters: 10000, created_at: "2026-02-11T12:00:00Z", completed_at: "2026-02-11T12:35:00Z", triggered_by: "Zack" },
  { id: "r8", country: "US", state: "TX", city: "Austin", metro_name: "Austin, TX", status: "completed", total_discovered: 12, new_records: 8, contacts_found: 6, duplicates_merged: 4, search_queries: ["massage therapy", "massage clinic", "RMT", "spa massage"], radius_meters: 10000, created_at: "2026-02-10T09:00:00Z", completed_at: "2026-02-10T09:18:00Z", triggered_by: "Zack" },
  { id: "r9", country: "CA", state: "ON", city: "Toronto", metro_name: "Toronto, ON", status: "completed", total_discovered: 89, new_records: 82, contacts_found: 61, duplicates_merged: 7, search_queries: ["massage therapy", "RMT", "massage clinic", "spa massage"], radius_meters: 15000, created_at: "2026-02-09T14:00:00Z", completed_at: "2026-02-09T14:50:00Z", triggered_by: "Zack" },
  { id: "r10", country: "US", state: "FL", city: "Miami", metro_name: "Miami, FL", status: "completed", total_discovered: 76, new_records: 70, contacts_found: 55, duplicates_merged: 6, search_queries: ["massage therapy", "spa massage", "day spa"], radius_meters: 15000, created_at: "2026-02-08T11:30:00Z", completed_at: "2026-02-08T12:05:00Z", triggered_by: "Riley" },
];

// ============================================================
// ICONS (inline SVG components)
// ============================================================
const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Play: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  History: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Loader: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  Building: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Globe: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Zap: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  External: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "—";
  const now = new Date("2026-02-18T15:00:00Z");
  const d = new Date(dateStr);
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

// ============================================================
// STATUS BADGE
// ============================================================
const StatusBadge = ({ status }) => {
  const config = {
    completed: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: <Icons.Check />, label: "Completed" },
    running: { bg: "bg-amber-500/15", text: "text-amber-400", icon: <Icons.Loader />, label: "Running" },
    failed: { bg: "bg-red-500/15", text: "text-red-400", icon: <Icons.X />, label: "Failed" },
    queued: { bg: "bg-slate-500/15", text: "text-slate-400", icon: <Icons.Loader />, label: "Queued" },
  };
  const c = config[status] || config.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
};

// ============================================================
// LOGIN PAGE
// ============================================================
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #0a0f1a 0%, #111927 50%, #0d1520 100%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #3ecfad 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.02]" style={{ background: "radial-gradient(circle, #3ecfad 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" }}>
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-white text-xl tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>VerveLabs</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Run Manager</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          <h2 className="text-white text-lg font-semibold mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@spamarketing.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all focus:ring-1"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", focusRing: "#3ecfad" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(62,207,173,0.08)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(62,207,173,0.08)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 mt-2 flex items-center justify-center gap-2"
              style={{ background: loading ? "rgba(62,207,173,0.5)" : "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: loading ? "none" : "0 4px 14px rgba(62,207,173,0.25)" }}
              onMouseOver={(e) => { if (!loading) e.target.style.boxShadow = "0 6px 20px rgba(62,207,173,0.35)"; }}
              onMouseOut={(e) => { if (!loading) e.target.style.boxShadow = "0 4px 14px rgba(62,207,173,0.25)"; }}
            >
              {loading ? <><Icons.Loader /> Signing in...</> : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">spamarketing.com internal tool</p>
      </div>
    </div>
  );
};

// ============================================================
// SIDEBAR
// ============================================================
const Sidebar = ({ currentPage, onNavigate, onLogout }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <Icons.Dashboard /> },
    { id: "new-run", label: "New Run", icon: <Icons.Play /> },
    { id: "history", label: "Run History", icon: <Icons.History /> },
    { id: "reports", label: "Coverage", icon: <Icons.Chart /> },
  ];

  return (
    <div className="w-60 h-screen fixed left-0 top-0 flex flex-col" style={{ background: "#0d1219", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" }}>
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div>
            <span className="text-white text-sm font-semibold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>VerveLabs</span>
            <p className="text-slate-600 text-[10px] uppercase tracking-widest">Run Manager</p>
          </div>
        </div>
      </div>

      <div className="px-3 mt-2 flex-1">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest font-medium px-3 mb-2">Navigation</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                currentPage === item.id
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
              }`}
              style={currentPage === item.id ? { background: "rgba(62,207,173,0.1)", color: "#3ecfad" } : {}}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-3">
        <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" }}>Z</div>
            <div>
              <p className="text-white text-xs font-medium">Zack</p>
              <p className="text-slate-600 text-[10px]">Admin</p>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-white/[0.02] transition-all"
        >
          <Icons.Logout /> Sign out
        </button>
      </div>
    </div>
  );
};

// ============================================================
// STAT CARD
// ============================================================
const StatCard = ({ icon, label, value, sub }) => (
  <div className="rounded-2xl p-5 transition-all duration-200 group" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(62,207,173,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
    onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(62,207,173,0.08)" }}>
        <span className="text-emerald-400">{icon}</span>
      </div>
    </div>
    <p className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>{value}</p>
    <p className="text-slate-500 text-xs mt-0.5">{label}</p>
    {sub && <p className="text-slate-600 text-[10px] mt-1">{sub}</p>}
  </div>
);

// ============================================================
// DASHBOARD PAGE
// ============================================================
const DashboardPage = ({ runs, onNavigate }) => {
  const completed = runs.filter(r => r.status === "completed");
  const metrosRun = new Set(completed.map(r => r.metro_name)).size;
  const totalDiscovered = completed.reduce((s, r) => s + (r.total_discovered || 0), 0);
  const totalContacts = completed.reduce((s, r) => s + (r.contacts_found || 0), 0);
  const thisMonth = runs.filter(r => new Date(r.created_at).getMonth() === 1).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Pipeline overview and recent activity</p>
        </div>
        <button
          onClick={() => onNavigate("new-run")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: "0 4px 14px rgba(62,207,173,0.25)" }}
          onMouseOver={(e) => e.target.style.boxShadow = "0 6px 20px rgba(62,207,173,0.35)"}
          onMouseOut={(e) => e.target.style.boxShadow = "0 4px 14px rgba(62,207,173,0.25)"}
        >
          <Icons.Play /> New Run
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Icons.Globe />} label="Metros Covered" value={metrosRun} sub={`${completed.length} total runs`} />
        <StatCard icon={<Icons.Building />} label="Companies Found" value={totalDiscovered.toLocaleString()} sub="Across all metros" />
        <StatCard icon={<Icons.Users />} label="Contacts Found" value={totalContacts.toLocaleString()} sub="Owners & practitioners" />
        <StatCard icon={<Icons.Zap />} label="Runs This Month" value={thisMonth} sub="February 2026" />
      </div>

      {/* Active run banner */}
      {runs.some(r => r.status === "running") && (
        <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="animate-spin"><Icons.Loader /></div>
          <div className="flex-1">
            <p className="text-amber-400 text-sm font-medium">
              Pipeline running: {runs.find(r => r.status === "running")?.metro_name}
            </p>
            <p className="text-amber-400/60 text-xs mt-0.5">Started {timeAgo(runs.find(r => r.status === "running")?.created_at)} — check back in ~15-30 min</p>
          </div>
        </div>
      )}

      {/* Recent runs table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <h2 className="text-white text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Recent Runs</h2>
          <button onClick={() => onNavigate("history")} className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "#3ecfad" }}
            onMouseOver={(e) => e.target.style.color = "#5eddc0"}
            onMouseOut={(e) => e.target.style.color = "#3ecfad"}
          >
            View all <Icons.ChevronRight />
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {["Metro", "Status", "Discovered", "Contacts", "Date", ""].map((h, i) => (
                <th key={i} className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 7).map((run) => (
              <tr key={run.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td className="px-5 py-3.5">
                  <p className="text-white text-sm font-medium">{run.metro_name}</p>
                  <p className="text-slate-600 text-[10px] mt-0.5">{run.country === "CA" ? "Canada" : "United States"}</p>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={run.status} /></td>
                <td className="px-5 py-3.5 text-sm text-slate-400">{run.total_discovered ?? "—"}</td>
                <td className="px-5 py-3.5 text-sm text-slate-400">{run.contacts_found ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <p className="text-sm text-slate-400">{formatDate(run.created_at)}</p>
                  <p className="text-[10px] text-slate-600">{formatTime(run.created_at)}</p>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {(run.status === "completed" || run.status === "failed") && (
                    <button className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ml-auto"
                      style={{ color: "#3ecfad", background: "rgba(62,207,173,0.08)" }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(62,207,173,0.15)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "rgba(62,207,173,0.08)"}
                    >
                      <Icons.Refresh /> Re-run
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// NEW RUN PAGE
// ============================================================
const NewRunPage = ({ onNavigate, runs, setRuns }) => {
  const [country, setCountry] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [radius, setRadius] = useState(10000);
  const [templateId, setTemplateId] = useState("1");
  const [customQueries, setCustomQueries] = useState(QUERY_TEMPLATES[0].queries.join(", "));
  const [submitted, setSubmitted] = useState(false);
  const [submittedMetro, setSubmittedMetro] = useState("");
  const [citySearch, setCitySearch] = useState("");

  const states = country ? Object.entries(METROS[country] || {}).map(([code, data]) => ({ code, name: data.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const cities = (country && stateCode) ? (METROS[country]?.[stateCode]?.cities || []) : [];
  const filteredCities = cities.filter(c => c.city.toLowerCase().includes(citySearch.toLowerCase()));
  const selectedCity = cities.find(c => c.city === cityName);

  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const t = QUERY_TEMPLATES.find(t => t.id === id);
    if (t) setCustomQueries(t.queries.join(", "));
  };

  const handleSubmit = () => {
    if (!selectedCity) return;
    const newRun = {
      id: "r" + (runs.length + 1),
      country, state: stateCode, city: cityName,
      metro_name: selectedCity.metro_name,
      status: "running",
      total_discovered: null, new_records: null, contacts_found: null, duplicates_merged: null,
      search_queries: customQueries.split(",").map(q => q.trim()),
      radius_meters: radius,
      created_at: new Date().toISOString(),
      completed_at: null,
      triggered_by: "Zack",
    };
    setRuns([newRun, ...runs]);
    setSubmittedMetro(selectedCity.metro_name);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(62,207,173,0.1)" }}>
          <Icons.Check />
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3ecfad" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 className="text-white text-xl font-bold mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>Run started</h2>
        <p className="text-slate-400 text-sm mb-1">{submittedMetro}</p>
        <p className="text-slate-600 text-sm mb-8">The pipeline is running. Check back in ~15–30 minutes for results.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => onNavigate("dashboard")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: "0 4px 14px rgba(62,207,173,0.25)" }}>
            Go to Dashboard
          </button>
          <button onClick={() => { setSubmitted(false); setCountry(""); setStateCode(""); setCityName(""); }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Start Another
          </button>
        </div>
      </div>
    );
  }

  const selectStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "white",
    appearance: "none",
    WebkitAppearance: "none",
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>New Pipeline Run</h1>
        <p className="text-slate-500 text-sm mt-1">Configure and launch a discovery + enrichment pipeline for a metro area</p>
      </div>

      <div className="rounded-2xl p-6 space-y-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Location section */}
        <div>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad" }}>1</span>
            Location
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">Country</label>
              <div className="relative">
                <select value={country} onChange={(e) => { setCountry(e.target.value); setStateCode(""); setCityName(""); }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10"
                  style={selectStyle}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <option value="" style={{ background: "#151d2b" }}>Select...</option>
                  <option value="US" style={{ background: "#151d2b" }}>United States</option>
                  <option value="CA" style={{ background: "#151d2b" }}>Canada</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><Icons.ChevronDown /></div>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">{country === "CA" ? "Province" : "State"}</label>
              <div className="relative">
                <select value={stateCode} onChange={(e) => { setStateCode(e.target.value); setCityName(""); }}
                  disabled={!country}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={selectStyle}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <option value="" style={{ background: "#151d2b" }}>Select...</option>
                  {states.map(s => <option key={s.code} value={s.code} style={{ background: "#151d2b" }}>{s.name}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><Icons.ChevronDown /></div>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">City</label>
              <div className="relative">
                <select value={cityName} onChange={(e) => setCityName(e.target.value)}
                  disabled={!stateCode}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={selectStyle}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <option value="" style={{ background: "#151d2b" }}>Select...</option>
                  {cities.map(c => <option key={c.city} value={c.city} style={{ background: "#151d2b" }}>{c.city}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><Icons.ChevronDown /></div>
              </div>
            </div>
          </div>

          {selectedCity && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-slate-600 text-[10px] uppercase tracking-wider">Lat</span>
                <p className="text-slate-400 text-xs font-mono">{selectedCity.lat}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-slate-600 text-[10px] uppercase tracking-wider">Lng</span>
                <p className="text-slate-400 text-xs font-mono">{selectedCity.lng}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                <span className="text-slate-600 text-[10px] uppercase tracking-wider">Yelp Label</span>
                <p className="text-slate-400 text-xs">{selectedCity.yelp_location}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

        {/* Radius */}
        <div>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad" }}>2</span>
            Search Radius
          </h3>
          <div className="flex gap-2">
            {[5000, 10000, 15000, 25000].map((r) => (
              <button key={r} onClick={() => setRadius(r)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={radius === r
                  ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad", border: "1px solid rgba(62,207,173,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.06)" }
                }
              >
                {r / 1000}km
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

        {/* Search queries */}
        <div>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad" }}>3</span>
            Search Queries
          </h3>
          <div className="flex gap-2 mb-3">
            {QUERY_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => handleTemplateChange(t.id)}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={templateId === t.id
                  ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad", border: "1px solid rgba(62,207,173,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.06)" }
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <textarea
            value={customQueries}
            onChange={(e) => setCustomQueries(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          <p className="text-slate-600 text-[10px] mt-1.5">Comma-separated search terms. Each term runs as a separate Google Places query.</p>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

        {/* Submit */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {selectedCity && (
              <p className="text-slate-500 text-sm">
                Ready to discover businesses in <span className="text-white font-medium">{selectedCity.metro_name}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!selectedCity}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: selectedCity ? "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" : "rgba(62,207,173,0.2)", boxShadow: selectedCity ? "0 4px 14px rgba(62,207,173,0.25)" : "none" }}
          >
            <Icons.Play /> Start Pipeline
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// HISTORY PAGE
// ============================================================
const HistoryPage = ({ runs }) => {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = runs.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterCountry !== "all" && r.country !== filterCountry) return false;
    if (searchTerm && !r.metro_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Run History</h1>
        <p className="text-slate-500 text-sm mt-1">All pipeline runs across every metro</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 items-center">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><Icons.Search /></span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search metros..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(62,207,173,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
        </div>
        <div className="flex gap-1.5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {["all", "completed", "running", "failed"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={filterStatus === s
                ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad" }
                : { color: "#64748b" }
              }
            >{s}</button>
          ))}
        </div>
        <div className="flex gap-1.5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {[["all", "All"], ["US", "US"], ["CA", "CA"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilterCountry(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filterCountry === v
                ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad" }
                : { color: "#64748b" }
              }
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["Metro", "Status", "Discovered", "New", "Contacts", "Radius", "Queries", "Date", ""].map((h, i) => (
                <th key={i} className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((run) => (
              <tr key={run.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{run.metro_name}</p>
                  <p className="text-slate-600 text-[10px]">by {run.triggered_by}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.total_discovered ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.new_records ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.contacts_found ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{run.radius_meters / 1000}km</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{run.search_queries?.join(", ")}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-400">{formatDate(run.created_at)}</p>
                  <p className="text-[10px] text-slate-600">{formatTime(run.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  {(run.status === "completed" || run.status === "failed") && (
                    <button className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                      style={{ color: "#3ecfad", background: "rgba(62,207,173,0.08)" }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(62,207,173,0.15)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "rgba(62,207,173,0.08)"}
                    >
                      <Icons.Refresh /> Re-run
                    </button>
                  )}
                  {run.status === "failed" && run.errors && (
                    <p className="text-red-400/60 text-[10px] mt-1 max-w-[120px] truncate" title={run.errors.join(", ")}>{run.errors[0]}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600 text-sm">No runs match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// COVERAGE REPORTS PAGE
// ============================================================
const ReportsPage = ({ runs }) => {
  const completed = runs.filter(r => r.status === "completed");
  const [expandedCountries, setExpandedCountries] = useState({});
  const [expandedStates, setExpandedStates] = useState({});

  // Build hierarchy
  const hierarchy = {};
  completed.forEach(r => {
    if (!hierarchy[r.country]) hierarchy[r.country] = {};
    if (!hierarchy[r.country][r.state]) hierarchy[r.country][r.state] = {};
    if (!hierarchy[r.country][r.state][r.city]) hierarchy[r.country][r.state][r.city] = [];
    hierarchy[r.country][r.state][r.city].push(r);
  });

  const aggCity = (runs) => ({
    runs: runs.length,
    discovered: runs.reduce((s, r) => s + (r.total_discovered || 0), 0),
    contacts: runs.reduce((s, r) => s + (r.contacts_found || 0), 0),
    lastRun: runs.reduce((latest, r) => r.completed_at > (latest || "") ? r.completed_at : latest, null),
  });

  const aggState = (stateCities) => {
    const all = Object.values(stateCities).flat();
    return { cities: Object.keys(stateCities).length, ...aggCity(all) };
  };

  const aggCountry = (countryStates) => {
    const allCities = Object.values(countryStates).reduce((acc, stateCities) => {
      Object.values(stateCities).forEach(runs => acc.push(...runs));
      return acc;
    }, []);
    return {
      states: Object.keys(countryStates).length,
      cities: Object.values(countryStates).reduce((s, st) => s + Object.keys(st).length, 0),
      ...aggCity(allCities),
    };
  };

  const toggleCountry = (c) => setExpandedCountries(prev => ({ ...prev, [c]: !prev[c] }));
  const toggleState = (key) => setExpandedStates(prev => ({ ...prev, [key]: !prev[key] }));

  const countryLabels = { US: "United States", CA: "Canada" };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Coverage Report</h1>
        <p className="text-slate-500 text-sm mt-1">Pipeline coverage by geography</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Icons.Globe />} label="Countries" value={Object.keys(hierarchy).length} />
        <StatCard icon={<Icons.Chart />} label="States / Provinces" value={Object.values(hierarchy).reduce((s, c) => s + Object.keys(c).length, 0)} />
        <StatCard icon={<Icons.Building />} label="Cities Covered" value={Object.values(hierarchy).reduce((s, c) => Object.values(c).reduce((s2, st) => s2 + Object.keys(st).length, s), 0)} />
      </div>

      {/* Hierarchical table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["Location", "Cities", "Companies", "Contacts", "Runs", "Last Run"].map((h, i) => (
                <th key={i} className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(hierarchy).sort().map(([countryCode, countryStates]) => {
              const ca = aggCountry(countryStates);
              const isExpanded = expandedCountries[countryCode];
              return (
                <React.Fragment key={countryCode}>
                  {/* Country row */}
                  <tr className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onClick={() => toggleCountry(countryCode)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`transition-transform duration-200 text-slate-600 ${isExpanded ? "rotate-90" : ""}`}><Icons.ChevronRight /></span>
                        <span className="text-white text-sm font-semibold">{countryLabels[countryCode] || countryCode}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#64748b" }}>{countryCode}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{ca.cities}</td>
                    <td className="px-5 py-3.5 text-sm text-white font-semibold">{ca.discovered.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-sm text-white font-semibold">{ca.contacts.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">{ca.runs}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(ca.lastRun)}</td>
                  </tr>

                  {/* State rows */}
                  {isExpanded && Object.entries(countryStates).sort().map(([stateCode, stateCities]) => {
                    const sa = aggState(stateCities);
                    const stateKey = `${countryCode}-${stateCode}`;
                    const stateExpanded = expandedStates[stateKey];
                    const stateName = METROS[countryCode]?.[stateCode]?.name || stateCode;
                    return (
                      <React.Fragment key={stateKey}>
                        <tr className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.01)" }}
                          onClick={() => toggleState(stateKey)}>
                          <td className="px-5 py-3 pl-10">
                            <div className="flex items-center gap-2">
                              <span className={`transition-transform duration-200 text-slate-600 ${stateExpanded ? "rotate-90" : ""}`}><Icons.ChevronRight /></span>
                              <span className="text-slate-300 text-sm font-medium">{stateName}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b" }}>{stateCode}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-400">{sa.cities}</td>
                          <td className="px-5 py-3 text-sm text-slate-300">{sa.discovered.toLocaleString()}</td>
                          <td className="px-5 py-3 text-sm text-slate-300">{sa.contacts.toLocaleString()}</td>
                          <td className="px-5 py-3 text-sm text-slate-500">{sa.runs}</td>
                          <td className="px-5 py-3 text-sm text-slate-500">{formatDate(sa.lastRun)}</td>
                        </tr>

                        {/* City rows */}
                        {stateExpanded && Object.entries(stateCities).sort().map(([cityName, cityRuns]) => {
                          const ci = aggCity(cityRuns);
                          return (
                            <tr key={`${stateKey}-${cityName}`} className="transition-colors hover:bg-white/[0.02]"
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: "rgba(255,255,255,0.015)" }}>
                              <td className="px-5 py-2.5 pl-16">
                                <span className="text-slate-400 text-sm">{cityName}</span>
                              </td>
                              <td className="px-5 py-2.5 text-sm text-slate-600">—</td>
                              <td className="px-5 py-2.5 text-sm text-slate-400">{ci.discovered.toLocaleString()}</td>
                              <td className="px-5 py-2.5 text-sm text-slate-400">{ci.contacts.toLocaleString()}</td>
                              <td className="px-5 py-2.5 text-sm text-slate-500">{ci.runs}</td>
                              <td className="px-5 py-2.5 text-sm text-slate-600">{formatDate(ci.lastRun)}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [runs, setRuns] = useState(MOCK_RUNS);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <DashboardPage runs={runs} onNavigate={setCurrentPage} />;
      case "new-run": return <NewRunPage onNavigate={setCurrentPage} runs={runs} setRuns={setRuns} />;
      case "history": return <HistoryPage runs={runs} />;
      case "reports": return <ReportsPage runs={runs} />;
      default: return <DashboardPage runs={runs} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(145deg, #0a0f1a 0%, #111927 50%, #0d1520 100%)", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        select option { background: #151d2b; color: white; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
      `}</style>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={() => {}} />
      <main className="ml-60 p-8 min-h-screen">
        {renderPage()}
      </main>
    </div>
  );
}
