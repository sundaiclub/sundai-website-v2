import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./fonts.css";
import Navbar from "./components/navbar";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "./contexts/UserContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sundai",
  description: "Building & Launching AI Prototypes Every Sunday",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <UserProvider>
        <html lang="en" className="h-screen">
          <body
            className={`${inter.className} bg-lightBackground min-h-screen overflow-hidden overscroll-none`}
          >
            <Navbar />
            <main className="origin-top-container">
              {children}
            </main>
          </body>
        </html>
      </UserProvider>
    </ClerkProvider>
  );
}