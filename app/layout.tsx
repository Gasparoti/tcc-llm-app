import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clareza / Lab",
  description:
    "Laboratório didático para estruturar prompts educacionais e revisar respostas de modelos de linguagem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
