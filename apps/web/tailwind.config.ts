import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Geist', 'Arial', 'sans-serif'] },
      colors: {
        brand: { 50: '#f1f7f1', 100: '#e0eee2', 200: '#c2dfc8', 300: '#94c7a1', 400: '#62a875', 500: '#438856', 600: '#2e7042', 700: '#245a36', 800: '#21482f', 900: '#1c3b29', 950: '#10261a' },
        slate: { 50: '#f7f8f6', 100: '#f0f2ee', 200: '#e0e5dd', 300: '#cbd2c7', 400: '#899586', 500: '#647060', 600: '#505e4e', 700: '#3c483c', 800: '#2c372d', 900: '#202b24', 950: '#151e19' },
      },
    },
  },
  plugins: [],
};

export default config;
