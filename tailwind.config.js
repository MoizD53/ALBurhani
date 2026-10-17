/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        sidebar: 'hsl(var(--sidebar) / <alpha-value>)',
        'sidebar-border': 'hsl(var(--sidebar-border) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        text: 'hsl(var(--text) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)', 
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)', 
        },
        border: 'hsl(var(--border) / <alpha-value>)', 
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E5C158',
          dark: '#C9A227',
          muted: '#B8962E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37, #E5C158)',
        'gold-gradient-reverse': 'linear-gradient(135deg, #E5C158, #D4AF37)',
        'accent-gradient': 'linear-gradient(135deg, #D4AF37, #C9A227)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'premium': '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,175,55,0.05) inset',
        'premium-hover': '0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(212,175,55,0.08)',
        'glass': '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,175,55,0.03) inset',
        'gold': '0 4px 12px rgba(212,175,55,0.1)',
        'gold-hover': '0 8px 24px rgba(212,175,55,0.15)',
        'gold-glow': '0 0 16px rgba(212,175,55,0.08), 0 0 32px rgba(212,175,55,0.03)',
      }
    },
  },
  plugins: [],
}
