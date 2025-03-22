'use client';

import { useEffect, useState } from 'react';

export default function GuidePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-white">Guide to Sundai</h1>
        <div className="relative w-full bg-gray-800 rounded-lg overflow-hidden shadow-xl" style={{ paddingTop: '56.25%' }}>
          <iframe
            src="https://docs.google.com/presentation/d/1SMAR0z1u4Z30uDnnRmE6Obahn1bRnTaOvZhtrrtwdpg/embed?start=false&loop=false&delayms=3000"
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            allowFullScreen
            title="Guide to Sundai"
          />
        </div>
      </div>
    </div>
  );
} 