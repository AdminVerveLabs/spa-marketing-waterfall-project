import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, BarChart3, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/dashboard/StatCard';
import { CoverageTable } from '@/components/reports/CoverageTable';
import type { RunCoverageStats } from '@/types';

export function ReportsPage() {
  const [stats, setStats] = useState<RunCoverageStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('run_coverage_stats')
      .select('*')
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load coverage data: ${error.message}`);
        setStats((data as RunCoverageStats[]) || []);
        setLoading(false);
      });
  }, []);

  const countries = new Set(stats.map(s => s.country)).size;
  const statesCount = new Set(stats.map(s => `${s.country}-${s.state}`)).size;
  const cities = stats.length;

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight font-sans">Coverage Report</h1>
        <p className="text-slate-500 text-sm mt-1">Pipeline coverage by geography</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Globe size={20} />} label="Countries" value={countries} />
        <StatCard icon={<BarChart3 size={20} />} label="States / Provinces" value={statesCount} />
        <StatCard icon={<Building2 size={20} />} label="Cities Covered" value={cities} />
      </div>

      <CoverageTable stats={stats} />
    </div>
  );
}
