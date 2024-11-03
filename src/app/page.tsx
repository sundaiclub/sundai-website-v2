"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ProjectCard from "./components/Project";
import Typewriter from "typewriter-effect";
import { useState, useEffect } from "react";
import { registerServiceWorker } from "./pwa";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useTheme } from '../context/ThemeContext';

export default function Home() {
  const [isTypingDone, setIsTypingDone] = useState(false);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  usePullToRefresh();

  const stompVariants = {
    hidden: { scale: 2, opacity: 0, y: -50 },
    visible: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.5,
      },
    },
  };

  return (
    <div className={`min-h-screen ${
      isDarkMode 
        ? 'bg-gradient-to-b from-gray-900 to-black text-gray-100' 
        : 'bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800'
      } font-space-mono`}>
      
      <section className="relative py-16 md:py-24 lg:py-26 px-4 md:px-8 overflow-hidden">
        <div className="container mx-auto relative z-10">
          <div className="flex flex-col items-center justify-center">
            <motion.div
              className="w-full text-center mb-8"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <h1 className="font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-black mb-6 font-space-mono tracking-tight">
                Sundai
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-black mb-8 max-w-xl mx-auto font-fira-code">
                Building & Launching AI Prototypes Every Sunday.
              </p>

              <div className={`grid grid-cols-3 gap-4 items-center max-w-lg mx-auto mb-12 ${
                isDarkMode 
                  ? 'bg-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' 
                  : 'bg-gray-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]'
                } rounded-xl p-6`}>
                <motion.div
                  className="flex justify-center items-center relative rounded-lg p-4 "
                  variants={stompVariants}
                  initial="hidden"
                  animate={isTypingDone ? "visible" : "hidden"}
                  transition={{ delay: 0.2 }}
                >
                  <Image
                    src="/images/affiliations/mit_logo_std_rgb_black.svg"
                    className="w-24 h-24 opacity-90"
                    alt="Logo MIT"
                    width={96}
                    height={96}
                  />
                </motion.div>
                <div className="text-xl text-black font-mono h-full mt-8 text-center px-4 py-2 rounded-lg">
                  <Typewriter
                    onInit={(typewriter) => {
                      typewriter
                        .changeDelay(70)
                        .typeString("We are hackers from")
                        .callFunction(() => {
                          setIsTypingDone(true);
                        })
                        .start();
                    }}
                  />
                </div>
                <motion.div
                  className="flex justify-center items-center relative  rounded-lg p-4 "
                  variants={stompVariants}
                  initial="hidden"
                  animate={isTypingDone ? "visible" : "hidden"}
                  transition={{ delay: 0.4 }}
                >
                  <Image
                    src="/images/affiliations/harvard-university-seeklogo.svg"
                    className="w-20 h-20 opacity-90"
                    style={{ filter: "grayscale(100%)" }}
                    alt="Logo Harvard"
                    width={80}
                    height={80}
                  />
                </motion.div>
              </div>

              <motion.div
                className="flex justify-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Link href="/projects/new">
                  <motion.span
                    className={`gap-4 btn-xl btn-purple group/btn btn-border-dark rounded-full ${
                      isDarkMode 
                        ? 'bg-indigo-700 hover:bg-indigo-600' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                      } text-white font-semibold text-base md:text-lg py-3 px-6 md:px-8 transition duration-300 cursor-pointer flex items-center justify-center`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get Started{" "}
                    <div className="flex items-center opacity-50 group-hover/btn:opacity-100 transition-opacity ml-2">
                      <svg
                        role="img"
                        viewBox="0 0 16 16"
                        width="0"
                        height="10"
                        fill="currentColor"
                        className="w-0 group-hover/btn:w-[0.7em] h-[0.7em] -mr-[0.7em] ease-out duration-200 transition-all transform-gpu"
                      >
                        <path d="M1 9h14a1 1 0 000-2H1a1 1 0 000 2z"></path>
                      </svg>
                      <svg
                        role="img"
                        viewBox="0 0 16 16"
                        width="10"
                        height="10"
                        fill="currentColor"
                        className="size-[0.7em]"
                      >
                        <path d="M7.293 1.707L13.586 8l-6.293 6.293a1 1 0 001.414 1.414l7-7a.999.999 0 000-1.414l-7-7a1 1 0 00-1.414 1.414z"></path>
                      </svg>
                    </div>
                  </motion.span>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
        >
          <ProjectCard />
        </motion.div>
      </section>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className={`${
          isDarkMode 
            ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-gray-300' 
            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
          } py-6 md:py-8`}
      >
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm md:text-base">
            &copy; 2024 Sundai Club. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}
