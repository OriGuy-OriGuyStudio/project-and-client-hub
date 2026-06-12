import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ["Kaha", "Heebo", "Arial Hebrew", "sans-serif"],
        body: ["Diplomat", "Heebo", "Arial Hebrew", "sans-serif"],
        sans: ["Diplomat", "Heebo", "Arial Hebrew", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // Studio brand scales (raw palette)
        brand: {
          purple: {
            light: "var(--brand-purple-light)",
            base: "var(--brand-purple-base)",
            dark: "var(--brand-purple-dark)",
          },
          green: {
            light: "var(--brand-green-light)",
            base: "var(--brand-green-base)",
            dark: "var(--brand-green-dark)",
          },
          cyan: {
            light: "var(--brand-cyan-light)",
            base: "var(--brand-cyan-base)",
            dark: "var(--brand-cyan-dark)",
          },
        },
        // shadcn semantic tokens (HSL-free, mapped to brand hex via CSS vars)
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
        },
        // Status / alert helpers (theme-aware)
        success: "var(--success)",
        warning: "var(--warning)",
        info: "var(--info)",
        link: "var(--link)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Tinted to the brand ink (never pure black), soft falloff.
        soft: "0 1px 2px var(--shadow-1), 0 6px 20px -6px var(--shadow-2)",
        lift: "0 2px 6px var(--shadow-1), 0 16px 36px -10px var(--shadow-2)",
      },
      transitionTimingFunction: {
        // Gentle, slightly-overshooting ease — feels hand-tuned, not linear.
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
