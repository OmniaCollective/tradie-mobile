
import React, { useState } from 'react';
import { Job, JobStatus, Urgency } from '../types';
import { Clock, MapPin, Play, CheckCircle2, AlertTriangle, ChevronRight, Plus, Circle, CheckCircle, MessageSquare, Mail, Share2 } from 'lucide-react';
import { format } from 'date-fns';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface Props {
  jobs: Job[];
  updateJobStatus: (id: string, status: JobStatus) => void;
  onJobClick: (id: string) => void;
  onMetricClick: (filter: 'active' | 'pending' | 'done') => void;
  todos: Todo[];
  onAddTodo: (text: string) => void;
  onToggleTodo: (id: string) => void;
}

const PlumberDashboard: React.FC<Props> = ({ 
  jobs, 
  updateJobStatus, 
  onJobClick, 
  onMetricClick,
  todos, 
  onAddTodo, 
  onToggleTodo 
}) => {
  const activeJobs = jobs.filter(j => j.status === JobStatus.IN_PROGRESS || j.status === JobStatus.SCHEDULED);
  
  const quotesPendingCount = jobs.filter(j => 
    j.status === JobStatus.REQUESTED || j.status === JobStatus.QUOTED
  ).length;

  const [newTodo, setNewTodo] = useState('');

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTodo(newTodo);
    setNewTodo('');
  };

  const shareClientLink = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    // Simulate sharing functionality
    if (navigator.share) {
      navigator.share({
        title: 'Plumbing Quote - FIXER',
        text: `Hi ${job.customer.name}, here is your instant quote for ${job.type}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert('Client Portal link copied to clipboard!');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => onMetricClick('pending')}
          className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 text-left active:scale-95 transition-all hover:border-[#00FFFF]/30"
        >
          <p className="text-[9px] text-[#A0A0A0] uppercase font-black tracking-widest mb-1">Quotes Pending</p>
          <p className="text-2xl font-black text-[#00FFFF]">{quotesPendingCount}</p>
        </button>
        <button 
          onClick={() => onMetricClick('active')}
          className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 text-left active:scale-95 transition-all hover:border-[#00FFFF]/30"
        >
          <p className="text-[9px] text-[#A0A0A0] uppercase font-black tracking-widest mb-1">Active Jobs</p>
          <p className="text-2xl font-black text-white">{activeJobs.length}</p>
        </button>
      </div>

      {/* To-Do List Section */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[#A0A0A0]">Field Notes</h2>
          <span className="text-[9px] font-bold text-[#00FFFF] bg-[#00FFFF]/10 px-2 py-0.5 rounded-full">
            {todos.filter(t => !t.completed).length} ACTIVE
          </span>
        </div>

        <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add new task..."
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold focus:outline-none focus:border-[#00FFFF] placeholder:text-white/20"
          />
          <button type="submit" className="bg-[#00FFFF] text-black p-2 rounded-lg hover:bg-opacity-80 transition-opacity">
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {todos.map(todo => (
            <div 
              key={todo.id} 
              onClick={() => onToggleTodo(todo.id)}
              className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 cursor-pointer active:scale-95 transition-all"
            >
              {todo.completed ? (
                <CheckCircle className="w-4 h-4 text-[#10B981]" />
              ) : (
                <Circle className="w-4 h-4 text-[#A0A0A0]" />
              )}
              <span className={`text-xs font-bold ${todo.completed ? 'text-[#A0A0A0] line-through' : 'text-white'}`}>
                {todo.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Jobs Feed */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[#A0A0A0]">Schedule: Today</h2>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
               <MessageSquare size={10} className="text-[#00FFFF]" />
               <span className="text-[8px] font-black text-[#A0A0A0] uppercase">SMS Bridging</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {activeJobs.length === 0 ? (
            <div className="py-12 text-center bg-[#1A1A1A] rounded-2xl border border-dashed border-white/10">
              <CheckCircle2 className="w-8 h-8 text-[#A0A0A0] mx-auto mb-2 opacity-20" />
              <p className="text-[#A0A0A0] text-xs font-bold uppercase tracking-widest">No active jobs scheduled</p>
            </div>
          ) : (
            activeJobs.map((job) => (
              <div 
                key={job.id} 
                className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden active:scale-[0.98] transition-all relative"
                onClick={() => onJobClick(job.id)}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {job.urgency === Urgency.EMERGENCY && (
                        <div className="flex items-center gap-1 bg-[#00FFFF]/10 px-2 py-1 rounded">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00FFFF] animate-pulse" />
                          <span className="text-[#00FFFF] text-[9px] font-black uppercase tracking-tighter">Emergency</span>
                        </div>
                      )}
                      <span className="text-[9px] font-black text-[#A0A0A0] uppercase border border-white/10 px-2 py-1 rounded tracking-tighter">
                        {job.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
                        <MessageSquare size={10} className="text-[#00FFFF]" />
                        <span className="text-[8px] font-black uppercase text-[#00FFFF]">SMS Link Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-lg font-black">{job.customer.name}</h3>
                      <p className="text-xs text-[#A0A0A0] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        {job.type}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => shareClientLink(e, job)}
                      className="bg-black/40 p-2 rounded-lg border border-white/10 text-[#A0A0A0] hover:text-[#00FFFF]"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 text-[10px] text-[#A0A0A0] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#00FFFF]" />
                      {job.scheduledDate ? format(new Date(job.scheduledDate), 'HH:mm') : 'Asap'}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#00FFFF]" />
                      {job.distance} miles
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {job.status === JobStatus.SCHEDULED || job.status === JobStatus.APPROVED || job.status === JobStatus.REQUESTED ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateJobStatus(job.id, JobStatus.IN_PROGRESS);
                        }}
                        className="flex-1 bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                      >
                        <Play className="w-4 h-4" fill="black" />
                        Start Job
                      </button>
                    ) : job.status === JobStatus.IN_PROGRESS ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateJobStatus(job.id, JobStatus.COMPLETED);
                        }}
                        className="flex-1 bg-[#10B981] text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete & Invoice
                      </button>
                    ) : null}
                    
                    <button className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <ChevronRight className="w-5 h-5 text-[#A0A0A0]" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PlumberDashboard;
