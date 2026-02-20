import { Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { PipelineRun } from '@/types';

interface ActiveRunBannerProps {
  run: PipelineRun;
}

export function ActiveRunBanner({ run }: ActiveRunBannerProps) {
  return (
    <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
      <Loader2 size={14} className="animate-spin text-amber-400" />
      <div className="flex-1">
        <p className="text-amber-400 text-sm font-medium">
          Pipeline running: {run.metro_name}
        </p>
        <p className="text-amber-400/60 text-xs mt-0.5">
          Started {timeAgo(run.created_at)} — check back in ~15-30 min
        </p>
      </div>
    </div>
  );
}
