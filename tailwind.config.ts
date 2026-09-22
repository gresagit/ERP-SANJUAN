import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: { 950: "#0d2b29", 900: "#123c39", 700: "#1f5d5b", 500: "#357a76", 100: "#dbeae7" },
        sand: { 50: "#faf7f1", 100: "#f2ecdf", 200: "#e6dcc6" },
        ochre: { 500: "#b9832f", 600: "#9c6c25" },
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
