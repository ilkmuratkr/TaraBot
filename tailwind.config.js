/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#dce4fd',
          300: '#c2d0fb',
          400: '#9db3f8',
          500: '#7891f5',
          600: '#5672ea',
          700: '#4257d6',
          800: '#3545af',
          900: '#2d3c8c',
          950: '#1e2353',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 