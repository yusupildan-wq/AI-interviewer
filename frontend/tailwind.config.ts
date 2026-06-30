import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#08090b',
        surface: '#131519',
        ink: '#f3f4f6',
        graphite: '#9aa1ac',
        slatewash: '#1b1e24',
        signal: '#2dd4bf',
        amberline: '#fbbf24',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(45, 212, 191, 0.15), 0 8px 24px -8px rgba(45, 212, 191, 0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        eq: {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
        blink: {
          '0%, 92%, 100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.1)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
      },
      animation: {
        eq: 'eq 0.9s ease-in-out infinite',
        blink: 'blink 4.5s ease-in-out infinite',
        breathe: 'breathe 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
