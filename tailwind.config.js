/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Page canvas — a cool off-white so white cards lift off it.
        frost: {
          DEFAULT: '#F1F5F9',
          deep: '#E3EAF3',
        },
        // Primary. Headings, sidebar top, primary actions.
        marine: {
          DEFAULT: '#173F6B',
          700: '#12365E',
          600: '#1E5591',
          500: '#2A6DB0',
          100: '#E8F0FA',
        },
        /**
         * Secondary. Aircon-cold teal: the company is called "Sejuk" — cool —
         * so the brand is the temperature it sells. Teal also keeps the chrome
         * clear of green, which is reserved below for "finished".
         */
        coolant: {
          DEFAULT: '#0E8C7B',
          50: '#E7F5F2',
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
          50: '#ECFAF0',
          600: '#12692F',
          700: '#0F5426',
        },
        // Muted body text and hairline borders.
        slate: {
          DEFAULT: '#5A6B80',
          light: '#8A99AC',
          line: '#DDE4ED',
        },
        copper: '#C1694F',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
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
        'card-sheen': 'linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 62%, #F5F8FC 100%)',
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
