import { useMemo } from "react";
import React from "react";

// Brand logos as SVG components - 20 recognizable logos
const logos = [
  // === LEFT SIDE (0-9) ===
  
  // Google - 4-color circle
  <svg key="google" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M50,25 A25,25 0 0,1 75,50 L50,50 Z"/>
    <path fill="#EA4335" d="M75,50 A25,25 0 0,1 50,75 L50,50 Z"/>
    <path fill="#FBBC05" d="M50,75 A25,25 0 0,1 25,50 L50,50 Z"/>
    <path fill="#34A853" d="M25,50 A25,25 0 0,1 50,25 L50,50 Z"/>
    <circle cx="50" cy="50" r="12" fill="#FFFFFF"/>
  </svg>,
  
  // McDonald's - Golden arches
  <svg key="mcdonalds" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC72C" d="M20,75 L20,35 Q20,20 35,20 Q50,20 50,45 Q50,20 65,20 Q80,20 80,35 L80,75 L70,75 L70,40 Q70,30 65,30 Q55,30 55,45 L55,75 L45,75 L45,45 Q45,30 35,30 Q30,30 30,40 L30,75 Z"/>
  </svg>,
  
  // Nike - Swoosh
  <svg key="nike" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#111111" d="M10,55 C25,50 55,40 90,35 C85,40 70,50 40,60 C25,65 15,65 10,55 Z"/>
  </svg>,
  
  // Starbucks - Green with white ring
  <svg key="starbucks" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#00704A"/>
    <circle cx="50" cy="50" r="28" fill="#FFFFFF"/>
    <circle cx="50" cy="50" r="22" fill="#00704A"/>
  </svg>,
  
  // Microsoft - 4 colored squares
  <svg key="microsoft" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="25" width="22" height="22" fill="#F25022"/>
    <rect x="53" y="25" width="22" height="22" fill="#7FBA00"/>
    <rect x="25" y="53" width="22" height="22" fill="#00A4EF"/>
    <rect x="53" y="53" width="22" height="22" fill="#FFB900"/>
  </svg>,
  
  // Target - Red and white rings
  <svg key="target" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#CC0000"/>
    <circle cx="50" cy="50" r="24" fill="#FFFFFF"/>
    <circle cx="50" cy="50" r="13" fill="#CC0000"/>
  </svg>,
  
  // Netflix - Red N
  <svg key="netflix" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#E50914" d="M30,25 L30,75 L40,75 L40,45 L60,75 L70,75 L70,25 L60,25 L60,55 L40,25 Z"/>
  </svg>,
  
  // Spotify - Green circle with black lines
  <svg key="spotify" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#1DB954"/>
    <path stroke="#000000" strokeWidth="5" strokeLinecap="round" fill="none" d="M30,38 Q50,32 70,38"/>
    <path stroke="#000000" strokeWidth="5" strokeLinecap="round" fill="none" d="M32,50 Q50,44 68,50"/>
    <path stroke="#000000" strokeWidth="5" strokeLinecap="round" fill="none" d="M35,62 Q50,56 65,62"/>
  </svg>,
  
  // YouTube - Red rectangle with white play
  <svg key="youtube" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="70" height="40" fill="#FF0000" rx="10"/>
    <polygon fill="#FFFFFF" points="42,40 42,60 62,50"/>
  </svg>,
  
  // Walmart - Blue spark
  <svg key="walmart" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g fill="#0071CE">
      <polygon points="50,15 54,42 50,50 46,42"/>
      <polygon points="50,85 54,58 50,50 46,58"/>
      <polygon points="15,50 42,54 50,50 42,46"/>
      <polygon points="85,50 58,54 50,50 58,46"/>
      <polygon points="25,25 44,44 50,50 42,42"/>
      <polygon points="75,75 56,56 50,50 58,58"/>
      <polygon points="75,25 56,44 50,50 58,42"/>
      <polygon points="25,75 44,56 50,50 42,58"/>
    </g>
  </svg>,
  
  // === RIGHT SIDE (10-19) ===
  
  // Kroger - Red circle with K
  <svg key="kroger" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#E31837"/>
    <path fill="#FFFFFF" d="M35,30 L35,70 L45,70 L45,55 L55,70 L68,70 L53,50 L65,30 L52,30 L45,45 L45,30 Z"/>
  </svg>,
  
  // Costco - Red/blue badge
  <svg key="costco" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="70" height="40" rx="5" fill="#E31837"/>
    <rect x="20" y="38" width="60" height="24" rx="3" fill="#005DAA"/>
    <text x="50" y="56" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="bold">COSTCO</text>
  </svg>,
  
  // Whole Foods - Green circle with leaf
  <svg key="wholefoods" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#00674B"/>
    <path fill="#FFFFFF" d="M50,25 Q70,35 70,50 Q70,70 50,75 Q30,70 30,50 Q30,35 50,25 Z"/>
    <path fill="#00674B" d="M50,30 Q60,40 60,50 Q60,65 50,70 Q50,55 50,30 Z"/>
  </svg>,
  
  // Aldi - Blue/orange A
  <svg key="aldi" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="20" width="70" height="60" fill="#00529B"/>
    <polygon fill="#FFFFFF" points="50,30 70,70 60,70 55,58 45,58 40,70 30,70"/>
    <polygon fill="#F26522" points="50,38 53,52 47,52"/>
  </svg>,
  
  // Publix - Green P
  <svg key="publix" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#3B7F3B"/>
    <path fill="#FFFFFF" d="M35,30 L35,70 L48,70 L48,55 L55,55 Q70,55 70,42 Q70,30 55,30 Z M48,40 L55,40 Q58,40 58,42 Q58,45 55,45 L48,45 Z"/>
  </svg>,
  
  // Amazon - Orange smile arrow
  <svg key="amazon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <text x="50" y="45" textAnchor="middle" fill="#232F3E" fontSize="20" fontWeight="bold">amazon</text>
    <path fill="#FF9900" d="M25,55 Q50,70 75,55 L78,52 Q50,68 25,55 Z"/>
    <polygon fill="#FF9900" points="75,50 82,55 75,60"/>
  </svg>,
  
  // Coca-Cola - Red circle with wave
  <svg key="cocacola" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#F40009"/>
    <path stroke="#FFFFFF" strokeWidth="3" fill="none" d="M25,50 Q35,40 50,50 Q65,60 75,50"/>
    <path stroke="#FFFFFF" strokeWidth="2" fill="none" d="M30,58 Q42,50 55,58 Q68,66 75,58"/>
  </svg>,
  
  // Walgreens - Red W
  <svg key="walgreens" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="35" fill="#E31837"/>
    <path fill="#FFFFFF" d="M25,35 L32,35 L38,55 L44,35 L50,35 L56,55 L62,35 L68,35 L75,65 L67,65 L62,45 L56,65 L44,65 L38,45 L33,65 L25,65 Z"/>
  </svg>,
  
  // CVS - Red heart
  <svg key="cvs" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fill="#CC0000" d="M50,75 L25,50 Q20,35 35,30 Q50,28 50,42 Q50,28 65,30 Q80,35 75,50 Z"/>
    <text x="50" y="58" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold">CVS</text>
  </svg>,
  
  // Adidas - 3 stripes
  <svg key="adidas" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g fill="#000000">
      <polygon points="20,70 30,45 40,45 30,70"/>
      <polygon points="38,70 48,35 58,35 48,70"/>
      <polygon points="56,70 66,25 76,25 66,70"/>
    </g>
  </svg>,
];

