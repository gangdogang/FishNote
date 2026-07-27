import { cloneElement, type AriaAttributes, type ReactElement, type ReactNode } from 'react';

interface FieldControlProps {
  id?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  helper?: ReactNode;
  htmlFor: string;
  children: ReactElement<FieldControlProps>;
}

export function Field({ label, error, helper, htmlFor, children }: FieldProps) {
  const helperId = helper ? `${htmlFor}-helper` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = mergeIds(children.props['aria-describedby'], helperId, errorId);
  const control = cloneElement(children, {
    id: htmlFor,
    'aria-invalid': error ? true : (children.props['aria-invalid'] ?? false),
    'aria-describedby': describedBy,
  });

  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-[5px] block text-xs font-bold text-ink-mute">
        {label}
      </label>
      {control}
      {helper ? <p id={helperId} className="m-0 mt-1 text-xs leading-snug text-ink-mute">{helper}</p> : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="m-0 mt-1 text-13 font-medium leading-snug text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function mergeIds(...ids: Array<string | undefined>) {
  const uniqueIds = [...new Set(ids.flatMap((id) => id?.split(/\s+/).filter(Boolean) ?? []))];
  return uniqueIds.length > 0 ? uniqueIds.join(' ') : undefined;
}
