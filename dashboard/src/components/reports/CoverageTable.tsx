import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { METROS } from '@/data/metros';
import type { RunCoverageStats } from '@/types';

interface CoverageTableProps {
  stats: RunCoverageStats[];
}

interface CityAgg {
  runs: number;
  discovered: number;
  contacts: number;
  lastRun: string | null;
}

interface StateAgg extends CityAgg {
  cities: number;
}

interface CountryAgg extends StateAgg {
  states: number;
}

type Hierarchy = Record<string, Record<string, Record<string, RunCoverageStats>>>;

function buildHierarchy(stats: RunCoverageStats[]): Hierarchy {
  const h: Hierarchy = {};
  for (const row of stats) {
    if (!h[row.country]) h[row.country] = {};
    if (!h[row.country][row.state]) h[row.country][row.state] = {};
    h[row.country][row.state][row.city] = row;
  }
  return h;
}

function aggFromStats(rows: RunCoverageStats[]): CityAgg {
  return {
    runs: rows.reduce((s, r) => s + r.completed_runs, 0),
    discovered: rows.reduce((s, r) => s + r.total_discovered, 0),
    contacts: rows.reduce((s, r) => s + r.total_contacts, 0),
    lastRun: rows.reduce((latest: string | null, r) => {
      if (!r.last_completed_at) return latest;
      return !latest || r.last_completed_at > latest ? r.last_completed_at : latest;
    }, null),
  };
}

const countryLabels: Record<string, string> = { US: "United States", CA: "Canada" };

export function CoverageTable({ stats }: CoverageTableProps) {
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

  const hierarchy = buildHierarchy(stats);

  const toggleCountry = (c: string) => setExpandedCountries(prev => ({ ...prev, [c]: !prev[c] }));
  const toggleState = (key: string) => setExpandedStates(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {["Location", "Cities", "Companies", "Contacts", "Runs", "Last Run"].map((h, i) => (
              <th key={i} className="text-left text-[10px] uppercase tracking-wider text-slate-600 font-medium px-5 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(hierarchy).sort().map(([countryCode, countryStates]) => {
            const allRows = Object.values(countryStates).flatMap(st => Object.values(st));
            const ca: CountryAgg = {
              ...aggFromStats(allRows),
              states: Object.keys(countryStates).length,
              cities: allRows.length,
            };
            const isExpanded = expandedCountries[countryCode];

            return (
              <React.Fragment key={countryCode}>
                {/* Country row */}
                <tr
                  className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() => toggleCountry(countryCode)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`transition-transform duration-200 text-slate-600 ${isExpanded ? "rotate-90" : ""}`}>
                        <ChevronRight size={14} />
                      </span>
                      <span className="text-white text-sm font-semibold">{countryLabels[countryCode] || countryCode}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#64748b" }}>{countryCode}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">{ca.cities}</td>
                  <td className="px-5 py-3.5 text-sm text-white font-semibold">{ca.discovered.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm text-white font-semibold">{ca.contacts.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">{ca.runs}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(ca.lastRun)}</td>
                </tr>

                {/* State rows */}
                {isExpanded && Object.entries(countryStates).sort().map(([stateCode, stateCities]) => {
                  const stateRows = Object.values(stateCities);
                  const sa: StateAgg = {
                    ...aggFromStats(stateRows),
                    cities: stateRows.length,
                  };
                  const stateKey = `${countryCode}-${stateCode}`;
                  const stateExpanded = expandedStates[stateKey];
                  const stateName = METROS[countryCode]?.[stateCode]?.name || stateCode;

                  return (
                    <React.Fragment key={stateKey}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.01)" }}
                        onClick={() => toggleState(stateKey)}
                      >
                        <td className="px-5 py-3 pl-10">
                          <div className="flex items-center gap-2">
                            <span className={`transition-transform duration-200 text-slate-600 ${stateExpanded ? "rotate-90" : ""}`}>
                              <ChevronRight size={14} />
                            </span>
                            <span className="text-slate-300 text-sm font-medium">{stateName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#64748b" }}>{stateCode}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-400">{sa.cities}</td>
                        <td className="px-5 py-3 text-sm text-slate-300">{sa.discovered.toLocaleString()}</td>
                        <td className="px-5 py-3 text-sm text-slate-300">{sa.contacts.toLocaleString()}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{sa.runs}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{formatDate(sa.lastRun)}</td>
                      </tr>

                      {/* City rows */}
                      {stateExpanded && Object.entries(stateCities).sort().map(([city, row]) => (
                        <tr
                          key={`${stateKey}-${city}`}
                          className="transition-colors hover:bg-white/[0.02]"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", background: "rgba(255,255,255,0.015)" }}
                        >
                          <td className="px-5 py-2.5 pl-16">
                            <span className="text-slate-400 text-sm">{city}</span>
                          </td>
                          <td className="px-5 py-2.5 text-sm text-slate-600">{"\u2014"}</td>
                          <td className="px-5 py-2.5 text-sm text-slate-400">{row.total_discovered.toLocaleString()}</td>
                          <td className="px-5 py-2.5 text-sm text-slate-400">{row.total_contacts.toLocaleString()}</td>
                          <td className="px-5 py-2.5 text-sm text-slate-500">{row.completed_runs}</td>
                          <td className="px-5 py-2.5 text-sm text-slate-600">{formatDate(row.last_completed_at)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {stats.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-600 text-sm">No coverage data yet. Complete some pipeline runs first.</p>
        </div>
      )}
    </div>
  );
}
