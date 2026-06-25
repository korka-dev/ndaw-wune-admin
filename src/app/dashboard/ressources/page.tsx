"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ressourcesApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type ResourceType = "document" | "video" | "autre";

type Document = {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  description: string | null;
  resource_type: ResourceType;
  uploaded_by: string | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

type FileCategory = "pdf" | "image" | "video" | "audio" | "word" | "excel" | "pptx" | "archive" | "text" | "other";

function getCategory(mime: string): FileCategory {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("word") || mime.includes("opendocument.text")) return "word";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("opendocument.spreadsheet")) return "excel";
  if (mime.includes("presentation") || mime.includes("powerpoint") || mime.includes("opendocument.presentation")) return "pptx";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar") || mime.includes("7z") || mime.includes("gzip")) return "archive";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

const CATEGORY_COLORS: Record<FileCategory, string> = {
  pdf:     "bg-red-50    text-red-500    border-red-100",
  image:   "bg-purple-50 text-purple-500 border-purple-100",
  video:   "bg-blue-50   text-blue-500   border-blue-100",
  audio:   "bg-pink-50   text-pink-500   border-pink-100",
  word:    "bg-blue-50   text-blue-600   border-blue-100",
  excel:   "bg-green-50  text-green-600  border-green-100",
  pptx:    "bg-orange-50 text-orange-500 border-orange-100",
  archive: "bg-yellow-50 text-yellow-600 border-yellow-100",
  text:    "bg-gray-50   text-gray-500   border-gray-100",
  other:   "bg-gray-50   text-gray-400   border-gray-100",
};

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  document: "Document",
  video:    "Vidéo",
  autre:    "Autre",
};

const RESOURCE_TYPE_COLORS: Record<ResourceType, string> = {
  document: "bg-blue-50 text-blue-600 border border-blue-200",
  video:    "bg-purple-50 text-purple-600 border border-purple-200",
  autre:    "bg-gray-50 text-gray-500 border border-gray-200",
};

