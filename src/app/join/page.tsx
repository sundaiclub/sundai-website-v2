"use client";
import Script from 'next/script';
import { motion } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext";
import { useEffect } from "react";

interface Tally {
    loadEmbeds: () => void;
}
declare const Tally: Tally;

declare global {
    interface Window {
        Tally: Tally;
    }
}

export default function Join() {
    const { isDarkMode } = useTheme();

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Tally) {
            window.Tally.loadEmbeds();
        }
    }, []);

    return (
        <div className={`min-h-screen ${
            isDarkMode
                ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
                : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
            } font-space-mono`}
        >
            <section className="relative py-16 md:py-24 lg:py-26 px-4 md:px-8">
                <div className="container mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="max-w-3xl mx-auto"
                    >
                        <h1 className={`text-3xl md:text-4xl font-bold text-center mb-8 ${
                            isDarkMode ? "text-gray-100" : "text-gray-900"
                        }`}>
                            Join Sundai Club
                        </h1>
                        <div className={`rounded-lg p-6 ${
                            isDarkMode ? "bg-gray-800" : "bg-white"
                        } shadow-lg`}>
                            <iframe
                                data-tally-src={`https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1${isDarkMode ? '&theme=dark' : ''}`}
                                loading="lazy"
                                width="100%"
                                height="216"
                                frameBorder={0}
                                marginHeight={0}
                                marginWidth={0}
                                title="Newsletter subscribers"
                                className="w-full"
                            ></iframe>
                        </div>
                    </motion.div>
                </div>
            </section>
            <Script
                src="https://tally.so/widgets/embed.js"
                onLoad={() => Tally.loadEmbeds()}
            />
        </div>
    );
}
