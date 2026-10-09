"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, User, Ticket, Calendar, Download, Search, LayoutDashboard, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"entries" | "requests">("entries");

  useEffect(() => {
    checkAuth();
    fetchEntries();
    fetchRequests();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('public:entries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries' }, (payload) => {
        setEntries(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
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

  const fetchEntries = async () => {
    const { data, error } = await supabase
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

  const handleApprove = async (id: string) => {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
    fetchRequests();
  };

  const handleReject = async (id: string) => {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id);
    fetchRequests();
  };
  
  const filteredData = entries.filter(d => 
    d.pass_serial.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.name_1.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.name_2 && d.name_2.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalEntries = entries.length;
  const stagCount = entries.filter(e => e.entry_type === 'stag').length;
  const duoCount = entries.filter(e => e.entry_type === 'duo').length;

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
          <div className="flex gap-3 mt-4 sm:mt-0">
            <button className="flex items-center gap-2 bg-garba-gold text-garba-maroon px-6 py-2 rounded-xl font-bold hover:bg-yellow-400 transition-colors">
              <Download className="w-5 h-5" /> Export Data
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition-colors">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Entries" value={totalEntries.toString()} icon={<Ticket />} color="garba-gold" />
          <StatCard title="Stag Entries" value={stagCount.toString()} icon={<User />} color="garba-green" />
          <StatCard title="Duo Entries" value={duoCount.toString()} icon={<Users />} color="blue-400" />
          <StatCard title="Peak Time" value="Live" icon={<Calendar />} color="purple-400" />
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
              <h2 className="text-xl font-bold text-garba-gold uppercase tracking-wider">Recent Entries</h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-garba-light/50" />
                <input 
                  type="text" 
                  placeholder="Search pass or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/30 border border-garba-gold/30 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-garba-gold transition-colors"
                />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-garba-gold/10 text-garba-light">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center opacity-70 animate-pulse">Loading entries...</td>
                    </tr>
                  ) : filteredData.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-garba-gold">{row.pass_serial}</td>
                      <td className="px-6 py-4 font-semibold">
                        {row.name_1} {row.name_2 && <span className="text-garba-light/60 text-sm"><br/>& {row.name_2}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          row.entry_type === 'stag' ? 'bg-garba-green/20 text-garba-green' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {row.entry_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 opacity-80">{row.entry_date}</td>
                      <td className="px-6 py-4 opacity-80">{new Date(row.created_at).toLocaleTimeString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && filteredData.length === 0 && (
                <div className="p-8 text-center text-garba-light/50">
                  No entries found matching your search.
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

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  // Simple mapping for Tailwind dynamic classes based on prop
  const iconColor = color === 'garba-gold' ? 'text-garba-gold' : 
                    color === 'garba-green' ? 'text-garba-green' : 
                    color === 'blue-400' ? 'text-blue-400' : 'text-purple-400';
                    
  const bgColor = color === 'garba-gold' ? 'bg-garba-gold/10' : 
                  color === 'garba-green' ? 'bg-garba-green/10' : 
                  color === 'blue-400' ? 'bg-blue-400/10' : 'bg-purple-400/10';

  return (
    <div className="ornate-card p-6 flex items-center gap-4 hover:border-garba-gold/80 transition-colors">
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
