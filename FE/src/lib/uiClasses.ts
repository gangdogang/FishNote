export function chipClass(active: boolean) {
  return [
    'inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-3.25 py-1.75 text-body-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
    active ? 'bg-primary text-on-primary hover:bg-primary-hover' : 'bg-chipbg text-ink hover:text-accent',
  ].join(' ');
}

export function inputClass(hasError: boolean) {
  return [
    'block w-full rounded-btn border bg-mist px-3 py-2.5 text-base text-ink outline-none transition placeholder:text-ink-mute focus:border-accent focus-visible:ring-2 focus-visible:ring-focus xl:text-body-sm',
    hasError ? 'border-red-600 dark:border-red-400' : 'border-control-border',
  ].join(' ');
}
