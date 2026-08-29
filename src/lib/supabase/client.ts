"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do navegador.
 *
 * A configuração NÃO é lida de `process.env` aqui: ela chega por props, vinda
 * do layout servidor (ver `(app)/layout.tsx`). Isso libera o projeto de
 * precisar do prefixo `NEXT_PUBLIC_` nas variáveis de ambiente — a Vercel
 * classifica variáveis com esse prefixo como públicas e nem sempre deixa
 * criá-las assim.
 *
 * Vale ser explícito: os valores continuam chegando ao navegador de qualquer
 * forma — um app que fala direto com o Supabase pelo cliente precisa deles
 * lá. O que muda é só de onde eles vêm (props em tempo de execução, em vez de
 * substituição no bundle em tempo de build). Quem protege os dados é a RLS,
 * nunca o segredo da anon key.
 */

interface SupabaseConfig {
  url: string;
  key: string;
}

let config: SupabaseConfig | null = null;
let cached: SupabaseClient | null = null;

/** Chamado uma vez pelo provider, com os valores que o servidor entregou. */
export function configureSupabaseClient(url: string, key: string): void {
  if (config && config.url === url && config.key === key) return;
  config = { url, key };
  // Trocou a configuração: o cliente antigo (e a WebSocket dele) não serve mais.
  cached = null;
}

/**
 * Uma instância só por aba: o Realtime abre uma WebSocket por cliente, e
 * recriar o cliente a cada render abriria conexões novas sem fechar as antigas.
 */
export function createClient(): SupabaseClient {
  if (!config) {
    throw new Error(
      "Cliente Supabase não configurado. O layout do quadro precisa passar a " +
        "URL e a chave para o BoardProvider.",
    );
  }
  if (!cached) {
    cached = createBrowserClient(config.url, config.key);
  }
  return cached;
}
