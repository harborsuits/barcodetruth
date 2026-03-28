import { motion } from "framer-motion";

/** Visual mockup of Chrome top bar with the 3-dot menu highlighted */
export function ChromeMenuMockup() {
  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <div className="bg-[hsl(210,20%,18%)] border border-border rounded-xl overflow-hidden">
        {/* Chrome top bar */}
        <div className="px-3 py-2.5 flex items-center gap-2">
          {/* Tab strip */}
          <div className="flex-1 bg-[hsl(210,15%,14%)] rounded-full px-3 py-1.5 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-[10px] text-muted-foreground font-mono truncate">barcodetruth.com</span>
          </div>
          
          {/* 3-dot menu — highlighted */}
          <motion.div 
            className="relative"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute -inset-2 rounded-full bg-primary/20 animate-pulse" />
            <div className="relative w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
              <div className="flex flex-col gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-primary" />
                <div className="w-[3px] h-[3px] rounded-full bg-primary" />
                <div className="w-[3px] h-[3px] rounded-full bg-primary" />
              </div>
            </div>
            <motion.div 
              className="absolute -top-6 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-primary text-lg">↓</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      <p className="text-[10px] text-center text-primary font-mono mt-2 tracking-wider">
        TAP THE ⋮ MENU
      </p>
    </div>
  );
}

/** Visual mockup of Chrome dropdown menu with "Add to Home Screen" highlighted */
export function ChromeDropdownMockup() {
  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <div className="bg-[hsl(210,20%,18%)] border border-border rounded-xl overflow-hidden">
        {/* Menu items */}
        <div className="divide-y divide-border/30">
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <span className="text-xs text-muted-foreground">New tab</span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <span className="text-xs text-muted-foreground">New incognito tab</span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <span className="text-xs text-muted-foreground">Bookmarks</span>
          </div>
          
          {/* ADD TO HOME SCREEN — highlighted */}
          <motion.div 
            className="px-4 py-2.5 flex items-center gap-3 bg-primary/10 border-l-2 border-primary"
            animate={{ backgroundColor: ["hsl(180 25% 45% / 0.1)", "hsl(180 25% 45% / 0.2)", "hsl(180 25% 45% / 0.1)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xs text-primary font-semibold">Add to Home screen</span>
            <motion.span 
              className="ml-auto text-primary text-sm"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ←
            </motion.span>
          </motion.div>
          
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <span className="text-xs text-muted-foreground">Desktop site</span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3 opacity-40">
            <span className="text-xs text-muted-foreground">Settings</span>
          </div>
        </div>
      </div>
      
      <p className="text-[10px] text-center text-primary font-mono mt-2 tracking-wider">
        TAP "ADD TO HOME SCREEN"
      </p>
    </div>
  );
}
