/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        table: {
          dark: "#0f172a", // Dark slate background
          felt: "#0b3c5d",  // Premium blue felt color
          border: "#b89742" // Gold border color
        },
        card: {
          red: "#ef4444",
          black: "#1e293b",
          gold: "#eab308"
        }
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "sans-serif"]
      },
      animation: {
        'deal-card': 'deal 0.5s ease-out forwards',
        'flip-card': 'flip 0.3s ease-in-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        deal: {
          '0%': { transform: 'translateY(-100px) scale(0.5) rotate(-20deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: '1' },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        }
      }
    },
  },
  plugins: [],
}
