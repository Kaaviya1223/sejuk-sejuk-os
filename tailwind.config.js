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
        // Accent. Field-service green — sidebar base, success, active nav.
        coolant: {
          DEFAULT: '#3E9B6B',
          50: '#EDF7F1',
          100: '#D8EDE2',
          200: '#A9D9BE',
          600: '#348A5D',
          700: '#2A724C',
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
        // The dashboard band: green at the near edge, blue at the far one.
        'brand-sweep': 'linear-gradient(105deg, #3E9B6B 0%, #2E7FA8 52%, #2A6DB0 100%)',
        // Sidebar: blue at the top, settling into green at the base.
        'brand-column': 'linear-gradient(180deg, #1E5591 0%, #2E7FA8 38%, #3E9B6B 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 63, 107, 0.04), 0 1px 3px rgba(23, 63, 107, 0.07)',
        lift: '0 4px 14px rgba(23, 63, 107, 0.10)',
        sheet: '0 -4px 24px rgba(23, 63, 107, 0.14)',
        tile: '0 1px 2px rgba(23, 63, 107, 0.06), 0 4px 10px rgba(23, 63, 107, 0.06)',
      },
    },
  },
  plugins: [],
}
