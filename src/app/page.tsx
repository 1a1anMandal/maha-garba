"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Lock, User, UserPlus } from "lucide-react";
import { DandiyaIcon } from "@/components/DandiyaIcon";

const ADMIN_EMAIL = "milankr.mandal2000@gmail.com";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (isRegistering) {
      // 1. Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        // 2. Create profile as pending
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: authData.user.id,
            email: email,
            full_name: fullName,
            status: "pending",
          },
        ]);

        if (profileError) {
          setError("Failed to create profile request: " + profileError.message);
        } else {
          setSuccess("Access requested! Please wait for admin approval.");
          setIsRegistering(false);
          setPassword("");
        }
      }
      setLoading(false);
    } else {
      // Login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Check Admin
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        router.push("/admin");
        return;
      }

      // Check Operator Approval Status
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", authData.user?.id)
        .single();

      if (!profile || profile.status === "pending") {
        await supabase.auth.signOut();
        setError("Your account is pending admin approval.");
        setLoading(false);
        return;
      }

      if (profile.status === "rejected") {
        await supabase.auth.signOut();
        setError("Your access request was rejected.");
        setLoading(false);
        return;
      }

      // Approved Operator
      router.push("/entry");
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
      <div className="text-center mb-8 animate-fade-in-down flex flex-col items-center">
        <DandiyaIcon className="w-16 h-16 mb-2" />
        <h1 className="text-4xl sm:text-6xl font-black text-garba-gold text-glow uppercase tracking-wider font-[family-name:var(--font-rozha)]">
          Maha Garba
        </h1>
        <div className="subtitle-lines w-full mt-2">
          <p className="text-garba-light text-sm sm:text-base tracking-[0.3em] font-semibold uppercase whitespace-nowrap px-4">
            Authorized Access
          </p>
        </div>
      </div>

      <div className="w-full max-w-md ornate-card transition-all duration-300">
        <div className="border-dots opacity-50 mt-4 mx-4"></div>
        <div className="p-8 pt-4">
          
          <div className="flex gap-4 mb-6">
            <button 
              onClick={() => { setIsRegistering(false); setError(""); setSuccess(""); }}
              className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${!isRegistering ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 border-b-2 border-transparent hover:text-garba-light'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setError(""); setSuccess(""); }}
              className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${isRegistering ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 border-b-2 border-transparent hover:text-garba-light'}`}
            >
              Request Access
            </button>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/20 text-red-100 p-3 rounded-lg text-sm font-bold text-center border border-red-500/50">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-garba-green/20 text-green-100 p-3 rounded-lg text-sm font-bold text-center border border-garba-green/50">
                {success}
              </div>
            )}

            {isRegistering && (
              <div className="flex flex-col gap-1.5 animate-fade-in-down">
                <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Full Name</label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                  <input 
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Name"
                    required={isRegistering}
                    className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                  />
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Email</label>
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
                isRegistering ? "SUBMIT REQUEST" : "LOGIN"
              )}
            </button>
          </form>
        </div>
        <div className="border-dots opacity-50 mb-4 mx-4"></div>
      </div>
    </div>
  );
}
