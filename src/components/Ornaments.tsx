import React from "react";

export function LotusMotif({ className = "w-7 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lotusGold" x1="0" y1="0" x2="40" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.4" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="lotusOrange" x1="0" y1="0" x2="40" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      {/* Central Petal */}
      <path d="M20 1 C22 7 24 14 20 22 C16 14 18 7 20 1 Z" fill="url(#lotusGold)" stroke="#d97706" strokeWidth="0.8" />
      <path d="M20 5 C21 9 22 14 20 19 C18 14 19 9 20 5 Z" fill="url(#lotusOrange)" />
      {/* Left Petal */}
      <path d="M20 22 C14 18 8 13 10 7 C14 11 18 16 20 22 Z" fill="url(#lotusGold)" stroke="#d97706" strokeWidth="0.8" />
      <path d="M19 20 C15 16 11 12 12 8 C15 11 18 15 19 20 Z" fill="url(#lotusOrange)" />
      {/* Right Petal */}
      <path d="M20 22 C26 18 32 13 30 7 C26 11 22 16 20 22 Z" fill="url(#lotusGold)" stroke="#d97706" strokeWidth="0.8" />
      <path d="M21 20 C25 16 29 12 28 8 C25 11 22 15 21 20 Z" fill="url(#lotusOrange)" />
      {/* Base jewel */}
      <circle cx="20" cy="21.5" r="1.5" fill="#fef08a" />
    </svg>
  );
}

export function CornerFlourish({ 
  className = "w-6 h-6", 
  position = "top-left" 
}: { 
  className?: string; 
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const transform = {
    "top-left": "none",
    "top-right": "scaleX(-1)",
    "bottom-left": "scaleY(-1)",
    "bottom-right": "scale(-1, -1)",
  }[position];

  return (
    <svg 
      viewBox="0 0 36 36" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      style={{ transform }}
    >
      <defs>
        <linearGradient id="cornerGold" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Outer corner L bracket with smooth corner */}
      <path d="M3 34 V12 C3 7 7 3 12 3 H34" stroke="url(#cornerGold)" strokeWidth="1.6" strokeLinecap="round" />
      {/* Inner flourish line */}
      <path d="M7 34 V15 C7 10.5 10.5 7 15 7 H34" stroke="url(#cornerGold)" strokeWidth="1" strokeOpacity="0.8" />
      {/* Corner ornate curl */}
      <path d="M10 10 C13 7 17 9 16 13 C15 16 10 14 10 10 Z" fill="url(#cornerGold)" />
      {/* Delicate dot */}
      <circle cx="19" cy="19" r="1.5" fill="#fef08a" />
    </svg>
  );
}
