"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, CheckCircle2, AlertCircle, User, Users, Calendar, Ticket, LogOut } from "lucide-react";
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
  const [date, setDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<{pass: string, type: string} | null>(null);
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);

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

  // Autofill logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (passSerial.length >= 3 && !name1 && !showTypePopup) {
        const matches = preRegistered.filter(p => p.pass_serial === passSerial || passSerial.endsWith(p.pass_serial));
        if (matches.length > 0) {
          setPendingMatches(matches);
          setShowTypePopup(true);
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [passSerial, name1, showTypePopup]);

  const handleSelectType = (selectedType: "stag" | "duo") => {
    const match = pendingMatches.find(m => m.entry_type === selectedType);
    if (match) {
      setName1(match.name_1);
      if (match.name_2) setName2(match.name_2);
      else setName2("");
    } else {
      setName1("");
      setName2("");
    }
    setEntryType(selectedType);
    setShowTypePopup(false);
  };

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

  const handleSubmit = async (e: React.FormEvent, bypassNameCheck = false) => {
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

    if (!bypassNameCheck) {
      const orQuery = `name_1.ilike."${name1.trim()}",name_2.ilike."${name1.trim()}"` + (name2 ? `,name_1.ilike."${name2.trim()}",name_2.ilike."${name2.trim()}"` : "");
      const { data: matches } = await supabase
        .from('entries')
        .select('pass_serial, entry_type')
        .or(orQuery)
        .limit(10); // Fetch a few to find one that is truly a different pass

      let duplicateInfo = null;
      if (matches) {
        const diffPass = matches.find(m => !(m.pass_serial === passSerial && m.entry_type === entryType));
        if (diffPass) duplicateInfo = diffPass;
      }
      
      if (!duplicateInfo) {
        const dupLocal = preRegistered.find(p => 
          !(p.pass_serial === passSerial && p.entry_type === entryType) && 
          (p.name_1.toLowerCase() === name1.trim().toLowerCase() || 
           (p.name_2 && p.name_2.toLowerCase() === name1.trim().toLowerCase()) ||
           (name2 && p.name_1.toLowerCase() === name2.trim().toLowerCase()) ||
           (name2 && p.name_2 && p.name_2.toLowerCase() === name2.trim().toLowerCase())
          )
        );
        if (dupLocal) duplicateInfo = dupLocal;
      }

      if (duplicateInfo) {
        setDuplicateNameWarning({ pass: duplicateInfo.pass_serial, type: duplicateInfo.entry_type });
        return;
      }
    }

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
    <>
      <div className="bg-app"></div>
      <div className="bg-overlay"></div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
      
      {/* Decorative Header */}
      <div className="text-center mb-8 animate-fade-in flex flex-col items-center relative w-full max-w-md">
        <button onClick={handleLogout} className="absolute right-0 top-0 text-garba-light/60 hover:text-white transition-colors" title="Logout">
          <LogOut className="w-6 h-6" />
        </button>
        <DandiyaIcon className="w-16 h-16 mb-2" />
        <h1 className="text-4xl sm:text-6xl font-black text-garba-gold text-glow uppercase tracking-wider font-[family-name:var(--font-rozha)]">
          Maha Garba
        </h1>
        <div className="subtitle-lines w-full mt-2">
          <p className="text-garba-light text-sm sm:text-base tracking-[0.3em] font-semibold uppercase whitespace-nowrap px-4">
            Entry Management
          </p>
        </div>
      </div>

      {/* Main Entry Card */}
      <div className={`w-full max-w-md ornate-card transition-all duration-500 ${
          status === "success" ? "border-garba-green shadow-[0_0_40px_rgba(21,109,53,0.8)]" : 
          status === "duplicate" ? "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]" : 
          ""
        }`}>
        
        {/* Top border dots */}
        <div className="border-dots opacity-50 mt-4 mx-4"></div>

        <div className="p-6 sm:p-8 pt-4">
          
          {/* Status Banners */}
          {/* Popup Notifications */}
      {status === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-down">
          <div className="bg-garba-green text-white p-8 rounded-2xl flex flex-col items-center gap-4 animate-bounce-in shadow-2xl max-w-sm w-full mx-4 border-2 border-green-400">
            <CheckCircle2 className="w-16 h-16" />
            <div className="text-center">
              <p className="font-black text-2xl uppercase tracking-wider">Entry Successful!</p>
              <p className="text-lg opacity-90 mt-2">Ready for next pass.</p>
            </div>
          </div>
        </div>
      )}

      {status === "duplicate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-down">
          <div className="bg-red-600 text-white p-8 rounded-2xl flex flex-col items-center gap-4 animate-shake shadow-2xl max-w-sm w-full mx-4 border-2 border-red-400">
            <AlertCircle className="w-16 h-16 shrink-0" />
            <div className="text-center">
              <p className="font-black text-2xl uppercase tracking-wider">Pass Already Used!</p>
              <p className="text-lg opacity-90 mt-2">This pass was already scanned today.</p>
              <button 
                onClick={() => {
                  setStatus("idle");
                  setPassSerial("");
                  setName1("");
                  setName2("");
                  passInputRef.current?.focus();
                }}
                className="mt-6 w-full bg-white text-red-600 px-6 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg active:scale-95"
              >
                Clear & Scan Next
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-down">
          <div className="bg-red-600 text-white p-8 rounded-2xl flex flex-col items-center gap-4 animate-shake shadow-2xl max-w-sm w-full mx-4 border-2 border-red-400">
            <AlertCircle className="w-16 h-16 shrink-0" />
            <div className="text-center">
              <p className="font-black text-2xl uppercase tracking-wider">System Error!</p>
              <p className="text-lg opacity-90 mt-2">{errorMsg}</p>
              <button 
                onClick={() => setStatus("idle")}
                className="mt-6 w-full bg-white text-red-600 px-6 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg active:scale-95"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Name Warning Popup */}
      {duplicateNameWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-down">
          <div className="bg-garba-darkred text-white p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4 border-2 border-yellow-500">
            <AlertCircle className="w-16 h-16 shrink-0 text-yellow-500" />
            <div className="text-center">
              <p className="font-black text-2xl uppercase tracking-wider text-yellow-500">Name Exists!</p>
              <p className="text-lg opacity-90 mt-2">Name already exists under a different pass.</p>
              <p className="font-bold text-xl text-white mt-2">Pass: {duplicateNameWarning.type.toUpperCase()} {duplicateNameWarning.pass}</p>
              <div className="flex flex-col gap-3 mt-6">
                <button 
                  onClick={() => setDuplicateNameWarning(null)}
                  className="w-full bg-white text-garba-darkred px-6 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={(e) => {
                    setDuplicateNameWarning(null);
                    handleSubmit(e as any, true);
                  }}
                  className="w-full bg-transparent border border-white/30 text-white/70 px-6 py-3 rounded-xl font-bold hover:bg-white/10 transition active:scale-95"
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Select Pass Type Popup */}
      {showTypePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-down">
          <div className="bg-garba-darkred text-white p-8 rounded-2xl flex flex-col items-center gap-6 shadow-2xl max-w-md w-full mx-4 border-2 border-garba-gold">
            <div className="text-center">
              <h3 className="font-black text-2xl text-garba-gold uppercase tracking-wider mb-2">Select Pass Type</h3>
              <p className="text-garba-light/80">Please confirm if this is a Stag or Duo pass before proceeding.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                onClick={() => handleSelectType("stag")}
                className="py-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold border-2 bg-black/40 text-white/90 border-garba-gold/30 hover:border-garba-gold hover:bg-garba-gold/20 transition-all active:scale-95"
              >
                <User className="w-8 h-8 text-garba-gold" /> 
                <span className="text-lg">STAG (1)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectType("duo")}
                className="py-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold border-2 bg-black/40 text-white/90 border-garba-gold/30 hover:border-garba-gold hover:bg-garba-gold/20 transition-all active:scale-95"
              >
                <Users className="w-8 h-8 text-garba-gold" /> 
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
    </>
  );
}
