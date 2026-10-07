type Props = { kind?: "pair" | "note" | "friends"; className?: string };

// Декоративный знак: смысл блока всегда указан текстом.
export function TogetherMark({ kind = "pair", className }: Props) {
  return (
    <svg className={className} viewBox="0 0 80 70" fill="none" aria-hidden="true" focusable="false">
      {kind === "note" ? (
        <g stroke="currentColor" strokeWidth="1">
          <path d="M14 17h52v38H14zM14 17l26 21 26-21M14 55l18-20M66 55 48 35" />
          <path d="M34 12h12" />
        </g>
      ) : kind === "friends" ? (
        <g stroke="currentColor" strokeWidth="1">
          <ellipse cx="29" cy="35" rx="19" ry="25" />
          <ellipse cx="51" cy="35" rx="19" ry="25" />
          <path d="M31 35h18M45 30l5 5-5 5" />
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="1">
          <ellipse cx="30" cy="35" rx="20" ry="27" />
          <ellipse cx="50" cy="35" rx="20" ry="27" />
          <path d="M35 35h10M40 30v10" strokeWidth=".6" />
        </g>
      )}
    </svg>
  );
}

