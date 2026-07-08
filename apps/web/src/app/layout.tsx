import type { Metadata } from "next";

import { Inter, JetBrains_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/ThemeProvider";

import "./globals.css";



const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });



export const metadata: Metadata = {
  title: "ServerHub — Gestion de serveurs",
  description: "Inventaire, monitoring SSH et terminal web pour vos serveurs",
  icons: { icon: "/icon.svg" },
};



const themeScript = `(function(){try{var t=localStorage.getItem('serverhub-theme');var d=t!=='light';document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;



export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (

    <html lang="fr" suppressHydrationWarning>

      <head>

        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

      </head>

      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>

        <ThemeProvider>{children}</ThemeProvider>

      </body>

    </html>

  );

}

