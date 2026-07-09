import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  helper?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, error, helper, htmlFor, children }: FieldProps) {
  const LabelTag = htmlFor ? 'label' : 'span';

  return (
    <div className="block">
      <LabelTag htmlFor={htmlFor} className="mb-[5px] block text-xs font-bold text-ink-mute">
        {label}
      </LabelTag>
      {children}
      {helper ? <p className="m-0 mt-1 text-xs leading-snug text-ink-mute">{helper}</p> : null}
      {error ? <span className="mt-1 block text-[13px] font-medium leading-snug text-red-700">{error}</span> : null}
    </div>
  );
}

export function inputClass(hasError: boolean) {
  return [
    'block w-full rounded-[10px] border bg-mist px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-mute/70 focus:border-sea',
    hasError ? 'border-red-300' : 'border-line',
  ].join(' ');
}
