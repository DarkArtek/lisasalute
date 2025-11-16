/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}", // Dice a Tailwind di "guardare" tutti i file Vue e JS
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}