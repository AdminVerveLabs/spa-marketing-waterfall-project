import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { BugReportForm } from '@/components/bugs/BugReportForm';
import { BugReportTable } from '@/components/bugs/BugReportTable';
import type { BugReport } from '@/types';

export function BugReportsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(`Failed to load bug reports: ${error.message}`);
        setBugs((data as BugReport[]) || []);
        setLoading(false);
      });
  }, []);

  const handleSubmit = (newBug: BugReport) => {
    setBugs(prev => [newBug, ...prev]);
  };

  const handleStatusChange = async (id: string, status: BugReport['status']) => {
    const { error } = await supabase
      .from('bug_reports')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    setBugs(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight font-sans">Bug Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Submit and track bugs found in the dashboard</p>
      </div>
      <BugReportForm onSubmit={handleSubmit} />
      <BugReportTable bugs={bugs} onStatusChange={handleStatusChange} />
    </div>
  );
}
