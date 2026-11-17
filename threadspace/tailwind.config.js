/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral greys (the "sand" name is kept so existing screens re-theme automatically)
        sand: { 50: '#f5f5f5', 100: '#ebebeb', 200: '#dadada', 300: '#bababa', 500: '#636363', 700: '#262626' },
      },
      fontFamily: {
        display: ['Archivo', 'Arial Narrow', 'Arial', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
