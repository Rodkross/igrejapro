/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        church: {
          900: '#0f172a', // Navy profissional
          600: '#2563eb', // Blue destaque
        }
      }
    },
  },
  plugins: [],
}