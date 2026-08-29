"use client";

import {
  Coins, Crown, Flame, Shield, Skull, Sparkles, ScrollText, Star, Trophy, Users,
  type LucideIcon,
} from "lucide-react";

/**
 * `achievements.icon` guarda o nome do ícone lucide. Este mapa é a única ponte
 * entre o dado do banco e o componente — nada de import dinâmico.
 */
const ICONS: Record<string, LucideIcon> = {
  "scroll-text": ScrollText,
  flame: Flame,
  users: Users,
  star: Star,
  crown: Crown,
  sparkles: Sparkles,
  coins: Coins,
  skull: Skull,
  shield: Shield,
  trophy: Trophy,
};

export function AchievementIcon({
  name,
  size = 13,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon size={size} className={className} aria-hidden />;
}
