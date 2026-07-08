"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, HardDrive, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const CLOUD_PROVIDERS = ["OVH", "Scaleway", "PulseHeberg", "Hetzner", "AWS", "GCP", "Azure", "Autre"];

type Props = {
  token: string;
  onCreated: () => void;
};

export function CreateDatacenterModal({ token, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "custom" as "cloud" | "custom",
    provider: CLOUD_PROVIDERS[0],
    location: "",
    description: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.createDatacenter(token, {
        name: form.name,
        type: form.type,
        provider: form.type === "cloud" ? form.provider : undefined,
        location: form.location || undefined,
        description: form.description || undefined,
      });
      setOpen(false);
      setForm({ name: "", type: "custom", provider: CLOUD_PROVIDERS[0], location: "", description: "" });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full text-xs">
        <Plus className="h-3.5 w-3.5" />
        Nouveau datacenter
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="glass w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Nouveau datacenter</h2>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-2 py-2">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="flex rounded-xl bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "custom" })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs ${
                      form.type === "custom" ? "bg-white/10 text-cyan-300" : "text-slate-400"
                    }`}
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    On-premise
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: "cloud" })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs ${
                      form.type === "cloud" ? "bg-white/10 text-cyan-300" : "text-slate-400"
                    }`}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Cloud
                  </button>
                </div>

                <div>
                  <label className="label">Nom</label>
                  <input
                    className="input-field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={form.type === "cloud" ? "OVH Production" : "Paris DC1"}
                    required
                  />
                </div>

                {form.type === "cloud" && (
                  <div>
                    <label className="label">Provider</label>
                    <select
                      className="input-field"
                      value={form.provider}
                      onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    >
                      {CLOUD_PROVIDERS.map((p) => (
                        <option key={p} value={p} className="bg-slate-900">
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Localisation (optionnel)</label>
                  <input
                    className="input-field"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Gravelines, Paris..."
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Création..." : "Créer"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
