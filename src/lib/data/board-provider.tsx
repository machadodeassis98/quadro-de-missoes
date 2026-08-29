"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { configureSupabaseClient, createClient } from "@/lib/supabase/client";
import { loadBoard, QuadroError, type BoardData } from "./api";
import type { CharacterView, MissionView, Profile } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Feedback (toasts)                                                  */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

/* ------------------------------------------------------------------ */
/*  Contexto                                                           */
/* ------------------------------------------------------------------ */

interface BoardContextValue {
  profile: Profile;
  data: BoardData;
  loading: boolean;
  error: string | null;
  /** true enquanto uma ação de escrita está no ar. */
  busy: boolean;
  /** false quando o canal de tempo real não está de pé — a UI avisa. */
  realtimeOk: boolean;
  refresh: () => Promise<void>;
  /**
   * Executa uma escrita, recarrega o quadro e mostra o retorno na tela.
   * Devolve true em caso de sucesso — o chamador usa isso para fechar modais.
   */
  run: (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  notify: (message: string, tone?: "success" | "error") => void;
  /** Fichas do jogador logado, ativas primeiro. */
  myCharacters: CharacterView[];
  /** Fichas ativas do jogador logado. */
  myActiveCharacters: CharacterView[];
  missions: MissionView[];
}

const BoardContext = createContext<BoardContextValue | null>(null);

const EMPTY: BoardData = {
  characters: [],
  missions: [],
  guilds: [],
  achievements: [],
};

export function BoardProvider({
  profile,
  supabaseUrl,
  supabaseAnonKey,
  children,
}: {
  profile: Profile;
  supabaseUrl: string;
  supabaseAnonKey: string;
  children: React.ReactNode;
}) {
  /*
   * Configura o cliente do navegador com o que o servidor entregou, antes de
   * qualquer efeito rodar (efeitos só disparam depois da renderização). É uma
   * atribuição idempotente de módulo, não estado de React.
   */
  configureSupabaseClient(supabaseUrl, supabaseAnonKey);

  const [data, setData] = useState<BoardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [realtimeOk, setRealtimeOk] = useState(true);

  const toastSeq = useRef(0);
  const mounted = useRef(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      if (mounted.current) setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Grava o resultado de uma carga bem-sucedida. */
  const commit = useCallback((next: BoardData) => {
    if (!mounted.current) return;
    setData(next);
    setError(null);
    setLoading(false);
  }, []);

  /** Grava a falha de uma carga. */
  const fail = useCallback((e: unknown) => {
    if (!mounted.current) return;
    setError(
      e instanceof QuadroError
        ? e.message
        : "Não foi possível carregar o quadro. Verifique a conexão.",
    );
    setLoading(false);
  }, []);

  /**
   * Recarrega o quadro.
   *
   * Chamadas concorrentes não empilham requisições: quem chega no meio de uma
   * recarga só marca `queued`, e o laço faz uma passada extra no fim. Isso
   * segura a rajada de eventos de Realtime que uma resolução de missão gera.
   */
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        queued.current = false;
        commit(await loadBoard());
      } while (queued.current && mounted.current);
    } catch (e) {
      fail(e);
    } finally {
      queued.current = false;
      inFlight.current = false;
    }
  }, [commit, fail]);

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string) => {
      setBusy(true);
      try {
        await action();
        await refresh();
        if (successMessage) notify(successMessage, "success");
        return true;
      } catch (e) {
        notify(
          e instanceof QuadroError ? e.message : "Algo deu errado. Tente de novo.",
          "error",
        );
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [refresh, notify],
  );

  /* Carga inicial */
  useEffect(() => {
    mounted.current = true;
    loadBoard().then(commit).catch(fail);
    return () => {
      mounted.current = false;
    };
  }, [commit, fail]);

  /* ------------------------------------------------------------------ */
  /*  Realtime                                                           */
  /*                                                                     */
  /*  Um canal só, quatro tabelas. Cada evento agenda uma recarga com     */
  /*  250 ms de folga: resolver uma missão dispara dezenas de eventos     */
  /*  (personagens, participantes, missão) e sem isso seriam dezenas de   */
  /*  recargas.                                                          */
  /*                                                                     */
  /*  Dois detalhes que custaram caro e não são opcionais:                */
  /*                                                                     */
  /*  1. `realtime.setAuth(token)` ANTES de assinar. Sem o token, o       */
  /*     socket conecta como `anon`; como todas as policies de SELECT são */
  /*     `to authenticated`, a RLS não deixa nenhuma linha passar. O      */
  /*     canal responde SUBSCRIBED normalmente e simplesmente nunca       */
  /*     entrega evento nenhum — falha silenciosa perfeita.               */
  /*  2. Nome de canal único por montagem. Em desenvolvimento o           */
  /*     StrictMode monta, desmonta e remonta; reusar o mesmo tópico faz  */
  /*     o segundo canal entrar num tópico que ainda está saindo.         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let unsubscribeAuth: (() => void) | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        void refresh();
      }, 250);
    };

    const start = async () => {
      let supabase;
      try {
        supabase = createClient();
      } catch {
        // Sem Supabase configurado o quadro segue funcionando sem tempo real.
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      await supabase.realtime.setAuth(session?.access_token ?? null);
      if (cancelled) return;

      // O token expira; quando o Supabase renova, o socket precisa saber.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        void supabase.realtime.setAuth(next?.access_token ?? null);
      });
      unsubscribeAuth = () => sub.subscription.unsubscribe();

      const topic = `quadro-${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(topic)
        .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "mission_participants" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "characters" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "guilds" }, scheduleRefresh)
        .subscribe((status) => {
          if (cancelled) return;
          // Sem callback de status, uma falha de assinatura ficaria invisível
          // e o quadro pareceria "só não atualizar".
          setRealtimeOk(status === "SUBSCRIBED");
        });
    };

    void start();

    return () => {
      cancelled = true;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      unsubscribeAuth?.();
      if (channel) {
        try {
          void createClient().removeChannel(channel);
        } catch {
          void channel.unsubscribe();
        }
      }
    };
  }, [refresh]);

  const myCharacters = useMemo(
    () =>
      data.characters
        .filter((c) => c.user_id === profile.id)
        .sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          return a.created_at.localeCompare(b.created_at);
        }),
    [data.characters, profile.id],
  );

  const myActiveCharacters = useMemo(
    () => myCharacters.filter((c) => c.active),
    [myCharacters],
  );

  const value = useMemo<BoardContextValue>(
    () => ({
      profile,
      data,
      loading,
      error,
      busy,
      realtimeOk,
      refresh,
      run,
      toasts,
      dismissToast,
      notify,
      myCharacters,
      myActiveCharacters,
      missions: data.missions,
    }),
    [
      profile, data, loading, error, busy, realtimeOk, refresh, run,
      toasts, dismissToast, notify, myCharacters, myActiveCharacters,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard precisa estar dentro de <BoardProvider>.");
  }
  return ctx;
}
