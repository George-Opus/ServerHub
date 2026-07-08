"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type Props = {
  token: string;
  datacenterId: number;
  onCreated: () => void;
};

export function CreateRackModal({ token, datacenterId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(42);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.createRack(token, datacenterId, { name, capacity_u: capacity });
      setOpen(false);
      setName("");
      setCapacity(42);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs">
        <Plus className="h-3.5 w-3.5" />
        Ajouter une baie
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
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Nouvelle baie</h2>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-2 py-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">Nom de la baie</label>
                  <input
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Baie A1"
                    required
                  />
                </div>
                <div>
                  <label className="label">Capacité (U)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    min={1}
                    max={52}
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Création..." : "Créer la baie"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
