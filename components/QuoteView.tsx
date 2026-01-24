
import React from 'react';
import { Job, JobStatus, Urgency } from '../types';
import { ShieldCheck, Calendar, Clock, ArrowLeft, Zap, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  job: Job;
  onAccept: () => void;
  onBack: () => void;
}

const QuoteView: React.FC<Props> = ({ job, onAccept, onBack }) => {
  const quote = job.quote;
  if (!quote) return <div>No quote found.</div>;

  return (
    <div className="min-h-screen bg-black pb-32">
       <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-[#A0A0A0]">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-black">Quote Detail</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-[#00FFFF]/10 px-3 py-1.5 rounded-full border border-[#00FFFF]/20">
            <Lock size={10} className="text-[#00FFFF]" />
            <span className="text-[8px] font-black uppercase text-[#00FFFF] tracking-widest">Secure Client Portal</span>
          </div>
       </header>

       <div className="p-6 space-y-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/10 relative overflow-hidden">
             {/* Diagonal accent */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-[#00FFFF]/5 translate-x-12 -translate-y-12 rotate-45" />
             
             <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                   <p className="text-[10px] text-[#A0A0A0] uppercase font-black tracking-widest mb-1">Total Estimated Cost</p>
                   <p className="text-4xl font-black text-[#00FFFF]">£{quote.total.toFixed(2)}</p>
                </div>
                {job.urgency === Urgency.EMERGENCY && (
                  <span className="bg-[#00FFFF]/10 text-[#00FFFF] text-[10px] px-2 py-1 rounded font-black uppercase border border-[#00FFFF]/30">Emergency Service</span>
                )}
             </div>

             <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
                <div className="flex justify-between text-sm">
                   <span className="text-[#A0A0A0]">Labour ({quote.labourHours}h @ £{quote.labourRate}/h)</span>
                   <span className="font-bold text-white">£{(quote.labourHours * quote.labourRate).toFixed(2)}</span>
                </div>
                {quote.materialsEstimate > 0 && (
                  <div className="flex justify-between text-sm">
                     <span className="text-[#A0A0A0]">Estimated Materials</span>
                     <span className="font-bold text-white">£{quote.materialsEstimate.toFixed(2)}</span>
                  </div>
                )}
                {quote.travelCost > 0 && (
                  <div className="flex justify-between text-sm">
                     <span className="text-[#A0A0A0]">Travel & Call-out</span>
                     <span className="font-bold text-white">£{quote.travelCost.toFixed(2)}</span>
                </div>
                )}
                {quote.emergencySurcharge > 0 && (
                   <div className="flex justify-between text-sm text-[#00FFFF]">
                      <span className="font-bold uppercase tracking-tighter">Emergency Surcharge</span>
                      <span className="font-bold">£{quote.emergencySurcharge.toFixed(2)}</span>
                   </div>
                )}
                <div className="flex justify-between text-sm border-t border-white/5 pt-4">
                   <span className="text-[#A0A0A0]">Subtotal</span>
                   <span className="font-bold text-white">£{quote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-[#A0A0A0]">VAT (20%)</span>
                   <span className="font-bold text-white">£{quote.vatAmount.toFixed(2)}</span>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-[#A0A0A0] uppercase tracking-widest ml-1">Included Protection</h3>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center gap-3">
                   <ShieldCheck className="w-5 h-5 text-[#00FFFF]" />
                   <span className="text-[9px] font-black uppercase tracking-widest leading-tight">12m Work Guarantee</span>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 flex items-center gap-3">
                   <ShieldCheck className="w-5 h-5 text-[#00FFFF]" />
                   <span className="text-[9px] font-black uppercase tracking-widest leading-tight">Public Liability</span>
                </div>
             </div>
          </div>

          <div className="bg-[#00FFFF]/5 border border-[#00FFFF]/20 p-5 rounded-xl">
             <div className="flex items-start gap-4">
                <div className="bg-[#00FFFF] p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-black" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-[#00FFFF] uppercase tracking-widest mb-1">Availability</p>
                   <p className="text-sm text-white/80 leading-snug">Earliest attending slot available:<br/><span className="text-white font-black underline decoration-[#00FFFF] decoration-2">Today, 2:00 PM</span>.</p>
                </div>
             </div>
          </div>
       </div>

       <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/5 pb-safe z-50 max-w-md mx-auto">
          <button 
            onClick={onAccept}
            className="w-full bg-[#00FFFF] text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 text-sm uppercase tracking-widest shadow-[0_10px_40px_rgba(0,255,255,0.2)] active:scale-95 transition-all"
          >
            Approve & Book Now
          </button>
          <div className="flex items-center justify-center gap-4 mt-6">
            <p className="text-[9px] text-[#A0A0A0] font-black uppercase tracking-widest">Valid for 48 hours</p>
            <div className="w-1 h-1 bg-white/20 rounded-full" />
            <p className="text-[9px] text-[#A0A0A0] font-black uppercase tracking-widest">Instant Confirmation</p>
          </div>
       </div>
    </div>
  );
};

export default QuoteView;
