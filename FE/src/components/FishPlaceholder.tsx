interface FishPlaceholderProps {
  className?: string;
}

export default function FishPlaceholder({ className = '' }: FishPlaceholderProps) {
  return (
    <svg viewBox="0 0 64 40" fill="none" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M2 20 C16 3, 42 3, 52 20 C42 37, 16 37, 2 20 Z" />
      <path d="M50 20 L63 9 L63 31 Z" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  );
}
