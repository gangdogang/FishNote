import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Field } from './FormField';
import ModalDialog from './ModalDialog';
import { inputClass } from '../lib/uiClasses';
import { CLAIM_ORDER, claimTypeLabel } from '../lib/sourcePresentation';
import type { FishClaimType, FishCorrectionRequest } from '../types/source';

interface CorrectionDialogProps {
  open: boolean;
  fishName: string;
  initialClaimType: FishClaimType;
  submitting: boolean;
  serverError?: string;
  onClearError: () => void;
  onSubmit: (request: FishCorrectionRequest) => Promise<void>;
  onClose: () => void;
}

interface FormErrors {
  message?: string;
  sourceUrl?: string;
}

export default function CorrectionDialog({
  open,
  fishName,
  initialClaimType,
  submitting,
  serverError,
  onClearError,
  onSubmit,
  onClose,
}: CorrectionDialogProps) {
  const id = useId().replace(/:/g, '');
  const claimId = `${id}-claim`;
  const messageId = `${id}-message`;
  const sourceUrlId = `${id}-source-url`;
  const descriptionId = `${id}-description`;
  const claimRef = useRef<HTMLSelectElement>(null);
  const [claimType, setClaimType] = useState<FishClaimType>(initialClaimType);
  const [message, setMessage] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    // Each dialog opening is a new correction draft by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClaimType(initialClaimType);
    setMessage('');
    setSourceUrl('');
    setErrors({});
  }, [initialClaimType, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCorrection(message, sourceUrl);
    setErrors(nextErrors);
    if (nextErrors.message || nextErrors.sourceUrl) {
      window.requestAnimationFrame(() => {
        document.getElementById(nextErrors.message ? messageId : sourceUrlId)?.focus();
      });
      return;
    }

    await onSubmit({
      claimType,
      message: message.trim(),
      sourceUrl: sourceUrl.trim() || null,
    });
  }

  function changeField(update: () => void) {
    update();
    if (serverError) onClearError();
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`${fishName} 정보 오류 제보`}
      descriptionId={descriptionId}
      initialFocusRef={claimRef}
      closeDisabled={submitting}
    >
      <p id={descriptionId} className="m-0 mb-4 text-body-sm leading-relaxed text-ink-mute">
        개인정보는 받지 않습니다. 확인이 필요한 내용과 공개 원문이 있다면 함께 남겨주세요.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <Field label="제보할 정보" htmlFor={claimId}>
          <select
            ref={claimRef}
            value={claimType}
            onChange={(event) => changeField(() => setClaimType(event.target.value as FishClaimType))}
            disabled={submitting}
            className={inputClass(false)}
          >
            {CLAIM_ORDER.map((claim) => (
              <option key={claim} value={claim}>{claimTypeLabel(claim)}</option>
            ))}
          </select>
        </Field>

        <Field
          label="확인이 필요한 내용"
          htmlFor={messageId}
          error={errors.message}
          helper={`${message.length}/1000자`}
        >
          <textarea
            name="message"
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(event) => changeField(() => {
              setMessage(event.target.value);
              if (errors.message) setErrors((current) => ({ ...current, message: undefined }));
            })}
            disabled={submitting}
            placeholder="어떤 정보가 왜 잘못되었는지 알려주세요"
            className={`${inputClass(Boolean(errors.message))} min-h-32 resize-y`}
          />
        </Field>

        <Field
          label="근거 원문 URL (선택)"
          htmlFor={sourceUrlId}
          error={errors.sourceUrl}
          helper="http 또는 https 공개 링크만 입력할 수 있어요"
        >
          <input
            name="sourceUrl"
            type="url"
            inputMode="url"
            maxLength={2048}
            value={sourceUrl}
            onChange={(event) => changeField(() => {
              setSourceUrl(event.target.value);
              if (errors.sourceUrl) setErrors((current) => ({ ...current, sourceUrl: undefined }));
            })}
            disabled={submitting}
            placeholder="https://example.org/source"
            className={inputClass(Boolean(errors.sourceUrl))}
          />
        </Field>

        {serverError ? (
          <p role="alert" className="m-0 rounded-btn bg-red-50 px-3 py-2.5 text-body-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded-btn border border-line bg-surface px-5 text-body-sm font-bold text-ink transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded-btn bg-primary px-5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? '접수 중...' : '제보 접수'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

function validateCorrection(message: string, sourceUrl: string): FormErrors {
  const errors: FormErrors = {};
  const normalizedMessage = message.trim();
  const normalizedUrl = sourceUrl.trim();
  if (!normalizedMessage) errors.message = '확인이 필요한 내용을 입력해 주세요.';
  else if (normalizedMessage.length > 1000) errors.message = '내용은 1000자 이하로 입력해 주세요.';

  if (normalizedUrl) {
    if (normalizedUrl.length > 2048) {
      errors.sourceUrl = 'URL은 2048자 이하로 입력해 주세요.';
    } else {
      try {
        const parsed = new URL(normalizedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
          errors.sourceUrl = '사용자 정보가 없는 http 또는 https 공개 링크를 입력해 주세요.';
        }
      } catch {
        errors.sourceUrl = '올바른 공개 URL을 입력해 주세요.';
      }
    }
  }
  return errors;
}
