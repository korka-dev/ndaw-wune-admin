"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { sessionsApi } from "@/lib/api";
import { ActiveSessionCtx } from "@/lib/session-context";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  adminOnly?: boolean;
};

type NavSection = {
  label: string | null;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: "home", exact: true },
    ],
  },
  {
    label: "Gestion",
    items: [
      { href: "/dashboard/sessions",     label: "Gestion Sessions",     icon: "calendar"   },
      { href: "/dashboard/superviseurs", label: "Gestion Superviseurs", icon: "supervisor", adminOnly: true },
      { href: "/dashboard/ecoles",       label: "Gestion Écoles",       icon: "school",     adminOnly: true },
      { href: "/dashboard/teachers",     label: "Gestion Enseignants",  icon: "users"      },
      { href: "/dashboard/eleves",       label: "Gestion Élèves",       icon: "users-sm"   },
    ],
  },
  {
    label: "Pédagogie",
    items: [
      { href: "/dashboard/planning",           label: "Gestion Planning",      icon: "clock"      },
      { href: "/dashboard/suivi-seances",      label: "Suivi des séances",     icon: "activity"   },
      { href: "/dashboard/suivi-superviseurs",   label: "Suivi superviseurs",    icon: "eye"        },
      { href: "/dashboard/rapports-journaliers", label: "Rapports Journaliers",  icon: "file-text"  },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/comptes", label: "Comptes utilisateurs", icon: "lock", adminOnly: true },
    ],
  },
];

type IconName = "calendar"|"home"|"school"|"users"|"users-sm"|"activity"|"clock"|"book"|"check"|"shield"|"doc"|"lock"|"supervisor"|"eye"|"file-text";

function NavIcon({ name }: { name: IconName }) {
  const p = { width:17, height:17, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  switch (name) {
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "home":     return <svg {...p}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>;
    case "school":   return <svg {...p}><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 10v6c0 2 3 4 7 4s7-2 7-4v-6"/></svg>;
    case "users":    return <svg {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.8-2-4.5-5-4.5"/></svg>;
    case "users-sm": return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>;
    case "activity": return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "clock":    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "book":     return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
    case "check":    return <svg {...p}><path d="M5 12l5 5 9-11"/></svg>;
    case "shield":   return <svg {...p}><path d="M12 2l8 4v6c0 5.25-3.5 9.5-8 11-4.5-1.5-8-5.75-8-11V6l8-4z"/></svg>;
    case "doc":      return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>;
    case "lock":       return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
    case "supervisor": return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/><circle cx="20" cy="8" r="1" fill="currentColor"/><path d="M18 6l4 4-4 4"/></svg>;
    case "eye":        return <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "file-text":  return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, fetchMe, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; name: string } | null | "loading">("loading");

  useEffect(() => {
    fetchMe().then(() => {
      const state = useAuth.getState();
      if (!state.user) { router.replace("/login"); return; }
      if (state.mustChangePassword || state.user.must_change_password) {
        router.replace("/change-password");
      }
    });
    // Charger la session active
    sessionsApi.list().then(({ data }) => {
      const active = (data.items ?? []).find((s: any) => s.status === "active") ?? null;
      setActiveSession(active);
    }).catch(() => {
      setActiveSession(null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-tx-muted text-sm">Chargement…</div>
    </div>
  );

  const isAdmin  = user.role === "admin";
  const initials = user.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── Sidebar ── */}
      <aside className="w-[232px] h-full bg-surface border-r border-border flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/logo-full.png" alt="ARED" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-tx">Ndaw Wune</div>
            <div className="text-[11px] text-tx-muted mt-0.5">Administration</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {NAV_SECTIONS.map((section, si) => {
            const visible = section.items.filter(n => !n.adminOnly || isAdmin);
            if (visible.length === 0) return null;
            return (
              <div key={si}>
                {section.label && (
                  <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-tx-muted/60 select-none">
                    {section.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {visible.map(n => {
                    const active = n.exact
                      ? pathname === n.href
                      : pathname.startsWith(n.href) && n.href !== "/dashboard";
                    const isActive = n.href === "/dashboard" ? pathname === "/dashboard" : active;
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-sm font-medium transition-colors
                          ${isActive ? "bg-brand-soft text-brand" : "text-tx hover:bg-surface-alt"}`}
                      >
                        <span className={isActive ? "text-brand" : "text-tx-muted"}>
                          <NavIcon name={n.icon as IconName} />
                        </span>
                        {n.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User panel — clic ouvre le modal de déconnexion */}
        <button
          onClick={() => setShowLogout(true)}
          className="m-3 p-3 bg-surface-alt rounded-xl flex items-center gap-2.5 w-[calc(100%-1.5rem)] hover:bg-brand-soft transition-colors group text-left"
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isAdmin ? "bg-brand" : "bg-primary"}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-tx truncate group-hover:text-brand transition-colors">{user.name}</div>
            <div className="text-[11px] text-tx-muted truncate">
              {user.title ?? (isAdmin ? "Administrateur" : user.role)}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tx-muted group-hover:text-brand transition-colors flex-shrink-0">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 h-full overflow-y-auto flex flex-col">
        {/* Banner : aucune session active */}
        {activeSession !== "loading" && !activeSession && (
          <div className="mx-7 mt-5 flex items-center gap-3 bg-warn-soft border border-warn/20 rounded-xl px-4 py-3 text-sm text-warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              <strong>Aucune session active.</strong> Activez une session dans{" "}
              <a href="/dashboard/sessions" className="underline font-semibold">Gestion Sessions</a>{" "}
              pour accéder à toutes les fonctionnalités.
            </span>
          </div>
        )}
        <ActiveSessionCtx.Provider value={activeSession === "loading" ? null : activeSession}>
          {children}
        </ActiveSessionCtx.Provider>
      </main>

      {/* ── Modal déconnexion ── */}
      {showLogout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${isAdmin ? "bg-brand" : "bg-primary"}`}>
                {initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-tx">{user.name}</div>
                <div className="text-xs text-tx-muted">{user.title ?? (isAdmin ? "Administrateur" : user.role)}</div>
              </div>
            </div>
            <p className="text-sm text-tx-muted mb-6">
              Voulez-vous vous déconnecter de la plateforme ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-tx-muted font-medium hover:bg-surface-alt transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
