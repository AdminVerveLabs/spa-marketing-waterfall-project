import { useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { BugReport } from '@/types';

const PAGE_OPTIONS = ['Dashboard', 'New Run', 'History', 'Coverage', 'Other'] as const;
const SEVERITY_OPTIONS = ['broken', 'annoying', 'cosmetic'] as const;

interface BugReportFormProps {
  onSubmit: (bug: BugReport) => void;
}

export function BugReportForm({ onSubmit }: BugReportFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState('');
  const [severity, setSeverity] = useState<string>('');
  const [whatHappened, setWhatHappened] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page || !severity || !whatHappened.trim()) {
      toast.error('Please fill in the required fields');
      return;
    }

    setSubmitting(true);
    const row = {
      page,
      severity,
      what_happened: whatHappened.trim(),
      expected_behavior: expectedBehavior.trim() || null,
      steps_to_reproduce: stepsToReproduce.trim() || null,
      browser_info: navigator.userAgent,
      current_url: window.location.href,
      submitted_by: user?.email ?? null,
      status: 'open',
    };

    const { data, error } = await supabase
      .from('bug_reports')
      .insert(row)
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      toast.error(`Failed to submit bug report: ${error.message}`);
      return;
    }

    toast.success('Bug report submitted');
    setPage('');
    setSeverity('');
    setWhatHappened('');
    setExpectedBehavior('');
    setStepsToReproduce('');
    onSubmit(data as BugReport);
  };

  const selectStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e2e8f0',
  };

  const textareaStyle = {
    ...selectStyle,
    resize: 'vertical' as const,
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h2 className="text-white text-sm font-semibold mb-4">Report a Bug</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">Page *</label>
          <select
            value={page}
            onChange={e => setPage(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/40"
            style={selectStyle}
          >
            <option value="" disabled>Select page...</option>
            {PAGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">Severity *</label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/40"
            style={selectStyle}
          >
            <option value="" disabled>Select severity...</option>
            {SEVERITY_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">What happened? *</label>
        <textarea
          value={whatHappened}
          onChange={e => setWhatHappened(e.target.value)}
          rows={3}
          placeholder="Describe the bug..."
          className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-600"
          style={textareaStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">Expected behavior</label>
          <textarea
            value={expectedBehavior}
            onChange={e => setExpectedBehavior(e.target.value)}
            rows={2}
            placeholder="What should have happened?"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-600"
            style={textareaStyle}
          />
        </div>
        <div>
          <label className="block text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">Steps to reproduce</label>
          <textarea
            value={stepsToReproduce}
            onChange={e => setStepsToReproduce(e.target.value)}
            rows={2}
            placeholder="1. Go to... 2. Click..."
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-600"
            style={textareaStyle}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)' }}
      >
        <Send size={14} />
        {submitting ? 'Submitting...' : 'Submit Bug Report'}
      </button>
    </form>
  );
}
