export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#1E5EFF',
        'accent-dark': '#1749CC',
        navy: '#0F1629',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
