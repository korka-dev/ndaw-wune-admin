"use client";
import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

interface Compte { id: string; name: string; email?: string; phone?: string; title?: string; role: string; status: string; }
const EMPTY = { name: "", email: "", phone: "", password: "", title: "", role: "coordonnateur" };

export default function ComptesPage() {
  const { user: me } = useAuth();
  const [items,   setItems]   = useState<Compte[]>([]);
  const [modal,   setModal]   = useState<null | "create" | Compte>(null);
  const [form,    setForm]    = useState<typeof EMPTY>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);

  const load = () => usersApi.list().then(r => setItems(r.data.items ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      if (modal === "create") await usersApi.create(form);
      else await usersApi.update((modal as Compte).id, form);
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce compte ?")) return;
    await usersApi.delete(id); load();
  };

  const isAdmin = me?.role === "admin";
  const initials = (n: string) => n.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-7 pb-7">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between pt-7 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-tx">Comptes utilisateurs</h1>
          <p className="text-tx-muted text-sm mt-0.5">Administrateurs & coordonnateurs</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setForm(EMPTY); setModal("create"); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nouveau compte
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              {["Utilisateur", "Contact", "Rôle", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-tx-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-surface-alt transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${u.role === "admin" ? "bg-brand" : "bg-primary"}`}>
                      {initials(u.name)}
                    </div>
                    <div>
                      <div className="font-medium text-tx flex items-center gap-1.5">
                        {u.name}
                        {u.id === me?.id && <span className="text-[10px] bg-brand-soft text-brand px-1.5 py-0.5 rounded font-semibold">Vous</span>}
                      </div>
                      {u.title && <div className="text-xs text-tx-muted">{u.title}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-tx-muted">{u.email ?? u.phone ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-brand-soft text-brand" : "bg-primary-soft text-primary"}`}>
                    {u.role === "admin" ? "Administrateur" : "Coordonnateur"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setForm({ ...EMPTY, ...u, password: "" }); setModal(u); }}
                        className="text-xs bg-primary-soft text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
                      >Modifier</button>
                      {u.id !== me?.id && (
                        <button
                          onClick={() => del(u.id)}
                          className="text-xs bg-danger-soft text-danger px-2.5 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors"
                        >Supprimer</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-tx-muted text-sm">Aucun compte pour l'instant</td></tr>
            )}
          </tbody>
        </table>
        <div className="px-5 pb-4">
          <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-bold text-tx mb-5">
              {modal === "create" ? "Nouveau compte" : "Modifier le compte"}
            </h2>
            <div className="space-y-3">
              {([
                ["Nom complet", "name"],
                ["Titre (optionnel)", "title"],
                ["E-mail", "email"],
                ["Téléphone", "phone"],
                ...(modal === "create" ? [["Mot de passe", "password"]] : []),
              ] as [string, string][]).map(([l, k]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-tx mb-1">{l}</label>
                  <input
                    type={k === "password" ? "password" : "text"}
                    value={(form as any)[k] ?? ""}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-tx mb-1">Rôle</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30 transition">
                  <option value="coordonnateur">Coordonnateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-tx-muted hover:bg-surface-alt transition-colors">Annuler</button>
              <button onClick={save} disabled={loading} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
