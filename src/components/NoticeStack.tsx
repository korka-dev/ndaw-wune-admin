"use client";
import { useNotices } from "@/lib/notify";

/** Bandeaux d'erreur empilés en bas à droite (APP-47). */
export default function NoticeStack() {
  const { notices, dismiss } = useNotices();
  if (notices.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className="bg-surface border border-red-300 shadow-lg rounded-xl px-4 py-3 text-sm flex gap-3 items-start">
          <div className="flex-1">
            <div className="font-semibold text-red-700">{n.message}</div>
            {n.detail && <div className="text-xs text-tx-muted mt-0.5 break-words">{n.detail}</div>}
            {n.reference && (
              <button
                onClick={() => navigator.clipboard?.writeText(n.reference!).catch(() => {})}
                className="mt-1 text-[11px] font-mono text-tx-muted hover:text-tx"
                title="Copier la référence à transmettre au support"
              >
                Réf. support : {n.reference} ⧉
              </button>
            )}
          </div>
          <button onClick={() => dismiss(n.id)} className="text-tx-muted hover:text-tx text-xs" aria-label="Fermer">✕</button>
        </div>
      ))}
    </div>
  );
}
