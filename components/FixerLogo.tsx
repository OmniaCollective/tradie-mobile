
import React from 'react';
import { Zap } from 'lucide-react';

interface Props {
  className?: string;
  iconSize?: number;
}

const FixerLogo: React.FC<Props> = ({ className = "w-10 h-10", iconSize = 18 }) => {
  return (
    <div className={`bg-[#00FFFF] rounded-xl flex items-center justify-center p-1 shadow-lg shadow-[#00FFFF]/20 ${className}`}>
      <Zap 
        size={iconSize} 
        fill="black" 
        stroke="black"
        strokeWidth={1.5}
      />
    </div>
  );
};

export default FixerLogo;
