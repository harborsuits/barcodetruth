import * as React from "react";
import { cn } from "@/lib/utils";

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden bg-slate-950 w-full rounded-2xl border border-white/5 shadow-2xl shadow-black/20 z-0",
        className
      )}
    >
      {/* Noise texture for premium material feel */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 pointer-events-none" />

      {/* Lamp glow area */}
      <div className="relative flex w-full flex-1 items-center justify-center isolate z-0">
        {/* Ambient glow - wide, very soft */}
        <div className="absolute top-1/4 h-64 w-[40rem] -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />

        {/* Focused orb - tight, brighter */}
        <div className="absolute top-1/4 h-24 w-[16rem] -translate-y-1/2 rounded-full bg-primary opacity-50 blur-3xl" />

        {/* Lamp base line */}
        <div className="absolute top-1/4 h-px w-[12rem] -translate-y-[5rem] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        {/* Top fade mask */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950 to-transparent" />
      </div>

      {/* Content container */}
      <div className="relative z-50 -mt-32 flex flex-col items-center px-5 pb-10">
        {children}
      </div>
    </div>
  );
};
