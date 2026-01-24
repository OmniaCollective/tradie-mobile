
import React, { useState } from 'react';
import { JOB_TYPES, MOCK_PLUMBER } from '../constants';
import { Job, Urgency, JobStatus } from '../types';
import { calculateQuote } from '../lib/automation';
import { getSuggestedQuote } from '../services/geminiService';
import FixerLogo from './FixerLogo';
import { X, ArrowLeft, Loader2, Check, Zap } from 'lucide-react';

interface Props {
  plumber: any;
  onCancel: () => void;
  onSubmit: (job: Job) => void;
}

const CustomerBooking: React.FC<Props> = ({ plumber, onCancel, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    postcode: '',
    type: JOB_TYPES[0],
    description: '',
    urgency: Urgency.STANDARD
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Automation: AI suggestion for duration/materials based on description
    const suggestion = await getSuggestedQuote(formData.description, formData.type);
    
    // Automation: Calculate full quote with business logic
    const quote = calculateQuote(
      suggestion.hours,
      suggestion.materials,
      formData.urgency,
      MOCK_PLUMBER,
      3.5 // Mock distance
    );

    const newJob: Job = {
      id: `job-${Math.random().toString(36).substr(2, 9)}`,
      customer: {
        id: `c-${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        phone: formData.phone,
        email: '',
        address: formData.address,
        postcode: formData.postcode
      },
      type: formData.type,
      description: formData.description,
      urgency: formData.urgency,
      status: JobStatus.REQUESTED,
      createdAt: new Date().toISOString(),
      distance: 3.5,
      quote: quote
    };

    setTimeout(() => {
      setIsLoading(false);
      setStep(3); // Success step
      setTimeout(() => onSubmit(newJob), 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto pb-20">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <header className="px-6 py-6 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black z-10">
          <button onClick={onCancel} className="p-2 -ml-2 text-[#A0A0A0]">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
             <FixerLogo className="w-6 h-6" iconSize={12} />
             <span className="font-black text-sm tracking-tighter uppercase">FIXER Booking</span>
          </div>
          <div className="w-6 h-6" />
        </header>

        <div className="flex-1 p-6">
          {step === 1 && (
            <div className="space-y-8 animate-in slide-in-from-right duration-300">
              <header>
                <h1 className="text-3xl font-black mb-2">Book a Service</h1>
                <p className="text-[#A0A0A0]">Tell us what's wrong and we'll handle the rest.</p>
              </header>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest block mb-2">Issue Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {JOB_TYPES.slice(0, 4).map(type => (
                      <button
                        key={type}
                        onClick={() => setFormData({...formData, type})}
                        className={`p-4 rounded-xl border text-sm font-bold text-left transition-all ${
                          formData.type === type ? 'border-[#00FFFF] bg-[#00FFFF]/5 text-[#00FFFF]' : 'border-white/10 text-white hover:border-white/20'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest block mb-2">Describe the Problem</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="E.g. The hot tap in the bathroom won't turn off..."
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#00FFFF] placeholder:text-white/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest block mb-2">Urgency</label>
                  <div className="flex gap-2">
                    {[Urgency.STANDARD, Urgency.URGENT, Urgency.EMERGENCY].map(u => (
                      <button
                        key={u}
                        onClick={() => setFormData({...formData, urgency: u})}
                        className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          formData.urgency === u ? 'border-[#00FFFF] bg-[#00FFFF] text-black' : 'border-white/10 text-[#A0A0A0]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-white text-black font-black py-4 rounded-xl text-sm uppercase tracking-widest"
                >
                  Next: Contact Details
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-right duration-300">
               <header>
                <h1 className="text-3xl font-black mb-2">Where & Who</h1>
                <p className="text-[#A0A0A0]">We need to know where to go.</p>
              </header>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest ml-1">Full Name</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#00FFFF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest ml-1">Phone Number</label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#00FFFF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest ml-1">Address</label>
                  <input
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#00FFFF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-[#A0A0A0] tracking-widest ml-1">Postcode</label>
                  <input
                    required
                    value={formData.postcode}
                    onChange={(e) => setFormData({...formData, postcode: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#00FFFF]"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#00FFFF] text-black font-black py-4 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Instant Quote'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-[#A0A0A0] font-black py-4 text-xs uppercase tracking-widest"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-500">
               <div className="w-20 h-20 bg-[#00FFFF] rounded-full flex items-center justify-center mb-4">
                  <Check className="w-10 h-10 text-black stroke-[3px]" />
               </div>
               <h1 className="text-3xl font-black">Quote Ready</h1>
               <p className="text-[#A0A0A0]">We've calculated the best price for your request. Opening your quote now...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerBooking;
