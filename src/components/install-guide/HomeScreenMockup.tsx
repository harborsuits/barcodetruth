import { motion } from "framer-motion";

/** Visual mockup of a phone home screen with the Barcode app icon */
export function HomeScreenMockup() {
  return (
    <div className="relative w-full max-w-[200px] mx-auto">
      <div className="bg-[hsl(210,20%,12%)] border border-border rounded-2xl p-6 space-y-4">
        {/* App grid — row 1 */}
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={`r1-${i}`} className="w-10 h-10 rounded-xl bg-muted/30" />
          ))}
        </div>
        {/* App grid — row 2 with Barcode icon */}
        <div className="grid grid-cols-4 gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/30" />
          
          {/* Barcode app icon */}
          <motion.div 
            className="relative"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute -inset-1 rounded-xl bg-primary/30 animate-pulse" />
            <div className="relative w-10 h-10 rounded-xl bg-primary/20 border-2 border-primary flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-primary">
                <rect x="2" y="4" width="2" height="16" fill="currentColor" rx="0.5"/>
                <rect x="6" y="4" width="1" height="16" fill="currentColor" rx="0.5"/>
                <rect x="9" y="4" width="3" height="16" fill="currentColor" rx="0.5"/>
                <rect x="14" y="4" width="1" height="16" fill="currentColor" rx="0.5"/>
                <rect x="17" y="4" width="2" height="16" fill="currentColor" rx="0.5"/>
                <rect x="21" y="4" width="1" height="16" fill="currentColor" rx="0.5"/>
              </svg>
            </div>
            <p className="text-[7px] text-primary font-medium text-center mt-1">Barcode</p>
          </motion.div>
          
          <div className="w-10 h-10 rounded-xl bg-muted/30" />
          <div className="w-10 h-10 rounded-xl bg-muted/30" />
        </div>
        {/* Row 3 */}
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={`r3-${i}`} className="w-10 h-10 rounded-xl bg-muted/30" />
          ))}
        </div>
      </div>
      
      <p className="text-[10px] text-center text-primary font-mono mt-2 tracking-wider">
        ONE TAP TO SCAN
      </p>
    </div>
  );
}
