// Jalon d'avancement — carré 13×13 bord encre, plein + coche quand done
export default function StepBox({ done, label, className = '' }) {
  return (
    <div className={`flex items-center gap-2 py-1.5 border-b border-dotted border-black/30 last:border-0 ${className}`}>
      <span
        className="inline-flex items-center justify-center flex-shrink-0 border border-ink"
        style={{ width: 13, height: 13, background: done ? '#000' : '#fff' }}
      >
        {done && (
          <span className="font-mono text-surface leading-none" style={{ fontSize: 8 }}>✓</span>
        )}
      </span>
      <span className="font-serif text-[13px] text-ink flex-1">{label}</span>
    </div>
  );
}
