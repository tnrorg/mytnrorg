/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // TNR brand palette — Dark Green, Gold, White, Black
        tnr: {
          // Existing names kept so the 39 live pages keep working unchanged.
          green:      '#0B3D2E', // deep forest green (primary)
          green2:     '#12603F', // mid green
          greenLight: '#1E7A52',
          gold:       '#C9A227', // brand gold
          goldLight:  '#E4C25B',
          black:      '#0A0F0C',
          ink:        '#0E1A14',
          cream:      '#F7F5EE',
          line:       'rgba(201,162,39,0.18)',

          // ── Design-system ramp (new) ──
          // Use these going forward; they match lib/design/tokens.js and the
          // CSS custom properties, so JS, CSS and utilities never disagree.
          950: '#062D21',
          900: '#0A3D2C',
          800: '#0F5138',
          700: '#176B49',
          'gold-500': '#C89A2B',
          'gold-400': '#D7AE4A',
          snow:     '#F8FAF8',
          neutral:  '#F1F4F2',
          charcoal: '#17211C',
          muted:    '#647169',
        },
      },
      fontFamily: {
        sans: ['var(--font-mulish)', 'Mulish', 'system-ui', 'sans-serif'],
        mulish: ['var(--font-mulish)', 'Mulish', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      borderRadius: {
        'tnr-sm': '0.5rem', 'tnr': '0.875rem', 'tnr-lg': '1.25rem', 'tnr-xl': '1.75rem',
      },
      transitionDuration: {
        micro: '150ms', standard: '250ms', reveal: '450ms',
      },
      maxWidth: {
        'tnr': '1280px',      // standard content container
        'tnr-wide': '1440px', // dashboards and analytics
        'tnr-prose': '68ch',  // policy and editorial pages
      },
      boxShadow: {
        'gold': '0 10px 40px -12px rgba(201,162,39,0.45)',
        'card': '0 20px 50px -24px rgba(0,0,0,0.55)',
        'tnr-flat':  '0 1px 2px rgba(23,33,28,0.05)',
        'tnr-raise': '0 4px 12px -4px rgba(23,33,28,0.10)',
      },
      backgroundImage: {
        'tnr-radial': 'radial-gradient(1200px 600px at 50% -10%, rgba(30,122,82,0.35), transparent 60%)',
        'gold-line': 'linear-gradient(90deg, transparent, #C9A227, transparent)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'pop': { '0%': { transform: 'scale(0.92)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop': 'pop 0.35s ease-out both',
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
