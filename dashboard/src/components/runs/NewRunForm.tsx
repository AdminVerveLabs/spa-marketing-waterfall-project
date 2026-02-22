import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Check, Search } from 'lucide-react';
import { METROS } from '@/data/metros';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MapPreview } from '@/components/runs/MapPreview';
import { timeAgo } from '@/lib/utils';
import type { MetroCity, SearchQueryTemplate, PipelineRun, MetroTableRow } from '@/types';

const MAX_QUERIES = 10;

function flattenMetros(): (MetroCity & { country: string; state: string })[] {
  const result: (MetroCity & { country: string; state: string })[] = [];
  for (const [country, states] of Object.entries(METROS)) {
    for (const [state, stateData] of Object.entries(states)) {
      for (const city of stateData.cities) {
        result.push({ ...city, country, state });
      }
    }
  }
  return result;
}

type StatusFilter = 'all' | 'never' | 'completed' | 'failed';
type CountryFilter = 'all' | 'US' | 'CA';
type SortKey = 'metro' | 'state' | 'lastRun';
type SortDir = 'asc' | 'desc';

interface NewRunFormProps {
  templates: SearchQueryTemplate[];
  onSubmit: (data: {
    country: string;
    state: string;
    city: string;
    metro_name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    search_queries: string[];
    yelp_location: string;
  }) => Promise<void>;
  initialData?: PipelineRun | null;
}

