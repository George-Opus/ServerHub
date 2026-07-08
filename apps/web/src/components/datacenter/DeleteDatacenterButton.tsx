"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, ApiError, type DatacenterInventory } from "@/lib/api";
import { Modal } from "@/components/Modal";

type Props = {
  token: string;
  datacenter: DatacenterInventory;
  onDeleted: () => void;
  onError: (msg: string) => void;
};

export function DeleteDatacenterButton({ token, datacenter, onDeleted, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const serverCount =
    datacenter.servers.length +
    datacenter.racks.reduce((n, r) => n + r.servers.length, 0);

  const confirm = async () => {
    setLoading(true);
    try {
      await api.deleteDatacenter(token, datacenter.id);
      setOpen(false);
      onDeleted();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Suppression impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Supprimer
      </button>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Supprimer le datacenter">
        <p className="mb-4 text-sm text-muted-foreground">
          Supprimer <strong className="text-foreground">{datacenter.name}</strong> ?
          {serverCount > 0 && (
            <>
              {" "}
              Les {serverCount} serveur(s) associé(s) seront désassignés (non supprimés).
            </>
          )}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={loading} className="btn-ghost flex-1">
            Annuler
          </button>
          <button type="button" onClick={confirm} disabled={loading} className="btn-primary flex-1 bg-destructive hover:brightness-110">
            {loading ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </Modal>
    </>
  );
}
