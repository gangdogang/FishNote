import type { ReactNode } from 'react';

interface InfoPageLayoutProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}

export default function InfoPageLayout({ eyebrow, title, description, children }: InfoPageLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-9 sm:px-7 sm:pt-12">
      <header className="mb-8 border-b border-line pb-7">
        {eyebrow ? <p className="mb-2 mt-0 text-13 font-bold text-accent">{eyebrow}</p> : null}
        <h1 className="m-0 text-28 font-extrabold tracking-[-0.03em] text-ink sm:text-[32px]">{title}</h1>
        <p className="mb-0 mt-3 max-w-[640px] text-15 leading-[1.75] text-ink-mute">{description}</p>
      </header>
      <div className="grid gap-7 text-14.5 leading-[1.8] text-ink">{children}</div>
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 mt-0 text-18 font-extrabold text-ink">{title}</h2>
      <div className="text-ink-mute [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_li+li]:mt-1.5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
