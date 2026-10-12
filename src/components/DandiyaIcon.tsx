import Image from "next/image";

export function DandiyaIcon({ className = "w-24 sm:w-28 h-auto" }: { className?: string }) {
  return (
    <img 
      src="/dandiya-decorative-clean.png" 
      alt="Maha Garba Dandiya" 
      className={`object-contain pointer-events-none drop-shadow-[0_4px_16px_rgba(245,158,11,0.5)] select-none ${className}`} 
    />
  );
}
