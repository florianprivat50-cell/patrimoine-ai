/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: { light: "#fcfcfb", dark: "#1a1a19" },
        page: { light: "#f9f9f7", dark: "#0d0d0d" },
        ink: {
          DEFAULT: "#0b0b0b",
          secondary: "#52514e",
          muted: "#898781",
          darkprimary: "#ffffff",
          darksecondary: "#c3c2b7",
        },
        accent: { DEFAULT: "#2a78d6", dark: "#3987e5" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
