"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, CheckCircle2, AlertCircle, User, Users, Calendar, Ticket, LogOut } from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function GateEntry() {
  const router = useRouter();
  const [passSerial, setPassSerial] = useState("");
  const [entryType, setEntryType] = useState<"stag" | "duo">("stag");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "duplicate" | "error">("idle");
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const passInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    passInputRef.current?.focus();
    const today = new Date();
    // format as YYYY-MM-DD for DB
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passSerial || !name1 || (entryType === "duo" && !name2)) return;

    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    const { error } = await supabase
      .from('entries')
      .insert([
        {
          pass_serial: passSerial,
          name_1: name1,
          name_2: entryType === "duo" ? name2 : null,
          entry_type: entryType,
          entry_date: date,
        }
      ]);

    setLoading(false);

    if (error) {
      if (error.code === '23505') { // Postgres Unique Violation
        setStatus("duplicate");
      } else {
        setStatus("error");
        setErrorMsg(error.message);
      }
    } else {
      setStatus("success");
      setPassSerial("");
      setName1("");
      setName2("");
      setEntryType("stag");
      passInputRef.current?.focus();
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
      
      {/* Decorative Header */}
      <div className="text-center mb-8 animate-fade-in relative w-full max-w-md">
        <button onClick={handleLogout} className="absolute right-0 top-0 text-garba-light/60 hover:text-white transition-colors" title="Logout">
          <LogOut className="w-6 h-6" />
        </button>
        <h1 className="text-4xl sm:text-6xl font-black text-garba-gold text-glow uppercase tracking-wider font-[family-name:var(--font-rozha)]">
          Maha Garba
        </h1>
        <p className="text-garba-light text-xl mt-2 tracking-widest font-semibold uppercase">
          Entry Management
        </p>
      </div>

      {/* Main Entry Card */}
      <div className={`w-full max-w-md bg-garba-maroon rounded-2xl shadow-2xl overflow-hidden border-2 transition-colors duration-500 ${
          status === "success" ? "border-garba-green shadow-[0_0_40px_rgba(12,87,42,0.6)]" : 
          status === "duplicate" ? "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6)]" : 
          "border-garba-gold/30"
        }`}>
        
        {/* Top border dots */}
        <div className="border-dots opacity-50 mt-4 mx-4"></div>

        <div className="p-6 sm:p-8">
          
          {/* Status Banners */}
          {status === "success" && (
            <div className="mb-6 bg-garba-green text-white p-4 rounded-xl flex items-center gap-3 animate-bounce-in">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <p className="font-bold text-lg">Entry Successful!</p>
                <p className="text-sm opacity-90">Ready for next pass.</p>
              </div>
            </div>
          )}

          {status === "duplicate" && (
            <div className="mb-6 bg-red-600 text-white p-4 rounded-xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-8 h-8 shrink-0 mt-1" />
              <div>
                <p className="font-bold text-lg">Warning: Pass Already Used!</p>
                <p className="text-sm opacity-90 mt-1">This pass was already scanned today.</p>
                <button 
                  onClick={() => {
                    setStatus("idle");
                    setPassSerial("");
                    passInputRef.current?.focus();
                  }}
                  className="mt-3 bg-white text-red-600 px-4 py-1 rounded font-bold text-sm hover:bg-gray-100 transition"
                >
                  Clear & Scan Next
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mb-6 bg-red-600 text-white p-4 rounded-xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-8 h-8 shrink-0 mt-1" />
              <div>
                <p className="font-bold text-lg">System Error!</p>
                <p className="text-sm opacity-90 mt-1">{errorMsg}</p>
                <button 
                  onClick={() => setStatus("idle")}
                  className="mt-3 bg-white text-red-600 px-4 py-1 rounded font-bold text-sm hover:bg-gray-100 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Pass Serial */}
            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Pass Serial Number</label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                <input 
                  ref={passInputRef}
                  type="text" 
                  value={passSerial}
                  onChange={(e) => setPassSerial(e.target.value)}
                  placeholder="e.g. MG-2024-001"
                  className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold font-mono text-lg transition-colors"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Entry Type Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Entry Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEntryType("stag")}
                  className={`py-3 rounded-xl flex items-center justify-center gap-2 font-bold border-2 transition-colors ${
                    entryType === "stag" 
                      ? "bg-garba-gold text-garba-maroon border-garba-gold" 
                      : "bg-garba-darkred text-white/70 border-transparent hover:border-garba-gold/30"
                  }`}
                >
                  <User className="w-5 h-5" /> Stag (1)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType("duo")}
                  className={`py-3 rounded-xl flex items-center justify-center gap-2 font-bold border-2 transition-colors ${
                    entryType === "duo" 
                      ? "bg-garba-gold text-garba-maroon border-garba-gold" 
                      : "bg-garba-darkred text-white/70 border-transparent hover:border-garba-gold/30"
                  }`}
                >
                  <Users className="w-5 h-5" /> Duo (2)
                </button>
              </div>
            </div>

            {/* Names */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">
                  {entryType === "stag" ? "Participant Name" : "Participant 1 Name"}
                </label>
                <input 
                  type="text" 
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="Enter name"
                  className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                />
              </div>
              
              {entryType === "duo" && (
                <div className="flex flex-col gap-1.5 animate-fade-in-down">
                  <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">Participant 2 Name</label>
                  <input 
                    type="text" 
                    value={name2}
                    onChange={(e) => setName2(e.target.value)}
                    placeholder="Enter second name"
                    className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Date Info */}
            <div className="flex items-center gap-2 text-garba-gold/80 bg-garba-darkred p-3 rounded-xl border border-garba-gold/10">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">Valid for Date: {date}</span>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading || status === "duplicate"}
              className="mt-2 w-full bg-gradient-to-r from-garba-gold to-yellow-500 hover:from-yellow-400 hover:to-yellow-300 text-garba-maroon font-black text-xl py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-garba-maroon border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "VALIDATE & ENTER"
              )}
            </button>
          </form>
        </div>

        {/* Bottom border dots */}
        <div className="border-dots opacity-50 mb-4 mx-4"></div>
      </div>
      
      {/* Custom Animations for Tailwind */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}} />
    </div>
  );
}
