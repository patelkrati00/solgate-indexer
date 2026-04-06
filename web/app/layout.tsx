import SolanaWalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";

import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>
          {/* <Navbar /> */}
          <main>{children}</main>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}