function FileIcon({ category, size = 20 }: { category: FileCategory; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (category) {
    case "pdf":
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><path d="M9 13h1.5a1.5 1.5 0 010 3H9v-3z"/><path d="M14 13v3"/><path d="M17 13v3"/><path d="M16 13h1"/></svg>;
    case "image":
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case "video":
      return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>;
    case "audio":
      return <svg {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case "word":
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><path d="M8 13l2 6 2-4 2 4 2-6"/></svg>;
    case "excel":
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><path d="M8 13l8 6M16 13l-8 6"/></svg>;
    case "pptx":
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><rect x="8" y="13" width="4" height="4" rx="1"/><path d="M12 15h3"/><path d="M12 13h3"/></svg>;
    case "archive":
      return <svg {...p}><path d="M21 10V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16v-2"/><path d="M12 22V12"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 2.12v9.88"/></svg>;
    case "text":
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>;
    default:
      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/></svg>;
  }
}

// ── Composant principal ────────────────────────────────────────────────────────

const TAB_TYPES: { key: "all" | ResourceType; label: string }[] = [
  { key: "all",      label: "Tous" },
  { key: "document", label: "Documents" },
  { key: "video",    label: "Vidéos" },
  { key: "autre",    label: "Autres" },
];

export default function RessourcesPage() {
  const [docs, setDocs]               = useState<Document[]>([]);
  const [loading, setLoading]         = useState(true);
  const [dragOver, setDragOver]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setProgress] = useState<{ name: string; done: boolean; error?: string }[]>([]);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [search, setSearch]           = useState("");
  const [activeTab, setActiveTab]     = useState<"all" | ResourceType>("all");
  const [uploadType, setUploadType]   = useState<ResourceType>("document");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await ressourcesApi.list();
      setDocs(data);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    setProgress(arr.map(f => ({ name: f.name, done: false })));

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      // Auto-détecter vidéo si le MIME le dit
      const effectiveType: ResourceType = f.type.startsWith("video/") ? "video" : uploadType;
      try {
        await ressourcesApi.upload(f, undefined, undefined, effectiveType);
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p));
      } catch {
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true, error: "Échec" } : p));
      }
    }

    await fetchDocs();
    setTimeout(() => {
      setUploading(false);
      setProgress([]);
    }, 1200);
  }, [fetchDocs, uploadType]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  // ── Téléchargement ──────────────────────────────────────────────────────────
  const handleDownload = async (doc: Document) => {
    try {
      const { data } = await ressourcesApi.download(doc.id);
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors du téléchargement.");
    }
  };

  // ── Suppression ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await ressourcesApi.delete(deleteId);
      setDocs(prev => prev.filter(d => d.id !== deleteId));
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // ── Filtrage ────────────────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    if (activeTab !== "all" && d.resource_type !== activeTab) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.original_filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<string, number> = {
    all:      docs.length,
    document: docs.filter(d => d.resource_type === "document").length,
    video:    docs.filter(d => d.resource_type === "video").length,
    autre:    docs.filter(d => d.resource_type === "autre").length,
  };

  const docToDelete = docs.find(d => d.id === deleteId);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-7">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx mb-0.5">Ressources FLN</h1>
          <p className="text-tx-muted text-sm">Bibliothèque de ressources pédagogiques</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Ajouter une ressource
        </button>
      </div>

      {/* Input fichier caché */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {/* Sélecteur de type d'upload */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">Type à uploader :</span>
        <div className="flex gap-2">
          {(["document", "video", "autre"] as ResourceType[]).map(t => (
            <button
              key={t}
              onClick={() => setUploadType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                uploadType === t
                  ? "bg-brand text-white border-brand"
                  : "bg-surface text-tx-muted border-border hover:border-brand/40"
              }`}
            >
              {RESOURCE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Zone drag & drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mb-5 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors
          ${dragOver
            ? "border-brand bg-brand-soft"
            : "border-border bg-surface hover:border-brand/40 hover:bg-surface-alt"
          }`}
      >
        <div className="flex flex-col items-center gap-2 pointer-events-none select-none">
          {uploadType === "video" ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={dragOver ? "text-brand" : "text-tx-muted"}>
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={dragOver ? "text-brand" : "text-tx-muted"}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
          <p className="text-sm font-medium text-tx">
            {dragOver ? "Relâchez pour uploader" : `Glissez-déposez vos ${RESOURCE_TYPE_LABELS[uploadType].toLowerCase()}s ici`}
          </p>
          <p className="text-xs text-tx-muted">
            {uploadType === "video"
              ? "MP4, MOV, AVI, MKV…"
              : uploadType === "document"
                ? "PDF, Word, Excel, images…"
                : "Tous types acceptés"}
          </p>
        </div>
      </div>

      {/* Barre de progression */}
      {uploading && uploadProgress.length > 0 && (
        <div className="mb-5 bg-surface border border-border rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-tx-muted uppercase tracking-wide mb-2">Upload en cours…</p>
          {uploadProgress.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${f.error ? "bg-danger" : f.done ? "bg-success" : "bg-brand animate-pulse"}`} />
              <span className="text-sm text-tx flex-1 truncate">{f.name}</span>
              <span className="text-xs text-tx-muted">
                {f.error ? "Échec" : f.done ? "✓" : "…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Onglets de type */}
      <div className="flex gap-1 mb-4">
        {TAB_TYPES.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-brand text-white"
                : "bg-surface text-tx-muted hover:bg-surface-alt border border-border"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === tab.key ? "bg-white/20 text-white" : "bg-surface-alt text-tx-muted"
            }`}>
              {counts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      {docs.length > 0 && (
        <div className="mb-4 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Rechercher une ressource…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-border rounded-xl text-tx placeholder:text-tx-muted focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
      )}

      {/* Liste des ressources */}
      {loading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-tx-muted text-sm">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          {docs.length === 0 ? (
            <>
              <svg className="mx-auto mb-3 text-tx-muted/40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/>
                <path d="M14 3v6h6"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
              </svg>
              <p className="text-tx-muted text-sm font-medium">Aucune ressource pour l'instant</p>
              <p className="text-tx-muted/60 text-xs mt-1">Utilisez le bouton ci-dessus ou glissez des fichiers pour commencer.</p>
            </>
          ) : (
            <p className="text-tx-muted text-sm">Aucune ressource ne correspond à votre recherche.</p>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
              {filtered.length} ressource{filtered.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(doc => {
              const cat = getCategory(doc.mime_type);
              const colors = CATEGORY_COLORS[cat];
              const rType = doc.resource_type as ResourceType ?? "document";
              return (
                <div key={doc.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-alt transition-colors group">
                  {/* Icône fichier */}
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colors}`}>
                    <FileIcon category={cat} size={18} />
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-tx truncate">{doc.title}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${RESOURCE_TYPE_COLORS[rType]}`}>
                        {RESOURCE_TYPE_LABELS[rType]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-tx-muted truncate">{doc.original_filename}</span>
                      <span className="text-tx-muted/40 text-xs">·</span>
                      <span className="text-xs text-tx-muted flex-shrink-0">{formatSize(doc.file_size)}</span>
                      <span className="text-tx-muted/40 text-xs">·</span>
                      <span className="text-xs text-tx-muted flex-shrink-0">{formatDate(doc.created_at)}</span>
                    </div>
                    {doc.description && (
                      <p className="text-xs text-tx-muted/70 mt-0.5 truncate">{doc.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(doc)}
                      title="Télécharger"
                      className="p-2 rounded-lg text-tx-muted hover:text-brand hover:bg-brand-soft transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteId(doc.id)}
                      title="Supprimer"
                      className="p-2 rounded-lg text-tx-muted hover:text-danger hover:bg-red-50 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-tx">Supprimer cette ressource ?</p>
                <p className="text-xs text-tx-muted mt-0.5 truncate max-w-[200px]">{docToDelete?.title}</p>
              </div>
            </div>
            <p className="text-sm text-tx-muted mb-5">
              Le fichier sera définitivement supprimé du serveur. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
