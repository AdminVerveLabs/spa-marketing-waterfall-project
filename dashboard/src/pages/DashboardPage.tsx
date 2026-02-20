import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Globe, Building2, Users, Zap, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActiveRunBanner } from '@/components/dashboard/ActiveRunBanner';
import { RecentRunsTable } from '@/components/dashboard/RecentRunsTable';
import type { PipelineRun } from '@/types';

export function DashboardPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRuns = async () => {
    const { data, error } = await supabase
      .from('pipeline_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) toast.error(`Failed to load runs: ${error.message}`);
    setRuns((data as PipelineRun[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRuns(); }, []);

  const completed = runs.filter(r => r.status === "completed");
  const metrosRun = new Set(completed.map(r => r.metro_name)).size;
  const totalDiscovered = completed.reduce((s, r) => s + (r.total_discovered || 0), 0);
  const totalContacts = completed.reduce((s, r) => s + (r.contacts_found || 0), 0);
  const now = new Date();
  const thisMonth = runs.filter(r => {
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const activeRun = runs.find(r => r.status === "running");

  const handleRerun = (run: PipelineRun) => {
    navigate(`/runs/new?rerun=${run.id}`);
  };

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-sans">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Pipeline overview and recent activity</p>
        </div>
        <button
          onClick={() => navigate("/runs/new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_6px_20px_rgba(62,207,173,0.35)]"
          style={{ background: "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)", boxShadow: "0 4px 14px rgba(62,207,173,0.25)" }}
        >
          <Play size={16} /> New Run
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Globe size={20} />} label="Metros Covered" value={metrosRun} sub={`${completed.length} total runs`} />
        <StatCard icon={<Building2 size={20} />} label="Companies Found" value={totalDiscovered.toLocaleString()} sub="Across all metros" />
        <StatCard icon={<Users size={20} />} label="Contacts Found" value={totalContacts.toLocaleString()} sub="Owners & practitioners" />
        <StatCard icon={<Zap size={20} />} label="Runs This Month" value={thisMonth} sub={monthLabel} />
      </div>

      {activeRun && <ActiveRunBanner run={activeRun} />}

      <RecentRunsTable runs={runs} onRerun={handleRerun} />
    </div>
  );
}
