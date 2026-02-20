import { Check, Loader2, X } from 'lucide-react';
import type { PipelineRun } from '@/types';

const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  completed: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: <Check size={14} />, label: "Completed" },
  running: { bg: "bg-amber-500/15", text: "text-amber-400", icon: <Loader2 size={14} className="animate-spin" />, label: "Running" },
  failed: { bg: "bg-red-500/15", text: "text-red-400", icon: <X size={14} />, label: "Failed" },
  queued: { bg: "bg-slate-500/15", text: "text-slate-400", icon: <Loader2 size={14} className="animate-spin" />, label: "Queued" },
  cancelled: { bg: "bg-slate-500/15", text: "text-slate-400", icon: <X size={14} />, label: "Cancelled" },
};

export function StatusBadge({ status }: { status: PipelineRun['status'] }) {
  const c = config[status] || config.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}
