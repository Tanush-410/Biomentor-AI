const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.zinc,
        secondary: colors.neutral,
        success: colors.zinc,
        warning: colors.stone,
        error: colors.zinc,
      }
    },
  },
  plugins: [],
}
