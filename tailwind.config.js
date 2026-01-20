/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // The ** glob handles all subfolders like 'utilities'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
