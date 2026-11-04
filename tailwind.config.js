/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#10131B',
        deck: '#161A24',
        deck2: '#1D2230',
        line: '#2A3142',
        ink: '#E9EDF6',
        mute: '#8C94A9',
        volt: '#2E8BFF',
        voltsoft: '#9CC8FF',
        flare: '#FF8A1F',
        ok: '#35D69B',
        bad: '#FF4D61',
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        body: ['"Manrope"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
