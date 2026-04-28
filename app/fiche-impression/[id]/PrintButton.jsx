'use client';
export default function PrintButton({ className }) {
  return (
    <button className={className} onClick={() => window.print()}>
      Imprimer
    </button>
  );
}
