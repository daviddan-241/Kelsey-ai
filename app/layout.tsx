import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kelsey AI — Your AI Workspace",
  description: "Premium AI workspace with 475+ agents, code generation, deployment, social media, crypto tools, and more.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
