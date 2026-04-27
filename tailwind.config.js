/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    // Override border-radius entirely — angles droits partout
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      full: '9999px', // perforations + boutons radio uniquement
    },
    extend: {
      colors: {
        bg:      '#F5F5F5',
        surface: '#FFFFFF',
        ink:     '#000000',
        muted:   '#737373',
        line:    '#E5E5E5',
        urgent:  '#FF0000',
      },
      fontFamily: {
        serif: ["'Fraunces'", 'Georgia', 'serif'],
        sans:  ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono:  ["'DM Mono'", 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
