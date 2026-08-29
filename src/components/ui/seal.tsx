"use client";

import { rankInfo, type MissionRank } from "@/lib/domain/rules";

/**
 * Selo de lacre da missão — o círculo com a letra do rank.
 * Gradiente radial e sombra interna idênticos aos do protótipo.
 */
export function Seal({ rank, size = 44 }: { rank: MissionRank | string; size?: number }) {
  const info = rankInfo(rank);
  return (
    <div
      title={`Rank ${info.label}`}
      aria-label={`Rank ${info.label}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${info.ring}, ${info.color})`,
        boxShadow: "0 2px 4px rgba(0,0,0,0.4), inset 0 0 6px rgba(0,0,0,0.35)",
        fontSize: size * 0.32,
      }}
      className="rounded-full border-2 border-ink flex items-center justify-center shrink-0 font-display font-black text-panel"
    >
      {info.label}
    </div>
  );
}
