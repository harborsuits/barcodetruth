import { useMemo } from "react";

// Brand logos as SVG components
const logos = [
  // Apple
  <svg key="apple" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M50,15c-2,0-4,1-5,3c-1,2-1,4,0,6c1,1,3,2,5,2c2,0,4-1,5-3s1-4,0-6C54,16,52,15,50,15z M50,30c-8,0-15,6-15,15c0,10,7,20,15,25c8-5,15-15,15-25C65,36,58,30,50,30z"/>
  </svg>,
  // Google
  <svg key="google" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="25" fill="#4285F4"/>
    <path fill="#EA4335" d="M75,50c0-3-0.5-6-1.5-8.5L50,50z"/>
    <path fill="#FBBC05" d="M50,75c7,0,13-3,17-7L50,50z"/>
    <path fill="#34A853" d="M25,50c0,7,3,13,7,17L50,50z"/>
  </svg>,
  // McDonald's
  <svg key="mcdonalds" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC72C" d="M30,80V35c0-8,6-15,13-15s13,7,13,15v10c0-8,6-15,13-15s13,7,13,15v45H30z"/>
  </svg>,
  // Nike Swoosh
  <svg key="nike" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M10,70 Q40,50 90,45 L85,55 Q40,58 15,75z"/>
  </svg>,
  // Starbucks
  <svg key="starbucks" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#00704A"/>
    <circle cx="50" cy="50" r="30" fill="currentColor"/>
    <circle cx="50" cy="50" r="25" fill="#00704A"/>
  </svg>,
  // Microsoft
  <svg key="microsoft" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="25" width="20" height="20" fill="#F25022"/>
    <rect x="55" y="25" width="20" height="20" fill="#7FBA00"/>
    <rect x="25" y="55" width="20" height="20" fill="#00A4EF"/>
    <rect x="55" y="55" width="20" height="20" fill="#FFB900"/>
  </svg>,
  // Target
  <svg key="target" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#CC0000"/>
    <circle cx="50" cy="50" r="25" fill="currentColor"/>
    <circle cx="50" cy="50" r="15" fill="#CC0000"/>
  </svg>,
  // Netflix
  <svg key="netflix" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="25" width="10" height="50" fill="#E50914"/>
    <rect x="60" y="25" width="10" height="50" fill="#E50914"/>
    <path fill="#E50914" d="M40,25 L60,75 L60,25z"/>
  </svg>,
  // Pepsi
  <svg key="pepsi" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="30" fill="#004B93"/>
    <path fill="currentColor" d="M50,20 A30,30 0 0,1 50,80z"/>
    <path fill="#E32934" d="M50,20 A30,30 0 0,0 50,80z"/>
  </svg>,
  // Mastercard
  <svg key="mastercard" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="50" r="20" fill="#EB001B"/>
    <circle cx="60" cy="50" r="20" fill="#F79E1B"/>
  </svg>,
  // Shell
  <svg key="shell" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FBCE07" d="M50,25 Q70,25 80,45 Q80,65 50,75 Q20,65 20,45 Q30,25 50,25z"/>
    <path fill="#DD1D21" d="M50,30 Q65,30 73,45 Q73,60 50,68 Q27,60 27,45 Q35,30 50,30z"/>
  </svg>,
  // Spotify
  <svg key="spotify" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#1DB954"/>
    <path stroke="#000" strokeWidth="3" fill="none" d="M30,40 Q50,35 70,40"/>
    <path stroke="#000" strokeWidth="3" fill="none" d="M30,50 Q50,45 70,50"/>
    <path stroke="#000" strokeWidth="3" fill="none" d="M30,60 Q50,55 70,60"/>
  </svg>,
  // YouTube
  <svg key="youtube" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="35" width="70" height="30" fill="#FF0000" rx="5"/>
    <polygon fill="currentColor" points="43,42 43,58 60,50"/>
  </svg>,
  // Adidas
  <svg key="adidas" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor">
      <polygon points="20,70 35,40 45,40 30,70"/>
      <polygon points="40,70 55,40 65,40 50,70"/>
      <polygon points="60,70 75,40 85,40 70,70"/>
    </g>
  </svg>,
  // Tesla
  <svg key="tesla" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#E82127" d="M50,30 L30,40 L30,50 L50,60 L70,50 L70,40z"/>
    <rect x="47" y="25" width="6" height="15" fill="#E82127"/>
  </svg>,
  // Meta/Facebook
  <svg key="meta" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="30" fill="#0866FF"/>
    <path fill="currentColor" d="M55,40v-5h10v10H55v20H45V45H35V40h10v-5c0-5,4-10,10-10h10v10H55z"/>
  </svg>,
];

interface FallingLogoProps {
  logo: React.ReactNode;
  index: number;
  totalLogos: number;
  side: "left" | "right";
}

function FallingLogo({ logo, index, totalLogos, side }: FallingLogoProps) {
  // Randomize position, delay, and duration
  const style = useMemo(() => {
    const leftPosition = side === "left" 
      ? (index / totalLogos) * 80 + 5 
      : (index / totalLogos) * 80 + 5;
    const delay = (index * 0.7) % 6;
    const duration = 8 + (index % 4);
    const size = 32 + (index % 3) * 8;
    
    return {
      left: `${leftPosition}%`,
      width: `${size}px`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    };
  }, [index, totalLogos, side]);

  return (
    <div 
      className="absolute opacity-0 text-white/20 animate-logo-fall pointer-events-none"
      style={style}
    >
      {logo}
    </div>
  );
}

interface FallingLogosProps {
  side: "left" | "right";
  className?: string;
}

export function FallingLogos({ side, className = "" }: FallingLogosProps) {
  // Use a subset of logos for each side, offset to show different logos
  const sideLogos = useMemo(() => {
    const offset = side === "left" ? 0 : 8;
    return logos.slice(offset, offset + 8);
  }, [side]);

  return (
    <div 
      className={`absolute top-0 bottom-0 overflow-hidden pointer-events-none ${className}`}
      style={{
        width: "120px",
        [side]: 0,
      }}
    >
      {sideLogos.map((logo, index) => (
        <FallingLogo 
          key={index} 
          logo={logo} 
          index={index} 
          totalLogos={sideLogos.length}
          side={side}
        />
      ))}
      {/* Duplicate for continuous stream */}
      {sideLogos.map((logo, index) => (
        <FallingLogo 
          key={`dup-${index}`} 
          logo={logo} 
          index={index + sideLogos.length} 
          totalLogos={sideLogos.length}
          side={side}
        />
      ))}
    </div>
  );
}
