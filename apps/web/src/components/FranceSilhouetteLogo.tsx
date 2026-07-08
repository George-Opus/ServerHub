"use client";

import { useId, type CSSProperties } from "react";

type Pt = { x: number; y: number };
type City = { name: string; lat: number; lon: number; tier: 1 | 2 | 3 };

const FRANCE_COAST: [number, number][] = [
  [-4.8, 48.5], [-4.2, 47.9], [-3.1, 47.4], [-2.1, 47.1], [-1.6, 46.7],
  [-1.9, 46.0], [-1.4, 45.0], [-1.1, 44.0], [-1.0, 43.5],
  [2.4, 43.0], [4.2, 43.2], [5.8, 43.3], [7.2, 43.5], [8.8, 43.7], [9.1, 42.9],
  [7.8, 44.2], [7.4, 45.5], [7.1, 46.8], [7.3, 47.9],
  [8.2, 48.6], [7.8, 49.2], [6.5, 49.6],
  [3.2, 50.2], [2.0, 50.8], [1.4, 51.0],
  [-1.2, 50.4], [-2.2, 49.7], [-3.2, 49.0], [-4.8, 48.5],
];

const FRANCE_DETAILED: [number, number][] = [
  [3.59, 50.38], [4.29, 49.91], [4.80, 49.99], [5.67, 49.53], [5.90, 49.44],
  [6.19, 49.46], [6.66, 49.20], [8.10, 49.02], [7.59, 48.33], [7.47, 47.62],
  [7.19, 47.45], [6.74, 47.54], [6.77, 47.29], [6.04, 46.73], [6.02, 46.27],
  [6.50, 46.43], [6.84, 45.99], [6.80, 45.71], [7.10, 45.33], [6.75, 45.03],
  [7.01, 44.25], [7.55, 44.13], [7.44, 43.69],
  [7.52, 43.78], [7.28, 43.68], [7.05, 43.55], [6.82, 43.42], [6.58, 43.28],
  [6.35, 43.18], [6.08, 43.08], [5.78, 43.05], [5.48, 43.18], [5.18, 43.28],
  [4.88, 43.38], [4.56, 43.40],
  [4.15, 43.28], [3.72, 43.12], [3.10, 43.08], [2.99, 42.47], [2.45, 42.58],
  [1.83, 42.34], [1.35, 42.52], [0.70, 42.80], [0.34, 42.58],
  [-0.75, 42.68], [-1.35, 43.05], [-1.78, 43.38], [-1.50, 43.03],
  [-1.52, 43.52], [-1.42, 43.88], [-1.38, 44.02], [-1.22, 44.38], [-1.15, 44.62],
  [-1.10, 44.88], [-1.06, 45.12],
  [-0.62, 45.58], [-0.38, 45.50], [-0.10, 45.38], [-0.42, 45.22], [-0.78, 45.10],
  [-1.05, 45.02], [-1.15, 46.01], [-1.48, 46.18], [-1.82, 46.48],
  [-2.23, 47.06], [-2.52, 47.28], [-2.82, 47.42], [-3.02, 47.52],
  [-3.18, 47.58], [-3.38, 47.65], [-3.58, 47.78], [-3.82, 47.88],
  [-4.15, 47.94], [-4.49, 47.95], [-4.72, 48.08], [-4.85, 48.22],
  [-4.78, 48.38], [-4.62, 48.52], [-4.42, 48.62], [-4.18, 48.70], [-3.98, 48.73],
  [-3.72, 48.78], [-3.45, 48.82], [-3.15, 48.85], [-2.85, 48.80], [-2.55, 48.72],
  [-2.28, 48.66], [-1.97, 48.63], [-1.72, 48.68], [-1.62, 48.64],
  [-1.78, 48.88], [-1.88, 49.08], [-1.93, 49.35], [-1.93, 49.78],
  [-1.55, 49.72], [-1.18, 49.55], [-0.82, 49.45], [-0.45, 49.38],
  [-0.08, 49.42], [0.28, 49.48], [0.62, 49.55], [0.95, 49.62],
  [0.72, 49.78], [1.05, 50.02], [1.34, 50.13], [1.52, 50.38], [1.64, 50.62],
  [1.64, 50.85], [1.64, 50.95], [2.05, 51.08], [2.51, 51.15],
  [2.66, 50.80], [3.12, 50.78], [3.59, 50.38],
];

