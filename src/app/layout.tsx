import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./fonts.css";
import Navbar from "./components/navbar";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "./contexts/UserContext";
import { ThemeProvider } from '../context/ThemeContext';
import { Providers } from './components/Providers';
import { Space_Mono, Fira_Code } from 'next/font/google'

const inter = Inter({ subsets: ["latin"] });

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
})

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
        <html lang="en">
          <body
            className={`${inter.className} h-screen ${spaceMono.variable} ${firaCode.variable}`}
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "none",
            }}
          >
            <Providers>
              <Navbar />
              <div className="origin-top-left min-h-screen pt-16">
                {children}
              </div>
            </Providers>
          </body>
        </html>
      </UserProvider>
    </ClerkProvider>
  );
}
