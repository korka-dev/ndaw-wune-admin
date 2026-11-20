"use client";
/**
 * Présences (rapport V2, APP-47).
 *
 * Cette page affichait « en cours de développement ». Les présences sont déjà
 * suivies dans deux écrans complets ; plutôt qu'un parcours sans issue, elle
 * oriente vers eux.
 */
import Link from "next/link";

const LIENS = [
  {
    href:  "/dashboard/suivi-superviseurs",
    titre: "Présence des tuteurs",
    desc:  "Pointages faits par les superviseurs sur le terrain : tuteur présent ou absent, motif, par jour.",
  },
  {
    href:  "/dashboard/suivi-seances",
    titre: "Présence des élèves",
    desc:  "Élèves présents / effectif saisis par le tuteur à la fin de chaque séance.",
  },
  {
    href:  "/dashboard/rapports-journaliers",
    titre: "Absences dans les rapports journaliers",
    desc:  "Nombre et liste des élèves absents déclarés dans chaque rapport.",
  },
];

export default function PresencesPage() {
  return (
    <div className="p-7 max-w-3xl">
      <h1 className="text-xl font-bold text-tx mb-1">Présences</h1>
      <p className="text-tx-muted text-sm mb-6">
        Les présences sont suivies dans les écrans ci-dessous.
      </p>
      <div className="grid gap-3">
        {LIENS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="bg-surface border border-border rounded-2xl p-5 hover:border-brand transition-colors"
          >
            <div className="font-semibold text-tx">{l.titre}</div>
            <div className="text-sm text-tx-muted mt-1">{l.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
