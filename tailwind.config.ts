import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mackinac: ['"P22 Mackinac Pro"', "serif"],
        montserrat: ['"Montserrat"', "sans-serif"],
        "space-mono": ['"Space Mono"', "monospace"],
        "fira-code": ['"Fira Code"', "monospace"],
      },
      fontSize: {
        xs: "0.6rem",
        sm: "0.7rem",
        base: "0.8rem",
        lg: "0.9rem",
        xl: "1rem",
        "2xl": "1.125rem",
        "3xl": "1.35rem",
        "4xl": "1.7rem",
        "5xl": "2rem",
        "6xl": "2.75rem",
      },
      colors: {
        indigo: {
          600: "#4f46e5",
          700: "#4338ca",
          900: "#312e81",
        },
      },
      animation: {
        "slide-left": "slideLeft 1s ease-out",
        "fade-in": "fadeIn 1s ease-out",
        "scroll-vertical": "scroll-vertical 15s linear infinite",
      },
      keyframes: {
        slideLeft: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scroll-vertical": {
          "0%": { "background-position": "50% 0%" },
          "100%": { "background-position": "50% 200%" },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            // Override all spacing
            '--tw-prose-body': 'inherit',
            '--tw-prose-headings': 'inherit',
            '--tw-prose-lead': 'inherit',
            '--tw-prose-links': '#4f46e5',
            '--tw-prose-bold': 'inherit',
            '--tw-prose-counters': 'inherit',
            '--tw-prose-bullets': 'inherit',
            '--tw-prose-hr': 'inherit',
            '--tw-prose-quotes': 'inherit',
            '--tw-prose-quote-borders': 'inherit',
            '--tw-prose-captions': 'inherit',
            '--tw-prose-code': 'inherit',
            '--tw-prose-pre-code': 'inherit',
            '--tw-prose-pre-bg': 'inherit',
            '--tw-prose-th-borders': 'inherit',
            '--tw-prose-td-borders': 'inherit',
            

            // Reset spacing
            '> *': {
              marginTop: '0.5em !important',
              marginBottom: '0.5em !important',
            },

            // Individual element styles
            p: {
              fontFamily: '"Arial", sans-serif',
              fontSize: '1rem',
              marginTop: '0.5em !important',
              marginBottom: '0.5em !important',
            },
            'h1, h2, h3, h4': {
              marginTop: '1em !important',
              marginBottom: '0.5em !important',
            },
            h1: {
              color: 'inherit',
              fontSize: '2.0rem !important',
            },
            h2: {
              color: 'inherit',
              fontSize: '1.3rem !important',
            },
            h3: {
              color: 'inherit',
              fontSize: '1.2rem !important',
            },
            h4: {
              color: 'inherit',
              fontSize: '0.9rem !important',
            },
            'ol, ul': {
              fontSize: '1rem !important',
              marginTop: '0.5em !important',
              marginBottom: '0.5em !important',
              paddingLeft: '1em !important',
            },
            li: {
              fontSize: '1rem !important',
              marginTop: '0.2em !important',
              marginBottom: '0.2em !important',
            },
            'li > *': {
              marginTop: '0 !important',
              marginBottom: '0 !important',
            },

            // Apply Montserrat font to all elements within prose
            fontFamily: '"Montserrat", sans-serif',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-scrollbar')
  ],
  darkMode: "class", // Enable dark mode
};

// Montserrat font classes

export default config;
