"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Lock, User } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check user role (admin vs operator) based on email or a custom user profile
    // For now, simple check: if email contains 'admin', go to admin, else entry
    if (data.user?.email?.includes("admin")) {
      router.push("/admin");
    } else {
      router.push("/entry");
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
      <div className="text-center mb-8 animate-fade-in-down">
        <h1 className="text-4xl sm:text-6xl font-black text-garba-gold text-glow uppercase tracking-wider font-[family-name:var(--font-rozha)]">
          Maha Garba
        </h1>
        <p className="text-garba-light text-xl mt-2 tracking-widest font-semibold uppercase">
          Authorized Access
        </p>
      </div>

      <div className="w-full max-w-md bg-garba-maroon rounded-2xl shadow-2xl overflow-hidden border-2 border-garba-gold/30">
        <div className="border-dots opacity-50 mt-4 mx-4"></div>
        <div className="p-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/20 text-red-100 p-3 rounded-lg text-sm font-bold text-center border border-red-500/50">
                {error}
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Email / Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@mahagarba.com"
                  required
                  className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-gradient-to-r from-garba-gold to-yellow-500 hover:from-yellow-400 hover:to-yellow-300 text-garba-maroon font-black text-xl py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-garba-maroon border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "LOGIN"
              )}
            </button>
          </form>
        </div>
        <div className="border-dots opacity-50 mb-4 mx-4"></div>
      </div>
    </div>
  );
}