export function NewRunForm({ templates, onSubmit, initialData }: NewRunFormProps) {
  const navigate = useNavigate();

  // Selection
  const [selected, setSelected] = useState<MetroTableRow | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');

  // Sorting — default: Last Run desc (never-run first)
  const [sortKey, setSortKey] = useState<SortKey>('lastRun');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Run data from Supabase
  const [runMap, setRunMap] = useState<Map<string, {
    status: string;
    total_discovered: number | null;
    contacts_found: number | null;
    completed_at: string | null;
  }>>(new Map());

  // Form state
  const [radius, setRadius] = useState(10000);
  const [templateId, setTemplateId] = useState(templates.find(t => t.is_default)?.id || templates[0]?.id || '');
  const [customQueries, setCustomQueries] = useState(
    (templates.find(t => t.is_default) || templates[0])?.queries.join(', ') || ''
  );
  const [submitted, setSubmitted] = useState(false);
  const [submittedMetro, setSubmittedMetro] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch most recent run per metro
  useEffect(() => {
    supabase
      .from('pipeline_runs')
      .select('city, state, country, metro_name, status, total_discovered, contacts_found, completed_at')
      .in('status', ['completed', 'failed'])
      .order('completed_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, (typeof data)[0]>();
        for (const run of data) {
          const key = `${run.city}|${run.state}|${run.country}`;
          if (!map.has(key)) map.set(key, run);
        }
        setRunMap(map);
      });
  }, []);

  // Merge static metros + run data
  const allMetros: MetroTableRow[] = useMemo(() => {
    const flat = flattenMetros();
    return flat.map(m => {
      const key = `${m.city}|${m.state}|${m.country}`;
      const run = runMap.get(key);
      return {
        ...m,
        lastStatus: (run?.status as PipelineRun['status']) || null,
        totalDiscovered: run?.total_discovered ?? null,
        contactsFound: run?.contacts_found ?? null,
        completedAt: run?.completed_at || null,
      };
    });
  }, [runMap]);

  // Auto-select for rerun
  useEffect(() => {
    if (!initialData || allMetros.length === 0) return;
    const match = allMetros.find(m =>
      m.city === initialData.city && m.state === initialData.state && m.country === initialData.country
    );
    if (match) {
      setSelected(match);
      setRadius(initialData.radius_meters);
      if (initialData.search_queries?.length) {
        setCustomQueries(initialData.search_queries.join(', '));
        setTemplateId('');
      }
    }
  }, [initialData, allMetros]);

  // Filter counts (from full unfiltered list)
  const counts = useMemo(() => {
    let never = 0, completed = 0, failed = 0;
    for (const m of allMetros) {
      if (!m.lastStatus) never++;
      else if (m.lastStatus === 'completed') completed++;
      else if (m.lastStatus === 'failed') failed++;
    }
    return { all: allMetros.length, never, completed, failed };
  }, [allMetros]);

  // Apply filters + sorting
  const filteredMetros = useMemo(() => {
    let result = allMetros;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.city.toLowerCase().includes(q) || m.state.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'never') result = result.filter(m => !m.lastStatus);
    else if (statusFilter === 'completed') result = result.filter(m => m.lastStatus === 'completed');
    else if (statusFilter === 'failed') result = result.filter(m => m.lastStatus === 'failed');

    if (countryFilter !== 'all') result = result.filter(m => m.country === countryFilter);

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'metro') return dir * a.city.localeCompare(b.city);
      if (sortKey === 'state') return dir * a.state.localeCompare(b.state);
      if (sortKey === 'lastRun') {
        if (!a.completedAt && !b.completedAt) return a.city.localeCompare(b.city);
        if (!a.completedAt) return -dir;
        if (!b.completedAt) return dir;
        return dir * (new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      }
      return 0;
    });

    return result;
  }, [allMetros, search, statusFilter, countryFilter, sortKey, sortDir]);

  const queryCount = customQueries.split(',').map(q => q.trim()).filter(Boolean).length;
  const queryLimitExceeded = queryCount > MAX_QUERIES;

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = templates.find(t => t.id === id);
    if (t) setCustomQueries(t.queries.join(', '));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'lastRun' ? 'desc' : 'asc');
    }
  };

  const handleRowClick = (metro: MetroTableRow) => {
    setSelected(prev =>
      prev && prev.city === metro.city && prev.state === metro.state && prev.country === metro.country
        ? null
        : metro
    );
  };

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        country: selected.country,
        state: selected.state,
        city: selected.city,
        metro_name: selected.metro_name,
        latitude: selected.lat,
        longitude: selected.lng,
        radius_meters: radius,
        search_queries: customQueries.split(',').map(q => q.trim()).filter(Boolean),
        yelp_location: selected.yelp_location,
      });
      setSubmittedMetro(selected.metro_name);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const isSelected = (m: MetroTableRow) =>
    selected?.city === m.city && selected?.state === m.state && selected?.country === m.country;

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-brand">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(62,207,173,0.1)" }}>
          <Check size={28} className="text-brand" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2 font-sans">Run queued</h2>
        <p className="text-slate-400 text-sm mb-1">{submittedMetro}</p>
        <p className="text-slate-600 text-sm mb-8">The pipeline run has been queued. Check back in ~15-30 minutes for results.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: "0 4px 14px rgba(62,207,173,0.25)" }}
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => { setSubmitted(false); setSelected(null); }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Start Another
          </button>
        </div>
      </div>
    );
  }

  const disabledSection = !selected;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight font-sans">New Pipeline Run</h1>
        <p className="text-slate-500 text-sm mt-1">Configure and launch a discovery + enrichment pipeline for a metro area</p>
      </div>

      {initialData && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(62,207,173,0.08)", border: "1px solid rgba(62,207,173,0.15)", color: "#3ecfad" }}>
          Re-running: {initialData.metro_name}
        </div>
      )}

      <div className="rounded-2xl p-6 space-y-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Step 1: Location — Metro Table + Map */}
        <div>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2 font-sans">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-brand/15 text-brand">1</span>
            Location
            {selected && (
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(62,207,173,0.15)", color: "#3ecfad" }}>
                {selected.city}, {selected.state}
              </span>
            )}
          </h3>

          {/* Search + Filters */}
          <div className="space-y-3 mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search city or state..."
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white outline-none placeholder:text-slate-600"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'never', 'completed', 'failed'] as StatusFilter[]).map(f => {
                const labels: Record<StatusFilter, string> = { all: 'All', never: 'Never Run', completed: 'Completed', failed: 'Failed' };
                const count = counts[f];
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={statusFilter === f
                      ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad", border: "1px solid rgba(62,207,173,0.3)" }
                      : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    {labels[f]} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}

              <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

              {(['all', 'US', 'CA'] as CountryFilter[]).map(f => (
                <button
                  key={`country-${f}`}
                  onClick={() => setCountryFilter(f)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                  style={countryFilter === f
                    ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad", border: "1px solid rgba(62,207,173,0.3)" }
                    : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid rgba(255,255,255,0.06)" }
                  }
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Table */}
            <div className="flex-[3] min-w-0">
              {/* Metro Table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                {/* Header */}
                <div
                  className="grid text-[10px] uppercase tracking-wider font-medium text-slate-600 px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", gridTemplateColumns: "1.4fr 0.5fr 1fr 0.7fr 0.7fr 0.9fr" }}
                >
                  <button onClick={() => handleSort('metro')} className="text-left hover:text-slate-400 transition-colors flex items-center">
                    Metro{sortIndicator('metro')}
                  </button>
                  <button onClick={() => handleSort('state')} className="text-left hover:text-slate-400 transition-colors flex items-center">
                    State{sortIndicator('state')}
                  </button>
                  <span>Status</span>
                  <span className="text-right">Companies</span>
                  <span className="text-right">Contacts</span>
                  <button onClick={() => handleSort('lastRun')} className="text-right hover:text-slate-400 transition-colors flex items-center justify-end">
                    Last Run{sortIndicator('lastRun')}
                  </button>
                </div>

                {/* Body */}
                <div className="metro-table-scroll overflow-y-auto" style={{ maxHeight: '340px' }}>
                  {filteredMetros.map(m => {
                    const sel = isSelected(m);
                    return (
                      <div
                        key={`${m.city}|${m.state}|${m.country}`}
                        onClick={() => handleRowClick(m)}
                        className="grid px-3 py-2 text-sm cursor-pointer transition-colors"
                        style={{
                          gridTemplateColumns: "1.4fr 0.5fr 1fr 0.7fr 0.7fr 0.9fr",
                          background: sel ? "rgba(62,207,173,0.08)" : undefined,
                          borderLeft: sel ? "2px solid #3ecfad" : "2px solid transparent",
                        }}
                        onMouseEnter={e => { if (!sel) (e.currentTarget.style.background = "rgba(255,255,255,0.03)"); }}
                        onMouseLeave={e => { if (!sel) (e.currentTarget.style.background = ""); }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`truncate ${sel ? "text-white font-medium" : "text-slate-300"}`}>{m.city}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                            style={{
                              background: m.country === 'CA' ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
                              color: m.country === 'CA' ? "#f87171" : "#60a5fa",
                            }}
                          >
                            {m.country}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs flex items-center">{m.state}</span>
                        <div className="flex items-center">
                          {m.lastStatus ? <StatusBadge status={m.lastStatus} /> : <span className="text-slate-700 text-xs">&mdash;</span>}
                        </div>
                        <span className="text-right text-slate-400 text-xs flex items-center justify-end">
                          {m.totalDiscovered != null ? m.totalDiscovered.toLocaleString() : <span className="text-slate-700">&mdash;</span>}
                        </span>
                        <span className="text-right text-slate-400 text-xs flex items-center justify-end">
                          {m.contactsFound != null ? m.contactsFound.toLocaleString() : <span className="text-slate-700">&mdash;</span>}
                        </span>
                        <span
                          className="text-right text-xs flex items-center justify-end"
                          style={{ color: m.completedAt ? "#94a3b8" : "#3ecfad" }}
                        >
                          {m.completedAt ? timeAgo(m.completedAt) : 'Never'}
                        </span>
                      </div>
                    );
                  })}
                  {filteredMetros.length === 0 && (
                    <div className="px-3 py-8 text-center text-slate-600 text-sm">No metros match your filters</div>
                  )}
                </div>
              </div>

              <p className="text-slate-600 text-[10px] mt-2">
                {filteredMetros.length} metros shown &middot; Click a row to select
              </p>
            </div>

            {/* Right: Map Preview */}
            <div className="flex-[2]">
              <MapPreview lat={selected?.lat} lng={selected?.lng} radius={radius} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

        {/* Step 2: Search Radius */}
        <div style={{ opacity: disabledSection ? 0.4 : 1, pointerEvents: disabledSection ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2 font-sans">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-brand/15 text-brand">2</span>
            Search Radius
          </h3>
          <div className="flex gap-2">
            {[5000, 10000, 15000, 25000].map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
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

        {/* Step 3: Search Queries */}
        <div style={{ opacity: disabledSection ? 0.4 : 1, pointerEvents: disabledSection ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2 font-sans">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-brand/15 text-brand">3</span>
            Search Queries
          </h3>
          <div className="flex gap-2 mb-3 flex-wrap">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTemplateChange(t.id)}
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
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none focus:border-brand/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <p className="text-slate-600 text-[10px] mt-1.5">Comma-separated search terms. Each term runs as a separate Google Places query.</p>
          {queryLimitExceeded && (
            <p className="text-red-400 text-xs mt-1.5">Too many queries ({queryCount}). Maximum is {MAX_QUERIES}.</p>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />

        {/* Submit */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {selected && (
              <div>
                <p className="text-slate-500 text-sm">
                  Ready to discover businesses in <span className="text-white font-medium">{selected.city}, {selected.state}</span>
                </p>
                {selected.completedAt && (
                  <p className="text-slate-600 text-xs mt-0.5">Last run {timeAgo(selected.completedAt)}</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!selected || submitting || queryLimitExceeded}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: selected && !submitting && !queryLimitExceeded ? "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" : "rgba(62,207,173,0.2)",
              boxShadow: selected && !submitting && !queryLimitExceeded ? "0 4px 14px rgba(62,207,173,0.25)" : "none",
            }}
          >
            <Play size={16} /> {submitting ? 'Starting...' : 'Start Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}
