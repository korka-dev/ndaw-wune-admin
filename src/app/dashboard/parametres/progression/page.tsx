"use client";

import { useEffect, useState, useCallback } from "react";
import { progressionConfigsApi, schoolsApi, sessionsApi } from "@/lib/api";

type ProgressionConfig = {
  id: string;
  school_id: string | null;
  session_id: string | null;
  nb_semaines: number;
  nb_jours: number;
};

type School = { id: string; name: string };
type Session = { id: string; name: string };

const EMPTY = { school_id: "", session_id: "", nb_semaines: 10, nb_jours: 3 };

export default function ProgressionConfigPage() {
  const [configs, setConfigs] = useState<ProgressionConfig[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, schoolsRes, sessionsRes] = await Promise.all([
        progressionConfigsApi.list(),
        schoolsApi.list({ limit: 10000 }),
        sessionsApi.list({ limit: 100 }),
      ]);
      setConfigs(cfgRes.data ?? []);
      setSchools(schoolsRes.data.items ?? []);
      setSessions(sessionsRes.data.items ?? []);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const schoolName = (id: string | null) => schools.find(s => s.id === id)?.name ?? (id ? "École supprimée" : "Toutes les écoles");
  const sessionName = (id: string | null) => sessions.find(s => s.id === id)?.name ?? (id ? "Session supprimée" : "Toutes les sessions");

  const save = async () => {
    setSaving(true); setError("");
    try {
      await progressionConfigsApi.create({
        school_id: form.school_id || null,
        session_id: form.session_id || null,
        nb_semaines: Number(form.nb_semaines),
        nb_jours: Number(form.nb_jours),
      });
      setForm(EMPTY);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette configuration ?")) return;
    try { await progressionConfigsApi.delete(id); await load(); }
    catch { alert("Suppression impossible."); }
  };

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-tx mb-0.5">Semaines / Jours du programme</h1>
        <p className="text-tx-muted text-sm">
          Configure le nombre de semaines et de jours affichés aux tuteurs pour choisir leur période de cours,
          par école et/ou par session. Sans configuration spécifique, la valeur par défaut (10 semaines, 3 jours) s&apos;applique.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-tx mb-4">Nouvelle configuration</h2>
        {error && (
          <div className="bg-danger-soft text-danger rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-tx-muted mb-1">École (optionnel)</label>
            <select
              value={form.school_id}
              onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Toutes les écoles</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-muted mb-1">Session (optionnel)</label>
            <select
              value={form.session_id}
              onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Toutes les sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-tx-muted mb-1">Nombre de semaines</label>
            <input
              type="number" min={1} value={form.nb_semaines}
              onChange={e => setForm(f => ({ ...f, nb_semaines: Number(e.target.value) }))}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tx-muted mb-1">Nombre de jours par semaine</label>
            <input
              type="number" min={1} value={form.nb_jours}
              onChange={e => setForm(f => ({ ...f, nb_jours: Number(e.target.value) }))}
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2.5 text-sm text-tx focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60 transition-colors"
        >
          {saving ? "Enregistrement…" : "Ajouter la configuration"}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold text-tx-muted uppercase tracking-wide">
            {configs.length} configuration{configs.length > 1 ? "s" : ""}
          </span>
        </div>
        {loading ? (
          <p className="text-tx-muted text-sm p-6 text-center">Chargement…</p>
        ) : configs.length === 0 ? (
          <p className="text-tx-muted text-sm p-6 text-center">Aucune configuration spécifique — valeur par défaut (10/3) appliquée partout.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-tx-muted uppercase tracking-wide border-b border-border">
                <th className="px-4 py-2.5">École</th>
                <th className="px-4 py-2.5">Session</th>
                <th className="px-4 py-2.5">Semaines</th>
                <th className="px-4 py-2.5">Jours</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 text-tx">{schoolName(c.school_id)}</td>
                  <td className="px-4 py-3 text-tx-muted">{sessionName(c.session_id)}</td>
                  <td className="px-4 py-3 text-tx font-medium">{c.nb_semaines}</td>
                  <td className="px-4 py-3 text-tx font-medium">{c.nb_jours}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      className="text-xs bg-danger-soft text-danger px-2.5 py-1 rounded-lg font-medium hover:bg-danger hover:text-white transition-colors"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
