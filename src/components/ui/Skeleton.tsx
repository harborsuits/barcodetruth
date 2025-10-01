export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={"animate-pulse rounded-lg bg-neutral-200/70 " + className} />
);
