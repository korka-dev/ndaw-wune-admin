"use client";
import { useEffect, useRef, useState } from "react";
import { rapportJournalierAdminApi } from "@/lib/api";

/* Une photo de rapport.

   Les images ne transitent plus dans les listes : le backend les sert une par
   une, décodées en binaire. Comme une balise <img> ne peut pas porter l'en-tête
   d'authentification, on récupère un blob via le client API puis on en fait une
   object URL — révoquée au démontage pour ne pas fuir de mémoire.

   Le chargement n'est déclenché que lorsque la vignette entre dans le champ :
   une galerie de 12 rapports ne télécharge pas 20 Mo d'un coup. */
export default function RapportPhoto({
  rapportId, index, className, alt, onClick, immediat = false,
}: {
  rapportId: string;
  index: number;
  className?: string;
  alt: string;
  onClick?: () => void;
  immediat?: boolean;   // true dans la visionneuse : pas d'attente
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [etat, setEtat] = useState<"attente" | "charge" | "erreur">("attente");
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(immediat);

  useEffect(() => {
    if (immediat || visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const obs = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [immediat, visible]);

  useEffect(() => {
    if (!visible) return;
    let annule = false;
    let url: string | null = null;
    setEtat("attente");
    rapportJournalierAdminApi.photo(rapportId, index)
      .then(({ data }) => {
        if (annule) return;
        url = URL.createObjectURL(data as Blob);
        setSrc(url);
        setEtat("charge");
      })
      .catch(() => { if (!annule) setEtat("erreur"); });
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [rapportId, index, visible]);

  return (
    <div ref={ref} className={`relative overflow-hidden bg-surface-alt ${className ?? ""}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onClick={onClick}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            onClick ? "cursor-zoom-in hover:opacity-90" : ""
          }`}
        />
      )}
      {etat === "attente" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border border-t-brand rounded-full animate-spin" />
        </div>
      )}
      {etat === "erreur" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-tx-muted">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="m3 16 5-5 4 4 3-3 6 6" />
          </svg>
          <span className="text-[10px]">Image illisible</span>
        </div>
      )}
    </div>
  );
}
