import type { Metadata, Viewport } from "next";
import { Cinzel, Spectral, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quadro de Missões",
  description:
    "Quadro de missões de RPG de mesa: publique missões, inscreva suas fichas e receba as recompensas do mestre.",
};

export const viewport: Viewport = {
  themeColor: "#1B1712",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * As variáveis das fontes precisam ficar no <html>, não no <body>:
     * os tokens do Tailwind (`--font-display`, `--font-body`, `--font-mono`)
     * são declarados em `:root` e apontam para elas. Custom property só
     * resolve `var()` no elemento onde é declarada — com as fontes no <body>,
     * `--font-display` computa vazio e a tipografia inteira cai no padrão
     * do navegador.
     */
    <html
      lang="pt-BR"
      className={`${cinzel.variable} ${spectral.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
