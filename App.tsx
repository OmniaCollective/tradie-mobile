
import React, { useState, useEffect } from 'react';
import { NAV_ITEMS, COLORS, MOCK_PLUMBER } from './constants';
import { Job, JobStatus, Urgency } from './types';
import PlumberDashboard from './components/PlumberDashboard';
import CustomerBooking from './components/CustomerBooking';
import QuoteView from './components/QuoteView';
import FixerLogo from './components/FixerLogo';
import { FileText, Plus, CheckCircle2, Circle, Calendar as CalendarIcon, Filter, MapPin, Clock, CreditCard, Zap } from 'lucide-react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentView, setCurrentView] = useState<'plumber' | 'customer_book' | 'customer_quote'>('plumber');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobsFilter, setJobsFilter] = useState<'active' | 'pending' | 'done'>('active');
  
  // Settings State
  const [settings, setSettings] = useState({
    businessName: MOCK_PLUMBER.businessName,
    hourlyRate: MOCK_PLUMBER.hourlyRate,
    emergencyCallOutRate: MOCK_PLUMBER.emergencyCallOutRate,
    minimumCallout: MOCK_PLUMBER.minimumCallout,
    emergencyMultiplier: MOCK_PLUMBER.emergencyMultiplier,
    basePostcode: MOCK_PLUMBER.basePostcode,
    maxTravelRadiusMiles: MOCK_PLUMBER.maxTravelRadiusMiles,
    workingHours: MOCK_PLUMBER.workingHours,
    paymentTermsDays: MOCK_PLUMBER.paymentTermsDays
  });

  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: 'Buy 15mm copper pipe', completed: false },
    { id: '2', text: 'Call back Mrs. Higgins', completed: true }
  ]);

  // Mock State
  const [jobs, setJobs] = useState<Job[]>([
    {
      id: 'job-1',
      customer: {
        id: 'c1',
        name: 'Sarah Jenkins',
        phone: '07890 123456',
        email: 'sarah@example.com',
        address: '12 Baker Street, London',
        postcode: 'NW1 6XE'
      },
      type: 'Tap Repair',
      description: 'Kitchen tap dripping constantly, making a mess.',
      urgency: Urgency.EMERGENCY,
      status: JobStatus.REQUESTED,
      createdAt: new Date().toISOString(),
      distance: 2.4,
      quote: {
        id: 'q1',
        labourHours: 1.5,
        labourRate: 85,
        materialsEstimate: 15,
        travelCost: 10,
        emergencySurcharge: 45,
        subtotal: 157.5,
        vatAmount: 31.5,
        total: 189.0,
        validUntil: new Date().toISOString()
      }
    },
    {
      id: 'job-2',
      customer: {
        id: 'c2',
        name: 'David Wilson',
        phone: '07123 456789',
        email: 'david@example.com',
        address: '45 Green Lane, London',
        postcode: 'E1 6AN'
      },
      type: 'Boiler Service',
      description: 'Annual service for a Worcester Bosch combi boiler.',
      urgency: Urgency.STANDARD,
      status: JobStatus.SCHEDULED,
      scheduledDate: new Date(Date.now() + 3600000 * 2).toISOString(),
      createdAt: new Date().toISOString(),
      distance: 5.1,
      quote: {
        id: 'q2',
        labourHours: 1,
        labourRate: 85,
        materialsEstimate: 0,
        travelCost: 15,
        emergencySurcharge: 0,
        subtotal: 100,
        vatAmount: 20,
        total: 120.0,
        validUntil: new Date().toISOString()
      }
    }
  ]);

  const addJob = (newJob: Job) => {
    setJobs([newJob, ...jobs]);
    setCurrentView('plumber');
    setActiveTab('dashboard');
  };

  const updateJobStatus = (jobId: string, status: JobStatus) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j));
  };

  const addTodo = (text: string) => {
    if (!text.trim()) return;
    setTodos([{ id: Date.now().toString(), text, completed: false }, ...todos]);
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleMetricClick = (filter: 'active' | 'pending' | 'done') => {
    setJobsFilter(filter);
    setActiveTab('jobs');
  };

  const filteredJobs = jobs.filter(job => {
    if (jobsFilter === 'active') return job.status === JobStatus.IN_PROGRESS;
    if (jobsFilter === 'pending') return [JobStatus.REQUESTED, JobStatus.QUOTED, JobStatus.APPROVED, JobStatus.SCHEDULED].includes(job.status);
    if (jobsFilter === 'done') return [JobStatus.COMPLETED, JobStatus.INVOICED, JobStatus.PAID].includes(job.status);
    return true;
  });

  const renderNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 px-4 py-3 flex justify-between items-center z-50 pb-safe">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center transition-all ${isActive ? 'text-[#00FFFF] scale-110' : 'text-[#A0A0A0]'}`}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const renderContent = () => {
    if (currentView === 'customer_book') {
      return <CustomerBooking plumber={MOCK_PLUMBER} onCancel={() => setCurrentView('plumber')} onSubmit={addJob} />;
    }
    
    if (currentView === 'customer_quote' && selectedJobId) {
      const job = jobs.find(j => j.id === selectedJobId);
      if (job) return <QuoteView job={job} onAccept={() => {
        updateJobStatus(job.id, JobStatus.APPROVED);
        setCurrentView('plumber');
      }} onBack={() => setCurrentView('plumber')} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <PlumberDashboard 
            jobs={jobs} 
            updateJobStatus={updateJobStatus} 
            onJobClick={(id) => {
              setSelectedJobId(id);
              setCurrentView('customer_quote');
            }}
            onMetricClick={handleMetricClick}
            todos={todos}
            onAddTodo={addTodo}
            onToggleTodo={toggleTodo}
          />
        );
      case 'jobs':
        return (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-black uppercase tracking-tighter">Jobs</h1>
              <div className="flex bg-[#1A1A1A] rounded-lg p-1 border border-white/5">
                {(['active', 'pending', 'done'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setJobsFilter(f)}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                      jobsFilter === f ? 'bg-[#00FFFF] text-black' : 'text-[#A0A0A0]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredJobs.length > 0 ? filteredJobs.map(job => (
                <div 
                  key={job.id} 
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setCurrentView('customer_quote');
                  }}
                  className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex justify-between items-center active:scale-[0.98] transition-transform"
                >
                   <div>
                      <p className="font-black text-white">{job.customer.name}</p>
                      <p className="text-xs text-[#A0A0A0] uppercase tracking-wider font-bold">{job.type}</p>
                   </div>
                   <div className="text-right">
                      <span className={`text-[9px] px-2 py-1 rounded font-black uppercase tracking-tighter ${
                        job.status === JobStatus.PAID ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white'
                      }`}>
                        {job.status}
                      </span>
                   </div>
                </div>
              )) : (
                <div className="py-12 text-center bg-[#1A1A1A] rounded-2xl border border-dashed border-white/10">
                   <Filter className="w-8 h-8 text-white/10 mx-auto mb-2" />
                   <p className="text-[#A0A0A0] text-sm font-bold uppercase tracking-widest">No {jobsFilter} jobs</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'calendar':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-black mb-6 uppercase tracking-tighter">Calendar</h1>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 text-center">
              <CalendarIcon className="w-12 h-12 text-[#00FFFF] mx-auto mb-4 opacity-50" />
              <p className="text-white font-black uppercase tracking-widest mb-2">Weekly Schedule</p>
              <p className="text-xs text-[#A0A0A0] leading-relaxed">Your smart calendar is syncing with Google and Apple. View slots by location density.</p>
              <div className="mt-8 grid grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`h-2 rounded-full ${i === 2 || i === 4 ? 'bg-[#00FFFF]' : 'bg-white/5'}`} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'invoices':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-black mb-6 uppercase tracking-tighter">Billing</h1>
             <div className="bg-[#1A1A1A] border border-white/5 p-8 rounded-2xl text-center">
                <FileText className="w-12 h-12 text-[#00FFFF] mx-auto mb-4" />
                <p className="text-white font-black uppercase tracking-widest mb-1">No pending invoices</p>
                <p className="text-xs text-[#A0A0A0] mb-6">Automation is handling collection for 3 completed jobs.</p>
                <button className="text-[#00FFFF] font-black text-xs uppercase tracking-widest border border-[#00FFFF]/30 px-6 py-3 rounded-xl hover:bg-[#00FFFF]/10 transition-colors">Generate Report</button>
             </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-black uppercase tracking-tighter">Settings</h1>
            
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00FFFF]" />
                <h2 className="text-[10px] uppercase text-[#A0A0A0] font-black tracking-widest">Financial Rules</h2>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-5 space-y-5 border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Hourly Rate</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] font-black">£</span>
                      <input 
                        type="number"
                        value={settings.hourlyRate}
                        onChange={(e) => setSettings({...settings, hourlyRate: Number(e.target.value)})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Min Callout</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] font-black">£</span>
                      <input 
                        type="number"
                        value={settings.minimumCallout}
                        onChange={(e) => setSettings({...settings, minimumCallout: Number(e.target.value)})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Emergency Rate</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] font-black">£</span>
                      <input 
                        type="number"
                        value={settings.emergencyCallOutRate}
                        onChange={(e) => setSettings({...settings, emergencyCallOutRate: Number(e.target.value)})}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Multiplier (x)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={settings.emergencyMultiplier}
                      onChange={(e) => setSettings({...settings, emergencyMultiplier: Number(e.target.value)})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Payment Terms (Days)</label>
                  <input 
                    type="number"
                    value={settings.paymentTermsDays}
                    onChange={(e) => setSettings({...settings, paymentTermsDays: Number(e.target.value)})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#00FFFF]" />
                <h2 className="text-[10px] uppercase text-[#A0A0A0] font-black tracking-widest">Operational Range</h2>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-5 space-y-5 border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Base Postcode</label>
                    <input 
                      type="text"
                      value={settings.basePostcode}
                      onChange={(e) => setSettings({...settings, basePostcode: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Max Radius (mi)</label>
                    <input 
                      type="number"
                      value={settings.maxTravelRadiusMiles}
                      onChange={(e) => setSettings({...settings, maxTravelRadiusMiles: Number(e.target.value)})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-[#A0A0A0]">Working Hours</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0]" />
                    <input 
                      type="text"
                      value={settings.workingHours}
                      onChange={(e) => setSettings({...settings, workingHours: e.target.value})}
                      placeholder="e.g. 08:00 - 18:00"
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-sm font-black text-white focus:border-[#00FFFF] outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            <button 
              onClick={() => setCurrentView('customer_book')}
              className="w-full bg-[#00FFFF] text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(0,255,255,0.2)] active:scale-95 transition-all"
            >
              <Zap size={20} fill="black" stroke="black" />
              Test Customer Experience
            </button>

            <div className="pt-4 pb-8 text-center">
              <p className="text-[9px] text-[#A0A0A0] font-black uppercase tracking-[0.2em]">FIXER Version 1.2.5</p>
            </div>
          </div>
        );
      default:
        return <div>Not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto shadow-2xl relative">
      <header className="px-6 py-5 flex justify-between items-center bg-black border-b border-white/5 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <FixerLogo className="w-11 h-11" iconSize={22} />
          <span className="text-3xl font-black tracking-tighter uppercase leading-none">FIXER</span>
        </div>
        <div className="flex gap-4 items-center">
           <div className="w-8 h-8 rounded-full border-2 border-[#00FFFF] p-0.5 overflow-hidden">
              <img src="https://picsum.photos/100/100" className="w-full h-full object-cover rounded-full" alt="Profile" />
           </div>
        </div>
      </header>

      <main className="pb-32">
        {renderContent()}
      </main>

      {currentView === 'plumber' && renderNav()}
    </div>
  );
};

export default App;
