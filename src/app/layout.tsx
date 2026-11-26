import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NdawWune — Plateforme",
  description: "Tableau de bord administrateur NdawWune",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
