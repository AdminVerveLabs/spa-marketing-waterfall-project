import { useState } from 'react';
import { Search, RefreshCw, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import { downloadRunReport } from '@/lib/export';
import type { PipelineRun } from '@/types';

interface RunHistoryTableProps {
  runs: PipelineRun[];
  onRerun: (run: PipelineRun) => void;
}

export function RunHistoryTable({ runs, onRerun }: RunHistoryTableProps) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(run: PipelineRun) {
    setDownloadingId(run.id);
    try {
      await downloadRunReport(run.metro_name);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = runs.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterCountry !== "all" && r.country !== filterCountry) return false;
    if (searchTerm && !r.metro_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {/* Filters */}
      <div className="flex gap-3 mb-5 items-center">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><Search size={15} /></span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search metros..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-brand/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>
        <div className="flex gap-1.5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {["all", "completed", "running", "failed", "queued"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={filterStatus === s
                ? { background: "rgba(62,207,173,0.15)", color: "#3ecfad" }
                : { color: "#64748b" }
              }
            >{s}</button>
          ))}
        </div>
        <div className="flex gap-1.5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          {([["all", "All"], ["US", "US"], ["CA", "CA"]] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterCountry(v)}
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
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.total_discovered ?? "\u2014"}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.new_records ?? "\u2014"}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{run.contacts_found ?? "\u2014"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{run.radius_meters / 1000}km</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{run.search_queries?.join(", ")}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-400">{formatDate(run.created_at)}</p>
                  <p className="text-[10px] text-slate-600">{formatTime(run.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  {(run.status === "completed" || run.status === "failed") && (
                    <div className="flex items-center gap-1.5">
                      {run.status === "completed" && (
                        <button
                          onClick={() => handleDownload(run)}
                          disabled={downloadingId === run.id}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-brand bg-brand/[0.08] hover:bg-brand/15 disabled:opacity-50"
                        >
                          {downloadingId === run.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download
                        </button>
                      )}
                      <button
                        onClick={() => onRerun(run)}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-brand bg-brand/[0.08] hover:bg-brand/15"
                      >
                        <RefreshCw size={14} /> Re-run
                      </button>
                    </div>
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
    </>
  );
}
