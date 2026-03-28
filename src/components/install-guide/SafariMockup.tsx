import { motion } from "framer-motion";

/** Visual mockup of the Safari bottom bar with the Share button highlighted */
export function SafariShareMockup() {
  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      {/* Safari bottom bar mockup */}
      <div className="bg-[hsl(210,20%,18%)] border border-border rounded-xl overflow-hidden">
        {/* URL bar area */}
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="flex-1 bg-[hsl(210,15%,14%)] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-[10px] text-muted-foreground font-mono truncate">barcodetruth.com</span>
          </div>
        </div>
        
        {/* Bottom toolbar */}
        <div className="px-4 py-2.5 flex items-center justify-between border-t border-border/50">
          {/* Back */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* Forward */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* SHARE BUTTON — highlighted */}
          <motion.div 
            className="relative"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Glow ring */}
            <div className="absolute -inset-2 rounded-full bg-primary/20 animate-pulse" />
            <div className="relative w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16,6 12,2 8,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            {/* Arrow pointer */}
            <motion.div 
              className="absolute -top-6 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-primary text-lg">↓</span>
            </motion.div>
          </motion.div>
          
          {/* Bookmarks */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40">
            <path d="M19 21L12 16L5 21V5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* Tabs */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>
      
      {/* Label */}
      <p className="text-[10px] text-center text-primary font-mono mt-2 tracking-wider">
        TAP THE SHARE ICON
      </p>
    </div>
  );
}

/** Visual mockup of the iOS share sheet with "Add to Home Screen" highlighted */
export function ShareSheetMockup() {
  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <div className="bg-[hsl(210,20%,18%)] border border-border rounded-xl overflow-hidden">
        {/* Share sheet header */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">barcodetruth.com</span>
          <span className="text-[10px] text-primary font-medium">Done</span>
        </div>
        
        {/* App row icons */}
        <div className="px-4 py-3 flex gap-3 border-b border-border/50">
          {["Messages", "Mail", "Notes"].map((app) => (
            <div key={app} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-muted/50" />
              <span className="text-[8px] text-muted-foreground/50">{app}</span>
            </div>
          ))}
        </div>
        
        {/* Action list */}
        <div className="divide-y divide-border/30">
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-xs text-muted-foreground">Copy</span>
          </div>
          
          {/* ADD TO HOME SCREEN — highlighted */}
          <motion.div 
            className="px-4 py-2.5 flex items-center gap-3 bg-primary/10 border-l-2 border-primary"
            animate={{ backgroundColor: ["hsl(180 25% 45% / 0.1)", "hsl(180 25% 45% / 0.2)", "hsl(180 25% 45% / 0.1)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xs text-primary font-semibold">Add to Home Screen</span>
            <motion.span 
              className="ml-auto text-primary text-sm"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ←
            </motion.span>
          </motion.div>
          
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-xs text-muted-foreground">Add Bookmark</span>
          </div>
          
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-xs text-muted-foreground">Find on Page</span>
          </div>
        </div>
      </div>
      
      <p className="text-[10px] text-center text-primary font-mono mt-2 tracking-wider">
        TAP "ADD TO HOME SCREEN"
      </p>
    </div>
  );
}
