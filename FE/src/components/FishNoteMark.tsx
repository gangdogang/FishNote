import type { SVGProps } from 'react';

export default function FishNoteMark({
  className = '',
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-fishnote-mark
      {...props}
    >
      <path
        d="M3.8 16c3.1-5 7.6-7.8 12.7-7.5 3 .2 5.6 1.4 7.5 3.2l4.2-2.6v13.8L24 20.3c-1.9 1.8-4.5 3-7.5 3.2C11.4 23.8 6.9 21 3.8 16Z"
        fill="currentColor"
        fillOpacity="0.13"
      />
      <path
        d="M3.8 16c3.1-5 7.6-7.8 12.7-7.5 3 .2 5.6 1.4 7.5 3.2l4.2-2.6v13.8L24 20.3c-1.9 1.8-4.5 3-7.5 3.2C11.4 23.8 6.9 21 3.8 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10.2 12.8h7M9.3 16h8.8M10.2 19.2h7" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="21.1" cy="13.2" r="1.25" fill="currentColor" />
    </svg>
  );
}
