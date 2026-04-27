// Cachet de statut spécial — urgent, standby, sav
export default function Flag({ type }) {
  if (!type) return null;
  const t = type.toLowerCase();

  if (t === 'urgent') {
    return (
      <span className="inline-block font-serif italic text-[11px] px-2 py-0.5 border-2 border-urgent text-urgent -rotate-3">
        URGENT
      </span>
    );
  }
  if (t === 'standby') {
    return (
      <span className="inline-block font-serif italic text-[11px] px-2 py-0.5 border-2 border-ink text-ink -rotate-3">
        STANDBY
      </span>
    );
  }
  if (t === 'sav') {
    return (
      <span className="inline-block font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 bg-ink text-surface">
        SAV
      </span>
    );
  }
  return null;
}
