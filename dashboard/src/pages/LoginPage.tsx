import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Footer } from '@/components/layout/Footer';

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #0a0f1a 0%, #111927 50%, #0d1520 100%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #3ecfad 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.02]" style={{ background: "radial-gradient(circle, #3ecfad 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="text-center mb-10">
          <div className="mb-2">
            <img src="/spa-marketing-logo.jpg" alt="SpaMarketing.com" className="h-16 w-auto mx-auto rounded-lg" />
          </div>
          <p className="text-slate-500 text-sm mt-1">Waterfaller</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          <h2 className="text-white text-lg font-semibold mb-6 font-sans">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@spamarketing.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-brand/40 focus:shadow-[0_0_0_3px_rgba(62,207,173,0.08)]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-brand/40 focus:shadow-[0_0_0_3px_rgba(62,207,173,0.08)]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 mt-2 flex items-center justify-center gap-2"
              style={{
                background: loading ? "rgba(62,207,173,0.5)" : "linear-gradient(135deg, #3ecfad 0%, #2ba88d 100%)",
                boxShadow: loading ? "none" : "0 4px 14px rgba(62,207,173,0.25)",
              }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Signing in...</> : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">spamarketing.com internal tool</p>
        <Footer />
      </div>
    </div>
  );
}
