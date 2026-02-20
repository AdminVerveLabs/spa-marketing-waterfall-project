import { useState } from 'react';
import { ChevronRight, RefreshCw, Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import { downloadRunReport } from '@/lib/export';
import type { PipelineRun } from '@/types';

interface RecentRunsTableProps {
  runs: PipelineRun[];
  onRerun: (run: PipelineRun) => void;
}

export function RecentRunsTable({ runs, onRerun }: RecentRunsTableProps) {
  const navigate = useNavigate();
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

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <h2 className="text-white text-sm font-semibold font-sans">Recent Runs</h2>
        <button
          onClick={() => navigate("/runs")}
          className="text-xs font-medium flex items-center gap-1 transition-colors text-brand hover:text-brand/80"
        >
          View all <ChevronRight size={14} />
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
              <td className="px-5 py-3.5 text-sm text-slate-400">{run.total_discovered ?? "\u2014"}</td>
              <td className="px-5 py-3.5 text-sm text-slate-400">{run.contacts_found ?? "\u2014"}</td>
              <td className="px-5 py-3.5">
                <p className="text-sm text-slate-400">{formatDate(run.created_at)}</p>
                <p className="text-[10px] text-slate-600">{formatTime(run.created_at)}</p>
              </td>
              <td className="px-5 py-3.5 text-right">
                {(run.status === "completed" || run.status === "failed") && (
                  <div className="flex items-center gap-1.5 justify-end">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
