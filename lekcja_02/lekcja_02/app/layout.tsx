import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KadraPro - Specjalista ds. kadr i prawa pracy",
  description: "Ekspert od kadr i prawa pracy dla polskich pracodawcow i pracownikow."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