interface FallingLogoProps {
  logo: React.ReactNode;
  index: number;
  totalLogos: number;
  side: "left" | "right";
}

function FallingLogo({ logo, index, side }: FallingLogoProps) {
  const style = useMemo(() => {
    // Create deterministic but varied values based on index
    const seed = index * 7 + (side === "left" ? 0 : 100);
    const leftPosition = ((seed * 13) % 85) + 5; // 5-90% spread across full gutter
    const delay = ((seed * 17) % 80) / 10; // 0-8s delay for better staggering
    const duration = 10 + ((seed * 11) % 100) / 10; // 10-20s duration
    const size = 32 + ((seed * 19) % 28); // 32-60px size
    const rotation = ((seed * 23) % 30) - 15; // -15 to +15 degrees
    
    return {
      left: `${leftPosition}%`,
      top: "-60px",
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      transform: `rotate(${rotation}deg)`,
    };
  }, [index, side]);

  return (
    <div
      className="absolute text-primary/70 animate-logo-fall pointer-events-none"
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
  // Select different logos for each side - 10 unique logos per side, no duplicates
  const sideLogos = useMemo(() => {
    const startIndex = side === "left" ? 0 : 10;
    return logos.slice(startIndex, startIndex + 10);
  }, [side]);

  // Mask gradient to fade logos near the hero edge
  const maskStyle: React.CSSProperties = side === "left"
    ? {
        maskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
      }
    : {
        maskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
      };

  return (
    <div
      className={`fixed top-0 bottom-0 overflow-hidden pointer-events-none z-10 ${className}`}
      style={{
        width: "clamp(100px, 15vw, 300px)",
        [side]: 0,
        ...maskStyle,
      }}
    >
      {sideLogos.map((logo, index) => (
        <FallingLogo
          key={`${side}-${index}`}
          logo={logo}
          index={index}
          totalLogos={sideLogos.length}
          side={side}
        />
      ))}
      {/* Duplicate set for continuous stream */}
      {sideLogos.map((logo, index) => (
        <FallingLogo
          key={`${side}-${index}-dup`}
          logo={logo}
          index={index + sideLogos.length}
          totalLogos={sideLogos.length}
          side={side}
        />
      ))}
    </div>
  );
}
