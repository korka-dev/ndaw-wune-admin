/**
 * Composant Pagination réutilisable.
 * Usage :
 *   <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
 *
 * - page   : index courant (commence à 1)
 * - total  : nombre total d'éléments
 * - pageSize : éléments par page
 * - onChange : callback appelé avec le nouveau numéro de page
 */
interface PaginationProps {
  page:     number;
  total:    number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  // Calcul des numéros de page visibles (max 5 autour de la page courante)
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn = (
    label: React.ReactNode,
    target: number,
    disabled: boolean,
    active = false,
    keyOverride?: string,
  ) => (
    <button
      key={keyOverride ?? String(target)}
      onClick={() => !disabled && onChange(target)}
      disabled={disabled}
      className={[
        "min-w-[34px] h-[34px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors px-2",
        disabled  ? "opacity-30 cursor-not-allowed text-tx-muted" :
        active    ? "bg-brand text-white shadow-sm" :
                    "text-tx hover:bg-surface-alt border border-transparent hover:border-border",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between py-3">
      {/* Compteur */}
      <span className="text-xs text-tx-muted select-none">
        {from}–{to} sur <span className="font-semibold text-tx">{total}</span>
      </span>

      {/* Boutons */}
      <div className="flex items-center gap-1">
        {/* Précédent */}
        {btn(
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>,
          page - 1, page === 1, false, "prev",
        )}

        {pages.map((p, i) =>
          p === "…"
            ? <span key={`ellipsis-${i}`} className="w-8 text-center text-tx-muted text-sm select-none">…</span>
            : btn(p, p as number, false, p === page)
        )}

        {/* Suivant */}
        {btn(
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>,
          page + 1, page === totalPages, false, "next",
        )}
      </div>
    </div>
  );
}
