import { Camera, X } from 'lucide-react';
import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { uploadImage } from '../api/image';
import { useAuth } from '../hooks/useAuth';
import type { ReviewRequest } from '../types/review';
import { inputClass } from '../lib/uiClasses';
import { Field } from './FormField';

type ReviewFormInputField = 'nickname' | 'rating' | 'content' | 'password';
type ReviewFormField = ReviewFormInputField | 'image';

interface ReviewFormState {
  nickname: string;
  rating: number | null;
  content: string;
  password: string;
}

type FieldErrors = Partial<Record<ReviewFormField, string>>;

interface SelectedImage {
  file: File;
  previewUrl: string;
}

interface ReviewFormProps {
  submitting: boolean;
  error?: string;
  resetKey: number;
  formRef?: RefObject<HTMLFormElement | null>;
  onSubmit: (request: ReviewRequest) => void;
}

const emptyForm: ReviewFormState = {
  nickname: '',
  rating: null,
  content: '',
  password: '',
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ACCEPTED_IMAGE_TYPES_ATTRIBUTE = [...ACCEPTED_IMAGE_TYPES].join(',');
const UPLOAD_ERROR_MESSAGE = '사진 업로드에 실패했어요. 사진 없이 등록하거나 다시 시도해 주세요';
const reviewFormFieldOrder: ReviewFormField[] = ['nickname', 'rating', 'content', 'password', 'image'];

export default function ReviewForm({ submitting, error, resetKey, formRef, onSubmit }: ReviewFormProps) {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState<ReviewFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ratingTabStop, setRatingTabStop] = useState(1);
  const idPrefix = useId();
  const nicknameId = `${idPrefix}-nickname`;
  const ratingLegendId = `${idPrefix}-rating-legend`;
  const ratingErrorId = fieldErrors.rating ? `${idPrefix}-rating-error` : undefined;
  const contentId = `${idPrefix}-content`;
  const passwordId = `${idPrefix}-password`;
  const imageId = `${idPrefix}-image`;
  const imageHelperId = `${imageId}-helper`;
  const imageErrorId = fieldErrors.image ? `${imageId}-error` : undefined;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const ratingButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = submitting || uploading;
  const isMemberReview = Boolean(isAuthenticated && user);

  useEffect(() => {
    // A resetKey change represents a different fish/review draft boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(emptyForm);
    setFieldErrors({});
    setSelectedImage(null);
    setUploading(false);
    setRatingTabStop(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetKey]);

  useEffect(() => {
    return () => {
      if (selectedImage) URL.revokeObjectURL(selectedImage.previewUrl);
    };
  }, [selectedImage]);

  function updateField<Field extends ReviewFormInputField>(field: Field, value: ReviewFormState[Field]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleImageSelect(file: File | undefined) {
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setSelectedImage(null);
      setFieldErrors((prev) => ({
        ...prev,
        image: 'JPG, PNG, 정적 GIF, 정적 WebP 사진만 올릴 수 있어요',
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setSelectedImage(null);
      setFieldErrors((prev) => ({ ...prev, image: '5MB 이하 사진만 올릴 수 있어요' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedImage({
      file,
      previewUrl: URL.createObjectURL(file),
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage() {
    setSelectedImage(null);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function focusField(field: ReviewFormField) {
    const target = {
      nickname: nicknameInputRef.current,
      rating: ratingButtonRefs.current[ratingTabStop - 1],
      content: contentInputRef.current,
      password: passwordInputRef.current,
      image: fileInputRef.current,
    }[field];
    target?.focus();
  }

  function handleRatingKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, score: number) {
    let nextScore: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextScore = score === 5 ? 1 : score + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextScore = score === 1 ? 5 : score - 1;
    if (event.key === 'Home') nextScore = 1;
    if (event.key === 'End') nextScore = 5;
    if (nextScore === undefined) return;

    event.preventDefault();
    setRatingTabStop(nextScore);
    updateField('rating', nextScore);
    ratingButtonRefs.current[nextScore - 1]?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const nextErrors = validateForm(form, isMemberReview);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstError = reviewFormFieldOrder.find((field) => nextErrors[field]);
      if (firstError) focusField(firstError);
      return;
    }

    setFieldErrors({});

    let imageUrl: string | null = null;
    let imageAssetId: string | null = null;
    if (selectedImage) {
      setUploading(true);
      try {
        const response = await uploadImage(selectedImage.file);
        imageUrl = response.url;
        imageAssetId = response.assetId;
      } catch {
        setFieldErrors((prev) => ({ ...prev, image: UPLOAD_ERROR_MESSAGE }));
        setUploading(false);
        fileInputRef.current?.focus();
        return;
      }
      setUploading(false);
    }

    const request: ReviewRequest = {
      rating: form.rating,
      content: form.content.trim(),
      imageUrl,
      imageAssetId,
    };

    if (!isMemberReview) {
      request.nickname = form.nickname.trim();
      request.password = form.password;
    }

    onSubmit(request);
  }

  return (
    <form
      ref={formRef}
      id="review-form"
      onSubmit={handleSubmit}
      noValidate
      className="mt-3.5 rounded-card border border-line bg-surface p-[18px]"
    >
      <h3 className="m-0 mb-3.5 text-15 font-bold text-ink">후기 남기기</h3>

      {isMemberReview && user ? <p className="m-0 mb-3 text-13 leading-snug text-ink-mute">{user.nickname} 님으로 남깁니다</p> : null}

      <div className={['mb-3 grid gap-3', isMemberReview ? '' : 'sm:grid-cols-2'].join(' ')}>
        {!isMemberReview ? (
          <Field label="닉네임" htmlFor={nicknameId} error={fieldErrors.nickname}>
            <input
              ref={nicknameInputRef}
              name="nickname"
              maxLength={30}
              value={form.nickname}
              placeholder="예: 회러버"
              onChange={(event) => updateField('nickname', event.target.value)}
              className={inputClass(Boolean(fieldErrors.nickname))}
            />
          </Field>
        ) : null}

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend id={ratingLegendId} className="mb-[5px] block p-0 text-xs font-bold text-ink-mute">
            별점 (선택)
          </legend>
          <div
            className="flex min-h-11 items-center gap-1"
            role="radiogroup"
            aria-labelledby={ratingLegendId}
            aria-invalid={Boolean(fieldErrors.rating)}
            aria-describedby={ratingErrorId}
          >
            {[1, 2, 3, 4, 5].map((score) => {
              const selected = form.rating !== null && score <= form.rating;
              return (
                <button
                  key={score}
                  id={`${idPrefix}-rating-${score}`}
                  ref={(node) => {
                    ratingButtonRefs.current[score - 1] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={form.rating === score}
                  tabIndex={ratingTabStop === score ? 0 : -1}
                  onClick={() => {
                    setRatingTabStop(score);
                    updateField('rating', form.rating === score ? null : score);
                  }}
                  onKeyDown={(event) => handleRatingKeyDown(event, score)}
                  className={[
                    'min-h-11 min-w-11 border-0 bg-transparent p-0 text-24 leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                    selected ? 'text-star' : 'text-control-border hover:text-star',
                  ].join(' ')}
                  aria-label={`${score}점`}
                >
                  ★
                </button>
              );
            })}
          </div>
          {fieldErrors.rating ? (
            <p
              id={ratingErrorId}
              role="alert"
              className="m-0 mt-1 text-13 font-medium leading-snug text-red-700 dark:text-red-400"
            >
              {fieldErrors.rating}
            </p>
          ) : null}
        </fieldset>
      </div>

      <div className="mb-3">
        <Field label="후기" htmlFor={contentId} error={fieldErrors.content}>
          <textarea
            ref={contentInputRef}
            name="content"
            maxLength={1000}
            rows={4}
            value={form.content}
            placeholder="맛·식감·먹은 곳 분위기, 자유롭게 적어주세요"
            onChange={(event) => updateField('content', event.target.value)}
            className={[inputClass(Boolean(fieldErrors.content)), 'min-h-[96px] resize-y leading-[1.6]'].join(' ')}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <div>
          {!isMemberReview ? (
            <Field
              label="비밀번호"
              htmlFor={passwordId}
              error={fieldErrors.password}
              helper="후기를 지울 때만 써요 (4자 이상)"
            >
              <input
                ref={passwordInputRef}
                name="password"
                minLength={4}
                maxLength={20}
                type="password"
                value={form.password}
                placeholder="4자 이상"
                onChange={(event) => updateField('password', event.target.value)}
                className={inputClass(Boolean(fieldErrors.password))}
              />
            </Field>
          ) : null}

          <div className={isMemberReview ? '' : 'mt-2'}>
            <input
              ref={fileInputRef}
              id={imageId}
              name="image"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES_ATTRIBUTE}
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.image)}
              aria-describedby={[imageHelperId, imageErrorId].filter(Boolean).join(' ')}
              className="peer sr-only"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
            />
            <label
              htmlFor={imageId}
              aria-disabled={isBusy}
              className={[
                'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-btn border border-line bg-surface px-3 py-2 text-body-sm font-bold text-ink transition peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-focus',
                isBusy
                  ? 'cursor-not-allowed bg-slate-100 text-ink-mute dark:bg-slate-800'
                  : 'hover:border-accent hover:text-accent',
              ].join(' ')}
            >
              <Camera className="h-4 w-4" aria-hidden />
              사진 추가
            </label>
            <p id={imageHelperId} className="m-0 mt-1 text-caption leading-snug text-ink-mute">
              JPG, PNG, 정적 GIF, 정적 WebP · 최대 5MB
            </p>

            {selectedImage ? (
              <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-btn border border-line bg-chipbg">
                <img src={selectedImage.previewUrl} alt="선택한 후기 사진 미리보기" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isBusy}
                  aria-label="사진 제거"
                  className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full border border-white bg-black/75 text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}

            {fieldErrors.image ? (
              <p
                id={imageErrorId}
                role="alert"
                className="m-0 mt-1 text-13 font-medium leading-snug text-red-700 dark:text-red-400"
              >
                {fieldErrors.image}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {error ? <p role="alert" className="m-0 text-13 font-medium leading-snug text-red-700 dark:text-red-400">{error}</p> : null}
          <button
            disabled={isBusy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-btn border-0 bg-primary px-5 py-2.5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600 sm:w-auto"
            type="submit"
          >
            {uploading ? '사진 올리는 중...' : submitting ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </form>
  );
}

function validateForm(form: ReviewFormState, isMemberReview: boolean) {
  const errors: FieldErrors = {};

  if (!isMemberReview && !form.nickname.trim()) errors.nickname = '닉네임을 입력해 주세요.';
  if (form.rating !== null && (form.rating < 1 || form.rating > 5)) errors.rating = '별점은 1~5점 중 선택해 주세요.';
  if (!form.content.trim()) errors.content = '후기를 입력해 주세요.';
  if (!isMemberReview && (form.password.length < 4 || form.password.length > 20)) errors.password = '비밀번호는 4~20자로 입력해 주세요.';

  return errors;
}
