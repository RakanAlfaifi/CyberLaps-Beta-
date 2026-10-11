import type { Config } from "tailwindcss";

/**
 * CyberLaps design tokens.
 * Dark mode only. Base background: #0B0F19.
 *
 * Color meaning (keep this consistent everywhere in the UI):
 *  - emerald : success, valid response, open port
 *  - blue    : activity, packets moving, selection
 *  - amber   : warning, misdirection, timeout
 *  - red     : error, rejected, RST
 */
const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds and surfaces
        void: "#0B0F19",
        surface: {
          DEFAULT: "#111827",
          raised: "#161E2E",
          overlay: "#1B2437",
        },
        line: {
          DEFAULT: "#1F2A3D",
          strong: "#2C3B55",
        },

        // Text
        ink: {
          DEFAULT: "#E5E7EB",
          muted: "#9CA3AF",
          faint: "#6B7280",
        },

        // Neon accents
        emerald: {
          neon: "#10B981",
          dim: "#065F46",
          glow: "#34D399",
        },
        cyber: {
          blue: "#3B82F6",
          dim: "#1E3A8A",
          glow: "#60A5FA",
        },
        amber: {
          neon: "#F59E0B",
          dim: "#78350F",
          glow: "#FBBF24",
        },
        danger: {
          neon: "#EF4444",
          dim: "#7F1D1D",
          glow: "#F87171",
        },
      },

      fontFamily: {
        sans: ['"Inter Variable"', "Inter", '"Cairo Variable"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },

      boxShadow: {
        "glow-emerald": "0 0 12px rgba(16, 185, 129, 0.45)",
        "glow-blue": "0 0 12px rgba(59, 130, 246, 0.45)",
        "glow-amber": "0 0 12px rgba(245, 158, 11, 0.45)",
        "glow-red": "0 0 12px rgba(239, 68, 68, 0.45)",
        panel: "0 0 0 1px #1F2A3D, 0 8px 24px rgba(0, 0, 0, 0.45)",
      },

      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.06) 1px, transparent 1px)",
        // The Visual Stage's diorama backdrop: a cool key light from the upper left, violet and teal fills, a deep floor.
        "stage-ambient":
          "radial-gradient(45% 55% at 18% 18%, rgba(139,92,246,0.14), transparent 70%), radial-gradient(50% 60% at 86% 84%, rgba(6,182,212,0.11), transparent 70%), radial-gradient(120% 95% at 50% 32%, #1a2747 0%, #111a2f 48%, #090d17 100%)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },

      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "type-in": {
          "0%": { opacity: "0", transform: "translateX(-4px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        scan: "scan 6s linear infinite",
        "fade-in-up": "fade-in-up 0.35s ease-out both",
        float: "float 6s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "spin-slow": "spin 6s linear infinite",
        "type-in": "type-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
