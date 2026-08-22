import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { RegistraServiceWorker } from "@/components/RegistraServiceWorker";

config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Comprar & Construir | Gestão Inteligente de Suprimentos",
  description:
    "Transforme a cadeia de suprimentos da sua obra com a metodologia estratégica da Comprar & Construir.",
  applicationName: "Comprar & Construir",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Comprar & Construir",
    // Barra de status transparente: o conteúdo sobe até o topo no iPhone
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  other: {
    // O Next emite `mobile-web-app-capable`, mas o Safari do iPhone ainda
    // lê a variante com prefixo apple — sem ela o app abre com a barra
    // do navegador mesmo depois de instalado.
    "apple-mobile-web-app-capable": "yes",
  },
};

/**
 * `viewportFit: cover` + as variáveis `env(safe-area-inset-*)` no CSS são o
 * que impede o menu inferior de ficar embaixo da barra de gestos do iPhone.
 */
export const viewport: Viewport = {
  themeColor: "#F97316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">
        <ToastProvider>
          <ConfirmModalProvider>{children}</ConfirmModalProvider>
        </ToastProvider>
        <RegistraServiceWorker />
      </body>
    </html>
  );
}
