import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { RunHistoryTable } from '@/components/runs/RunHistoryTable';
import type { PipelineRun } from '@/types';

export function HistoryPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('pipeline_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load runs: ${error.message}`);
        setRuns((data as PipelineRun[]) || []);
        setLoading(false);
      });
  }, []);

  const handleRerun = (run: PipelineRun) => {
    navigate(`/runs/new?rerun=${run.id}`);
  };

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight font-sans">Run History</h1>
        <p className="text-slate-500 text-sm mt-1">All pipeline runs across every metro</p>
      </div>
      <RunHistoryTable runs={runs} onRerun={handleRerun} />
    </div>
  );
}
