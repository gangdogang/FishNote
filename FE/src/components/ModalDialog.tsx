import {
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const defaultPanelClassName =
  'max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100%-2rem-env(safe-area-inset-left)-env(safe-area-inset-right))] max-w-[520px] rounded-card border border-line px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_20px_50px_rgba(26,43,51,0.22)]';

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';
const openDialogStack: HTMLDialogElement[] = [];

interface ModalDialogBaseProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  descriptionId?: string;
  closeDisabled?: boolean;
}

type ModalDialogLabelProps =
  | { title: string; titleId?: never }
  | { title?: never; titleId: string };

export type ModalDialogProps = ModalDialogBaseProps & ModalDialogLabelProps;

export default function ModalDialog({
  open,
  onClose,
  title,
  titleId,
  children,
  panelClassName = defaultPanelClassName,
  initialFocusRef,
  descriptionId,
  closeDisabled = false,
}: ModalDialogProps) {
  const generatedTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const lastFocusedInsideRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const resolvedTitleId = titleId ?? generatedTitleId;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeDisabledRef.current = closeDisabled;
  }, [closeDisabled]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    const activeDialog = dialog;
    const activePanel = panel;

    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    openNativeDialog(dialog);
    const unregisterDialog = registerOpenDialog(dialog);
    const unlockBodyScroll = lockBodyScroll();

    const requestedInitialFocus = initialFocusRef?.current;
    const focusTarget = requestedInitialFocus
      && panel.contains(requestedInitialFocus)
      && isAvailableFocusTarget(requestedInitialFocus)
      ? requestedInitialFocus
      : getFocusableElements(panel)[0] ?? panel;
    lastFocusedInsideRef.current = focusTarget;
    focusTarget.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (event.defaultPrevented || !isTopmostDialog(activeDialog)) return;
        event.preventDefault();
        if (!closeDisabledRef.current) onCloseRef.current();
        return;
      }

      if (
        event.key !== 'Tab'
        || event.defaultPrevented
        || !isTopmostDialog(activeDialog)
      ) return;

      const focusableElements = getFocusableElements(activePanel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        activePanel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeIndex === focusableElements.length - 1) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isTopmostDialog(activeDialog)) return;

      const focusTarget = event.target;
      if (focusTarget instanceof HTMLElement && activePanel.contains(focusTarget)) {
        lastFocusedInsideRef.current = focusTarget;
        return;
      }

      const previousFocus = lastFocusedInsideRef.current;
      const fallbackFocus = previousFocus
        && activePanel.contains(previousFocus)
        && isAvailableFocusTarget(previousFocus)
        ? previousFocus
        : getFocusableElements(activePanel)[0] ?? activePanel;
      fallbackFocus.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      unregisterDialog();
      unlockBodyScroll();
      closeNativeDialog(dialog);
      lastFocusedInsideRef.current = null;

      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocusRef, open]);

  if (!open || typeof document === 'undefined') return null;

  function handleBackdropClick(event: ReactMouseEvent<HTMLDialogElement>) {
    if (
      event.target === event.currentTarget
      && isTopmostDialog(event.currentTarget)
      && !closeDisabledRef.current
    ) onCloseRef.current();
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={resolvedTitleId}
      aria-describedby={descriptionId}
      aria-busy={closeDisabled || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (
          isTopmostDialog(event.currentTarget)
          && !closeDisabledRef.current
        ) onCloseRef.current();
      }}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[90] m-0 h-dvh min-h-0 max-h-[100dvh] w-full max-w-none items-center justify-center overflow-hidden border-0 bg-ink/45 p-0 open:flex backdrop:bg-transparent"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'relative min-h-0 max-w-full touch-pan-y overflow-y-auto overscroll-contain scroll-pb-[calc(1rem+env(safe-area-inset-bottom))] bg-surface text-ink focus:outline-none',
          panelClassName,
        ].join(' ')}
      >
        {title ? (
          <h2 id={resolvedTitleId} className="m-0 mb-4 text-20 font-extrabold leading-snug text-ink">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

function registerOpenDialog(dialog: HTMLDialogElement) {
  const existingIndex = openDialogStack.indexOf(dialog);
  if (existingIndex >= 0) openDialogStack.splice(existingIndex, 1);
  openDialogStack.push(dialog);

  return () => {
    const index = openDialogStack.lastIndexOf(dialog);
    if (index >= 0) openDialogStack.splice(index, 1);
  };
}

function isTopmostDialog(dialog: HTMLDialogElement) {
  return openDialogStack[openDialogStack.length - 1] === dialog;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && isAvailableFocusTarget(element));
}

function isAvailableFocusTarget(element: HTMLElement) {
  return !element.hidden
    && !element.matches(':disabled')
    && element.getAttribute('aria-hidden') !== 'true'
    && element.closest('[hidden], [inert]') === null;
}

function openNativeDialog(dialog: HTMLDialogElement) {
  if (dialog.open) return;

  try {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      return;
    }
  } catch {
    // Environments without a complete dialog implementation use the open fallback.
  }

  dialog.setAttribute('open', '');
}

function closeNativeDialog(dialog: HTMLDialogElement) {
  if (!dialog.open) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;

  return () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeLock;
      bodyOverflowBeforeLock = '';
    }
  };
}
