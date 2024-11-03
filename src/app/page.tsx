"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ProjectCard from "./components/Project";
import Typewriter from "typewriter-effect";
import { useState, useEffect } from "react";
import { registerServiceWorker } from "./pwa";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

export default function Home() {
  const [isTypingDone, setIsTypingDone] = useState(false);

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
    <div className="min-h-screen bg-lightBackground text-gray-800 font-montserrat">
      <section className="section-spacing px-4 md:px-8 overflow-hidden">
        <div className="section-container">
          <div className="flex flex-col items-center justify-center">
            <motion.div
              className="w-full text-center mb-8"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <h1 className="heading-primary">Sundai</h1>
              <p className="text-primary">
                Building & Launching AI Prototypes Every Sunday.
              </p>

              <div className="grid grid-cols-3 gap-4 items-center max-w-lg mx-auto mb-12 bg-gray-100 rounded-xl p-6 shadow-customLight">
                <motion.div
                  className="flex justify-center items-center relative rounded-lg p-4"
                  variants={stompVariants}
                  initial="hidden"
                  animate={isTypingDone ? "visible" : "hidden"}
                  transition={{ delay: 0.2 }}
                >
                  <Image
                    src="/images/affiliations/mit_logo_std_rgb_black.svg"
                    className="w-24 h-24 opacity-90"
                    alt="MIT Logo"
                    width={96}
                    height={96}
                  />
                </motion.div>
                <div className="text-xl text-black font-mono text-center px-4 py-2">
                  <Typewriter
                    onInit={(typewriter) => {
                      typewriter
                        .changeDelay(70)
                        .typeString("We are hackers from")
                        .callFunction(() => setIsTypingDone(true))
                        .start();
                    }}
                  />
                </div>
                <motion.div
                  className="flex justify-center items-center relative rounded-lg p-4"
                  variants={stompVariants}
                  initial="hidden"
                  animate={isTypingDone ? "visible" : "hidden"}
                  transition={{ delay: 0.4 }}
                >
                  <Image
                    src="/images/affiliations/harvard-university-seeklogo.svg"
                    className="w-20 h-20 opacity-90 grayscale"
                    alt="Harvard Logo"
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
                    className="button-primary px-6 py-3 text-base md:text-lg rounded-full flex items-center gap-4"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get Started{" "}
                    <svg
                      role="img"
                      viewBox="0 0 16 16"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="ml-2 transform transition-transform group-hover:w-[0.7em] w-0 ease-out duration-200"
                    >
                      <path d="M1 9h14a1 1 0 000-2H1a1 1 0 000 2z"></path>
                      <path d="M7.293 1.707L13.586 8l-6.293 6.293a1 1 0 001.414 1.414l7-7a.999.999 0 000-1.414l-7-7a1 1 0 00-1.414 1.414z"></path>
                    </svg>
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
        className="bg-gradient-dark text-gray-700 py-6 md:py-8"
      >
        <div className="container mx-auto px-4 text-center">
          <p className="footer-text">
            &copy; 2024 Sundai Club. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}