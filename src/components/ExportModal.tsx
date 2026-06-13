"use client";
import { useState } from "react";

export interface ExportField {
  key: string;
  label: string;
}

interface ExportModalProps {
  title?: string;
  fields: ExportField[];
  exporting?: boolean;
  onClose: () => void;
  onExport: (selectedKeys: string[]) => void;
}

/**
 * Modal générique permettant à l'utilisateur de choisir les colonnes à inclure
 * dans un export (xlsx/csv). Toutes les colonnes sont sélectionnées par défaut.
 */
export default function ExportModal({ title = "Exporter", fields, exporting, onClose, onExport }: ExportModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(fields.map(f => f.key)));

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => (prev.size === fields.length ? new Set() : new Set(fields.map(f => f.key))));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-tx mb-1">{title}</h2>
        <p className="text-sm text-tx-muted mb-4">Sélectionnez les informations à inclure dans l&apos;export.</p>

        <button
          onClick={toggleAll}
          className="text-xs font-semibold text-brand hover:underline mb-2"
        >
          {selected.size === fields.length ? "Tout désélectionner" : "Tout sélectionner"}
        </button>

        <div className="max-h-72 overflow-y-auto border border-border rounded-xl p-3 flex flex-col gap-2">
          {fields.map(f => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-tx cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(f.key)}
                onChange={() => toggle(f.key)}
                className="w-4 h-4 accent-brand"
              />
              {f.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-tx hover:bg-surface-alt transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onExport(Array.from(selected))}
            disabled={exporting || selected.size === 0}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand hover:bg-brand-dark text-white transition-colors disabled:opacity-60"
          >
            {exporting ? "Export…" : "Exporter"}
          </button>
        </div>
      </div>
    </div>
  );
}
