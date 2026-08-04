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
        /**
         * Primary. Navigation and buttons, per the brand spec: Deep Blue
         * #1565C0. The darker steps are for hover and for text that needs more
         * weight; white on the default clears AA at 5.75:1.
         */
        marine: {
          DEFAULT: '#1565C0',
          700: '#0D47A1',
          600: '#1565C0',
          500: '#1976D2',
          100: themed('chip'),
        },
        /**
         * Secondary actions, per the brand spec: Teal #00897B. White text on
         * that step measures 4.32:1, just under AA for body size, so filled
         * teal buttons use the 600 step at 5.32:1 and the spec value is kept
         * for accents, icons and rules where nothing sits on top of it.
         */
        coolant: {
          DEFAULT: '#00897B',
          50: themed('accent-soft'),
          100: '#B2DFDB',
          200: '#80CBC4',
          600: '#00796B',
          700: '#00695C',
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
        'brand-sweep': 'linear-gradient(105deg, #00897B 0%, #0F79A8 48%, #1565C0 100%)',
        // Sidebar: deep blue at the top, settling into teal at the base.
        'brand-column': 'linear-gradient(180deg, #1565C0 0%, #0F79A8 45%, #00897B 100%)',
        // Decorative layers for the band: two soft lights and a fine dot grid.
        'brand-glow':
          'radial-gradient(60rem 22rem at 12% -40%, rgba(255,255,255,0.30), transparent 60%), radial-gradient(38rem 20rem at 88% 130%, rgba(255,255,255,0.20), transparent 60%)',
        'dot-grid': 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
        // A pale wash so a white card is never quite flat.
        'card-sheen':
          'linear-gradient(180deg, rgb(var(--sheen-a)) 0%, rgb(var(--sheen-b)) 62%, rgb(var(--sheen-c)) 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(38, 50, 56, 0.04), 0 1px 3px rgba(38, 50, 56, 0.07)',
        lift: '0 10px 26px -6px rgba(38, 50, 56, 0.18), 0 3px 8px rgba(38, 50, 56, 0.08)',
        sheet: '0 -4px 24px rgba(38, 50, 56, 0.14)',
        tile: '0 1px 2px rgba(38, 50, 56, 0.06), 0 6px 16px -6px rgba(38, 50, 56, 0.14)',
        // Coloured glows so an icon chip sits *on* the card rather than in it.
        'glow-blue': '0 6px 16px -4px rgba(21, 101, 192, 0.45)',
        'glow-teal': '0 6px 16px -4px rgba(0, 137, 123, 0.45)',
        'glow-green': '0 6px 16px -4px rgba(21, 128, 61, 0.42)',
        'glow-amber': '0 6px 16px -4px rgba(217, 119, 6, 0.40)',
        'glow-copper': '0 6px 16px -4px rgba(193, 105, 79, 0.40)',
        'glow-slate': '0 6px 16px -4px rgba(90, 107, 128, 0.35)',
      },
    },
  },
  plugins: [],
}
