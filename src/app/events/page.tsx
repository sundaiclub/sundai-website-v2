"use client";

import { useTheme } from "../contexts/ThemeContext";
import { motion } from "framer-motion";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useEffect, useState } from "react";

export default function EventsPage() {
  const { isDarkMode } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  
  usePullToRefresh();

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const calendarSrc = isMobile 
    ? "https://calendar.google.com/calendar/embed?src=b9608c51d87848d30aa6ab36d64932f9216fffc976e34873df715dc7d240b68b%40group.calendar.google.com&ctz=America%2FNew_York&mode=AGENDA"
    : "https://calendar.google.com/calendar/embed?src=b9608c51d87848d30aa6ab36d64932f9216fffc976e34873df715dc7d240b68b%40group.calendar.google.com&ctz=America%2FNew_York";

  return (
    <div
      className={`min-h-screen ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-black text-gray-100"
          : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-800"
      } font-space-mono`}
    >
      <section className="relative py-16 md:py-24 lg:py-26 px-4 md:px-8 overflow-hidden">
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4 font-space-mono">
              Upcoming Events
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto">
              Join us for our upcoming events and activities. Stay connected with the Sundai community!
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="calendar-container w-full overflow-hidden rounded-lg shadow-lg"
          >
            <div className={`w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-lg`}>
              <iframe 
                src={calendarSrc}
                style={{ border: 0 }} 
                width="100%" 
                height={isMobile ? "500" : "700"} 
                frameBorder="0" 
                scrolling="no"
                title="Sundai Events Calendar"
                className="w-full rounded-lg"
              ></iframe>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <p className="text-lg mb-4">
              Want to add our events to your personal calendar?
            </p>
            <a 
              href="https://calendar.google.com/calendar/u/0?cid=Yjk2MDhjNTFkODc4NDhkMzBhYTZhYjM2ZDY0OTMyZjkyMTZmZmZjOTc2ZTM0ODczZGY3MTVkYzdkMjQwYjY4YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t" 
              className={`inline-block px-6 py-3 rounded-full ${
                isDarkMode 
                  ? 'bg-indigo-600 hover:bg-indigo-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white font-medium transition duration-300`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
} 