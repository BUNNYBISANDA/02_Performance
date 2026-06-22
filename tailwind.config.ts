import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#061321",
          900: "#07182d",
          850: "#0a2038",
          800: "#0f2d48",
        },
        command: {
          cyan: "#11b7d9",
          teal: "#0f9f8f",
          steel: "#5f7795",
          mist: "#eef7fb",
          paper: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["Aptos", "Segoe UI Variable", "Segoe UI", "sans-serif"],
        display: ["Aptos Display", "Aptos", "Segoe UI Variable", "sans-serif"],
      },
      boxShadow: {
        card: "0 14px 34px rgba(15, 45, 72, 0.08)",
        lift: "0 18px 44px rgba(7, 24, 45, 0.16)",
      },
      backgroundImage: {
        "command-grid":
          "linear-gradient(rgba(17,183,217,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(17,183,217,0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
