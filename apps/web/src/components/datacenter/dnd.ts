export const DND_SERVER_MIME = "application/x-serverhub-server";

export type ServerDragPayload = {
  serverId: number;
  datacenterId: number | null;
  rackId: number | null;
  rackU: number | null;
  rackUnits?: number;
};

let activeDrag: ServerDragPayload | null = null;

export function getActiveDrag(): ServerDragPayload | null {
  return activeDrag;
}

export function setServerDragData(e: React.DragEvent, payload: ServerDragPayload) {
  activeDrag = payload;
  e.dataTransfer.setData(DND_SERVER_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

export function clearServerDrag() {
  activeDrag = null;
}

export function getServerDragData(e: React.DragEvent): ServerDragPayload | null {
  const raw = e.dataTransfer.getData(DND_SERVER_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServerDragPayload;
  } catch {
    return null;
  }
}
