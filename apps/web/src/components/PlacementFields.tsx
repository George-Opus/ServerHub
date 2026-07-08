"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Inventory, type RackWithServers } from "@/lib/api";
import { canPlaceAt } from "@/components/datacenter/rackPlacement";

type Props = {
  token: string;
  active?: boolean;
  datacenterId: number | null;
  rackId: number | null;
  rackU: number | null;
  rackUnits: number;
  serverId?: number;
  onDatacenterChange: (id: number | null) => void;
  onRackChange: (id: number | null) => void;
  onRackUChange: (u: number | null) => void;
  onRackUnitsChange: (units: number) => void;
};

export function PlacementFields({
  token,
  active = true,
  datacenterId,
  rackId,
  rackU,
  rackUnits,
  serverId,
  onDatacenterChange,
  onRackChange,
  onRackUChange,
  onRackUnitsChange,
}: Props) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInventory = useCallback(() => {
    setLoading(true);
    api.getInventory(token).then(setInventory).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (active) loadInventory();
  }, [active, loadInventory]);

  const datacenters = inventory?.datacenters ?? [];
  const selectedDc = datacenters.find((d) => d.id === datacenterId);
  const racks: RackWithServers[] = selectedDc?.type === "custom" ? selectedDc.racks : [];
  const selectedRack = racks.find((r) => r.id === rackId);

  const isSlotFree = (u: number) =>
    selectedRack
      ? canPlaceAt(selectedRack.servers, u, rackUnits, selectedRack.capacity_u, serverId)
      : false;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between">
        <p className="label mb-0">Emplacement</p>
        {loading && <span className="text-[10px] text-muted-foreground">Chargement…</span>}
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Datacenter</label>
        <select
          className="input-field mt-1"
          value={datacenterId ?? ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            onDatacenterChange(v);
          }}
        >
          <option value="">— Non assigné —</option>
          {datacenters.map((dc) => (
            <option key={dc.id} value={dc.id}>
              {dc.name} ({dc.type === "cloud" ? "cloud" : "on-premise"})
            </option>
          ))}
        </select>
      </div>

      {selectedDc?.type === "custom" && (
        <>
          {racks.length === 0 ? (
            <p className="text-xs text-amber-400/90">
              Aucune baie dans ce datacenter — créez-en une depuis la vue Datacenters.
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Baie</label>
                <select
                  className="input-field mt-1"
                  value={rackId ?? ""}
                  onChange={(e) => {
                    onRackChange(e.target.value ? Number(e.target.value) : null);
                  }}
                >
                  <option value="">— Hors baie (datacenter) —</option>
                  {racks.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name} ({rack.capacity_u}U)
                    </option>
                  ))}
                </select>
              </div>

              {rackId && selectedRack && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Taille en baie</label>
                    <select
                      className="input-field mt-1"
                      value={rackUnits}
                      onChange={(e) => {
                        const units = Number(e.target.value);
                        onRackUnitsChange(units);
                        if (rackU && !canPlaceAt(selectedRack.servers, rackU, units, selectedRack.capacity_u, serverId)) {
                          onRackUChange(null);
                        }
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 42].filter(
                        (n) => n <= selectedRack.capacity_u,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n}U
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Position (U bas){rackU ? ` · U${rackU}–U${rackU + rackUnits - 1}` : ""}
                    </label>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-card/50 p-2">
                      <div className="mb-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => onRackUChange(null)}
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            rackU === null ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Sans position U
                        </button>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {Array.from({ length: selectedRack.capacity_u }, (_, i) => selectedRack.capacity_u - i).map(
                          (u) => {
                            const free = isSlotFree(u);
                            const isSelected = rackU === u;
                            const isInRange =
                              rackU !== null && u >= rackU && u < rackU + rackUnits;
                            return (
                              <button
                                key={u}
                                type="button"
                                disabled={!free && !isInRange}
                                onClick={() => onRackUChange(u)}
                                title={
                                  free
                                    ? `Placer ${rackUnits}U à partir de U${u}`
                                    : `U${u} indisponible`
                                }
                                className={`rounded py-1 text-[10px] font-mono transition-all ${
                                  isSelected
                                    ? "bg-primary/30 text-primary ring-1 ring-primary/50"
                                    : isInRange
                                      ? "bg-primary/15 text-primary"
                                      : free
                                        ? "bg-muted text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
                                        : "cursor-not-allowed bg-destructive/10 text-destructive/50"
                                }`}
                              >
                                {u}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {selectedDc?.type === "cloud" && (
        <p className="text-xs text-muted-foreground">Les datacenters cloud n&apos;utilisent pas de baies.</p>
      )}
    </div>
  );
}
