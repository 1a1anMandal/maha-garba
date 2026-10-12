"use client";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Users, User, Ticket, Calendar, Download, Search, LayoutDashboard, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DandiyaIcon } from "@/components/DandiyaIcon";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export default function AdminDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"entries" | "requests">("entries");
  
  // New Filters
  const [filterDate, setFilterDate] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "stag" | "duo">("all");
  
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Expand State
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Click outside to close export menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#export-menu-container')) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [exportMenuOpen]);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setEntries(data);
    setLoading(false);
  };

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending');
    if (data) setRequests(data);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      const ADMIN_EMAIL = "milankr.mandal2000@gmail.com";
      if (session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        router.push('/entry');
      }
    };
    checkAuth();
    fetchEntries();
    fetchRequests();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('public:entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries' }, (payload) => {
        setEntries(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleApprove = async (id: string) => {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
    fetchRequests();
  };

  const handleReject = async (id: string) => {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id);
    fetchRequests();
  };
  
  const filteredData = entries.filter(d => {
    const matchesSearch = d.pass_serial.split('_')[0].toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.name_1.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (d.name_2 && d.name_2.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDate = filterDate === "all" || d.entry_date === filterDate;
    const matchesType = filterType === "all" || d.entry_type === filterType;
    return matchesSearch && matchesDate && matchesType;
  }).sort((a, b) => (a.pass_serial ? a.pass_serial.split('_')[0] : "").localeCompare(b.pass_serial ? b.pass_serial.split('_')[0] : "", undefined, { numeric: true }));
    const grouped = new Map<string, any>();
    filteredData.forEach(d => {
      const key = `${d.pass_serial.split('_')[0]}_${d.entry_type}`;
      if (!grouped.has(key)) {
        grouped.set(key, d);
      } else {
        const existing = grouped.get(key);
        if (d.entry_date > existing.entry_date) {
          grouped.set(key, d);
        }
      }
    });
    const displayData = Array.from(grouped.values()).sort((a, b) => (a.pass_serial ? a.pass_serial.split('_')[0] : "").localeCompare(b.pass_serial ? b.pass_serial.split('_')[0] : "", undefined, { numeric: true }));


  const allUniquePasses = new Map<string, any>();
  entries.forEach(e => allUniquePasses.set(`${e.pass_serial.split('_')[0]}_${e.entry_type}`, e));
  const uniquePassesArr = Array.from(allUniquePasses.values());

  const totalEntries = uniquePassesArr.length;
  const stagCount = uniquePassesArr.filter(e => e.entry_type === 'stag').length;
  const duoCount = uniquePassesArr.filter(e => e.entry_type === 'duo').length;
  
  const uniqueDates = Array.from(new Set(entries.map(e => e.entry_date))).sort((a, b) => (b as string).localeCompare(a as string));

  const handleExport = async (exportType: 'all' | 'duo' | 'stag' | 'filtered') => {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      let rawData = entries;
      
      if (exportType === 'duo') {
        rawData = entries.filter(e => e.entry_type === 'duo');
      } else if (exportType === 'stag') {
        rawData = entries.filter(e => e.entry_type === 'stag');
      } else if (exportType === 'filtered') {
        rawData = filteredData;
      }
      
      if (!rawData || rawData.length === 0) {
        alert('No records available to export.');
        setIsExporting(false);
        return;
      }

      // Check if this export is single category or combined
      const isDuoOnly = exportType === 'duo' || (exportType === 'filtered' && filterType === 'duo');
      const isStagOnly = exportType === 'stag' || (exportType === 'filtered' && filterType === 'stag');

      // 1. Gather all unique attendance dates present in this export dataset, sorted chronologically ascending
      const dateList = Array.from(new Set(rawData.map(e => e.entry_date).filter(Boolean)))
        .sort((a, b) => (a as string).localeCompare(b as string));

      // Helper to format date header as DD-MMM (e.g. "29-Sep", "01-Oct", "10-Oct")
      const formatDateHeader = (dStr: string) => {
        try {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const mIdx = parseInt(parts[1], 10) - 1;
            return `${parts[2].padStart(2, '0')}-${months[mIdx] || parts[1]}`;
          }
        } catch {}
        return dStr;
      };

      const dateHeaders = dateList.map(d => formatDateHeader(d as string));

      // 2. Group records by unique pass (pass_serial prefix + entry_type)
      interface GroupedPass {
        passNumber: string;
        entryType: 'stag' | 'duo';
        name_1: string;
        name_2: string;
        datesAttended: Set<string>;
      }

      const passMap = new Map<string, GroupedPass>();

      rawData.forEach(item => {
        const passNum = item.pass_serial ? item.pass_serial.split('_')[0] : '';
        const key = `${passNum}_${item.entry_type}`;
        if (!passMap.has(key)) {
          passMap.set(key, {
            passNumber: passNum,
            entryType: item.entry_type,
            name_1: item.name_1 || '',
            name_2: item.name_2 || '',
            datesAttended: new Set([item.entry_date]),
          });
        } else {
          const existing = passMap.get(key)!;
          existing.datesAttended.add(item.entry_date);
          if (!existing.name_1 && item.name_1) existing.name_1 = item.name_1;
          if (!existing.name_2 && item.name_2) existing.name_2 = item.name_2;
        }
      });

      // Sort passes numerically
      const uniquePasses = Array.from(passMap.values()).sort((a, b) =>
        a.passNumber.localeCompare(b.passNumber, undefined, { numeric: true })
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance');

      // 3. Define Header Columns based on export type
      let headerLabels: string[] = [];
      if (isDuoOnly) {
        headerLabels = ['Pass Number (DUO)', 'Name', 'Name 2', ...dateHeaders];
      } else if (isStagOnly) {
        headerLabels = ['Pass Number (STAG)', 'Name', ...dateHeaders];
      } else {
        headerLabels = ['Pass Number', 'Pass Type', 'Name', 'Name 2', ...dateHeaders];
      }

      const headerRow = sheet.addRow(headerLabels);
      headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } }; // Garba Maroon
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD4AF37' } },
          left: { style: 'thin', color: { argb: 'FFD4AF37' } },
          bottom: { style: 'thin', color: { argb: 'FFD4AF37' } },
          right: { style: 'thin', color: { argb: 'FFD4AF37' } }
        };
      });

      // Freeze top row
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      // 4. Populate rows: ONE row per unique pass with columns for attendance
      uniquePasses.forEach(pass => {
        const rowValues: string[] = [];

        if (isDuoOnly) {
          rowValues.push(pass.passNumber);
          rowValues.push(pass.name_1);
          rowValues.push(pass.name_2);
        } else if (isStagOnly) {
          rowValues.push(pass.passNumber);
          rowValues.push(pass.name_1);
        } else {
          rowValues.push(pass.passNumber);
          rowValues.push(pass.entryType.toUpperCase());
          rowValues.push(pass.name_1);
          rowValues.push(pass.name_2);
        }

        // Attendance columns: "Present" if attended, else empty
        dateList.forEach(d => {
          if (pass.datesAttended.has(d as string)) {
            rowValues.push('Present');
          } else {
            rowValues.push('');
          }
        });

        const dataRow = sheet.addRow(rowValues);
        dataRow.height = 20;

        dataRow.eachCell((cell, colNumber) => {
          const isNameCol = isStagOnly 
            ? colNumber === 2 
            : isDuoOnly 
              ? (colNumber === 2 || colNumber === 3)
              : (colNumber === 3 || colNumber === 4);

          cell.alignment = { 
            horizontal: isNameCol ? 'left' : 'center', 
            vertical: 'middle' 
          };

          if (cell.value === 'Present') {
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          } else {
            cell.font = { name: 'Arial', size: 10 };
          }

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        });
      });

      // 5. Adjust column widths
      headerLabels.forEach((_, idx) => {
        const colNum = idx + 1;
        const col = sheet.getColumn(colNum);
        const isNameCol = isStagOnly 
          ? colNum === 2 
          : isDuoOnly 
            ? (colNum === 2 || colNum === 3)
            : (colNum === 3 || colNum === 4);

        if (colNum === 1) {
          col.width = 20; // Pass Number
        } else if (!isDuoOnly && !isStagOnly && colNum === 2) {
          col.width = 14; // Pass Type
        } else if (isNameCol) {
          col.width = 26; // Name / Name 2
        } else {
          col.width = 13; // Date columns
        }
      });

      const buffer = await (workbook.xlsx as any).writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      let fileName = 'Maha_Garba_All_Attendance';
      if (isDuoOnly) fileName = 'Maha_Garba_DUO_Attendance';
      else if (isStagOnly) fileName = 'Maha_Garba_STAG_Attendance';
      else if (exportType === 'filtered') fileName = 'Maha_Garba_Filtered_Attendance';
      
      saveAs(blob, `${fileName}.xlsx`);
      
    } catch (e) {
      console.error(e);
      alert('Error exporting data');
    }
    setIsExporting(false);
  };

  return (
    <>
      <div className="bg-app"></div>
      <div className="bg-overlay"></div>
      <div className="relative z-10 min-h-screen px-3 py-4 sm:p-8">
      
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center ornate-card p-4 sm:p-6 gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <DandiyaIcon className="w-10 sm:w-12 h-auto shrink-0" />
            <div>
              <div className="mb-0.5">
                <img 
                  src="/maha-garba-title-only.png" 
                  alt="Maha Garba" 
                  className="h-5 sm:h-6 w-auto object-contain drop-shadow-[0_2px_10px_rgba(245,183,0,0.4)] pointer-events-none"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-garba-gold uppercase tracking-wider font-[family-name:var(--font-rozha)] text-glow select-none">
                Admin Dashboard
              </h1>
              <p className="text-garba-light/80 text-[11px] sm:text-xs font-semibold tracking-wide select-none">Maha Garba Event Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div id="export-menu-container" className="relative flex-1 sm:flex-initial">
              <button 
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={isExporting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-garba-green hover:bg-green-600 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold text-sm sm:text-base transition-colors disabled:opacity-70 cursor-pointer touch-manipulation select-none active:opacity-90"
              >
                {isExporting ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full pointer-events-none"></span> : <Download className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />}
                <span className="pointer-events-none">{isExporting ? 'Exporting...' : 'Export Data'}</span>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" />
              </button>
              {exportMenuOpen && (
                <div className="absolute left-0 sm:left-auto right-0 mt-2 w-full sm:w-52 bg-black/95 backdrop-blur-xl border border-garba-gold/30 rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
                  <button type="button" onClick={() => handleExport('all')} className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-garba-gold/20 text-white font-semibold text-sm border-b border-garba-gold/10 transition-colors cursor-pointer touch-manipulation select-none">
                    Export All Entries
                  </button>
                  <button type="button" onClick={() => handleExport('duo')} className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-garba-gold/20 text-blue-300 font-semibold text-sm border-b border-garba-gold/10 transition-colors cursor-pointer touch-manipulation select-none">
                    Export Duo Only
                  </button>
                  <button type="button" onClick={() => handleExport('stag')} className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-garba-gold/20 text-garba-green font-semibold text-sm border-b border-garba-gold/10 transition-colors cursor-pointer touch-manipulation select-none">
                    Export Stag Only
                  </button>
                  <button type="button" onClick={() => handleExport('filtered')} className="w-full text-left px-4 py-2.5 sm:py-3 hover:bg-garba-gold/20 text-garba-gold font-semibold text-sm transition-colors cursor-pointer touch-manipulation select-none">
                    Export Filtered View
                  </button>
                </div>
              )}
            </div>
            <button 
              type="button"
              onClick={handleLogout} 
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold text-sm sm:text-base transition-colors cursor-pointer touch-manipulation select-none active:opacity-90 shrink-0"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
              <span className="pointer-events-none">Logout</span>
            </button>
          </div>
        </header>

        {/* Stats Grid: 2 columns on mobile, 4 columns on large */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6 animate-fade-in">
          <StatCard 
            title="Total Passes" 
            value={totalEntries.toString()} 
            icon={<Users className="w-4 h-4 sm:w-6 sm:h-6" />} 
            color="garba-gold" 
            active={filterType === 'all'}
            onClick={() => setFilterType('all')}
          />
          <StatCard 
            title="Stag Passes" 
            value={stagCount.toString()} 
            icon={<User className="w-4 h-4 sm:w-6 sm:h-6" />} 
            color="garba-green" 
            active={filterType === 'stag'}
            onClick={() => setFilterType('stag')}
          />
          <StatCard 
            title="Duo Passes" 
            value={duoCount.toString()} 
            icon={<Ticket className="w-4 h-4 sm:w-6 sm:h-6" />} 
            color="blue-400" 
            active={filterType === 'duo'}
            onClick={() => setFilterType('duo')}
          />
          <StatCard 
            title="Current View" 
            value={displayData.length.toString()} 
            icon={<Calendar className="w-4 h-4 sm:w-6 sm:h-6" />} 
            color="purple-400" 
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 sm:gap-4 border-b border-garba-gold/20 pb-1 sm:pb-2 text-xs sm:text-sm">
          <button 
            type="button"
            onClick={() => setActiveTab('entries')}
            className={`font-bold uppercase tracking-wider px-3 sm:px-4 py-1.5 sm:py-2 transition-colors cursor-pointer touch-manipulation select-none ${activeTab === 'entries' ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 hover:text-garba-light'}`}
          >
            Gate Entries
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`font-bold uppercase tracking-wider px-3 sm:px-4 py-1.5 sm:py-2 transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation select-none ${activeTab === 'requests' ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 hover:text-garba-light'}`}
          >
            Access Requests {requests.length > 0 && <span className="bg-red-600 text-white text-[11px] px-1.5 py-0.5 rounded-full">{requests.length}</span>}
          </button>
        </div>

        {/* Dynamic Section */}
        {activeTab === 'entries' ? (
          <div className="ornate-card overflow-hidden flex flex-col animate-fade-in-down">
            <div className="p-4 sm:p-6 border-b border-garba-gold/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5 sm:gap-4">
              <div className="flex flex-col gap-1 w-full md:w-auto">
                <h2 className="text-lg sm:text-xl font-bold text-garba-gold uppercase tracking-wider">Entries</h2>
                <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
                  <span className="text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                    Total: {displayData.length}
                  </span>
                  <span className="text-garba-green bg-garba-green/10 px-2 py-0.5 rounded">
                    Stag: {displayData.filter(d => d.entry_type === 'stag').length}
                  </span>
                  <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                    Duo: {displayData.filter(d => d.entry_type === 'duo').length}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 w-full md:w-auto">
                <select 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-black/40 border border-garba-gold/30 rounded-lg py-2 px-3 sm:px-4 text-white font-semibold focus:outline-none focus:border-garba-gold transition-colors cursor-pointer text-sm sm:text-base w-full sm:w-auto"
                >
                  <option value="all">All Dates</option>
                  {uniqueDates.map(d => <option key={d as string} value={d as string}>{d as string}</option>)}
                </select>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-garba-light/50 pointer-events-none" />
                  <input 
                    type="text" 
                    placeholder="Search pass or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-garba-gold/30 rounded-lg py-2 pl-9 sm:pl-10 pr-3 sm:pr-4 text-white focus:outline-none focus:border-garba-gold transition-colors text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] sm:min-w-full">
                <thead className="bg-black/40 text-garba-gold text-xs sm:text-sm uppercase">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Pass Serial</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Name(s)</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Type</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Date</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Time</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garba-gold/10 text-garba-light text-xs sm:text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 sm:px-6 py-8 text-center opacity-70 animate-pulse">Loading entries...</td>
                    </tr>
                  ) : displayData.map((row) => (
                    <Fragment key={row.id}>
                      <tr 
                        className={`hover:bg-white/5 transition-colors cursor-pointer select-none ${expandedRowId === row.id ? 'bg-white/5' : ''}`}
                        onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-garba-gold text-sm sm:text-base">{row.pass_serial.split('_')[0]}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold">
                          {row.name_1} {row.name_2 && <span className="text-garba-light/80"><br/>& {row.name_2}</span>}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase ${
                            row.entry_type === 'stag' ? 'bg-garba-green/20 text-garba-green' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {row.entry_type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 opacity-80 whitespace-nowrap">{row.entry_date}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 opacity-80 whitespace-nowrap">{new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                          {expandedRowId === row.id ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-garba-gold inline-block pointer-events-none" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-garba-light/50 inline-block pointer-events-none" />}
                        </td>
                      </tr>
                      {expandedRowId === row.id && (
                        <tr className="bg-black/40">
                          <td colSpan={6} className="px-3 sm:px-6 py-3 sm:py-4 border-t-0">
                            <div className="flex flex-col gap-2 p-1 sm:p-2">
                              <h4 className="text-garba-gold text-xs sm:text-sm font-bold uppercase tracking-wider">Attendance History for Pass {row.pass_serial.split('_')[0]}</h4>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {entries.filter(e => e.pass_serial.split('_')[0] === row.pass_serial.split('_')[0] && e.entry_type === row.entry_type).sort((a,b) => a.entry_date.localeCompare(b.entry_date)).map(historyEntry => (
                                  <span key={historyEntry.id} className="bg-white/10 text-garba-light px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/20 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                                    <Calendar className="w-3 h-3 text-garba-gold pointer-events-none" />
                                    {historyEntry.entry_date}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {!loading && displayData.length === 0 && (
                <div className="p-6 sm:p-8 text-center text-garba-light/50 text-sm sm:text-base">
                  No entries found matching your filters.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ornate-card overflow-hidden flex flex-col animate-fade-in-down">
            <div className="p-4 sm:p-6 border-b border-garba-gold/20 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-garba-gold uppercase tracking-wider">Pending Operator Requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px] sm:min-w-full">
                <thead className="bg-black/40 text-garba-gold text-xs sm:text-sm uppercase">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Full Name</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Email</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider">Request Date</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garba-gold/10 text-garba-light text-xs sm:text-sm">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 sm:px-6 py-8 text-center opacity-70">No pending access requests.</td>
                    </tr>
                  ) : requests.map((req) => (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 font-bold">{req.full_name}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 opacity-90 break-all">{req.email}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 opacity-80 whitespace-nowrap">{new Date(req.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right space-x-2 sm:space-x-3 whitespace-nowrap">
                        <button 
                          type="button"
                          onClick={() => handleApprove(req.id)} 
                          className="bg-garba-green hover:bg-green-600 text-white px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer touch-manipulation select-none active:opacity-90"
                        >
                          Approve
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleReject(req.id)} 
                          className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors cursor-pointer touch-manipulation select-none active:opacity-90"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
}

function StatCard({ title, value, icon, color, active, onClick }: { title: string, value: string, icon: React.ReactNode, color: string, active?: boolean, onClick?: () => void }) {
  const iconColor = color === 'garba-gold' ? 'text-garba-gold' : 
                    color === 'garba-green' ? 'text-garba-green' : 
                    color === 'blue-400' ? 'text-blue-400' : 'text-purple-400';
                    
  const bgColor = color === 'garba-gold' ? 'bg-garba-gold/10' : 
                  color === 'garba-green' ? 'bg-garba-green/10' : 
                  color === 'blue-400' ? 'bg-blue-400/10' : 'bg-purple-400/10';

  return (
    <div 
      onClick={onClick} 
      className={`ornate-card p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 transition-all touch-manipulation select-none ${onClick ? 'cursor-pointer hover:border-garba-gold active:opacity-90' : ''} ${active ? 'border-garba-gold bg-garba-gold/20 scale-[1.01]' : 'border-garba-gold/30'}`}
    >
      <div className={`p-2 sm:p-3.5 rounded-lg sm:rounded-xl ${bgColor} ${iconColor} pointer-events-none shrink-0`}>
        {icon}
      </div>
      <div className="pointer-events-none min-w-0">
        <p className="text-garba-light/70 text-[11px] sm:text-xs md:text-sm font-semibold uppercase tracking-wide truncate">{title}</p>
        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mt-0.5 sm:mt-1">{value}</p>
      </div>
    </div>
  );
}


