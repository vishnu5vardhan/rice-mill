import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17201a",
        field: "#f6f4ed",
        grain: "#e6d9ad",
        leaf: "#3f6b4b",
        rust: "#a45238",
        skywash: "#d9e6e9"
      },
      boxShadow: {
        soft: "0 10px 28px rgba(23, 32, 26, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
