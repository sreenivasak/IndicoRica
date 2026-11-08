import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IndicoRica — Indian community in Costa Rica",
  description: "Businesses, groceries, guides and events for Indians in Costa Rica.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-amber-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
