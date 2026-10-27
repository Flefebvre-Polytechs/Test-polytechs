import type { Metadata } from "next";
import "./globals.css";
import "./unites/style.css";
import "./hub.css";
import "./premium.css";

export const metadata: Metadata = {
  title: "Polytechs · Espace QSE",
  description: "Pilotage qualité, sécurité et environnement.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
