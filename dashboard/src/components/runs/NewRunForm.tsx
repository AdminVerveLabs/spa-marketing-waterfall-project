import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Check, ChevronDown } from 'lucide-react';
import { METROS } from '@/data/metros';
import type { SearchQueryTemplate, PipelineRun } from '@/types';

const MAX_QUERIES = 10;

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
  const [country, setCountry] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [radius, setRadius] = useState(10000);
  const [templateId, setTemplateId] = useState(templates.find(t => t.is_default)?.id || templates[0]?.id || "");
  const [customQueries, setCustomQueries] = useState(
    (templates.find(t => t.is_default) || templates[0])?.queries.join(", ") || ""
  );
  const [submitted, setSubmitted] = useState(false);
  const [submittedMetro, setSubmittedMetro] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setCountry(initialData.country);
    setStateCode(initialData.state);
    setCityName(initialData.city);
    setRadius(initialData.radius_meters);
    if (initialData.search_queries?.length) {
      setCustomQueries(initialData.search_queries.join(", "));
      setTemplateId("");
    }
  }, [initialData]);

  const queryCount = customQueries.split(",").map(q => q.trim()).filter(Boolean).length;
  const queryLimitExceeded = queryCount > MAX_QUERIES;

  const states = country
    ? Object.entries(METROS[country] || {})
        .map(([code, data]) => ({ code, name: data.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const cities = (country && stateCode) ? (METROS[country]?.[stateCode]?.cities || []) : [];
  const selectedCity = cities.find(c => c.city === cityName);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = templates.find(t => t.id === id);
    if (t) setCustomQueries(t.queries.join(", "));
  };

  const handleSubmit = async () => {
    if (!selectedCity || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        country,
        state: stateCode,
        city: cityName,
        metro_name: selectedCity.metro_name,
        latitude: selectedCity.lat,
        longitude: selectedCity.lng,
        radius_meters: radius,
        search_queries: customQueries.split(",").map(q => q.trim()).filter(Boolean),
        yelp_location: selectedCity.yelp_location,
      });
      setSubmittedMetro(selectedCity.metro_name);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "white",
    appearance: "none",
    WebkitAppearance: "none",
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
            onClick={() => navigate("/")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: "0 4px 14px rgba(62,207,173,0.25)" }}
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => { setSubmitted(false); setCountry(""); setStateCode(""); setCityName(""); }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Start Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
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
        {/* Location section */}
        <div>
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2 font-sans">
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-brand/15 text-brand">1</span>
            Location
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">Country</label>
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setStateCode(""); setCityName(""); }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10 focus:border-brand/40"
                  style={selectStyle}
                >
                  <option value="">Select...</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><ChevronDown size={16} /></div>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">
                {country === "CA" ? "Province" : "State"}
              </label>
              <div className="relative">
                <select
                  value={stateCode}
                  onChange={(e) => { setStateCode(e.target.value); setCityName(""); }}
                  disabled={!country}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10 disabled:opacity-40 disabled:cursor-not-allowed focus:border-brand/40"
                  style={selectStyle}
                >
                  <option value="">Select...</option>
                  {states.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><ChevronDown size={16} /></div>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">City</label>
              <div className="relative">
                <select
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  disabled={!stateCode}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer pr-10 disabled:opacity-40 disabled:cursor-not-allowed focus:border-brand/40"
                  style={selectStyle}
                >
                  <option value="">Select...</option>
                  {cities.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><ChevronDown size={16} /></div>
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

        {/* Search queries */}
        <div>
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
            {selectedCity && (
              <p className="text-slate-500 text-sm">
                Ready to discover businesses in <span className="text-white font-medium">{selectedCity.metro_name}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!selectedCity || submitting || queryLimitExceeded}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: selectedCity && !submitting && !queryLimitExceeded ? "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)" : "rgba(62,207,173,0.2)",
              boxShadow: selectedCity && !submitting && !queryLimitExceeded ? "0 4px 14px rgba(62,207,173,0.25)" : "none",
            }}
          >
            <Play size={16} /> {submitting ? "Starting..." : "Start Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
