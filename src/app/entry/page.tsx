"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, User, Users, Calendar, Ticket, LogOut, Loader2 } from "lucide-react";
import { DandiyaIcon } from "@/components/DandiyaIcon";
import preRegistered from "@/lib/preRegistered.json";

import { supabase } from "@/lib/supabase";

export default function GateEntry() {
  const router = useRouter();
  const [passSerial, setPassSerial] = useState("");
  const [entryType, setEntryType] = useState<"stag" | "duo">("stag");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "duplicate" | "error">("idle");
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const [date] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<{pass: string, type: string} | null>(null);
  const [showTypePopup, setShowTypePopup] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);

  const passInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/');
        return;
      }
      const ADMIN_EMAIL = "milankr.mandal2000@gmail.com";
      if (data.session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.session.user.id).single();
        if (!profile || profile.status !== 'approved') {
          await supabase.auth.signOut();
          router.push('/');
        }
      }
    };
    checkAuth();
    passInputRef.current?.focus();
  }, [router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkAndAutofill = async (match: any) => {
    setIsChecking(true);
    const exactPassSerial = match.pass_serial;
    const type = match.entry_type;

    try {
      // Instantly check DB for today's entry
      const { data } = await supabase
        .from('entries')
        .select('id')
        .eq('pass_serial', `${exactPassSerial}_${type}_${date}`)
        .maybeSingle();

      setIsChecking(false);

      // Autofill fields
      setPassSerial(exactPassSerial);
      setEntryType(type as "stag" | "duo");
      setName1(match.name_1 || "");
      if (match.name_2) setName2(match.name_2);
      else setName2("");

      if (data) {
        // Already marked present today!
        setStatus("duplicate");
      }
    } catch (err) {
      console.error("Autofill check failed", err);
      setIsChecking(false);
    }
  };

  // Autofill & Instant Check logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (passSerial.length >= 3 && !name1 && !showTypePopup && status === 'idle' && !isChecking) {
        const matches = preRegistered.filter(p => p.pass_serial === passSerial || passSerial.endsWith(String(p.pass_serial)));
        if (matches.length > 1) {
          setPendingMatches(matches);
          setShowTypePopup(true);
        } else if (matches.length === 1) {
          checkAndAutofill(matches[0]);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [passSerial, name1, showTypePopup, status, isChecking]);

  const handleSelectType = (selectedType: "stag" | "duo") => {
    const match = pendingMatches.find(m => m.entry_type === selectedType);
    setShowTypePopup(false);
    if (match) {
      checkAndAutofill(match);
    }
  };

  const resetForm = () => {
    setPassSerial("");
    setName1("");
    setName2("");
    setStatus("idle");
    setEntryType("stag");
    setErrorMsg("");
    setDuplicateNameWarning(null);
    setShowTypePopup(false);
    setPendingMatches([]);
    setTimeout(() => {
      passInputRef.current?.focus();
    }, 100);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const submitEntry = async (bypassNameCheck = false) => {
    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from('entries')
        .insert([
          {
            pass_serial: `${passSerial}_${entryType}_${date}`,
            name_1: name1,
            name_2: entryType === "duo" ? name2 : null,
            entry_type: entryType,
            entry_date: date,
          }
        ]);

      if (error) {
        if (error.code === '23505') { // Postgres Unique Violation
          setStatus("duplicate");
        } else {
          setStatus("error");
          setErrorMsg(error.message);
        }
      } else {
        setStatus("success");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passSerial || !name1) return;

    if (!name1.trim().includes(' ')) {
      setStatus("error");
      setErrorMsg("Participant 1 must have a Full Name (First and Last Name).");
      return;
    }
    if (name2 && !name2.trim().includes(' ')) {
      setStatus("error");
      setErrorMsg("Participant 2 must have a Full Name (First and Last Name).");
      return;
    }

    try {
      const orQuery = `name_1.ilike."${name1.trim()}",name_2.ilike."${name1.trim()}"` + (name2 ? `,name_1.ilike."${name2.trim()}",name_2.ilike."${name2.trim()}"` : "");
      const { data: matches, error: matchError } = await supabase
        .from('entries')
        .select('pass_serial, entry_type')
        .or(orQuery)
        .limit(10);

      if (matchError) {
        console.error("Match error:", matchError);
      }

      let duplicateInfo = null;
      if (matches) {
        const diffPass = matches.find(m => String(m.pass_serial).split('_')[0] !== String(passSerial).trim());
        if (diffPass) duplicateInfo = diffPass;
      }
      
      if (!duplicateInfo) {
        const dupLocal = preRegistered.find(p => 
          !(String(p.pass_serial) === String(passSerial).trim() && p.entry_type === entryType) && 
          (String(p.name_1 || "").toLowerCase() === name1.trim().toLowerCase() || 
           (p.name_2 && String(p.name_2).toLowerCase() === name1.trim().toLowerCase()) ||
           (name2 && String(p.name_1 || "").toLowerCase() === name2.trim().toLowerCase()) ||
           (name2 && p.name_2 && String(p.name_2).toLowerCase() === name2.trim().toLowerCase())
          )
        );
        if (dupLocal) duplicateInfo = dupLocal;
      }

      if (duplicateInfo) {
        setDuplicateNameWarning({ 
          pass: String(duplicateInfo.pass_serial), 
          type: String(duplicateInfo.entry_type || "") 
        });
        return;
      }

      await submitEntry(false);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <>
    <div className="min-h-screen bg-app flex flex-col items-center pt-8 pb-12 px-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-black/40"></div>
      
      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center mb-8 relative z-10 px-2">
        <h1 className="text-3xl font-rozha text-garba-gold drop-shadow-lg tracking-wide flex flex-col leading-tight">
          <span>MAHA GARBA</span>
          <span className="text-sm font-sans tracking-widest text-garba-light/80 uppercase">Gate Entry</span>
        </h1>
        <button 
          onClick={handleLogout}
          className="bg-black/50 hover:bg-black/80 text-garba-gold border border-garba-gold/30 p-3 rounded-xl transition-all shadow-lg active:scale-95"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full max-w-lg ornate-card p-1 sm:p-2 relative z-10 mx-auto mt-2">
        <div className="border-dots opacity-50 mt-2 mx-4"></div>
        
        <div className="p-6 sm:p-8 relative">
          
          <DandiyaIcon className="w-16 h-16 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(245,183,0,0.5)]" />

          {/* Glassmorphism Modals */}

          {/* Success Popup */}
          {status === "success" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-garba-green/20 backdrop-blur-xl border border-garba-green/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(34,197,94,0.3)] transform transition-all animate-bounce-in">
                <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-6 drop-shadow-md" />
                <h2 className="text-3xl font-black text-green-400 mb-2 uppercase tracking-widest drop-shadow-md">Entry Granted</h2>
                <p className="text-green-100 text-lg mb-8 font-medium">Welcome to Maha Garba!</p>
                <button 
                  onClick={resetForm}
                  className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl shadow-lg transition-colors text-lg"
                >
                  Next Pass
                </button>
              </div>
            </div>
          )}

          {/* Duplicate Popup */}
          {status === "duplicate" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-orange-500/20 backdrop-blur-xl border border-orange-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(249,115,22,0.3)] transform transition-all animate-bounce-in">
                <AlertCircle className="w-20 h-20 text-orange-400 mx-auto mb-6 drop-shadow-md" />
                <h2 className="text-3xl font-black text-orange-400 mb-2 uppercase tracking-widest drop-shadow-md">Already Present</h2>
                <p className="text-orange-100 text-lg mb-8 font-medium">This pass has already been marked for today.</p>
                <button 
                  onClick={resetForm}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-3 rounded-xl shadow-lg transition-colors text-lg"
                >
                  Scan Another
                </button>
              </div>
            </div>
          )}

          {/* Error Popup */}
          {status === "error" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-red-500/20 backdrop-blur-xl border border-red-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(239,68,68,0.3)] transform transition-all animate-bounce-in">
                <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6 drop-shadow-md" />
                <h2 className="text-3xl font-black text-red-400 mb-2 uppercase tracking-widest drop-shadow-md">System Error</h2>
                <p className="text-red-100 text-lg mb-8 font-medium break-words">{errorMsg}</p>
                <button 
                  onClick={() => setStatus("idle")}
                  className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl shadow-lg transition-colors text-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Duplicate Name Warning Popup */}
          {duplicateNameWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(234,179,8,0.3)] transform transition-all animate-bounce-in">
                <AlertCircle className="w-20 h-20 text-yellow-400 mx-auto mb-6 drop-shadow-md" />
                <h2 className="text-2xl font-black text-yellow-400 mb-2 uppercase tracking-wide drop-shadow-md">Name Exists!</h2>
                <p className="text-yellow-100 text-[15px] mb-6 font-medium leading-relaxed">
                  This name is already registered under:<br/>
                  <strong className="text-white text-lg block mt-2">{(duplicateNameWarning.type || "").toUpperCase()} - {(duplicateNameWarning.pass || "").split('_')[0]}</strong>
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDuplicateNameWarning(null)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-colors border border-white/20"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setDuplicateNameWarning(null);
                      submitEntry(true);
                    }}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl shadow-lg transition-colors"
                  >
                    Proceed Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Type Choice Popup */}
          {showTypePopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 flex flex-col items-center gap-6 shadow-[0_8px_32px_rgba(255,255,255,0.1)] max-w-md w-full mx-4 transform transition-all animate-bounce-in">
                <div className="text-center">
                  <h3 className="font-black text-2xl text-garba-gold uppercase tracking-wider mb-2 drop-shadow-md">Select Pass Type</h3>
                  <p className="text-garba-light/90 font-medium">This pass number exists in multiple categories. Please choose.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    type="button"
                    onClick={() => handleSelectType("stag")}
                    className="py-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold border border-white/20 bg-white/5 text-white hover:bg-garba-gold/20 hover:border-garba-gold/50 hover:text-garba-gold transition-all active:scale-95"
                  >
                    <User className="w-8 h-8 drop-shadow-md" /> 
                    <span className="text-lg">STAG (1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectType("duo")}
                    className="py-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold border border-white/20 bg-white/5 text-white hover:bg-garba-gold/20 hover:border-garba-gold/50 hover:text-garba-gold transition-all active:scale-95"
                  >
                    <Users className="w-8 h-8 drop-shadow-md" /> 
                    <span className="text-lg">DUO (2)</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowTypePopup(false)}
                  className="mt-2 text-sm text-garba-light/60 hover:text-white transition-colors underline underline-offset-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Pass Serial */}
            <div className="flex flex-col gap-1.5">
              <label className="text-garba-gold font-bold text-sm tracking-wide uppercase flex justify-between items-center">
                <span>Pass Serial Number</span>
                {isChecking && <Loader2 className="w-4 h-4 text-garba-gold animate-spin" />}
              </label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                <input 
                  ref={passInputRef}
                  type="text" 
                  value={passSerial}
                  onChange={(e) => setPassSerial(e.target.value)}
                  placeholder="e.g. 005"
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
                      ? "bg-garba-gold text-garba-maroon border-garba-gold shadow-[0_0_15px_rgba(245,183,0,0.3)]" 
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
                      ? "bg-garba-gold text-garba-maroon border-garba-gold shadow-[0_0_15px_rgba(245,183,0,0.3)]" 
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
                    placeholder="Enter second name (optional)"
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
                <Loader2 className="w-6 h-6 text-garba-maroon animate-spin" />
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
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />
    </div>
    </>
  );
}



