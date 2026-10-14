/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        sidebar: {
          DEFAULT: '#0B132B',
          hover: '#1C2541',
          active: '#2563eb',
          text: '#94A3B8',
          textActive: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
