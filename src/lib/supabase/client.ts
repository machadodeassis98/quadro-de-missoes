"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Cliente do navegador. Uma instância só por aba: o Realtime abre uma
 * WebSocket por cliente, e recriar o cliente a cada render abriria conexões
 * novas sem fechar as antigas.
 */
export function createClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Ver .env.example e DEPLOY.md.",
    );
  }
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