const CITIES: City[] = [
  { name: "Paris", lat: 48.86, lon: 2.35, tier: 3 },
  { name: "Lyon", lat: 45.76, lon: 4.84, tier: 2 },
  { name: "Marseille", lat: 43.3, lon: 5.37, tier: 2 },
  { name: "Bordeaux", lat: 44.84, lon: -0.58, tier: 2 },
  { name: "Lille", lat: 50.63, lon: 3.06, tier: 1 },
  { name: "Strasbourg", lat: 48.58, lon: 7.75, tier: 1 },
  { name: "Nantes", lat: 47.22, lon: -1.55, tier: 1 },
  { name: "Toulouse", lat: 43.6, lon: 1.44, tier: 1 },
  { name: "Rennes", lat: 48.11, lon: -1.68, tier: 1 },
];

const MAP_BBOX = { lonMin: -5, lonMax: 9, latMin: 42, latMax: 51, latMid: 46.5 };
const MAP_PAD = { x: 15, y: 15, w: 170, h: 210 };
const MAP_COS_LAT = Math.cos((MAP_BBOX.latMid * Math.PI) / 180);
const MAP_GEO_W = (MAP_BBOX.lonMax - MAP_BBOX.lonMin) * MAP_COS_LAT;
const MAP_GEO_H = MAP_BBOX.latMax - MAP_BBOX.latMin;
const MAP_SCALE = Math.min(MAP_PAD.w / MAP_GEO_W, MAP_PAD.h / MAP_GEO_H);
const MAP_Y_INSET = (MAP_PAD.h - MAP_GEO_H * MAP_SCALE) / 2;
const EXTRUSION_LAYERS = 8;

function mapFr(lat: number, lon: number): Pt {
  return {
    x: MAP_PAD.x + (lon - MAP_BBOX.lonMin) * MAP_COS_LAT * MAP_SCALE,
    y: MAP_PAD.y + MAP_Y_INSET + (MAP_BBOX.latMax - lat) * MAP_SCALE,
  };
}

