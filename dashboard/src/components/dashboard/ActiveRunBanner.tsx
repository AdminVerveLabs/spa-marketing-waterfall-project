import { Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { PipelineRun } from '@/types';

interface ActiveRunBannerProps {
  run: PipelineRun;
}

export function ActiveRunBanner({ run }: ActiveRunBannerProps) {
  const hasBatchInfo = run.total_batches != null && run.total_batches > 0;
  const completedBatches = run.completed_batches || 0;
  const totalBatches = run.total_batches || 0;
  const progressPct = hasBatchInfo ? Math.round((completedBatches / totalBatches) * 100) : 0;

  return (
    <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
      <Loader2 size={14} className="animate-spin text-amber-400" />
      <div className="flex-1">
        <p className="text-amber-400 text-sm font-medium">
          Pipeline running: {run.metro_name}
        </p>
        <p className="text-amber-400/60 text-xs mt-0.5">
          {hasBatchInfo
            ? `Enrichment: ${completedBatches}/${totalBatches} batches (${progressPct}%)`
            : `Discovery phase`}
          {' \u2014 '}started {timeAgo(run.started_at || run.created_at)}
        </p>
      </div>
      {hasBatchInfo && (
        <div className="w-24 h-1.5 rounded-full bg-amber-400/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
