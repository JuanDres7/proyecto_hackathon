export function BrandMark({
  size = "md",
  showWordmark = true,
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const box =
    size === "lg" ? "w-12 h-12" : size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const word =
    size === "lg" ? "text-3xl md:text-5xl" : size === "sm" ? "text-base" : "text-lg";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${box} rounded-xl bg-surface-card/80 border border-border-muted flex items-center justify-center p-1.5 shadow-lg shadow-primary/10`}
      >
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full" aria-hidden>
          <path
            d="M26 50L42 66L74 34"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="50"
            cy="50"
            r="32"
            stroke="#60a5fa"
            strokeWidth="4"
            strokeDasharray="8 6"
            opacity="0.6"
          />
          <circle cx="50" cy="50" r="4" fill="#34d399" />
        </svg>
      </div>
      {showWordmark && (
        <span className={`font-display font-semibold tracking-tight text-white ${word}`}>
          Limpi<span className="text-primary">App</span>
        </span>
      )}
    </div>
  );
}
