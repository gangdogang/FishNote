import { StrictMode, useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModalDialog from './ModalDialog';

function ModalHarness({ panelClassName }: { panelClassName?: string }) {
  const [open, setOpen] = useState(false);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        필터 열기
      </button>
      <button type="button">외부 작업</button>
      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        title="검색 필터"
        initialFocusRef={firstActionRef}
        panelClassName={panelClassName}
      >
        <p>필터 내용을 선택하세요.</p>
        <button ref={firstActionRef} type="button">첫 번째</button>
        <button type="button">두 번째</button>
        <button type="button">마지막</button>
      </ModalDialog>
    </>
  );
}

function NestedModalHarness() {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  const childOpenerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <ModalDialog
        open={parentOpen}
        onClose={() => setParentOpen(false)}
        title="부모 대화상자"
      >
        <button
          ref={childOpenerRef}
          type="button"
          onClick={() => setChildOpen(true)}
        >
          자식 열기
        </button>
        <button type="button">부모 작업</button>
      </ModalDialog>
      <ModalDialog
        open={childOpen}
        onClose={() => setChildOpen(false)}
        title="자식 대화상자"
      >
        <button type="button">자식 작업</button>
      </ModalDialog>
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = '';
});

describe('ModalDialog', () => {
  it('닫혀 있으면 렌더링하지 않고, 열리면 native modal과 accessible title을 제공한다', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '필터 열기' }));

    const dialog = screen.getByRole('dialog', { name: '검색 필터' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).not.toHaveAttribute('aria-busy');
    expect(dialog).toHaveClass('h-dvh', 'max-h-[100dvh]');
    expect(screen.getByRole('heading', { name: '검색 필터' })).toHaveAttribute(
      'id',
      dialog.getAttribute('aria-labelledby'),
    );
    expect(dialog.firstElementChild).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
      'pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
    );
    expect(screen.getByRole('button', { name: '첫 번째' })).toHaveFocus();
  });

  it('외부로 이동한 focus를 회수하고 Tab과 Shift+Tab focus를 내부에서 순환시킨다', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: '필터 열기' }));
    const first = screen.getByRole('button', { name: '첫 번째' });
    const last = screen.getByRole('button', { name: '마지막' });

    expect(first).toHaveFocus();
    screen.getByRole('button', { name: '외부 작업' }).focus();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
  });

  it('Escape로 닫고 body scroll과 opener focus를 원래 상태로 복원한다', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'clip';
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: '필터 열기' });

    await user.click(opener);
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(opener).toHaveFocus();
  });

  it('closeDisabled이면 Escape, cancel, backdrop 닫기를 막지만 open=false 전환은 허용한다', () => {
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = '저장 시작';
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = 'clip';

    const modal = (open: boolean) => (
      <ModalDialog
        open={open}
        onClose={onClose}
        title="저장 중"
        closeDisabled
      >
        <button type="button">저장 상태</button>
      </ModalDialog>
    );
    const { rerender } = render(modal(true));
    const dialog = screen.getByRole('dialog', { name: '저장 중' });

    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(document.body.style.overflow).toBe('hidden');

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document, escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);

    const cancelEvent = new Event('cancel', { bubbles: true, cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();

    rerender(modal(false));
    expect(screen.queryByRole('dialog', { name: '저장 중' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('StrictMode와 중첩 modal에서도 최상위만 닫고 body lock과 opener focus를 보존한다', async () => {
    const user = userEvent.setup();
    const rootOpener = document.createElement('button');
    rootOpener.textContent = '루트 열기 버튼';
    document.body.append(rootOpener);
    rootOpener.focus();
    document.body.style.overflow = 'clip';

    render(
      <StrictMode>
        <NestedModalHarness />
      </StrictMode>,
    );

    const childOpener = screen.getByRole('button', { name: '자식 열기' });
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(childOpener);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '자식 대화상자' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '부모 대화상자' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(childOpener).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(rootOpener).toHaveFocus();
    rootOpener.remove();
  });

  it('panel 내부 click은 유지하고 backdrop click은 닫는다', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: '필터 열기' });

    await user.click(opener);
    await user.click(screen.getByText('필터 내용을 선택하세요.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('외부 titleId와 bottom-sheet panel class를 사용할 수 있고 focusable child가 없으면 panel에 focus한다', () => {
    const onClose = vi.fn();
    render(
      <ModalDialog
        open
        onClose={onClose}
        titleId="custom-sheet-title"
        panelClassName="max-h-[85dvh] w-full self-end rounded-t-card border border-line px-4 pb-safe pt-5"
      >
        <h2 id="custom-sheet-title">필터 선택</h2>
        <p>선택할 필터가 아직 없습니다.</p>
      </ModalDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: '필터 선택' });
    const panel = dialog.firstElementChild;
    expect(dialog).toHaveAttribute('aria-labelledby', 'custom-sheet-title');
    expect(panel).toHaveClass('self-end', 'w-full', 'rounded-t-card', 'pb-safe');
    expect(panel).toHaveFocus();
  });
});
