"use client";

import { useMemo } from "react";

type Point3 = { x: number; y: number; z: number; id: number };

function fibonacciSphere(count: number): Point3[] {
  const phi = Math.PI * (3 - Math.sqrt(5));
  const points: Point3[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    points.push({
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      id: i,
    });
  }
  return points;
}

function buildEdges(points: Point3[], maxDist: number): [number, number][] {
  const maxSq = maxDist * maxDist;
  const edges: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      if (dx * dx + dy * dy + dz * dz <= maxSq) edges.push([i, j]);
    }
  }
  return edges;
}

const ORBIT_POINTS: Point3[] = [
  { x: 0, y: 1.28, z: 0, id: 1000 },
  { x: 1.1, y: 0.55, z: 0.4, id: 1001 },
  { x: -0.95, y: 0.35, z: 0.85, id: 1002 },
  { x: 0.45, y: -0.9, z: -1.05, id: 1003 },
  { x: -1.15, y: -0.45, z: 0.35, id: 1004 },
  { x: 0.85, y: 0.15, z: -1.15, id: 1005 },
];

type Props = {
  /** Pixel width/height of the SVG */
  size?: number;
  className?: string;
};

export function NetworkGlobeLogo({ size = 280, className = "" }: Props) {
  const globePoints = useMemo(() => fibonacciSphere(64), []);
  const globeEdges = useMemo(() => buildEdges(globePoints, 0.42), [globePoints]);

  const orbitLinks = useMemo(() => {
    const links: { from: Point3; to: Point3 }[] = [];
    for (const orbit of ORBIT_POINTS) {
      const nearest = [...globePoints]
        .map((p) => ({
          p,
          d:
            (p.x - orbit.x) ** 2 + (p.y - orbit.y) ** 2 + (p.z - orbit.z) ** 2,
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      nearest.forEach(({ p }) => links.push({ from: orbit, to: p }));
    }
    return links;
  }, [globePoints]);

  const allPoints = useMemo(() => [...globePoints, ...ORBIT_POINTS], [globePoints]);

  const cx = 200;
  const cy = 200;
  const r = 118;

  const project = (p: Point3) => ({
    sx: cx + p.x * r,
    sy: cy - p.y * r,
    depth: p.z,
  });

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={`network-globe-logo ${className}`}
      aria-hidden
    >
      <g className="network-globe-spin">
        {globeEdges.map(([a, b], i) => {
          const pa = globePoints[a];
          const pb = globePoints[b];
          if (!pa || !pb) return null;
          const A = project(pa);
          const B = project(pb);
          const avgDepth = (A.depth + B.depth) / 2;
          const opacity = 0.15 + (avgDepth + 1) * 0.22;
          return (
            <line
              key={`g-${a}-${b}`}
              x1={A.sx}
              y1={A.sy}
              x2={B.sx}
              y2={B.sy}
              stroke="currentColor"
              strokeWidth="0.9"
              opacity={opacity}
              className="network-globe-line"
              style={{ animationDelay: `${(i % 7) * 0.35}s` }}
            />
          );
        })}

        {orbitLinks.map(({ from, to }, i) => {
          const A = project(from);
          const B = project(to);
          return (
            <line
              key={`o-${from.id}-${to.id}-${i}`}
              x1={A.sx}
              y1={A.sy}
              x2={B.sx}
              y2={B.sy}
              stroke="currentColor"
              strokeWidth="0.65"
              opacity={0.35}
              strokeDasharray="3 5"
              className="network-globe-line network-globe-line-orbit"
              style={{ animationDelay: `${(i % 5) * 0.5}s` }}
            />
          );
        })}

        {allPoints.map((p) => {
          const { sx, sy, depth } = project(p);
          const isOrbit = p.id >= 1000;
          const base = isOrbit ? 2.8 : 2.2;
          const opacity = isOrbit ? 0.85 : 0.35 + (depth + 1) * 0.32;
          return (
            <circle
              key={p.id}
              cx={sx}
              cy={sy}
              r={base}
              fill="currentColor"
              opacity={opacity}
              className={isOrbit ? "network-globe-node network-globe-node-orbit" : "network-globe-node"}
              style={{ animationDelay: `${(p.id % 11) * 0.18}s` }}
            />
          );
        })}
      </g>
    </svg>
  );
}
