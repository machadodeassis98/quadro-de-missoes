import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

/** Rotas que não exigem sessão. */
const PUBLIC_PATHS = ["/entrar", "/cadastrar"];

/**
 * Renova a sessão a cada navegação (é o que mantém o jogador logado ao
 * recarregar) e protege as rotas do quadro.
 *
 * No Next 16 esta camada se chama `proxy` — é o antigo `middleware`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sem projeto Supabase configurado (ou com valor inválido) não há sessão
  // para renovar nem rota a proteger — as páginas mostram as instruções.
  if (!isSupabaseConfigured) return response;

  let user = null;

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // getUser() (e não getSession()) porque valida o token no servidor.
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    /*
     * Esta camada roda em TODA requisição. Se ela lançar, o site inteiro
     * responde 500 — inclusive as páginas que existem para explicar o
     * problema. Foi exatamente o que aconteceu num deploy com a variável de
     * ambiente malformada. Melhor seguir sem sessão: as rotas protegidas
     * conferem a sessão de novo no servidor, então nada vaza por aqui.
     */
    console.error("proxy: falha ao verificar a sessão", error);
    return response;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("proxima", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/quadro";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos assets estáticos e imagens — o proxy roda em toda
     * navegação e não deve pagar o custo de arquivo estático.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
