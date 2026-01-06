import "./globals.css";

export const metadata = {
  title: "Juego de mi Vida",
  description: "Hábitos, misiones y progreso en modo RPG.",
  applicationName: "Juego de mi Vida",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1220",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Juego de mi Vida"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/icon-192.png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
