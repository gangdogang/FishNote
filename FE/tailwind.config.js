/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 실제 색값은 src/index.css의 CSS 변수(:root / .dark)에서 정의 — 다크모드 대응
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          hover: 'rgb(var(--c-accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)'
        },
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          hover: 'rgb(var(--c-primary-hover) / <alpha-value>)'
        },
        'on-primary': 'rgb(var(--c-on-primary) / <alpha-value>)',
        'hero-surface': 'rgb(var(--c-hero-surface) / <alpha-value>)',
        'on-hero': 'rgb(var(--c-on-hero) / <alpha-value>)',
        focus: 'rgb(var(--c-focus) / <alpha-value>)',
        'control-border': 'rgb(var(--c-control-border) / <alpha-value>)',
        sea: {
          DEFAULT: 'rgb(var(--c-sea) / <alpha-value>)',
          soft: 'rgb(var(--c-sea-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-sea-deep) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          mute: 'rgb(var(--c-ink-mute) / <alpha-value>)'
        },
        mist: 'rgb(var(--c-mist) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        chipbg: 'rgb(var(--c-chipbg) / <alpha-value>)',
        star: 'rgb(var(--c-star) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)'
      },
      borderRadius: {
        card: '14px',
        btn: '10px'
      },
      maxWidth: {
        content: '980px'
      },
      spacing: {
        '1.75': '7px',
        '3.25': '13px',
        '4.5': '18px',
        '5.5': '22px'
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        lead: ['1.125rem', { lineHeight: '1.65rem' }],
        title: ['1.75rem', { lineHeight: '2.125rem' }],
        // px 고정 타이포 스케일 — 임의값(text-[13px] 등) 대신 사용
        10: '10px',
        11: '11px',
        12.5: '12.5px',
        13: '13px',
        14: '14px',
        14.5: '14.5px',
        15: '15px',
        17: '17px',
        18: '18px',
        19: '19px',
        20: '20px',
        24: '24px',
        28: '28px',
        30: '30px'
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'Noto Sans KR',
          'sans-serif'
        ]
      }
    }
  },
  plugins: [],
};
