export default function Kicker({ children, className = '' }) {
  return (
    <p className={`font-mono uppercase tracking-[0.18em] text-[10px] text-muted leading-none ${className}`}>
      {children}
    </p>
  );
}
