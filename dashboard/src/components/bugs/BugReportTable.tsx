import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import type { BugReport } from '@/types';

interface BugReportTableProps {
  bugs: BugReport[];
  onStatusChange: (id: string, status: BugReport['status']) => void;
}

const SEVERITY_STYLES: Record<BugReport['severity'], { bg: string; text: string }> = {
  broken: { bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
  annoying: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  cosmetic: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

const STATUS_OPTIONS: BugReport['status'][] = ['open', 'investigating', 'fixed', 'wont_fix'];

function statusLabel(s: string) {
  return s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function BugReportTable({ bugs, onStatusChange }: BugReportTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (bugs.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-slate-500 text-sm">No bug reports yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <th className="w-8 px-4 py-3" />
            <th className="text-left text-slate-600 text-[10px] uppercase tracking-wider px-4 py-3 font-medium">Severity</th>
            <th className="text-left text-slate-600 text-[10px] uppercase tracking-wider px-4 py-3 font-medium">Page</th>
            <th className="text-left text-slate-600 text-[10px] uppercase tracking-wider px-4 py-3 font-medium">Description</th>
            <th className="text-left text-slate-600 text-[10px] uppercase tracking-wider px-4 py-3 font-medium">Status</th>
            <th className="text-left text-slate-600 text-[10px] uppercase tracking-wider px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {bugs.map(bug => {
            const isExpanded = expanded[bug.id] ?? false;
            const sev = SEVERITY_STYLES[bug.severity];
            return (
              <tr key={bug.id} className="group" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td colSpan={6} className="p-0">
                  {/* Main row */}
                  <div
                    className="flex items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleRow(bug.id)}
                  >
                    <div className="w-8 px-4 py-3 flex items-center">
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-200 text-slate-600 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                    <div className="px-4 py-3">
                      <span
                        className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{ background: sev.bg, color: sev.text }}
                      >
                        {bug.severity}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-slate-400 text-sm">{bug.page}</div>
                    <div className="px-4 py-3 text-slate-300 text-sm flex-1 truncate max-w-[400px]">
                      {bug.what_happened}
                    </div>
                    <div className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={bug.status}
                        onChange={e => onStatusChange(bug.id, e.target.value as BugReport['status'])}
                        className="text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: bug.status === 'fixed' ? '#4ade80' : bug.status === 'open' ? '#f87171' : '#94a3b8',
                        }}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(bug.created_at)}
                      <span className="text-slate-600 ml-1">{formatTime(bug.created_at)}</span>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="px-12 pb-5 pt-1" style={{ background: 'rgba(255,255,255,0.01)' }}>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <DetailField label="What happened" value={bug.what_happened} />
                        <DetailField label="Expected behavior" value={bug.expected_behavior} />
                        <DetailField label="Steps to reproduce" value={bug.steps_to_reproduce} />
                        <DetailField label="Submitted by" value={bug.submitted_by} />
                        <DetailField label="Browser" value={bug.browser_info} />
                        <DetailField label="URL" value={bug.current_url} />
                        {bug.console_errors && (
                          <div className="col-span-2">
                            <DetailField label="Console errors" value={bug.console_errors} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-slate-300 text-sm whitespace-pre-wrap">{value || '\u2014'}</p>
    </div>
  );
}
