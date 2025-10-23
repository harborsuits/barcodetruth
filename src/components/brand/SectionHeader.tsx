interface SectionHeaderProps {
  children: React.ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  );
}
