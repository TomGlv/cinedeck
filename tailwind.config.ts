import type { Config } from "tailwindcss";

/** One accent (hot rose) on deep black; rarity colours (violet, amber, fuchsia...) stay Tailwind's own. */
const accent = {
  50: "#fff1f4",
  100: "#ffe0e7",
  200: "#ffc2d1",
  300: "#ff93ae",
  400: "#ff5c86",
  500: "#f72d64",
  600: "#e0124f",
  700: "#bc0a41",
  800: "#9c0c3c",
  900: "#850f39",
  950: "#4b031b",
};

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent,
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-geist-sans)", "sans-serif"],
      },
      transitionTimingFunction: {
        // Every `transition` utility settles like a spring instead of easing linearly
        DEFAULT: "cubic-bezier(0.32, 0.72, 0, 1)",
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        DEFAULT: "300ms",
      },
    },
  },
  plugins: [],
};
export default config;
