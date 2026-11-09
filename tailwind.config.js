import typography from "@tailwindcss/typography";

/** Your site's design tokens (from site.json) as Tailwind colors and fonts. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {
    "colors": {
      "bg": "rgb(var(--c-bg) / <alpha-value>)",
      "surface": "rgb(var(--c-surface) / <alpha-value>)",
      "ink": "rgb(var(--c-ink) / <alpha-value>)",
      "muted": "rgb(var(--c-muted) / <alpha-value>)",
      "line": "rgb(var(--c-line) / <alpha-value>)",
      "primary": {
        "DEFAULT": "rgb(var(--c-primary) / <alpha-value>)",
        "ink": "rgb(var(--c-primary-ink) / <alpha-value>)"
      },
      "accent": "rgb(var(--c-accent) / <alpha-value>)"
    },
    "fontFamily": {
      "display": [
        "var(--font-display)"
      ],
      "body": [
        "var(--font-body)"
      ],
      "sans": [
        "var(--font-body)"
      ],
      "mono": [
        "var(--font-mono)"
      ]
    },
    "borderRadius": {
      "theme": "var(--radius)"
    },
    "borderColor": {
      "DEFAULT": "rgb(var(--c-line) / <alpha-value>)"
    },
    "maxWidth": {
      "page": "80rem"
    }
  } },
  plugins: [typography],
};
