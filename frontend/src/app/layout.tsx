import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import dynamic from "next/dynamic";
import { WalletProvider } from "@/contexts/WalletContext";

const CustomCursor = dynamic(() => import("@/components/CustomCursor"), { ssr: false });
const LiquidBackground = dynamic(() => import("@/components/LiquidBackground"), { ssr: false });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "web3 guard — smart contract security",
  description: "AI-powered smart contract vulnerability scanner for the next generation of blockchain security.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-brutal-bg text-brutal-text overflow-x-hidden selection:bg-brutal-orange selection:text-white`}>
        <WalletProvider>
          {/* z-0: Liquid ambient background */}
          <LiquidBackground />

          {/* z-1: Subtle grain texture (purely decorative, never blocks anything) */}
          <div className="grain-overlay"></div>
          
          {/* z-10: Custom trailing cursor */}
          <CustomCursor />
          
          {/* z-30: Navigation bar */}
          <div className="relative z-30">
            <Navbar />
          </div>
          
          {/* Page content - no z-index to avoid trapping fixed panels */}
          <main>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}

