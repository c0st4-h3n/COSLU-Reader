// Estampa S.08 da COSLU LABZ — porta fiel do DateStampInline
// (fonte: ../../COSLU Labz/deck.jsx :: DateStampInline / brand.jsx s.08).
// Carimbo retangular "received-style": BUILT · BY / COSLU LABZ / — data —.
// Tokens via CSS vars de brand-tokens.css ("o pattern que já seguimos").

export function StampS08({
  label = "BUILT · BY",
  big = "COSLU LABZ",
  date = "MAY 2026",
  rotate = -3,
  size = 1,
}: {
  label?: string;
  big?: string;
  date?: string;
  rotate?: number;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "inline-block",
        border: `${3 * size}px double var(--c-vermilion)`,
        padding: `${14 * size}px ${24 * size}px`,
        transform: `rotate(${rotate}deg)`,
        color: "var(--c-vermilion)",
        fontFamily: "var(--f-mono)",
        textAlign: "center",
        background: "transparent",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12 * size, letterSpacing: "0.32em" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 800,
          fontSize: 32 * size,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          margin: `${6 * size}px 0`,
        }}
      >
        {big}
      </div>
      <div
        style={{
          width: "100%",
          height: 1,
          background: "var(--c-vermilion)",
          margin: `${6 * size}px 0`,
        }}
      />
      <div style={{ fontWeight: 700, fontSize: 11 * size, letterSpacing: "0.32em" }}>
        — {date} —
      </div>
    </div>
  );
}
