import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0d12',
          900: '#0f131a',
          800: '#161b24',
          700: '#1f2530',
          600: '#2a3140',
          500: '#3a4356',
          400: '#5b6578',
          300: '#8891a3',
          200: '#c2c8d4',
          100: '#e7e9ee',
          50: '#f5f6f8'
        },
        accent: {
          DEFAULT: '#3d6bff',
          dim: '#2748b0',
          bright: '#6d8fff'
        },
        severity: {
          critical: '#e5484d',
          high: '#f5a623',
          medium: '#e8c33a',
          low: '#7fb8e6',
          info: '#8891a3',
          pass: '#2fb872'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
