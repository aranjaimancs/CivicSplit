/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46BB',
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46BB',
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
        },
        app: {
          bg: '#F0F2F5',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        'card-md': '0 2px 8px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.08)',
        nav: '0 -1px 0 rgba(15, 23, 42, 0.06), 0 -8px 32px rgba(15, 23, 42, 0.06)',
        fab: '0 4px 14px rgba(79, 70, 187, 0.35), 0 2px 4px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
