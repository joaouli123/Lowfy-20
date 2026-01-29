import React, { useState } from 'react';
import { CheckCircle2, LucideIcon, ArrowRight } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  details: string[];
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon: Icon, details }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="group relative bg-white dark:bg-[#0f0f0f] rounded-2xl p-6 border border-gray-200 dark:border-[#333] hover:border-[#29654f] dark:hover:border-[#4ade80] shadow-lg dark:shadow-none transition-all duration-500 cursor-pointer overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Glow Effect */}
      <div className={`absolute -top-20 -right-20 w-40 h-40 bg-[#29654f] rounded-full blur-[80px] transition-opacity duration-500 ${isHovered ? 'opacity-20 dark:opacity-40' : 'opacity-0'}`}></div>
      
      <div className="relative z-10">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${isHovered ? 'bg-[#29654f] text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-[#29654f] dark:text-[#4ade80]'}`}>
          <Icon size={28} strokeWidth={1.5} />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-[#29654f] dark:group-hover:text-[#4ade80] transition-colors">
          {title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
          {description}
        </p>

        {/* Expanding Section */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isHovered ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <ul className="space-y-2">
              {details.map((detail, idx) => (
                <li key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-[#29654f] mr-2" />
                  {detail}
                </li>
              ))}
            </ul>
            <button className="mt-4 flex items-center text-[#29654f] dark:text-[#4ade80] text-sm font-bold hover:underline">
              Explorar recurso <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;