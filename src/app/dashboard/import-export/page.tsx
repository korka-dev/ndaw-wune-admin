"use client";
import { useRef, useState } from "react";
import { importExportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/csv";

type ImportSummary = {
  ecoles_creees: number;
  superviseurs_crees: number;
  tuteurs_crees: number;
  classes_creees: number;
  eleves_crees: number;
  ignores: number;
  erreurs: string[];
};

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await importExportApi.export();
      downloadBlob(res.data, "export_ndawwune.xlsx");
    } catch {
      alert("Erreur lors de l'export.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setResult(null);
    setImportError(null);
    try {
      const { data } = await importExportApi.import(file);
      setResult(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setImportError(typeof detail === "string" ? detail : "Erreur lors de l'import.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg pt-7 pb-4 mb-6 border-b border-border">
        <h1 className="text-xl font-bold text-tx">Import / Export</h1>
        <p className="text-tx-muted text-sm mt-0.5">
          Exportez l&apos;ensemble des données du programme (écoles, superviseurs, tuteurs, classes,
          élèves) dans un fichier Excel, ou réimportez ce même fichier pour ajouter de nouvelles
          données — les enregistrements déjà présents en base sont automatiquement ignorés, jamais modifiés.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Export ── */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-tx">Exporter toutes les données</h2>
          </div>
          <p className="text-sm text-tx-muted mb-5">
            Génère un classeur Excel — une ligne par élève, avec l&apos;IEF, la commune, l&apos;école,
            le superviseur, le tuteur, la classe et les informations de l&apos;élève. Même format que
            celui utilisé pour la synchronisation de la base (BaseNWVFinale2026).
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {exporting ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            )}
            {exporting ? "Export en cours…" : "Exporter Excel"}
          </button>
        </div>

        {/* ── Import ── */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-tx">Importer des données</h2>
          </div>
          <p className="text-sm text-tx-muted mb-5">
            Réimportez un fichier au même format (celui exporté ci-contre, ou une mise à jour de la
            base de référence). Les écoles, superviseurs, tuteurs, classes et élèves déjà présents en
            base sont <strong>ignorés sans être modifiés</strong> — seuls les nouveaux enregistrements
            sont ajoutés.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 bg-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {importing ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            )}
            {importing ? "Import en cours…" : "Choisir un fichier Excel"}
          </button>
        </div>
      </div>

      {/* ── Résultat de l'import ── */}
      {importError && (
        <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{importError}</span>
        </div>
      )}

      {result && (
        <div className="mt-6 bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-tx mb-4">Résultat de l&apos;import</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
            {[
              { label: "Écoles créées", value: result.ecoles_creees },
              { label: "Superviseurs créés", value: result.superviseurs_crees },
              { label: "Tuteurs créés", value: result.tuteurs_crees },
              { label: "Classes créées", value: result.classes_creees },
              { label: "Élèves créés", value: result.eleves_crees },
              { label: "Déjà existants (ignorés)", value: result.ignores },
            ].map(s => (
              <div key={s.label} className="bg-bg rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-brand">{s.value}</p>
                <p className="text-[11px] text-tx-muted mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          {result.erreurs.length > 0 && (
            <div className="bg-danger/10 rounded-xl p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-danger mb-1.5">
                {result.erreurs.length} ligne{result.erreurs.length > 1 ? "s" : ""} ignorée{result.erreurs.length > 1 ? "s" : ""} (erreur)
              </p>
              {result.erreurs.map((e, i) => (
                <p key={i} className="text-xs text-danger mb-0.5">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
