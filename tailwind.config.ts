import type { Config } from 'tailwindcss';

// Design tokens ported 1:1 from project/Flore Atelie.dc.html (Claude Design prototype).
// Do not "improve" these — the palette/type system was already validated with the client.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Briefing palette
        moss: '#6B7C5C',       // verde musgo escuro (hero bg, accents)
        cream: '#FAF7F2',      // off-white creme (page background)
        terracotta: '#C4836A', // terracota suave (CTAs, accents, errors-as-warmth)
        blush: '#E8C4B8',      // rosa pó (success icons, highlights)
        // Extended palette actually used throughout the prototype
        forest: '#4B5740',     // primary text/button green (darker than "moss")
        'forest-dark': '#3A3F32', // footer / darkest surface
        beige: '#F3EDE3',      // secondary section background
        'beige-deep': '#EFE6D8',
        border: '#D8CFC0',     // input/card borders
        muted: '#7C7F6D',      // body copy, secondary text
        'muted-2': '#8A8D7C',
        'muted-3': '#5C5F51',
        faint: '#A7AB97',      // placeholders, char counters
        warn: '#F6E9D3',       // cutoff/notice banner background
        'warn-text': '#8C3B2C',
        'error-bg': '#FBE3E0',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Work Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        petalPop: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.8s ease both',
        petalPop: 'petalPop 0.3s ease both',
      },
    },
  },
  plugins: [],
};

export default config;
