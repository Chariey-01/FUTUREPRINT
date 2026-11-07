/** FUTUREPRINT design tokens. Pathway "ink" shades are the text-safe (WCAG AA on ivory) variants. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#17243B',
          950: '#0D1524',
          900: '#121D31',
          800: '#17243B',
          700: '#24365A',
          600: '#3A4F7A',
        },
        ivory: {
          DEFAULT: '#EDE7DD',
          50: '#FAF8F4',
          100: '#F4F0E9',
          200: '#EDE7DD',
          300: '#DDD3C3',
          400: '#BFB3A0',
        },
        adapt: { DEFAULT: '#A99BCB', soft: '#E7E1F2', ink: '#54457F' },
        transform: { DEFAULT: '#E7A18F', soft: '#F8E3DC', ink: '#8C3F2B' },
        discover: { DEFAULT: '#8DB89B', soft: '#DCEBE0', ink: '#2E5B3E' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'Segoe UI', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,36,59,0.06), 0 8px 24px -12px rgba(23,36,59,0.18)',
        lift: '0 2px 4px rgba(23,36,59,0.08), 0 18px 40px -18px rgba(23,36,59,0.35)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
