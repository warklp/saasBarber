import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import RouteGuard from "@/components/auth/RouteGuard";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { headers } from 'next/headers';
import { NavigationProgress } from "@/components/navigation/NavigationProgress";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Barbearia - Sistema de Gestão",
  description: "Sistema completo para gestão de barbearias",
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage = pathname === "/login";

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <NavigationProgress />
        {isLoginPage ? (
          children
        ) : (
          <RouteGuard>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 ml-16">
                <Header />
                <main className="pt-16 min-h-screen bg-gray-50">
                  {children}
                </main>
              </div>
            </div>
          </RouteGuard>
        )}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}