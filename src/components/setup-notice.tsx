import { ScrollText } from "lucide-react";
import { supabaseConfigProblem } from "@/lib/supabase/env";

/**
 * Mostrado quando o projeto Supabase ainda não foi configurado.
 *
 * É o único caminho em que o app não fala com o banco — e ele diz isso na
 * cara, em vez de fingir que funcionou (que era um dos problemas do protótipo).
 */
export function SetupNotice() {
  const problem = supabaseConfigProblem();

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-ink">
      <div className="w-full max-w-md">
        <div className="text-center">
          <ScrollText size={40} className="text-brass mx-auto mb-3.5" aria-hidden />
          <h1 className="font-display font-bold text-panel text-2xl">
            Quadro de Missões
          </h1>
          <p className="font-body text-faint text-sm mt-2 mb-6">
            A taverna ainda não foi conectada ao banco de dados.
          </p>
        </div>

        <div className="q-panel p-5">
          {problem && (
            <p
              className="font-body text-[13px] mb-3 px-3 py-2 rounded-[2px] bg-blood/10 border border-blood/40 text-[#7A2F28]"
              role="alert"
            >
              {problem}
            </p>
          )}

          <p className="font-body text-[14px] text-ink-text">
            Falta apontar o app para um projeto Supabase. Crie um arquivo{" "}
            <code className="font-mono text-[12px]">.env.local</code> na raiz (ou
            defina as variáveis na Vercel) com:
          </p>
          <pre className="mt-3 p-3 rounded-[2px] bg-panel-light border border-brass-dim/35 overflow-x-auto font-mono text-[11.5px] text-ink-text">
{`NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua anon key>`}
          </pre>
          <p className="font-body text-[13px] text-muted mt-3">
            Na Vercel, o campo <em>Key</em> recebe o nome e o campo <em>Value</em>{" "}
            recebe só o valor — sem o <code className="font-mono text-[11.5px]">=</code>{" "}
            e sem aspas. Depois de alterar, é preciso um <strong>Redeploy</strong>.
          </p>
          <p className="font-body text-[13px] text-muted mt-2">
            O passo a passo completo — criar o projeto, rodar as migrations,
            ligar o Realtime — está em <strong>DEPLOY.md</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