function coordsToPath(coords: [number, number][]): string {
  return (
    coords
      .map(([lon, lat], i) => {
        const { x, y } = mapFr(lat, lon);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

function coordsToSmoothPath(coords: [number, number][]): string {
  const pts = coords.map(([lon, lat]) => mapFr(lat, lon));
  if (pts.length < 3) return coordsToPath(coords);
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[(i + 2) % pts.length];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

function pointInPoly(x: number, y: number, coords: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [lonI, latI] = coords[i];
    const [lonJ, latJ] = coords[j];
    const pi = mapFr(latI, lonI);
    const pj = mapFr(latJ, lonJ);
    if (pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x) inside = !inside;
  }
  return inside;
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateNodesInPoly(count: number, inside: (x: number, y: number) => boolean, seeds: Pt[]): Pt[] {
  const nodes: Pt[] = [...seeds];
  let seed = 0;
  while (nodes.length < count && seed < count * 50) {
    const x = 15 + seeded(seed) * 170;
    const y = 15 + seeded(seed + 1) * 210;
    seed += 2;
    if (inside(x, y)) nodes.push({ x, y });
  }
  return nodes;
}

function hubArcPath(a: Pt, b: Pt, lift: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - lift;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function buildEdges(nodes: Pt[], maxDist: number, maxPer: number): [number, number][] {
  const maxSq = maxDist * maxDist;
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const nbrs: { j: number; d: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = dx * dx + dy * dy;
      if (d <= maxSq) nbrs.push({ j, d });
    }
    nbrs.sort((a, b) => a.d - b.d);
    for (const { j } of nbrs.slice(0, maxPer)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

const FR_PATH = coordsToPath(FRANCE_COAST);
const FR_DETAILED_PATH = coordsToPath(FRANCE_DETAILED);
const FR_DETAILED_FILL = coordsToSmoothPath(FRANCE_DETAILED);
const PARIS = mapFr(48.86, 2.35);
const CITY_PTS = CITIES.map((c) => mapFr(c.lat, c.lon));
const NODES_E = generateNodesInPoly(55, (x, y) => pointInPoly(x, y, FRANCE_DETAILED), CITY_PTS);
const EDGES_E = buildEdges(NODES_E, 22, 2);

type Props = {
  size?: number;
  hero?: boolean;
  className?: string;
};

function LogoFilters({ id, clipPath }: { id: string; clipPath: string }) {
  return (
    <defs>
      <filter id={`${id}-bloom`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${id}-bloom-strong`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id={`${id}-fr-detailed-clip`}>
        <path d={clipPath} />
      </clipPath>
    </defs>
  );
}

export function FranceSilhouetteLogo({ size = 280, hero = false, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const hubs = CITIES.filter((c) => c.tier >= 2);
  const remoteHubs = hubs.filter((c) => c.name !== "Paris");

  const cssVars = {
    "--fr-logo-cyan": "hsl(var(--primary))",
    "--fr-logo-blue": "hsl(var(--primary) / 0.55)",
    "--fr-logo-orange": "hsl(25 95% 53%)",
    "--fr-logo-white": "hsl(var(--foreground))",
    "--fr-logo-stroke": "hsl(var(--border))",
  } as CSSProperties;

  return (
    <div
      className={`france-3d-logo text-primary ${hero ? "france-3d-logo-hero" : ""} ${className}`}
      style={{ ...cssVars, width: size, height: size * 1.2 }}
      aria-hidden
    >
      <div className="france-3d-logo-stage">
        <div className="france-3d-logo-float">
          <div className="france-3d-logo-tilt">
            <svg viewBox="0 0 200 240" width={size} height={size * 1.2}>
            <LogoFilters id={uid} clipPath={FR_DETAILED_FILL} />

            <g opacity={0.1} transform="translate(8 28) skewX(-18) scale(1 0.42)">
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={`gh-${i}`}
                  x1={20 + i * 18}
                  y1={10}
                  x2={20 + i * 18}
                  y2={200}
                  stroke="var(--fr-logo-cyan)"
                  strokeWidth={0.4}
                />
              ))}
              {Array.from({ length: 11 }, (_, i) => (
                <line
                  key={`gv-${i}`}
                  x1={10}
                  y1={20 + i * 16}
                  x2={190}
                  y2={20 + i * 16}
                  stroke="var(--fr-logo-cyan)"
                  strokeWidth={0.4}
                />
              ))}
            </g>

            <ellipse cx={100} cy={218} rx={58} ry={10} fill="var(--fr-logo-blue)" opacity={0.14}>
              <animate attributeName="rx" values="52;62;52" dur="7s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.1;0.18;0.1" dur="7s" repeatCount="indefinite" />
            </ellipse>

            {Array.from({ length: EXTRUSION_LAYERS }, (_, i) => {
              const depth = EXTRUSION_LAYERS - i;
              const dx = depth * 0.65;
              const dy = depth * 1.05;
              return (
                <path
                  key={`ext-${i}`}
                  d={FR_DETAILED_FILL}
                  fill="var(--fr-logo-blue)"
                  fillOpacity={0.03 + i * 0.018}
                  transform={`translate(${dx.toFixed(1)} ${dy.toFixed(1)})`}
                />
              );
            })}

            <path
              d={FR_DETAILED_PATH}
              fill="none"
              stroke="var(--fr-logo-blue)"
              strokeWidth={2.2}
              opacity={0.35}
              transform="translate(5.2 8.4)"
            />

            <g clipPath={`url(#${uid}-fr-detailed-clip)`}>
              {EDGES_E.map(([a, b], i) => (
                <line
                  key={`ee-${a}-${b}`}
                  x1={NODES_E[a].x}
                  y1={NODES_E[a].y}
                  x2={NODES_E[b].x}
                  y2={NODES_E[b].y}
                  stroke="var(--fr-logo-cyan)"
                  strokeWidth={0.45}
                  opacity={0.28}
                >
                  <animate
                    attributeName="opacity"
                    values="0.12;0.5;0.12"
                    dur={`${2.2 + (i % 5) * 0.4}s`}
                    begin={`${(i % 7) * 0.15}s`}
                    repeatCount="indefinite"
                  />
                </line>
              ))}
              {NODES_E.map((n, i) => (
                <circle
                  key={`en-${i}`}
                  cx={n.x}
                  cy={n.y}
                  r={i < CITIES.length ? 1.6 : 0.7}
                  fill={i < CITIES.length ? "var(--fr-logo-white)" : "var(--fr-logo-cyan)"}
                  opacity={i < CITIES.length ? 0.9 : 0.45}
                >
                  {i < CITIES.length ? (
                    <animate
                      attributeName="opacity"
                      values="0.55;1;0.55"
                      dur={`${2.5 + i * 0.2}s`}
                      repeatCount="indefinite"
                    />
                  ) : null}
                </circle>
              ))}
            </g>

            <path d={FR_DETAILED_FILL} fill="var(--fr-logo-blue)" fillOpacity={0.2} />
            <path d={FR_DETAILED_FILL} fill="var(--fr-logo-cyan)" fillOpacity={0.04} />

            <path
              d={FR_PATH}
              fill="none"
              stroke="var(--fr-logo-stroke)"
              strokeWidth={0.6}
              opacity={0.22}
              strokeDasharray="2 3"
              strokeLinejoin="round"
            />

            <path
              d={FR_DETAILED_PATH}
              fill="none"
              stroke="var(--fr-logo-cyan)"
              strokeWidth={hero ? 2 : 1.6}
              strokeLinejoin="miter"
              strokeLinecap="butt"
              filter={`url(#${uid}-bloom)`}
            />
            <path
              d={FR_DETAILED_PATH}
              fill="none"
              stroke="var(--fr-logo-cyan)"
              strokeWidth={0.4}
              opacity={0.5}
              strokeLinejoin="miter"
            />

            <path
              d={FR_DETAILED_PATH}
              fill="none"
              stroke="var(--fr-logo-white)"
              strokeWidth={hero ? 1.4 : 1.1}
              strokeLinecap="round"
              strokeDasharray="6 420"
              opacity={0.75}
              filter={`url(#${uid}-bloom-strong)`}
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-426" dur="5.5s" repeatCount="indefinite" />
            </path>
            <path
              d={FR_DETAILED_PATH}
              fill="none"
              stroke="var(--fr-logo-orange)"
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeDasharray="3 430"
              opacity={0.55}
            >
              <animate attributeName="stroke-dashoffset" from="-80" to="-510" dur="8s" repeatCount="indefinite" />
            </path>

            {remoteHubs.map((c, i) => {
              const pt = mapFr(c.lat, c.lon);
              const arc = hubArcPath(pt, PARIS, 10 + (i % 3) * 4);
              return (
                <g key={`link-${c.name}`}>
                  <path d={arc} fill="none" stroke="var(--fr-logo-cyan)" strokeWidth={0.7} opacity={0.2} />
                  <path
                    d={arc}
                    fill="none"
                    stroke="var(--fr-logo-cyan)"
                    strokeWidth={0.9}
                    strokeDasharray="5 16"
                    opacity={0.65}
                    filter={`url(#${uid}-bloom)`}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-42"
                      dur={`${1.6 + i * 0.25}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              );
            })}

            {hubs.map((c, i) => {
              const pt = mapFr(c.lat, c.lon);
              const isParis = c.name === "Paris";
              const r = c.tier === 3 ? 3.2 : 2.2;
              return (
                <g key={c.name}>
                  <ellipse
                    cx={pt.x + 0.8}
                    cy={pt.y + 2.2}
                    rx={r * 0.9}
                    ry={r * 0.35}
                    fill="var(--fr-logo-blue)"
                    opacity={0.35}
                  />
                  {isParis ? (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={9}
                      fill="var(--fr-logo-orange)"
                      opacity={0.18}
                      filter={`url(#${uid}-bloom-strong)`}
                    >
                      <animate attributeName="r" values="6;11;6" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.12;0.28;0.12" dur="3s" repeatCount="indefinite" />
                    </circle>
                  ) : (
                    <circle cx={pt.x} cy={pt.y} r={5} fill="var(--fr-logo-cyan)" opacity={0.12}>
                      <animate
                        attributeName="r"
                        values="3;6;3"
                        dur={`${3.5 + i * 0.3}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={r}
                    fill={isParis ? "var(--fr-logo-orange)" : "var(--fr-logo-white)"}
                    filter={isParis || c.tier >= 2 ? `url(#${uid}-bloom)` : undefined}
                  >
                    {!isParis ? (
                      <animate
                        attributeName="opacity"
                        values="0.5;1;0.5"
                        dur={`${2.8 + i * 0.2}s`}
                        repeatCount="indefinite"
                      />
                    ) : null}
                  </circle>
                  {isParis ? <circle cx={pt.x} cy={pt.y} r={1.4} fill="var(--fr-logo-white)" /> : null}
                </g>
              );
            })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
