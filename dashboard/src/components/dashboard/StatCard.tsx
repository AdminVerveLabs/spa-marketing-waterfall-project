interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 group hover:border-brand/15 hover:bg-white/[0.03]"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(62,207,173,0.08)" }}>
          <span className="text-emerald-400">{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight font-sans">{value}</p>
      <p className="text-slate-500 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-slate-600 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}
