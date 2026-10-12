"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, User, Users, Calendar, Ticket, LogOut, Loader2 } from "lucide-react";
import { DandiyaIcon } from "@/components/DandiyaIcon";
import { LotusMotif, CornerFlourish } from "@/components/Ornaments";
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
  const getPassCandidates = (raw: string): string[] => {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const candidates = new Set<string>();
    candidates.add(trimmed);
    candidates.add(trimmed.toUpperCase());
    candidates.add(trimmed.toLowerCase());

    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      candidates.add(String(num));
      candidates.add(String(num).padStart(2, '0'));
      candidates.add(String(num).padStart(3, '0'));
      candidates.add(String(num).padStart(4, '0'));
    }

    const unpadded = trimmed.replace(/^0+/, '');
    if (unpadded) candidates.add(unpadded);

    return Array.from(candidates);
  };

  // Automated lookup within manually selected category
  const handlePassLookup = useCallback(async (typedPass: string, selectedType: "stag" | "duo") => {
    const query = typedPass.trim();
    const currentCallId = ++lookupAbortRef.current;

    if (!query) {
      setName1("");
      setName2("");
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const candidates = getPassCandidates(query);

    try {
      // 1. Check if already marked present today
      const filterConditions = candidates.map(c => `pass_serial.eq.${c}_${selectedType}_${date}`).join(',');
      const { data: existingEntry } = await supabase
        .from('entries')
        .select('id, name_1, name_2')
        .or(filterConditions)
        .maybeSingle();

      if (currentCallId !== lookupAbortRef.current) return;

      if (existingEntry) {
        if (existingEntry.name_1) setName1(existingEntry.name_1);
        if (existingEntry.name_2) setName2(existingEntry.name_2);
        setStatus("duplicate");
        setIsChecking(false);
        return;
      }

      // 2. Search local pre-registered database
      let foundPre: any = null;
      if (Array.isArray(preRegistered)) {
        foundPre = preRegistered.find((p: any) => 
          (p.entry_type || "").toLowerCase() === selectedType &&
          candidates.includes(String(p.pass_serial || p.pass).trim())
        );
      } else {
        const preList = (preRegistered as any)[selectedType] || [];
        foundPre = preList.find((p: any) => 
          candidates.includes(String(p.pass || p.pass_serial).trim())
        );
      }

      if (foundPre) {
        if (currentCallId !== lookupAbortRef.current) return;
        setName1(foundPre.name_1 || foundPre.name1 || "");
        setName2(foundPre.name_2 || foundPre.name2 || "");
        setIsChecking(false);
        return;
      }

      // 3. Search Supabase entries history
      const passSerialConditions = candidates.map(c => `pass_serial.ilike.${c}_${selectedType}_%`).join(',');
      const { data: historyEntries } = await supabase
        .from('entries')
        .select('name_1, name_2')
        .eq('entry_type', selectedType)
        .or(passSerialConditions)
        .order('created_at', { ascending: false })
        .limit(1);

      if (currentCallId !== lookupAbortRef.current) return;

      if (historyEntries && historyEntries.length > 0) {
        setName1(historyEntries[0].name_1 || "");
        setName2(historyEntries[0].name_2 || "");
        setIsChecking(false);
        return;
      }

      // 4. Pass not found in selected category: Allow new entry smoothly
      setIsChecking(false);

    } catch (err) {
      console.error("Lookup error:", err);
      if (currentCallId === lookupAbortRef.current) {
        setIsChecking(false);
      }
    }
  }, [date]);

  // Handle Pass Serial typing with debounce
  useEffect(() => {
    if (!passSerial.trim()) {
      setIsChecking(false);
      return;
    }
    const timer = setTimeout(() => {
      handlePassLookup(passSerial, entryType);
    }, 250);
    return () => clearTimeout(timer);
  }, [passSerial, entryType, handlePassLookup]);

  // Handle manual category button switch
  const handleTypeSelect = (newType: "stag" | "duo") => {
    if (newType === entryType) return;
    setEntryType(newType);
    if (newType === "stag") {
      setName2("");
    }
    if (passSerial.trim()) {
      handlePassLookup(passSerial, newType);
    }
  };

  // Duplicate name check against other registered passes
  const handleNameBlur = async (name: string, participantNumber: 1 | 2) => {
    const trimmed = name.trim();
    if (!trimmed || !trimmed.includes(' ')) return;

    try {
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const normalizedInput = normalize(trimmed);
      const currentPassNum = passSerial.trim();

      // 1. Check local pre-registered records
      const allPre = Array.isArray(preRegistered) ? preRegistered : [
        ...((preRegistered as any).stag || []).map((x: any) => ({ ...x, entry_type: "stag" })),
        ...((preRegistered as any).duo || []).map((x: any) => ({ ...x, entry_type: "duo" }))
      ];

      for (const item of allPre) {
        const itemType = (item.entry_type || "").toLowerCase();
        const itemPass = String(item.pass_serial || item.pass || "").trim();
        if (itemType === entryType && itemPass === currentPassNum) continue;

        const p1Name = item.name_1 || item.name1;
        const p2Name = item.name_2 || item.name2;

        if (p1Name && normalize(p1Name) === normalizedInput) {
          setDuplicateNameWarning({
            pass: itemPass,
            type: itemType,
            existingName: p1Name,
            participantNum: 1,
          });
          return;
        }
        if (p2Name && normalize(p2Name) === normalizedInput) {
          setDuplicateNameWarning({
            pass: itemPass,
            type: itemType,
            existingName: p2Name,
            participantNum: 2,
          });
          return;
        }
      }

      // 2. Check Supabase entries
      const { data: dbMatches } = await supabase
        .from('entries')
        .select('pass_serial, entry_type, name_1, name_2')
        .or(`name_1.ilike.%${trimmed}%,name_2.ilike.%${trimmed}%`)
        .limit(10);

      if (!dbMatches) return;

      for (const p of dbMatches) {
        const pPass = (p.pass_serial || "").split('_')[0];
        if (p.entry_type === entryType && pPass === currentPassNum) continue;

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

    if (duplicateNameWarning) {
      return;
    }

    await submitEntry();
  };

  return (
    <>
      <div className="bg-app"></div>
      <div className="bg-overlay"></div>
      
      {/* Top Bar with Logout Button */}
      <div className="fixed top-3 right-3 sm:top-5 sm:right-5 z-30">
        <button 
          type="button"
          onClick={handleLogout}
          className="bg-black/60 hover:bg-black/85 text-amber-400 border border-amber-500/30 p-2.5 sm:p-3 rounded-xl transition-all shadow-lg cursor-pointer touch-manipulation select-none active:opacity-80 flex items-center gap-1.5"
          title="Logout"
        >
          <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5 pointer-events-none" />
          <span className="hidden sm:inline text-xs font-semibold tracking-wider text-amber-300 uppercase pointer-events-none">Exit</span>
        </button>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-12 font-sans pointer-events-auto">
        
        {/* Decorative Header (Dandiya + 3D Maha Garba Logo) */}
        <div className="w-full max-w-[440px] sm:max-w-[460px] flex flex-col items-center text-center mb-3 sm:mb-4 select-none">
          <DandiyaIcon className="w-24 sm:w-28 h-auto mb-1.5" />
          <img 
            src="/maha-garba-logo-clean.png" 
            alt="Maha Garba Gate Entry" 
            className="w-full max-w-[320px] sm:max-w-[380px] h-auto object-contain mx-auto drop-shadow-[0_4px_24px_rgba(245,183,0,0.45)] pointer-events-none"
          />
        </div>

        {/* Ornate Gate Entry Card */}
        <div className="w-full max-w-[440px] sm:max-w-[460px] relative mx-auto">
          
          {/* Top Lotus Motif on outer border */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
            <LotusMotif className="w-7 h-5 sm:w-8 sm:h-5.5 drop-shadow-[0_2px_8px_rgba(245,158,11,0.7)]" />
          </div>

          {/* Bottom Lotus Motif on outer border */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
            <LotusMotif className="w-7 h-5 sm:w-8 sm:h-5.5 drop-shadow-[0_2px_8px_rgba(245,158,11,0.7)]" />
          </div>

          {/* Outer Border Frame */}
          <div className="border border-amber-500/70 rounded-2xl p-1 sm:p-1.5 shadow-[0_15px_50px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[#2a0405] via-[#1a0102] to-[#250304]/95 backdrop-blur-xl">
            
            {/* Inner Border Frame */}
            <div className="border border-amber-600/30 rounded-[14px] p-4 sm:p-6 relative overflow-hidden bg-[#180203]/70">
              
              {/* Corner Filigrees */}
              <div className="absolute top-1 left-1 pointer-events-none z-10 select-none">
                <CornerFlourish position="top-left" className="w-5 h-5 sm:w-6 sm:h-6 opacity-90" />
              </div>
              <div className="absolute top-1 right-1 pointer-events-none z-10 select-none">
                <CornerFlourish position="top-right" className="w-5 h-5 sm:w-6 sm:h-6 opacity-90" />
              </div>
              <div className="absolute bottom-1 left-1 pointer-events-none z-10 select-none">
                <CornerFlourish position="bottom-left" className="w-5 h-5 sm:w-6 sm:h-6 opacity-90" />
              </div>
              <div className="absolute bottom-1 right-1 pointer-events-none z-10 select-none">
                <CornerFlourish position="bottom-right" className="w-5 h-5 sm:w-6 sm:h-6 opacity-90" />
              </div>

              {/* Glassmorphism Modals */}

              {/* Success Popup */}
              {status === "success" && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in cursor-pointer" 
                  onClick={resetForm}
                >
                  <div 
                    className="bg-[#0b2912]/90 border border-green-500/50 rounded-2xl p-6 sm:p-8 max-w-[92vw] sm:max-w-sm w-full text-center shadow-[0_8px_32px_rgba(34,197,94,0.35)] transform transition-all animate-bounce-in cursor-default" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CheckCircle2 className="w-14 h-14 sm:w-20 sm:h-20 text-green-400 mx-auto mb-4 sm:mb-6 drop-shadow-md pointer-events-none" />
                    <h2 className="text-2xl sm:text-3xl font-black text-green-400 mb-1 sm:mb-2 uppercase tracking-widest drop-shadow-md select-none">Entry Granted</h2>
                    <p className="text-green-100 text-base sm:text-lg mb-6 sm:mb-8 font-medium select-none">Welcome to Maha Garba!</p>
                    <button 
                      type="button"
                      onClick={resetForm}
                      className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 sm:py-3.5 rounded-xl shadow-lg transition-colors text-base sm:text-lg cursor-pointer touch-manipulation select-none active:opacity-90 uppercase tracking-wide"
                    >
                      Next Pass
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate / Already Present Popup */}
              {status === "duplicate" && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in cursor-pointer" 
                  onClick={resetForm}
                >
                  <div 
                    className="bg-[#381102]/90 border border-orange-500/50 rounded-2xl p-6 sm:p-8 max-w-[92vw] sm:max-w-sm w-full text-center shadow-[0_8px_32px_rgba(249,115,22,0.35)] transform transition-all animate-bounce-in cursor-default" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertCircle className="w-14 h-14 sm:w-20 sm:h-20 text-orange-400 mx-auto mb-4 sm:mb-6 drop-shadow-md pointer-events-none" />
                    <h2 className="text-2xl sm:text-3xl font-black text-orange-400 mb-1 sm:mb-2 uppercase tracking-widest drop-shadow-md select-none">Already Present</h2>
                    <p className="text-orange-100 text-sm sm:text-base mb-6 sm:mb-8 font-medium select-none">
                      This {entryType.toUpperCase()} pass has already been marked present for today.
                    </p>
                    <button 
                      type="button"
                      onClick={resetForm}
                      className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-3 sm:py-3.5 rounded-xl shadow-lg transition-colors text-base sm:text-lg cursor-pointer touch-manipulation select-none active:opacity-90 uppercase tracking-wide"
                    >
                      Scan Another Pass
                    </button>
                  </div>
                </div>
              )}

              {/* Error Popup */}
              {status === "error" && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in cursor-pointer" 
                  onClick={() => setStatus("idle")}
                >
                  <div 
                    className="bg-[#3b0808]/90 border border-red-500/50 rounded-2xl p-6 sm:p-8 max-w-[92vw] sm:max-w-sm w-full text-center shadow-[0_8px_32px_rgba(239,68,68,0.35)] transform transition-all animate-bounce-in cursor-default" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertCircle className="w-14 h-14 sm:w-20 sm:h-20 text-red-400 mx-auto mb-4 sm:mb-6 drop-shadow-md pointer-events-none" />
                    <h2 className="text-2xl sm:text-3xl font-black text-red-400 mb-1 sm:mb-2 uppercase tracking-widest drop-shadow-md select-none">Notice</h2>
                    <p className="text-red-100 text-sm sm:text-base mb-6 sm:mb-8 font-medium break-words select-none">{errorMsg}</p>
                    <button 
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl shadow-lg transition-colors text-base sm:text-lg cursor-pointer touch-manipulation select-none active:opacity-90 uppercase tracking-wide"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Name Warning Popup */}
              {duplicateNameWarning && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in cursor-pointer" 
                  onClick={() => setDuplicateNameWarning(null)}
                >
                  <div 
                    className="bg-[#382602]/90 border border-amber-500/50 rounded-2xl p-5 sm:p-8 max-w-[92vw] sm:max-w-sm w-full text-center shadow-[0_8px_32px_rgba(234,179,8,0.35)] transform transition-all animate-bounce-in cursor-default" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-3 sm:mb-4 drop-shadow-md pointer-events-none" />
                    <h2 className="text-xl sm:text-2xl font-black text-yellow-400 mb-2 uppercase tracking-wide drop-shadow-md select-none">Name Exists!</h2>
                    <p className="text-yellow-100 text-xs sm:text-sm mb-5 sm:mb-6 font-medium leading-relaxed select-none">
                      The name <strong className="text-white font-bold">"{duplicateNameWarning.existingName}"</strong> is already registered under:
                      <strong className="text-white text-base sm:text-lg block mt-1.5 tracking-wider">
                        {duplicateNameWarning.type.toUpperCase()} PASS - {duplicateNameWarning.pass.split('_')[0]}
                      </strong>
                      <span className="text-white/80 text-xs sm:text-sm mt-0.5 block">
                        As Participant {duplicateNameWarning.participantNum}
                      </span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                      <button 
                        type="button"
                        onClick={() => setDuplicateNameWarning(null)}
                        className="w-full sm:flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 sm:py-3 rounded-xl transition-colors border border-white/20 cursor-pointer touch-manipulation select-none active:opacity-80 text-sm sm:text-base uppercase"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setDuplicateNameWarning(null);
                          submitEntry();
                        }}
                        className="w-full sm:flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 sm:py-3 rounded-xl shadow-lg transition-colors cursor-pointer touch-manipulation select-none active:opacity-90 text-sm sm:text-base uppercase"
                      >
                        Proceed Anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Gate Entry Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-4.5 relative z-10 pt-1">
                
                {/* 1. SELECT PASS TYPE */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-amber-400 font-bold text-xs tracking-wider uppercase select-none">
                    1. SELECT PASS TYPE
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Stag (1) */}
                    <button
                      type="button"
                      onClick={() => handleTypeSelect("stag")}
                      className={`p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer touch-manipulation select-none active:opacity-90 ${
                        entryType === "stag" 
                          ? "border-2 border-amber-400 bg-[#3a090b] shadow-[0_0_15px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/40" 
                          : "border border-amber-950/70 bg-[#160203]/80 hover:border-amber-800/40 hover:bg-[#200304]"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg shrink-0 pointer-events-none">
                        <User className={`w-5 h-5 ${entryType === "stag" ? "text-amber-400" : "text-stone-400/60"}`} /> 
                      </div>
                      <div className="flex flex-col text-left leading-tight pointer-events-none">
                        <span className={`font-bold text-xs sm:text-sm tracking-wide ${entryType === "stag" ? "text-amber-400" : "text-stone-300"}`}>
                          STAG (1)
                        </span>
                        <span className={`text-[10px] sm:text-[11px] ${entryType === "stag" ? "text-amber-200/70" : "text-stone-400/50"}`}>
                          Single Entry
                        </span>
                      </div>
                    </button>

                    {/* Duo (2) */}
                    <button
                      type="button"
                      onClick={() => handleTypeSelect("duo")}
                      className={`p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer touch-manipulation select-none active:opacity-90 ${
                        entryType === "duo" 
                          ? "border-2 border-amber-400 bg-[#3a090b] shadow-[0_0_15px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/40" 
                          : "border border-amber-950/70 bg-[#160203]/80 hover:border-amber-800/40 hover:bg-[#200304]"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg shrink-0 pointer-events-none">
                        <Users className={`w-5 h-5 ${entryType === "duo" ? "text-amber-400" : "text-stone-400/60"}`} /> 
                      </div>
                      <div className="flex flex-col text-left leading-tight pointer-events-none">
                        <span className={`font-bold text-xs sm:text-sm tracking-wide ${entryType === "duo" ? "text-amber-400" : "text-stone-300"}`}>
                          DUO (2)
                        </span>
                        <span className={`text-[10px] sm:text-[11px] ${entryType === "duo" ? "text-amber-200/70" : "text-stone-400/50"}`}>
                          Two Participants
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. PASS SERIAL NUMBER */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center min-h-[18px]">
                    <label className="text-amber-400 font-bold text-xs tracking-wider uppercase select-none">
                      2. PASS SERIAL NUMBER
                    </label>
                    {isChecking && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-300 font-medium animate-pulse select-none">
                        <Loader2 className="w-3 h-3 animate-spin pointer-events-none" />
                        Searching {entryType.toUpperCase()}...
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Ticket className="absolute left-3.5 w-4 h-4 sm:w-5 sm:h-5 text-amber-400/80 pointer-events-none" />
                    <input 
                      ref={passInputRef}
                      type="text" 
                      value={passSerial}
                      onChange={(e) => setPassSerial(e.target.value)}
                      placeholder="Enter pass serial number"
                      className="w-full bg-[#160203] border border-amber-600/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-11 pr-3 sm:pr-4 text-white placeholder:text-stone-400/50 text-base transition-all font-sans"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* 3. PARTICIPANT DETAILS */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-amber-400 font-bold text-xs tracking-wider uppercase select-none">
                    3. PARTICIPANT DETAILS
                  </label>
                  
                  {/* Participant 1 */}
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 w-4 h-4 sm:w-5 sm:h-5 text-amber-400/80 pointer-events-none" />
                    <input 
                      type="text" 
                      value={name1}
                      onChange={(e) => setName1(e.target.value)}
                      onBlur={() => handleNameBlur(name1, 1)}
                      placeholder="Enter full name"
                      className="w-full bg-[#160203] border border-amber-600/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-11 pr-3 sm:pr-4 text-white placeholder:text-stone-400/50 text-base transition-all font-sans"
                    />
                  </div>
                  
                  {/* Participant 2 (Duo only) */}
                  {entryType === "duo" && (
                    <div className="relative flex items-center animate-fade-in-down">
                      <Users className="absolute left-3.5 w-4 h-4 sm:w-5 sm:h-5 text-amber-400/80 pointer-events-none" />
                      <input 
                        type="text" 
                        value={name2}
                        onChange={(e) => setName2(e.target.value)}
                        onBlur={() => handleNameBlur(name2, 2)}
                        placeholder="Enter second participant name (for Duo)"
                        className="w-full bg-[#160203] border border-amber-600/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-11 pr-3 sm:pr-4 text-white placeholder:text-stone-400/50 text-base transition-all font-sans"
                      />
                    </div>
                  )}

                  {/* Valid Date Banner */}
                  <div className="flex items-center gap-2.5 bg-[#250406] border border-red-950/80 py-2.5 px-3.5 rounded-xl text-xs sm:text-sm select-none">
                    <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 pointer-events-none shrink-0" />
                    <span className="text-amber-200/90 font-medium">Valid for Date: <strong className="text-white font-bold ml-1">{date}</strong></span>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit"
                  disabled={loading || status === "duplicate"}
                  className="mt-1 w-full bg-gradient-to-r from-[#ffbe3b] via-[#f59e0b] to-[#d97706] hover:from-[#fcd34d] hover:to-[#f59e0b] text-black font-black text-base sm:text-lg py-3 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-[0_4px_22px_rgba(245,158,11,0.45)] transition-all cursor-pointer touch-manipulation select-none active:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-wide uppercase"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-black animate-spin pointer-events-none" />
                      <span>VALIDATING...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-black fill-black/15 pointer-events-none" />
                      <span>VALIDATE & ENTER</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Custom Animations */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fade-in-down {
            0% { opacity: 0; transform: translateY(-8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes bounce-in {
            0% { transform: scale(0.92); opacity: 0; }
            50% { transform: scale(1.03); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
          .animate-fade-in-down { animation: fade-in-down 0.25s ease-out forwards; }
          .animate-bounce-in { animation: bounce-in 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        `}} />
      </div>
    </>
  );
}
