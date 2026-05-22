/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        '4.5': '1.125rem', // 18px — utilisé pour les checkboxes (w-4.5 h-4.5)
      },
      colors: {
        bg:       "#FAF7F1",
        surface:  "#FFFFFF",
        "surface-alt": "#F6F1E5",
        border:   "#E5DCC8",
        "border-soft": "#EFE7D2",
        tx:       "#1F1A10",
        "tx-muted":  "#6E624A",
        "tx-dim":    "#9C8E73",
        brand:    { DEFAULT: "#8B6F1F", dark: "#6E561A", soft: "#F0E6CA" },
        primary:  { DEFAULT: "#4A90C2", dark: "#326E9C", soft: "#DCEAF5" },
        success:  { DEFAULT: "#2F7D4A", soft: "#DDEBE0" },
        danger:   { DEFAULT: "#B23A3A", soft: "#F4DEDE" },
        warn:     { DEFAULT: "#C68B1A", soft: "#FBEFD0" },
        purple:   { DEFAULT: "#7B4F9E", soft: "#EDE5F5" },
      },
      fontFamily: {
        sans: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: {
        "2.5xl": "20px",
      },
    },
  },
  plugins: [],
};
