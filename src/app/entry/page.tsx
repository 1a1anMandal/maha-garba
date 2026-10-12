"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, User, Users, Calendar, Ticket, LogOut, Loader2 } from "lucide-react";
import { DandiyaIcon } from "@/components/DandiyaIcon";
import preRegistered from "@/lib/preRegistered.json";
import { supabase } from "@/lib/supabase";

export default function GateEntry() {
  const router = useRouter();
  
  // Form State
  const [entryType, setEntryType] = useState<"stag" | "duo">("stag");
  const [passSerial, setPassSerial] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  
  // Status and Loading
  const [status, setStatus] = useState<"idle" | "success" | "duplicate" | "error">("idle");
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Duplicate Name Warning
  const [duplicateNameWarning, setDuplicateNameWarning] = useState<{
    pass: string;
    type: string;
    existingName: string;
    participantNum: number;
  } | null>(null);

  // Today's date (YYYY-MM-DD)
  const [date] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const passInputRef = useRef<HTMLInputElement>(null);
  const lookupAbortRef = useRef<number>(0);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/');
        return;
      }
      const ADMIN_EMAIL = "milankr.mandal2000@gmail.com";
      if (data.session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.session.user.id)
          .single();
        if (!profile || profile.status !== 'approved') {
          await supabase.auth.signOut();
          router.push('/');
        }
      }
    };
    checkAuth();
    passInputRef.current?.focus();
  }, [router]);

  // Generate lookup candidates for flexible matching (e.g. "5", "05", "005")
  const getPassCandidates = useCallback((rawPass: string): string[] => {
    const trimmed = rawPass.trim();
    if (!trimmed) return [];
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      return Array.from(new Set([
        trimmed,
        String(num),
        String(num).padStart(2, '0'),
        String(num).padStart(3, '0'),
      ]));
    }
    return [trimmed];
  }, []);

  // Perform search ONLY within currently selected category (Stage or Duo)
  const performLookup = useCallback(async (pass: string, type: "stag" | "duo") => {
    const trimmed = pass.trim();
    if (!trimmed) {
      setName1("");
      setName2("");
      setStatus("idle");
      setIsChecking(false);
      return;
    }

    const currentLookupId = ++lookupAbortRef.current;
    setIsChecking(true);

    try {
      const candidates = getPassCandidates(trimmed);

      // 1. Search Supabase database entries in selected category
      const filterConditions = candidates.map(c => `pass_serial.ilike.${c}_${type}_%`).join(',');
      const { data: dbMatches, error } = await supabase
        .from('entries')
        .select('pass_serial, entry_type, name_1, name_2, entry_date, created_at')
        .eq('entry_type', type)
        .or(filterConditions)
        .order('entry_date', { ascending: false });

      if (currentLookupId !== lookupAbortRef.current) return;
      if (error) console.error("Database lookup error:", error);

      // 2. Search local preRegistered array in selected category
      const localMatch = preRegistered.find(p =>
        p.entry_type === type &&
        candidates.includes(String(p.pass_serial).trim())
      );

      let matchedName1 = "";
      let matchedName2 = "";
      let foundMatch = false;

      if (dbMatches && dbMatches.length > 0) {
        // Take latest recorded participant names
        matchedName1 = dbMatches[0].name_1 || "";
        matchedName2 = dbMatches[0].name_2 || "";
        foundMatch = true;
      } else if (localMatch) {
        matchedName1 = localMatch.name_1 || "";
        matchedName2 = localMatch.name_2 || "";
        foundMatch = true;
      }

      if (foundMatch) {
        // Autofill existing details
        setName1(matchedName1);
        setName2(type === "duo" ? matchedName2 : "");

        // Check if already checked-in TODAY for this category & pass
        const checkedInToday = dbMatches?.some(d => d.entry_date === date);
        if (checkedInToday) {
          setStatus("duplicate");
        } else {
          setStatus("idle");
        }
      } else {
        // Pass not found: allow manual entry without blocking or unnecessary popups
        setStatus("idle");
      }
    } catch (err) {
      console.error("Lookup exception:", err);
      if (currentLookupId === lookupAbortRef.current) {
        setStatus("idle");
      }
    } finally {
      if (currentLookupId === lookupAbortRef.current) {
        setIsChecking(false);
      }
    }
  }, [date, getPassCandidates]);

  // Debounced search on passSerial or entryType change
  useEffect(() => {
    if (!passSerial.trim()) {
      setName1("");
      setName2("");
      setStatus("idle");
      setIsChecking(false);
      return;
    }

    const timer = setTimeout(() => {
      performLookup(passSerial, entryType);
    }, 300);

    return () => clearTimeout(timer);
  }, [passSerial, entryType, performLookup]);

  // Handle manual category toggle
  const handleTypeSelect = (selectedType: "stag" | "duo") => {
    if (selectedType === entryType) return;
    setEntryType(selectedType);
    setName1("");
    setName2("");
    setStatus("idle");
    setDuplicateNameWarning(null);
    setErrorMsg("");
    // If a pass number is already typed, re-run lookup immediately in new category
    if (passSerial.trim()) {
      performLookup(passSerial, selectedType);
    }
  };

  // Normalized Name Validation on Blur (Checks for duplicate full names)
  const handleNameBlur = async (nameToVerify: string, memberNum: number) => {
    const trimmed = nameToVerify.trim();
    // Only check when complete full name (at least first & last name) is entered
    if (!trimmed || !trimmed.includes(' ')) return;

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedInput = normalize(trimmed);
    const candidates = getPassCandidates(passSerial);

    try {
      // Query database for matching full name
      const { data: dbRecords, error } = await supabase
        .from('entries')
        .select('pass_serial, entry_type, name_1, name_2')
        .or(`name_1.ilike."${trimmed}",name_2.ilike."${trimmed}"`)
        .limit(10);

      if (error) console.error("Name duplicate check error:", error);

      // Check DB records for a conflict on a DIFFERENT pass
      if (dbRecords && dbRecords.length > 0) {
        for (const record of dbRecords) {
          const recordPass = record.pass_serial ? record.pass_serial.split('_')[0] : '';
          if (candidates.includes(recordPass)) continue; // Same pass, ignore

          if (record.name_1 && normalize(record.name_1) === normalizedInput) {
            setDuplicateNameWarning({
              pass: recordPass,
              type: record.entry_type || "",
              existingName: record.name_1,
              participantNum: 1,
            });
            return;
          }
          if (record.name_2 && normalize(record.name_2) === normalizedInput) {
            setDuplicateNameWarning({
              pass: recordPass,
              type: record.entry_type || "",
              existingName: record.name_2,
              participantNum: 2,
            });
            return;
          }
        }
      }

      // Check preRegistered records
      for (const p of preRegistered) {
        const pPass = String(p.pass_serial).trim();
        if (candidates.includes(pPass)) continue; // Same pass, ignore

        if (p.name_1 && normalize(p.name_1) === normalizedInput) {
          setDuplicateNameWarning({
            pass: pPass,
            type: p.entry_type || "",
            existingName: p.name_1,
            participantNum: 1,
          });
          return;
        }
        if (p.name_2 && normalize(p.name_2) === normalizedInput) {
          setDuplicateNameWarning({
            pass: pPass,
            type: p.entry_type || "",
            existingName: p.name_2,
            participantNum: 2,
          });
          return;
        }
      }
    } catch (err) {
      console.error("Name blur verification error:", err);
    }
  };

  // Reset form after entry or dismiss
  const resetForm = () => {
    setPassSerial("");
    setName1("");
    setName2("");
    setStatus("idle");
    setErrorMsg("");
    setDuplicateNameWarning(null);
    setIsChecking(false);
    setTimeout(() => {
      passInputRef.current?.focus();
    }, 100);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Core submit function
  const submitEntry = async () => {
    const rawPass = passSerial.trim();
    if (!rawPass || !name1.trim()) return;

    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      // 1. Double check duplicate for today before inserting
      const candidates = getPassCandidates(rawPass);
      const filterConditions = candidates.map(c => `pass_serial.eq.${c}_${entryType}_${date}`).join(',');
      const { data: existingEntry } = await supabase
        .from('entries')
        .select('id')
        .or(filterConditions)
        .maybeSingle();

      if (existingEntry) {
        setStatus("duplicate");
        setLoading(false);
        return;
      }

      // 2. Insert new attendance record
      // Standardize pass serial: if numeric, pad to 3 digits for consistency, else use trimmed
      const num = parseInt(rawPass, 10);
      const standardPass = !isNaN(num) ? String(num).padStart(3, '0') : rawPass;
      const serialKey = `${standardPass}_${entryType}_${date}`;

      const { error } = await supabase
        .from('entries')
        .insert([
          {
            pass_serial: serialKey,
            name_1: name1.trim().toUpperCase(),
            name_2: entryType === "duo" && name2.trim() ? name2.trim().toUpperCase() : null,
            entry_type: entryType,
            entry_date: date,
          }
        ]);

      if (error) {
        if (error.code === '23505') {
          setStatus("duplicate");
        } else {
          setStatus("error");
          setErrorMsg(error.message);
        }
      } else {
        setStatus("success");
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passSerial.trim()) {
      setErrorMsg("Please enter a Pass Number.");
      setStatus("error");
      return;
    }
    if (!name1.trim()) {
      setErrorMsg("Please enter the participant name.");
      setStatus("error");
      return;
    }
    if (!name1.trim().includes(' ')) {
      setStatus("error");
      setErrorMsg("Participant 1 must have a Full Name (First and Last Name).");
      return;
    }
    if (entryType === "duo" && name2.trim() && !name2.trim().includes(' ')) {
      setStatus("error");
      setErrorMsg("Participant 2 must have a Full Name (First and Last Name).");
      return;
    }

    // If duplicate name warning is currently active, wait for admin's confirmation
    if (duplicateNameWarning) {
      return;
    }

    await submitEntry();
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

        {/* Main Entry Card */}
        <div className="w-full max-w-lg ornate-card p-1 sm:p-2 relative z-10 mx-auto mt-2">
          <div className="border-dots opacity-50 mt-2 mx-4"></div>
          
          <div className="p-6 sm:p-8 relative">
            <DandiyaIcon className="w-16 h-16 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(245,183,0,0.5)]" />

            {/* Glassmorphism Modals */}

            {/* Success Popup */}
            {status === "success" && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" 
                onClick={resetForm}
              >
                <div 
                  className="bg-garba-green/20 backdrop-blur-xl border border-garba-green/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(34,197,94,0.3)] transform transition-all animate-bounce-in" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-6 drop-shadow-md" />
                  <h2 className="text-3xl font-black text-green-400 mb-2 uppercase tracking-widest drop-shadow-md">Entry Granted</h2>
                  <p className="text-green-100 text-lg mb-8 font-medium">Welcome to Maha Garba!</p>
                  <button 
                    onClick={resetForm}
                    className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3.5 rounded-xl shadow-lg transition-colors text-lg"
                  >
                    Next Pass
                  </button>
                </div>
              </div>
            )}

            {/* Duplicate / Already Present Popup */}
            {status === "duplicate" && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" 
                onClick={resetForm}
              >
                <div 
                  className="bg-orange-500/20 backdrop-blur-xl border border-orange-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(249,115,22,0.3)] transform transition-all animate-bounce-in" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertCircle className="w-20 h-20 text-orange-400 mx-auto mb-6 drop-shadow-md" />
                  <h2 className="text-3xl font-black text-orange-400 mb-2 uppercase tracking-widest drop-shadow-md">Already Present</h2>
                  <p className="text-orange-100 text-lg mb-8 font-medium">
                    This {entryType.toUpperCase()} pass has already been marked present for today.
                  </p>
                  <button 
                    onClick={resetForm}
                    className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-3.5 rounded-xl shadow-lg transition-colors text-lg"
                  >
                    Scan Another Pass
                  </button>
                </div>
              </div>
            )}

            {/* Error Popup */}
            {status === "error" && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" 
                onClick={() => setStatus("idle")}
              >
                <div 
                  className="bg-red-500/20 backdrop-blur-xl border border-red-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(239,68,68,0.3)] transform transition-all animate-bounce-in" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6 drop-shadow-md" />
                  <h2 className="text-3xl font-black text-red-400 mb-2 uppercase tracking-widest drop-shadow-md">Notice</h2>
                  <p className="text-red-100 text-lg mb-8 font-medium break-words">{errorMsg}</p>
                  <button 
                    onClick={() => setStatus("idle")}
                    className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl shadow-lg transition-colors text-lg"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* Duplicate Name Warning Popup */}
            {duplicateNameWarning && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in" 
                onClick={() => setDuplicateNameWarning(null)}
              >
                <div 
                  className="bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_8px_32px_rgba(234,179,8,0.3)] transform transition-all animate-bounce-in" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertCircle className="w-20 h-20 text-yellow-400 mx-auto mb-6 drop-shadow-md" />
                  <h2 className="text-2xl font-black text-yellow-400 mb-2 uppercase tracking-wide drop-shadow-md">Name Exists!</h2>
                  <p className="text-yellow-100 text-[15px] mb-6 font-medium leading-relaxed">
                    The name <strong className="text-white font-bold">"{duplicateNameWarning.existingName}"</strong> is already registered under:
                    <strong className="text-white text-lg block mt-2 tracking-wider">
                      {duplicateNameWarning.type.toUpperCase()} PASS - {duplicateNameWarning.pass.split('_')[0]}
                    </strong>
                    <span className="text-white/80 text-sm mt-1 block">
                      As Participant {duplicateNameWarning.participantNum}
                    </span>
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
                        submitEntry();
                      }}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl shadow-lg transition-colors"
                    >
                      Proceed Anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Gate Entry Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* 1. Step 1: Select Pass Type (Stage or Duo) FIRST */}
              <div className="flex flex-col gap-2">
                <label className="text-garba-gold font-bold text-sm tracking-wider uppercase flex items-center justify-between">
                  <span>1. Select Pass Type</span>
                  <span className="text-xs text-garba-light/60 lowercase">(choose before or during entry)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTypeSelect("stag")}
                    className={`py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-bold border-2 transition-all active:scale-[0.98] ${
                      entryType === "stag" 
                        ? "bg-garba-gold text-garba-maroon border-garba-gold shadow-[0_0_20px_rgba(245,183,0,0.4)]" 
                        : "bg-garba-darkred text-white/70 border-white/10 hover:border-garba-gold/30 hover:text-white"
                    }`}
                  >
                    <User className="w-5 h-5" /> 
                    <span className="text-base tracking-wide">STAG (1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeSelect("duo")}
                    className={`py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-bold border-2 transition-all active:scale-[0.98] ${
                      entryType === "duo" 
                        ? "bg-garba-gold text-garba-maroon border-garba-gold shadow-[0_0_20px_rgba(245,183,0,0.4)]" 
                        : "bg-garba-darkred text-white/70 border-white/10 hover:border-garba-gold/30 hover:text-white"
                    }`}
                  >
                    <Users className="w-5 h-5" /> 
                    <span className="text-base tracking-wide">DUO (2)</span>
                  </button>
                </div>
              </div>

              {/* 2. Step 2: Pass Serial Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-garba-gold font-bold text-sm tracking-wider uppercase flex justify-between items-center">
                  <span>2. Pass Number ({entryType.toUpperCase()})</span>
                  {isChecking && (
                    <span className="flex items-center gap-1.5 text-xs text-garba-gold font-normal animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching {entryType.toUpperCase()}...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-gold/70" />
                  <input 
                    ref={passInputRef}
                    type="text" 
                    value={passSerial}
                    onChange={(e) => setPassSerial(e.target.value)}
                    placeholder={`e.g. 5 or 005 (${entryType.toUpperCase()})`}
                    className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold font-mono text-lg transition-colors"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* 3. Participant Name(s) */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">
                    {entryType === "stag" ? "Participant Full Name" : "Participant 1 Full Name"}
                  </label>
                  <input 
                    type="text" 
                    value={name1}
                    onChange={(e) => setName1(e.target.value)}
                    onBlur={() => handleNameBlur(name1, 1)}
                    placeholder="Enter first & last name"
                    className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                  />
                </div>
                
                {entryType === "duo" && (
                  <div className="flex flex-col gap-1.5 animate-fade-in-down">
                    <label className="text-garba-gold font-bold text-sm tracking-wide uppercase">
                      Participant 2 Full Name
                    </label>
                    <input 
                      type="text" 
                      value={name2}
                      onChange={(e) => setName2(e.target.value)}
                      onBlur={() => handleNameBlur(name2, 2)}
                      placeholder="Enter second participant name"
                      className="w-full bg-garba-darkred border-2 border-garba-gold/30 rounded-xl py-3 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-garba-gold transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Valid Date Banner */}
              <div className="flex items-center gap-2 text-garba-gold/80 bg-garba-darkred p-3 rounded-xl border border-garba-gold/10">
                <Calendar className="w-5 h-5 text-garba-gold" />
                <span className="text-sm font-medium">Valid for Date: <strong className="text-white">{date}</strong></span>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={loading || status === "duplicate"}
                className="mt-2 w-full bg-gradient-to-r from-garba-gold to-yellow-500 hover:from-yellow-400 hover:to-yellow-300 text-garba-maroon font-black text-xl py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 text-garba-maroon animate-spin" />
                ) : (
                  "VALIDATE & ENTER"
                )}
              </button>
            </form>
          </div>

          <div className="border-dots opacity-50 mb-4 mx-4"></div>
        </div>
        
        {/* Custom Animations */}
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
