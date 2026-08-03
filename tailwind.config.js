/** @type {import('tailwindcss').Config} */
/**
 * Semantic tokens are CSS variables so light and dark are one set of class
 * names, not two. `rgb(var(--x) / <alpha-value>)` keeps opacity modifiers
 * (`bg-surface/60`) working. Brand hues that must not change between themes —
 * the blues, teal and success green — stay as literals below.
 */
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Card surface. Not `white`, because in dark mode it isn't.
        surface: themed('surface'),
        // Primary text.
        ink: themed('ink'),
        // Card headings and text-weight brand accents.
        brand: themed('brand'),
        // Page canvas — a cool off-white so cards lift off it.
        frost: {
          DEFAULT: themed('canvas'),
          deep: themed('subtle'),
        },
        // Primary. Headings, sidebar top, primary actions.
        marine: {
          DEFAULT: '#173F6B',
          700: '#12365E',
          600: '#1E5591',
          500: '#2A6DB0',
          100: themed('chip'),
        },
        /**
         * Secondary. Aircon-cold teal: the company is called "Sejuk" — cool —
         * so the brand is the temperature it sells. Teal also keeps the chrome
         * clear of green, which is reserved below for "finished".
         */
        coolant: {
          DEFAULT: '#0E8C7B',
          50: themed('accent-soft'),
          100: '#CDEAE5',
          200: '#9BD6CD',
          600: '#0B7466',
          700: '#095C51',
        },
        /**
         * Success. Used *only* where something is complete — the finish button
         * and the closed state. Nothing decorative may wear it, or it stops
         * meaning anything.
         */
        success: {
          DEFAULT: '#15803D',
          50: themed('success-soft'),
          600: '#12692F',
          700: '#0F5426',
        },
        // Muted body text and hairline borders.
        slate: {
          DEFAULT: themed('muted'),
          light: themed('faint'),
          line: themed('line'),
        },
        copper: '#C1694F',
      },
      fontFamily: {
        /**
         * One typeface. Headings previously used a geometric display face,
         * whose flat-topped 1 and perfectly round 0 read as stylised on an
         * order number — the thing staff read most. Hierarchy comes from
         * weight, size and tracking instead.
         */
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Reserved for text that really is code — table names, file paths.
        // Identifiers and money use the body sans with `tabular-nums` instead,
        // which aligns in columns without reading like a terminal.
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        // The dashboard band: teal at the near edge, deep blue at the far one.
        'brand-sweep': 'linear-gradient(105deg, #0E8C7B 0%, #157B90 48%, #1E5591 100%)',
        // Sidebar: deep blue at the top, settling into teal at the base.
        'brand-column': 'linear-gradient(180deg, #1E5591 0%, #157B90 45%, #0E8C7B 100%)',
        // Decorative layers for the band: two soft lights and a fine dot grid.
        'brand-glow':
          'radial-gradient(60rem 22rem at 12% -40%, rgba(255,255,255,0.30), transparent 60%), radial-gradient(38rem 20rem at 88% 130%, rgba(255,255,255,0.20), transparent 60%)',
        'dot-grid': 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
        // A pale wash so a white card is never quite flat.
        'card-sheen':
          'linear-gradient(180deg, rgb(var(--sheen-a)) 0%, rgb(var(--sheen-b)) 62%, rgb(var(--sheen-c)) 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 63, 107, 0.04), 0 1px 3px rgba(23, 63, 107, 0.07)',
        lift: '0 10px 26px -6px rgba(23, 63, 107, 0.18), 0 3px 8px rgba(23, 63, 107, 0.08)',
        sheet: '0 -4px 24px rgba(23, 63, 107, 0.14)',
        tile: '0 1px 2px rgba(23, 63, 107, 0.06), 0 6px 16px -6px rgba(23, 63, 107, 0.14)',
        // Coloured glows so an icon chip sits *on* the card rather than in it.
        'glow-blue': '0 6px 16px -4px rgba(42, 109, 176, 0.45)',
        'glow-teal': '0 6px 16px -4px rgba(14, 140, 123, 0.45)',
        'glow-green': '0 6px 16px -4px rgba(21, 128, 61, 0.42)',
        'glow-amber': '0 6px 16px -4px rgba(217, 119, 6, 0.40)',
        'glow-copper': '0 6px 16px -4px rgba(193, 105, 79, 0.40)',
        'glow-slate': '0 6px 16px -4px rgba(90, 107, 128, 0.35)',
      },
    },
  },
  plugins: [],
}
