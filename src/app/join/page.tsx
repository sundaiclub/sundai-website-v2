"use client";

import { motion } from "framer-motion";
import Script from "next/script";
import { useEffect } from "react";

import { useTheme } from "../contexts/ThemeContext";

interface TallyEmbedApi {
  loadEmbeds: () => void;
}

declare global {
  interface Window {
    Tally?: TallyEmbedApi;
  }
}

export default function JoinPage() {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    window.Tally?.loadEmbeds();
  }, []);

  return (
    <main
      className={`min-h-screen bg-gradient-to-b font-space-mono ${
        isDarkMode
          ? "from-gray-900 to-black text-gray-100"
          : "from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
      }`}
    >
      <section className="relative px-4 py-16 md:px-8 md:py-24 lg:py-26">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="container mx-auto max-w-3xl"
        >
          <h1
            className={`mb-8 text-center text-3xl font-bold md:text-4xl ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            Join Sundai Club
          </h1>
          <div
            className={`rounded-lg p-6 shadow-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <iframe
              data-tally-src={`https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1${
                isDarkMode ? "&theme=dark" : ""
              }`}
              loading="lazy"
              width="100%"
              height="216"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              title="Sundai Club membership form"
              className="w-full"
            />
          </div>
        </motion.div>
      </section>
      <Script
        src="https://tally.so/widgets/embed.js"
        onLoad={() => window.Tally?.loadEmbeds()}
      />
    </main>
  );
}
