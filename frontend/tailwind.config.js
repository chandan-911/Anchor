/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f8fafc',
          dark: '#030712', // Linear-like deep dark
        },
        surface: {
          light: '#ffffff',
          dark: '#111827', // Card surface
        },
        primary: {
          DEFAULT: '#6366f1', // Indigo
          hover: '#4f46e5',
        },
        accent: {
          emerald: '#10b981', // Growth / Success
          violet: '#8b5cf6',   // Clarity / Vision
          rose: '#f43f5e',     // Stress / Threat
          amber: '#f59e0b',    // Warning / Risk
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
