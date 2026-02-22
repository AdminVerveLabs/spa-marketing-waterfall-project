import { useState, useMemo } from "react";

const METROS = [
  { city: "Austin", state: "TX", country: "US", lastRun: "2026-02-19T14:30:00Z", lastStatus: "completed", discovered: 63, contacts: 38 },
  { city: "Houston", state: "TX", country: "US", lastRun: "2026-02-18T09:15:00Z", lastStatus: "completed", discovered: 142, contacts: 67 },
  { city: "Dallas", state: "TX", country: "US", lastRun: "2026-01-15T11:00:00Z", lastStatus: "completed", discovered: 98, contacts: 41 },
  { city: "San Antonio", state: "TX", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Fort Worth", state: "TX", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Denver", state: "CO", country: "US", lastRun: "2026-02-20T08:00:00Z", lastStatus: "completed", discovered: 87, contacts: 52 },
  { city: "Colorado Springs", state: "CO", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Phoenix", state: "AZ", country: "US", lastRun: "2026-02-20T10:45:00Z", lastStatus: "failed", discovered: 45, contacts: 12 },
  { city: "Scottsdale", state: "AZ", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Tucson", state: "AZ", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Los Angeles", state: "CA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "San Francisco", state: "CA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "San Diego", state: "CA", country: "US", lastRun: "2026-02-19T16:20:00Z", lastStatus: "completed", discovered: 110, contacts: 58 },
  { city: "San Jose", state: "CA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Sacramento", state: "CA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "New York City", state: "NY", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Miami", state: "FL", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Orlando", state: "FL", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Tampa", state: "FL", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Chicago", state: "IL", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Seattle", state: "WA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Portland", state: "OR", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Atlanta", state: "GA", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Nashville", state: "TN", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Las Vegas", state: "NV", country: "US", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Toronto", state: "ON", country: "CA", lastRun: "2026-02-17T12:00:00Z", lastStatus: "completed", discovered: 95, contacts: 44 },
  { city: "Vancouver", state: "BC", country: "CA", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Calgary", state: "AB", country: "CA", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Edmonton", state: "AB", country: "CA", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Montreal", state: "QC", country: "CA", lastRun: null, lastStatus: null, discovered: null, contacts: null },
  { city: "Ottawa", state: "ON", country: "CA", lastRun: null, lastStatus: null, discovered: null, contacts: null },
];

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const now = new Date("2026-02-21T17:00:00Z");
  const d = new Date(dateStr);
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

function StatusBadge({ status }) {
  if (!status) return <span style={{ color: "#6b7280", fontSize: 13 }}>—</span>;
  const colors = {
    completed: { bg: "rgba(52,211,153,0.15)", text: "#34d399", label: "Completed" },
    failed: { bg: "rgba(248,113,113,0.15)", text: "#f87171", label: "Failed" },
    running: { bg: "rgba(251,191,36,0.15)", text: "#fbbf24", label: "Running" },
  };
  const c = colors[status] || colors.completed;
  return (
    <span style={{
      background: c.bg, color: c.text, fontSize: 12, fontWeight: 600,
      padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap"
    }}>{c.label}</span>
  );
}

const TEMPLATES = [
  { name: "Default Massage/Spa", queries: "massage therapy, massage clinic, RMT, spa massage, massage therapist" },
  { name: "Spa Focus", queries: "day spa, med spa, wellness spa, beauty spa" },
  { name: "Wellness Broad", queries: "wellness center, holistic healing, bodywork, therapeutic massage" },
];

export default function NewRunPrototype() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, never, completed, failed, stale
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("lastRun"); // city, state, lastRun
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [radius, setRadius] = useState(10000);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [queries, setQueries] = useState(TEMPLATES[0].queries);
  const [submitted, setSubmitted] = useState(false);

  const filtered = useMemo(() => {
    let result = [...METROS];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m =>
        m.city.toLowerCase().includes(s) ||
        m.state.toLowerCase().includes(s) ||
        `${m.city}, ${m.state}`.toLowerCase().includes(s)
      );
    }
    if (countryFilter !== "all") result = result.filter(m => m.country === countryFilter);
    if (filter === "never") result = result.filter(m => !m.lastRun);
    else if (filter === "completed") result = result.filter(m => m.lastStatus === "completed");
    else if (filter === "failed") result = result.filter(m => m.lastStatus === "failed");
    else if (filter === "stale") {
      const thirtyDaysAgo = new Date("2026-01-22T00:00:00Z");
      result = result.filter(m => m.lastRun && new Date(m.lastRun) < thirtyDaysAgo);
    }
    result.sort((a, b) => {
      if (sortBy === "city") return sortDir === "asc" ? a.city.localeCompare(b.city) : b.city.localeCompare(a.city);
      if (sortBy === "state") return sortDir === "asc" ? a.state.localeCompare(b.state) : b.state.localeCompare(a.state);
      if (sortBy === "lastRun") {
        if (!a.lastRun && !b.lastRun) return 0;
        if (!a.lastRun) return sortDir === "asc" ? -1 : 1;
        if (!b.lastRun) return sortDir === "asc" ? 1 : -1;
        return sortDir === "asc"
          ? new Date(a.lastRun) - new Date(b.lastRun)
          : new Date(b.lastRun) - new Date(a.lastRun);
      }
      return 0;
    });
    return result;
  }, [search, filter, countryFilter, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4, color: "#3ecfad" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const neverRun = METROS.filter(m => !m.lastRun).length;
  const completedRuns = METROS.filter(m => m.lastStatus === "completed").length;
  const failedRuns = METROS.filter(m => m.lastStatus === "failed").length;

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0f1a 0%, #111927 100%)", color: "#fff", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 440, padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(62,207,173,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#3ecfad" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Run Queued</h2>
          <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 6 }}>{selected.city}, {selected.state}</p>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 28 }}>The pipeline will start automatically. Check back in ~15–30 minutes for results.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { setSubmitted(false); setSelected(null); }} style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, cursor: "pointer" }}>Start Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0f1a 0%, #111927 100%)", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>New Pipeline Run</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28 }}>Select a metro area, configure search parameters, and launch</p>

        {/* Step 1: Select Metro */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>1</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Select Metro</span>
            {selected && (
              <span style={{ marginLeft: "auto", background: "rgba(62,207,173,0.12)", color: "#3ecfad", padding: "4px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                {selected.city}, {selected.state}
              </span>
            )}
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search city or state..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none" }}
            />
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3 }}>
              {[
                { key: "all", label: "All", count: METROS.length },
                { key: "never", label: "Never Run", count: neverRun },
                { key: "completed", label: "Completed", count: completedRuns },
                { key: "failed", label: "Failed", count: failedRuns },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                    background: filter === f.key ? "rgba(62,207,173,0.15)" : "transparent",
                    color: filter === f.key ? "#3ecfad" : "#94a3b8",
                    transition: "all 0.15s"
                  }}
                >{f.label} ({f.count})</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3 }}>
              {[{ key: "all", label: "All" }, { key: "US", label: "US" }, { key: "CA", label: "CA" }].map(c => (
                <button
                  key={c.key}
                  onClick={() => setCountryFilter(c.key)}
                  style={{
                    padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                    background: countryFilter === c.key ? "rgba(62,207,173,0.15)" : "transparent",
                    color: countryFilter === c.key ? "#3ecfad" : "#94a3b8",
                  }}
                >{c.label}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <style>{`
            .metro-table-scroll::-webkit-scrollbar { width: 6px; }
            .metro-table-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 3px; }
            .metro-table-scroll::-webkit-scrollbar-thumb { background: rgba(62,207,173,0.25); border-radius: 3px; }
            .metro-table-scroll::-webkit-scrollbar-thumb:hover { background: rgba(62,207,173,0.45); }
            .metro-table-scroll { scrollbar-width: thin; scrollbar-color: rgba(62,207,173,0.25) rgba(255,255,255,0.02); }
          `}</style>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="metro-table-scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", position: "sticky", top: 0, zIndex: 1 }}>
                    <th onClick={() => handleSort("city")} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, cursor: "pointer", userSelect: "none", fontSize: 12, letterSpacing: "0.03em" }}>
                      METRO <SortIcon col="city" />
                    </th>
                    <th onClick={() => handleSort("state")} style={{ textAlign: "left", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, cursor: "pointer", userSelect: "none", fontSize: 12 }}>
                      STATE <SortIcon col="state" />
                    </th>
                    <th style={{ textAlign: "center", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, fontSize: 12 }}>STATUS</th>
                    <th style={{ textAlign: "right", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, fontSize: 12 }}>FOUND</th>
                    <th style={{ textAlign: "right", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, fontSize: 12 }}>CONTACTS</th>
                    <th onClick={() => handleSort("lastRun")} style={{ textAlign: "right", padding: "10px 14px", color: "#94a3b8", fontWeight: 600, cursor: "pointer", userSelect: "none", fontSize: 12 }}>
                      LAST RUN <SortIcon col="lastRun" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const isSelected = selected && selected.city === m.city && selected.state === m.state;
                    return (
                      <tr
                        key={`${m.city}-${m.state}`}
                        onClick={() => setSelected(m)}
                        style={{
                          cursor: "pointer",
                          background: isSelected ? "rgba(62,207,173,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                          borderLeft: isSelected ? "3px solid #3ecfad" : "3px solid transparent",
                          transition: "all 0.1s"
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                          {m.city}
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>{m.country}</span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{m.state}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}><StatusBadge status={m.lastStatus} /></td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: m.discovered ? "#e2e8f0" : "#4b5563", fontVariantNumeric: "tabular-nums" }}>{m.discovered ?? "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: m.contacts ? "#e2e8f0" : "#4b5563", fontVariantNumeric: "tabular-nums" }}>{m.contacts ?? "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          {m.lastRun ? (
                            <span style={{ color: "#94a3b8" }}>{timeAgo(m.lastRun)}</span>
                          ) : (
                            <span style={{ color: "#3ecfad", fontSize: 12, fontWeight: 500 }}>Never</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>No metros match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            {filtered.length} metro{filtered.length !== 1 ? "s" : ""} shown · Click a row to select
          </p>
        </div>

        {/* Step 2: Search Radius */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24, marginBottom: 20,
          opacity: selected ? 1 : 0.4, pointerEvents: selected ? "auto" : "none", transition: "opacity 0.2s"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>2</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Search Radius</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "5km", value: 5000 }, { label: "10km", value: 10000 }, { label: "15km", value: 15000 }, { label: "25km", value: 25000 }].map(r => (
              <button
                key={r.value}
                onClick={() => setRadius(r.value)}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid",
                  borderColor: radius === r.value ? "#3ecfad" : "rgba(255,255,255,0.1)",
                  background: radius === r.value ? "rgba(62,207,173,0.12)" : "rgba(255,255,255,0.03)",
                  color: radius === r.value ? "#3ecfad" : "#94a3b8",
                  fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.15s"
                }}
              >{r.label}</button>
            ))}
          </div>
        </div>

        {/* Step 3: Search Queries */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24, marginBottom: 24,
          opacity: selected ? 1 : 0.4, pointerEvents: selected ? "auto" : "none", transition: "opacity 0.2s"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>3</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Search Queries</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                onClick={() => { setSelectedTemplate(i); setQueries(t.queries); }}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid",
                  borderColor: selectedTemplate === i ? "#3ecfad" : "rgba(255,255,255,0.1)",
                  background: selectedTemplate === i ? "rgba(62,207,173,0.12)" : "rgba(255,255,255,0.03)",
                  color: selectedTemplate === i ? "#3ecfad" : "#94a3b8",
                  fontSize: 13, cursor: "pointer"
                }}
              >{t.name}</button>
            ))}
          </div>
          <textarea
            value={queries}
            onChange={e => setQueries(e.target.value)}
            rows={3}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              resize: "vertical", outline: "none", boxSizing: "border-box"
            }}
          />
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>Comma-separated search terms. Each term runs as a separate Google Places query.</p>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {selected && (
              <span style={{ color: "#94a3b8", fontSize: 14 }}>
                Ready to discover businesses in <strong style={{ color: "#fff" }}>{selected.city}, {selected.state}</strong>
                {selected.lastRun && <span style={{ color: "#64748b" }}> · Last run {timeAgo(selected.lastRun)}</span>}
              </span>
            )}
          </div>
          <button
            onClick={() => selected && setSubmitted(true)}
            disabled={!selected}
            style={{
              padding: "12px 28px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 600, cursor: selected ? "pointer" : "default",
              background: selected ? "linear-gradient(135deg, #3ecfad, #2ba88d)" : "rgba(255,255,255,0.06)",
              color: selected ? "#fff" : "#4b5563",
              boxShadow: selected ? "0 0 20px rgba(62,207,173,0.25)" : "none",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
            Start Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}
