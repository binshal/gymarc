import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        acc: "#e11d48",   // crimson — energy / PRs
        acc2: "#059669",  // emerald — on-track / positive
      },
    },
  },
  plugins: [],
};
export default config;
