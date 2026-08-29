"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Sword, Shield, Trophy, LogOut, WifiOff } from "lucide-react";
import { signOut } from "@/app/entrar/actions";
import { useBoard } from "@/lib/data/board-provider";
import { Spinner } from "@/components/ui/primitives";

const TABS = [
  { href: "/quadro", label: "Quadro de Missões", Icon: ScrollText },
  { href: "/fichas", label: "Minhas Fichas", Icon: Sword },
  { href: "/guildas", label: "Guildas", Icon: Shield },
  { href: "/mural", label: "Mural de Conquistas", Icon: Trophy },
] as const;

/**
 * Cabeçalho + abas. Visual do protótipo mantido: aba ativa vira pergaminho com
 * sublinhado dourado. A mudança é de usabilidade — no celular a barra rola na
 * horizontal em vez de espremer quatro abas de nome longo.
 */
export function AppNav() {
  const pathname = usePathname();
  const { profile, busy, realtimeOk, refresh } = useBoard();

  return (
    <header className="px-4 sm:px-5 pt-5 pb-0 sticky top-0 z-30 bg-ink border-b border-brass-dim/25">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <Link href="/quadro" className="flex items-center gap-2.5 min-w-0">
          <ScrollText className="text-brass shrink-0" size={22} aria-hidden />
          <h1 className="font-display font-bold text-panel text-lg sm:text-xl truncate">
            Quadro de Missões
          </h1>
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          {busy && <Spinner size={14} />}
          {!realtimeOk && (
            <button
              type="button"
              onClick={() => void refresh()}
              title="O quadro não está recebendo atualizações automáticas. Clique para recarregar agora."
              className="flex items-center gap-1 font-mono text-[11px] text-blood hover:opacity-80 cursor-pointer"
            >
              <WifiOff size={13} aria-hidden />
              <span className="hidden sm:inline">sem tempo real</span>
            </button>
          )}
          <span className="font-mono text-xs text-faint max-w-[8rem] truncate">
            {profile.username}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              title="Sair da taverna"
              aria-label="Sair da taverna"
              className="text-muted hover:text-brass p-1 cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>

      <nav className="max-w-3xl mx-auto mt-4 flex gap-1 overflow-x-auto q-tabs">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-1.5 px-3 py-2 rounded-t-[2px] shrink-0",
                "font-display text-[12.5px] font-semibold whitespace-nowrap",
                active
                  ? "bg-panel text-ink-text border-b-2 border-brass"
                  : "text-faint border-b-2 border-transparent hover:text-panel",
              ].join(" ")}
            >
              <Icon size={14} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
