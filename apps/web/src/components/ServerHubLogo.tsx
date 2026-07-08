"use client";

import { useId } from "react";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 20, md: 28, lg: 40 };
const FRAME_PX: Record<Size, number> = { sm: 32, md: 44, lg: 56 };

type Props = {
  size?: Size;
  framed?: boolean;
  className?: string;
  "aria-hidden"?: boolean;
};

export function ServerHubLogo({ size = "md", framed = false, className = "", ...rest }: Props) {
  const clipId = useId();
  const px = SIZE_PX[size];
  const frame = FRAME_PX[size];

  const svg = (
    <svg
      viewBox="0 0 48 48"
      width={px}
      height={px}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="serverhub-logo"
      aria-hidden={rest["aria-hidden"] ?? true}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="13.5" />
        </clipPath>
      </defs>

      {/* Orbite réseau */}
      <ellipse
        cx="24"
        cy="24"
        rx="19"
        ry="8"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.2"
        className="serverhub-logo-orbit"
      />

      {/* Globe — grille qui tourne */}
      <g clipPath={`url(#${clipId})`}>
        <circle cx="24" cy="24" r="13.5" fill="currentColor" fillOpacity="0.08" />
        <g className="serverhub-logo-spin">
          <ellipse cx="24" cy="24" rx="13.5" ry="4.5" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
          <ellipse cx="24" cy="24" rx="13.5" ry="8.5" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <ellipse cx="24" cy="15.5" rx="10" ry="2" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <ellipse cx="24" cy="32.5" rx="10" ry="2" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path
            d="M24 10.5 C34 24 34 24 24 37.5 C14 24 14 24 24 10.5"
            stroke="currentColor"
            strokeWidth="0.65"
            opacity="0.45"
          />
          <path
            d="M24 10.5 C14 24 14 24 24 37.5 C34 24 34 24 24 10.5"
            stroke="currentColor"
            strokeWidth="0.65"
            opacity="0.45"
          />
          <line x1="10.5" y1="24" x2="37.5" y2="24" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        </g>
      </g>

      <circle cx="24" cy="24" r="13.5" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />

      {/* Liens réseau autour du globe */}
      <g className="serverhub-logo-network">
        <path
          d="M32 14 Q24 20 16 22"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.5"
          strokeLinecap="round"
          className="serverhub-logo-link"
        />
        <path
          d="M34 28 Q28 24 20 34"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.4"
          strokeLinecap="round"
          className="serverhub-logo-link serverhub-logo-link-delay"
        />
        <path
          d="M14 18 Q20 24 18 32"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.45"
          strokeLinecap="round"
          className="serverhub-logo-link serverhub-logo-link-delay-2"
        />
        <circle cx="32" cy="14" r="1.6" fill="currentColor" className="serverhub-logo-node" />
        <circle cx="16" cy="22" r="1.4" fill="currentColor" className="serverhub-logo-node serverhub-logo-node-delay" />
        <circle cx="34" cy="28" r="1.3" fill="currentColor" className="serverhub-logo-node serverhub-logo-node-delay-2" />
        <circle cx="14" cy="18" r="1.2" fill="currentColor" className="serverhub-logo-node serverhub-logo-node-delay-3" />
        <circle cx="20" cy="34" r="1.3" fill="currentColor" className="serverhub-logo-node serverhub-logo-node-delay" />
      </g>
    </svg>
  );

  if (!framed) {
    return <span className={`inline-flex shrink-0 ${className}`}>{svg}</span>;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground ${className}`}
      style={{ width: frame, height: frame }}
    >
      {svg}
    </span>
  );
}

export function ServerHubBrand({
  size = "md",
  showText = true,
  className = "",
}: {
  size?: Size;
  showText?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ServerHubLogo size={size} framed />
      {showText && <span className="text-sm font-semibold tracking-tight text-foreground">ServerHub</span>}
    </span>
  );
}
