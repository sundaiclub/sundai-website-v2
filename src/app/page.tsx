"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ProjectCard from "./components/Project";
import Typewriter from "typewriter-effect";
import { useState, useEffect } from "react";
import { registerServiceWorker } from "./pwa";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useTheme } from './contexts/ThemeContext';

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
        <div className="container mx-auto relative z-10"
             style={{
              backgroundImage: "url('/images/background_sundai.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              }}>
          <div className="flex flex-col items-center justify-center">
            <motion.div
              className="w-full text-center mb-8"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <h1 className={`font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-6 font-space-mono tracking-tight ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Sundai
              </h1>
              <p className={`text-base sm:text-lg md:text-xl mb-8 max-w-xl mx-auto font-fira-code ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
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
                    src="/images/affiliations/mit_logo_std_rgb_silver-gray.svg"
                    style={{ filter: "brightness(1.2)" }}
                    className="w-24 h-24 opacity-90"
                    alt="Logo MIT"
                    width={96}
                    height={96}
                  />
                </motion.div>
                <div className={`text-xl font-mono h-full mt-8 text-center px-4 py-2 rounded-lg ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
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
            ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-gray-200' 
            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
          } py-6 md:py-2`}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Copyright notice - Left aligned */}
            <p className="text-sm md:text-base order-2 md:order-1 mt-4 md:mt-0">
              &copy; 2024 Sundai Club. All rights reserved.
            </p>
            
            {/* Social links - Right aligned */}
            <ul className="flex justify-center order-1 md:order-2">
              {/* GitHub */}
              <li>
                <Link href="https://github.com/sundai-club" className={`flex justify-center items-center w-8 h-8 ${
                  isDarkMode 
                    ? 'text-gray-200 hover:text-purple-400' 
                    : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`} aria-label="Github">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 8.2c-4.4 0-8 3.6-8 8 0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4V22c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.7 3.9.3.4.6.9.6 1.6v2.2c0 .2.1.5.6.4 3.2-1.1 5.5-4.1 5.5-7.6-.1-4.4-3.7-8-8.1-8z" />
                  </svg>
                </Link>
              </li>
              {/* X (Twitter) */}
              <li className="ml-4">
                <Link href="https://twitter.com/sundai_club" className={`flex justify-center items-center w-8 h-8 ${
                  isDarkMode 
                    ? 'text-gray-200 hover:text-purple-400' 
                    : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`} aria-label="Twitter">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <path d="m13.063 9 3.495 4.475L20.601 9h2.454l-5.359 5.931L24 23h-4.938l-3.866-4.893L10.771 23H8.316l5.735-6.342L8 9h5.063Zm-.74 1.347h-1.457l8.875 11.232h1.36l-8.778-11.232Z" />
                  </svg>
                </Link>
              </li>
              {/* LinkedIn */}
              <li className="ml-4">
                <Link href="https://www.linkedin.com/company/sundaiclub" className={`flex justify-center items-center w-8 h-8 ${
                  isDarkMode 
                    ? 'text-gray-200 hover:text-purple-400' 
                    : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`} aria-label="LinkedIn">
                  <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                    <path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/>
                  </svg>
                </Link>
              </li>
              {/* Instagram */}
              <li className="ml-4">
                <Link href="https://instagram.com/sundai_club" className={`flex justify-center items-center w-8 h-8 ${
                  isDarkMode 
                    ? 'text-gray-200 hover:text-purple-400' 
                    : 'text-gray-700 hover:text-purple-600'
                  } rounded-full transition duration-150 ease-in-out`} aria-label="Instagram">
                  <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                    <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
                  </svg>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
