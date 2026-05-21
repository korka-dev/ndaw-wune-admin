"use client";

type ImportResult = {
  format: string;
  imported: number;
  skipped: number;
  errors: string[];
};

type Props = {
  result: ImportResult | null;
  error: string | null;
  onClose: () => void;
};

export default function ImportResultModal({ result, error, onClose }: Props) {
  const isSuccess = !!result && result.imported > 0;
  const hasErrors = !!result && result.errors.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">

        {/* En-tête */}
        <div className={`rounded-t-2xl px-6 pt-5 pb-4 flex items-center gap-3 ${error ? "bg-danger-soft" : isSuccess ? "bg-success-soft" : "bg-warn-soft"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${error ? "bg-danger/10 text-danger" : isSuccess ? "bg-success/10 text-success" : "bg-warn/10 text-warn"}`}>
            {error ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : isSuccess ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            )}
          </div>
          <div>
            <p className="font-semibold text-tx text-sm">
              {error ? "Erreur d'import" : isSuccess ? "Import réussi" : "Aucun élève importé"}
            </p>
            {result && (
              <p className="text-xs text-tx-muted mt-0.5">
                Format détecté : <span className="font-medium">{result.format}</span>
              </p>
            )}
          </div>
        </div>

        {/* Corps */}
        <div className="px-6 py-4">
          {error ? (
            <p className="text-sm text-tx">{error}</p>
          ) : result ? (
            <div className="space-y-3">
              {/* Compteurs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-alt rounded-xl px-4 py-3 text-center">
                  <div className={`text-2xl font-bold ${result.imported > 0 ? "text-success" : "text-tx-muted"}`}>
                    {result.imported}
                  </div>
                  <div className="text-xs text-tx-muted mt-0.5">
                    élève{result.imported !== 1 ? "s" : ""} importé{result.imported !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="bg-surface-alt rounded-xl px-4 py-3 text-center">
                  <div className={`text-2xl font-bold ${result.skipped > 0 ? "text-warn" : "text-tx-muted"}`}>
                    {result.skipped}
                  </div>
                  <div className="text-xs text-tx-muted mt-0.5">
                    ligne{result.skipped !== 1 ? "s" : ""} ignorée{result.skipped !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Liste des erreurs */}
              {hasErrors && (
                <div>
                  <p className="text-xs font-semibold text-tx-muted uppercase tracking-wide mb-2">
                    Détail des lignes ignorées
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-alt divide-y divide-border">
                    {result.errors.map((err, i) => (
                      <div key={i} className="px-3 py-2 flex items-start gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-warn flex-shrink-0 mt-0.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span className="text-xs text-tx">{err}</span>
                      </div>
                    ))}
                  </div>
                  {result.errors.length >= 50 && (
                    <p className="text-xs text-tx-muted mt-1.5">
                      Seules les 50 premières erreurs sont affichées.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Pied */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
