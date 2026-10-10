"use client";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Users, User, Ticket, Calendar, Download, Search, LayoutDashboard, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
      let dataToExport = entries;
      
      if (exportType === 'duo') {
        dataToExport = entries.filter(e => e.entry_type === 'duo');
      } else if (exportType === 'stag') {
        dataToExport = entries.filter(e => e.entry_type === 'stag');
      } else if (exportType === 'filtered') {
        dataToExport = filteredData;
      }
      
      // Sort by Pass Number
      dataToExport = [...dataToExport].sort((a, b) => (a.pass_serial ? a.pass_serial.split('_')[0] : "").localeCompare(b.pass_serial ? b.pass_serial.split('_')[0] : "", undefined, { numeric: true }));
      
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance');

      // Title Row
      const typeLabel = exportType === 'all' || exportType === 'filtered' 
                        ? (filterType === 'all' ? 'ALL' : filterType.toUpperCase()) 
                        : exportType.toUpperCase();
      const dateLabel = exportType === 'filtered' && filterDate !== 'all' ? filterDate : 'ALL DATES';
      
      const titleRow = sheet.addRow([`GARBA WORKSHOP ATTENDANCE — ${typeLabel} PASS — ${dateLabel}`]);
      titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 30;
      sheet.mergeCells('A1:E1');
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } };

      // Header Row
      const headerRow = sheet.addRow(['Pass Number', 'Name', 'Name 2', 'Entry Date', 'Time']);
      headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.height = 20;
      
      headerRow.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Columns Width
      sheet.getColumn(1).width = 20;
      sheet.getColumn(2).width = 30;
      sheet.getColumn(3).width = 30;
      sheet.getColumn(4).width = 15;
      sheet.getColumn(5).width = 15;

      // Data Rows
      dataToExport.forEach(row => {
        const timeStr = new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dataRow = sheet.addRow([
            row.pass_serial.split('_')[0],
          row.name_1,
          row.name_2 || '',
          row.entry_date,
          timeStr
        ]);
        
        dataRow.eachCell((cell: any) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      });

      const buffer = await (workbook.xlsx as any).writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      let fileName = 'Maha_Garba_Entries';
      if (exportType === 'duo') fileName = 'Maha_Garba_DUO_Entries';
      else if (exportType === 'stag') fileName = 'Maha_Garba_STAG_Entries';
      else if (exportType === 'filtered') fileName = 'Maha_Garba_Filtered_Entries';
      
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
      <div className="relative z-10 min-h-screen p-4 sm:p-8">
      
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center ornate-card p-6">
          <div className="flex items-center gap-4">
            <div className="bg-garba-gold p-3 rounded-xl">
              <LayoutDashboard className="w-8 h-8 text-garba-maroon" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-garba-gold uppercase tracking-widest font-[family-name:var(--font-rozha)] text-glow">
                Admin Dashboard
              </h1>
              <p className="text-garba-light/80 font-semibold tracking-wide">Maha Garba Event Management</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4">
            <div className="relative">
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={isExporting}
                className="flex items-center gap-2 bg-garba-green hover:bg-green-600 px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-70"
              >
                {isExporting ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span> : <Download className="w-5 h-5" />}
                {isExporting ? 'Exporting...' : 'Export Data'}
                <ChevronDown className="w-4 h-4" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-garba-gold/30 rounded-lg shadow-xl overflow-hidden z-50">
                  <button onClick={() => handleExport('all')} className="w-full text-left px-4 py-3 hover:bg-garba-gold/20 text-white font-semibold border-b border-garba-gold/10 transition-colors">
                    Export All Entries
                  </button>
                  <button onClick={() => handleExport('duo')} className="w-full text-left px-4 py-3 hover:bg-garba-gold/20 text-blue-300 font-semibold border-b border-garba-gold/10 transition-colors">
                    Export Duo Only
                  </button>
                  <button onClick={() => handleExport('stag')} className="w-full text-left px-4 py-3 hover:bg-garba-gold/20 text-garba-green font-semibold border-b border-garba-gold/10 transition-colors">
                    Export Stag Only
                  </button>
                  <button onClick={() => handleExport('filtered')} className="w-full text-left px-4 py-3 hover:bg-garba-gold/20 text-garba-gold font-semibold transition-colors">
                    Export Filtered View
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold transition-colors">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
          <StatCard 
            title="Total Passes" 
            value={totalEntries.toString()} 
            icon={<Users />} 
            color="garba-gold" 
            active={filterType === 'all'}
            onClick={() => setFilterType('all')}
          />
          <StatCard 
            title="Stag Passes" 
            value={stagCount.toString()} 
            icon={<User />} 
            color="garba-green" 
            active={filterType === 'stag'}
            onClick={() => setFilterType('stag')}
          />
          <StatCard 
            title="Duo Passes" 
            value={duoCount.toString()} 
            icon={<Ticket />} 
            color="blue-400" 
            active={filterType === 'duo'}
            onClick={() => setFilterType('duo')}
          />
          <StatCard 
            title="Current View" 
            value={displayData.length.toString()} 
            icon={<Calendar />} 
            color="purple-400" 
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-garba-gold/20 pb-2">
          <button 
            onClick={() => setActiveTab('entries')}
            className={`font-bold uppercase tracking-wider px-4 py-2 transition-colors ${activeTab === 'entries' ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 hover:text-garba-light'}`}
          >
            Gate Entries
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`font-bold uppercase tracking-wider px-4 py-2 transition-colors flex items-center gap-2 ${activeTab === 'requests' ? 'text-garba-gold border-b-2 border-garba-gold' : 'text-garba-light/50 hover:text-garba-light'}`}
          >
            Access Requests {requests.length > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{requests.length}</span>}
          </button>
        </div>

        {/* Dynamic Section */}
        {activeTab === 'entries' ? (
          <div className="ornate-card overflow-hidden flex flex-col animate-fade-in-down">
            <div className="p-6 border-b border-garba-gold/20 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-garba-gold uppercase tracking-wider">Entries</h2>
                <div className="flex gap-3 text-xs font-bold uppercase tracking-wider">
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
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <select 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-black/40 border border-garba-gold/30 rounded-lg py-2 px-4 text-white font-semibold focus:outline-none focus:border-garba-gold transition-colors"
                >
                  <option value="all">All Dates</option>
                  {uniqueDates.map(d => <option key={d as string} value={d as string}>{d as string}</option>)}
                </select>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-light/50" />
                  <input 
                    type="text" 
                    placeholder="Search pass or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-garba-gold/30 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-garba-gold transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/40 text-garba-gold text-sm uppercase">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Pass Serial</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Name(s)</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Type</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Time</th>
                    <th className="px-6 py-4 font-semibold tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garba-gold/10 text-garba-light">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center opacity-70 animate-pulse">Loading entries...</td>
                    </tr>
                  ) : displayData.map((row) => (
                    <Fragment key={row.id}>
                      <tr 
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${expandedRowId === row.id ? 'bg-white/5' : ''}`}
                        onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                      >
                        <td className="px-6 py-4 font-mono text-garba-gold">{row.pass_serial.split('_')[0]}</td>
                        <td className="px-6 py-4 font-semibold">
                          {row.name_1} {row.name_2 && <span className="text-garba-light/80"><br/>& {row.name_2}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            row.entry_type === 'stag' ? 'bg-garba-green/20 text-garba-green' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {row.entry_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 opacity-80">{row.entry_date}</td>
                        <td className="px-6 py-4 opacity-80">{new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                        <td className="px-6 py-4 text-right">
                          {expandedRowId === row.id ? <ChevronUp className="w-5 h-5 text-garba-gold inline-block" /> : <ChevronDown className="w-5 h-5 text-garba-light/50 inline-block" />}
                        </td>
                      </tr>
                      {expandedRowId === row.id && (
                        <tr className="bg-black/40">
                          <td colSpan={6} className="px-6 py-4 border-t-0">
                            <div className="flex flex-col gap-3 p-2">
                              <h4 className="text-garba-gold text-sm font-bold uppercase tracking-wider">Attendance History for Pass {row.pass_serial.split('_')[0]}</h4>
                              <div className="flex flex-wrap gap-2">
                                {entries.filter(e => e.pass_serial.split('_')[0] === row.pass_serial.split('_')[0] && e.entry_type === row.entry_type).sort((a,b) => a.entry_date.localeCompare(b.entry_date)).map(historyEntry => (
                                  <span key={historyEntry.id} className="bg-white/10 text-garba-light px-3 py-1.5 rounded-lg border border-white/20 text-sm flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-garba-gold" />
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
                <div className="p-8 text-center text-garba-light/50">
                  No entries found matching your filters.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ornate-card overflow-hidden flex flex-col animate-fade-in-down">
            <div className="p-6 border-b border-garba-gold/20 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-garba-gold uppercase tracking-wider">Pending Operator Requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/40 text-garba-gold text-sm uppercase">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Full Name</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Email</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Request Date</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-garba-gold/10 text-garba-light">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center opacity-70">No pending access requests.</td>
                    </tr>
                  ) : requests.map((req) => (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold">{req.full_name}</td>
                      <td className="px-6 py-4 opacity-90">{req.email}</td>
                      <td className="px-6 py-4 opacity-80">{new Date(req.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button onClick={() => handleApprove(req.id)} className="bg-garba-green hover:bg-green-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleReject(req.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-colors">
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
      className={`ornate-card p-6 flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer hover:border-garba-gold' : ''} ${active ? 'border-garba-gold bg-garba-gold/20 scale-[1.02]' : 'border-garba-gold/30'}`}
    >
      <div className={`p-4 rounded-xl ${bgColor} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-garba-light/70 text-sm font-semibold uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}


