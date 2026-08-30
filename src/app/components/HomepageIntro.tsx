'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import Typewriter from 'typewriter-effect';
import { useState } from 'react';

export default function HomepageIntro({ isDarkMode }: { isDarkMode: boolean }) {
  const [isTypingDone, setIsTypingDone] = useState(false);
  const logoVariants = {
    hidden: { scale: 2, opacity: 0, y: -50 },
    visible: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
        duration: 0.5,
      },
    },
  };

  return (
    <section className="relative overflow-hidden px-4 py-16 md:px-8 md:py-24">
      <div className="container relative z-10 mx-auto h-[400px] overflow-hidden">
        <div
          className="absolute inset-0 animate-scroll-vertical"
          style={{
            backgroundImage: "url('/images/background_sundai.svg')",
            backgroundSize: '300px auto',
            backgroundRepeat: 'repeat',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 50%, transparent)',
            maskImage:
              'linear-gradient(to bottom, transparent, black 50%, transparent)',
          }}
        />

        <motion.div
          className="relative z-20 mb-8 w-full text-center"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <h1
            className={`mb-6 font-space-mono text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            Sundai
          </h1>
          <p
            className={`mx-auto mb-8 max-w-xl font-fira-code text-base sm:text-lg md:text-xl ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Building &amp; Launching AI Prototypes Every Sunday.
          </p>

          <div
            className={`mx-auto mb-12 grid max-w-lg grid-cols-1 items-center gap-4 rounded-xl p-4 sm:grid-cols-3 sm:p-6 ${
              isDarkMode
                ? 'bg-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]'
                : 'bg-gray-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]'
            }`}
          >
            <motion.div
              className="relative flex items-center justify-center rounded-lg p-2 sm:p-4"
              variants={logoVariants}
              initial="hidden"
              animate={isTypingDone ? 'visible' : 'hidden'}
              transition={{ delay: 0.2 }}
            >
              <Image
                src="/images/affiliations/mit_logo_std_rgb_silver-gray.svg"
                style={{ filter: 'brightness(1.2)' }}
                className="h-16 w-16 opacity-90 sm:h-24 sm:w-24"
                alt="Logo MIT"
                width={96}
                height={96}
              />
            </motion.div>
            <div
              className={`h-full rounded-lg px-2 py-1 text-center font-mono text-base sm:mt-8 sm:px-4 sm:py-2 sm:text-xl ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              <Typewriter
                onInit={typewriter => {
                  typewriter
                    .changeDelay(70)
                    .typeString('We are builders from')
                    .callFunction(() => setIsTypingDone(true))
                    .start();
                }}
              />
            </div>
            <motion.div
              className="relative flex items-center justify-center rounded-lg p-2 sm:p-4"
              variants={logoVariants}
              initial="hidden"
              animate={isTypingDone ? 'visible' : 'hidden'}
              transition={{ delay: 0.4 }}
            >
              <Image
                src="/images/affiliations/harvard-university-seeklogo.svg"
                className="h-14 w-14 opacity-90 sm:h-20 sm:w-20"
                style={{ filter: 'grayscale(100%)' }}
                alt="Logo Harvard"
                width={80}
                height={80}
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
