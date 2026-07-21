import type { Metadata } from "next";
import { AuthGuard } from "../components/auth-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finora - doradca podatkowy AI",
  description: "Chatbot AI od PIT, VAT, ryczałtu i działalności B2B w Polsce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body><AuthGuard>{children}</AuthGuard></body>
    </html>
  );
}
