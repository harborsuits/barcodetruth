import { useState, useEffect } from 'react';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { cn } from '@/lib/utils';

interface LogoDisplayProps {
  logoUrl: string | null;
  website: string | null;
  brandName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-16 w-16 text-2xl'
};

export function LogoDisplay({ 
  logoUrl, 
  website, 
  brandName, 
  size = 'md', 
  className 
}: LogoDisplayProps) {
  const [isBroken, setIsBroken] = useState(false);
  const displayLogo = useBrandLogo(logoUrl, website, brandName);
  
  // Reset broken state when logo URL changes
  useEffect(() => {
    setIsBroken(false);
  }, [displayLogo]);
  
  if (displayLogo && !isBroken) {
    return (
      <img 
        src={displayLogo} 
        alt={`${brandName} logo`}
        className={cn('object-contain', sizeClasses[size], className)}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setIsBroken(true)}
        loading="lazy"
      />
    );
  }
  
  // Fallback to monogram
  return (
    <div className={cn(
      'flex items-center justify-center bg-muted rounded',
      sizeClasses[size],
      className
    )}>
      <span className="font-bold text-muted-foreground">
        {brandName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
