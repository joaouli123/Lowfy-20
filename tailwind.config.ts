import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

// Escala verde esmeralda oficial da marca Lowfy (guia de tokens do sistema).
// 50/100/200/600/700/800 vêm dos valores exatos do guia (tint/tint2/hover2/DEFAULT/hover/dark);
// 300-500 e 900 são interpolados para completar a rampa exigida pelo HeroUI.
// Espelha as CSS vars --primary/--primary-hover/--primary-dark/--primary-tint* em client/src/index.css.
const primary = {
  50: "#eef7f3",
  100: "#d8ebe1",
  200: "#cfe6da",
  300: "#a7ccbb",
  400: "#7fb29c",
  500: "#57987d",
  600: "#2f7d5c",
  700: "#266a4d",
  800: "#1f5640",
  900: "#184233",
  950: "#0f2a20",
};

export default {
  darkMode: ["class"],
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Radii dedicados do guia de tokens (uso explícito: rounded-card, rounded-btn, etc.)
        card: "var(--radius-card)",
        btn: "var(--radius-btn)",
        "btn-sm": "var(--radius-btn-sm)",
        tile: "var(--radius-tile)",
        modal: "var(--radius-modal)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        floating: "var(--shadow-floating)",
      },
      backgroundImage: {
        "auth-gradient": "var(--auth-gradient)",
      },
      colors: {
        dark: {
          700: "#1a1a1a",
          800: "#121212",
          900: "#0a0a0a",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Fundos adicionais do guia de tokens
        app: "var(--bg-app)",
        "card-soft": "var(--bg-card-soft)",
        // Escala de texto adicional do guia (corpo/label, parágrafo, meta, desabilitado)
        body: "var(--text-body)",
        faint: "var(--faint)",
        disabled: "var(--disabled)",
        // Borda secundária (sidebar/topbar/tags) e divisores de menu
        hairline: "var(--border-2)",
        divider: "var(--divider)",
        amber: {
          from: "var(--amber-from)",
          to: "var(--amber-to)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "gradient-shift": {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gradient-shift": "gradient-shift 15s ease infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              ...primary,
              DEFAULT: primary[600],
              foreground: "#ffffff",
            },
          },
        },
        dark: {
          colors: {
            primary: {
              ...primary,
              DEFAULT: primary[500],
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
  ],
} satisfies Config;
