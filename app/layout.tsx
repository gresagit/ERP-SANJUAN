import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAN JUAN · Servicios de salud",
  description: "Sistema interno de atención, expedientes y agenda de San Juan Servicios de Salud",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">{children}</body>
    </html>
  );
}
