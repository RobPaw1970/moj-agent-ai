import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generator leadów",
  description: "Asystent AI wspierający sprzedaż IFS Cloud",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
