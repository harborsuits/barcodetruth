export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div 
    className={"animate-pulse rounded-lg " + className} 
    style={{ background: "color-mix(in oklab, var(--text) 8%, transparent)" }}
  />
);
