/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46BB',
          50:  '#EEEDFB',
          100: '#D9D7F6',
          200: '#B3AFED',
          300: '#8D88E4',
          400: '#6760DB',
          500: '#4F46BB',
          600: '#3F37A0',
          700: '#302A80',
          800: '#211D5F',
          900: '#130F3A',
        },
        app: {
          bg: '#F3F2FF',       // warm lavender — on-brand, not cold gray
          surface: '#FAFAFE',  // card surface hint
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:        '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(79,70,187,0.08)',
        'card-lift': '0 2px 8px rgba(0,0,0,0.06), 0 20px 48px rgba(79,70,187,0.13)',
        nav:         '0 -1px 0 rgba(0,0,0,0.05), 0 -8px 24px rgba(79,70,187,0.09)',
        fab:         '0 4px 20px rgba(79,70,187,0.48), 0 1px 4px rgba(15,23,42,0.12)',
        header:      '0 8px 32px rgba(79,70,187,0.22)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-in':    'fade-in 0.22s ease both',
        'slide-up':   'slide-up 0.28s cubic-bezier(0.34,1.2,0.64,1) both',
        'slide-up-sm':'slide-up-sm 0.22s ease both',
        'shimmer':    'shimmer 1.6s linear infinite',
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-up-sm': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
