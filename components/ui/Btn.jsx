const VARIANTS = {
  primary: 'bg-ink text-surface border border-ink',
  outline: 'bg-surface text-ink border border-ink',
  ghost:   'bg-transparent text-ink border border-transparent',
  danger:  'bg-surface text-urgent border border-urgent',
};

export default function Btn({ variant = 'primary', children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-4 py-2 font-sans text-[13px] font-medium disabled:opacity-40 cursor-pointer ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
