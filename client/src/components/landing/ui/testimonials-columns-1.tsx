
"use client";
import React, { useMemo } from "react";

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: any[];
  duration?: number;
  index?: number;
}) => {
  const avatarColors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-lime-500",
  ];

  const columnIndex = props.index || 0;
  const duration = props.duration || 25;
  
  const items = useMemo(() => props.testimonials, [props.testimonials]);

  return (
    <div 
      className={props.className} 
      data-testimonial-index={columnIndex}
    >
      <div
        className="flex flex-col gap-4 animate-testimonial-scroll"
        style={{ 
          '--testimonial-duration': `${duration}s`,
          animationDelay: `${-duration * (columnIndex / 3)}s`
        } as React.CSSProperties}
      >
        {items.map(({ text, name, role }, i) => (
          <div 
            className="p-5 md:p-6 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-dark-900 max-w-xs w-full transition-colors" 
            key={`original-${i}`}
            data-testid={`testimonial-card-original-${i}`}
          >
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed line-clamp-4">{text}</div>
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                {name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <div className="font-bold text-gray-900 dark:text-white text-xs">{name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{role}</div>
              </div>
            </div>
          </div>
        ))}
        {items.map(({ text, name, role }, i) => (
          <div 
            className="p-5 md:p-6 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-dark-900 max-w-xs w-full transition-colors" 
            key={`duplicate-${i}`}
            data-testid={`testimonial-card-duplicate-${i}`}
          >
            <div className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed line-clamp-4">{text}</div>
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                {name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <div className="font-bold text-gray-900 dark:text-white text-xs">{name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
