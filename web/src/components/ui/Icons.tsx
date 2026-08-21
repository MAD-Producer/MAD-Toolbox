type IconProps = {
  className?: string;
};

function base(className?: string) {
  return {
    className: className ?? "size-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.06.78 2.14 0 1.55-.02 2.79-.02 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function WindowsIcon({ className }: IconProps) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9ZM11.6 4.2 21 3v8.5h-9.4V4.2Zm0 8.4H21V21l-9.4-1.3v-7.1Z" />
    </svg>
  );
}

export function AppleIcon({ className }: IconProps) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.38 2.1 2.93 3.6 2.87 1.45-.06 2-.93 3.74-.93s2.24.93 3.77.9c1.56-.03 2.55-1.41 3.5-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.04-.02-3.03-1.16-3.07-4.58ZM14.16 4.06c.8-.97 1.34-2.31 1.19-3.66-1.15.05-2.55.77-3.38 1.73-.74.86-1.39 2.23-1.22 3.55 1.29.1 2.6-.65 3.41-1.62Z" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5c0-.9 1-1.46 1.76-.99l9.5 5.66a1.15 1.15 0 0 1 0 1.98l-9.5 5.66c-.76.45-1.76-.1-1.76-1V5.5Z" />
    </svg>
  );
}

export function TasksIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 5.5h3.5M4 12h3.5M4 18.5h3.5" />
      <path d="M10.5 5.5H20M10.5 12H20M10.5 18.5H20" />
      <path d="m5.75 4.5 1 1 1.75-2" />
    </svg>
  );
}

export function BilibiliIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="7" width="18" height="12.5" rx="4" />
      <path d="m7.5 4.5 2.4 2.4M16.5 4.5l-2.4 2.4" />
      <path d="M9.5 12v2.5M14.5 12v2.5" />
    </svg>
  );
}

export function GlobeDownloadIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M4 11h14M11 4c2 2.2 3 4.4 3 7s-1 4.8-3 7c-2-2.2-3-4.4-3-7s1-4.8 3-7Z" />
      <path d="M18 16v5m0 0 2-2m-2 2-2-2" />
    </svg>
  );
}

export function MusicIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="7" cy="17.5" r="3" />
      <circle cx="18" cy="15.5" r="3" />
      <path d="M10 17.5V6.5l11-2.5v11.5" />
    </svg>
  );
}

export function MovieIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M8 5v14M16 5v14M3 12h18M3 8.5h5M3 15.5h5M16 8.5h5M16 15.5h5" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5c.3 2.9 1.3 4.8 2.8 6.1 1.4 1.2 3.4 1.9 6 2-2.7.2-4.7.9-6.1 2.2-1.4 1.3-2.3 3.1-2.7 5.7-.4-2.6-1.3-4.4-2.7-5.7C7.9 11.5 6 10.8 3.2 10.6c2.6-.1 4.6-.8 6-2C10.7 7.3 11.7 5.4 12 2.5Z" />
      <path d="M19 14.5c.15 1.4.65 2.3 1.35 2.9.65.55 1.6.9 2.85 1-1.28.1-2.24.45-2.9 1.05-.65.6-1.1 1.5-1.3 2.75-.2-1.25-.65-2.15-1.3-2.75-.66-.6-1.62-.95-2.9-1.05 1.25-.1 2.2-.45 2.85-1 .7-.6 1.2-1.5 1.35-2.9Z" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  );
}
