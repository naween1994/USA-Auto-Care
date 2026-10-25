/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#111c35',
          900: '#0b1325',
          950: '#060b16',
        },
        brandRed: {
          500: '#e11d48',
          600: '#be123c',
          700: '#9f1239',
        },
      },
    },
  },
  plugins: [],
};
