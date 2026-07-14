import { FormEvent, useEffect, useRef, useState, type RefObject } from 'react';
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
  formRef?: RefObject<HTMLFormElement>;
  onSubmit: (request: ReviewRequest) => void;
}

const emptyForm: ReviewFormState = {
  nickname: '',
  rating: null,
  content: '',
  password: '',
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOAD_ERROR_MESSAGE = '사진 업로드에 실패했어요. 사진 없이 등록하거나 다시 시도해 주세요';

export default function ReviewForm({ submitting, error, resetKey, formRef, onSubmit }: ReviewFormProps) {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState<ReviewFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = submitting || uploading;
  const isMemberReview = Boolean(isAuthenticated && user);

  useEffect(() => {
    setForm(emptyForm);
    setFieldErrors({});
    setSelectedImage(null);
    setUploading(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const nextErrors = validateForm(form, isMemberReview);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});

    let imageUrl: string | null = null;
    if (selectedImage) {
      setUploading(true);
      try {
        const response = await uploadImage(selectedImage.file);
        imageUrl = response.url;
      } catch {
        setFieldErrors((prev) => ({ ...prev, image: UPLOAD_ERROR_MESSAGE }));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const request: ReviewRequest = {
      rating: form.rating,
      content: form.content.trim(),
      imageUrl,
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
          <Field label="닉네임" error={fieldErrors.nickname}>
            <input
              name="nickname"
              maxLength={30}
              value={form.nickname}
              placeholder="예: 회러버"
              aria-invalid={Boolean(fieldErrors.nickname)}
              onChange={(event) => updateField('nickname', event.target.value)}
              className={inputClass(Boolean(fieldErrors.nickname))}
            />
          </Field>
        ) : null}

        <Field label="별점 (선택)" error={fieldErrors.rating}>
          <div className="flex min-h-[42px] items-center gap-1" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((score) => {
              const selected = form.rating !== null && score <= form.rating;
              return (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={form.rating === score}
                  onClick={() => updateField('rating', form.rating === score ? null : score)}
                  className={[
                    'min-h-9 min-w-9 border-0 bg-transparent p-0 text-24 leading-none transition',
                    selected ? 'text-star' : 'text-line hover:text-star',
                  ].join(' ')}
                  aria-label={`${score}점`}
                >
                  ★
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mb-3">
        <Field label="후기" error={fieldErrors.content}>
          <textarea
            maxLength={1000}
            rows={4}
            value={form.content}
            placeholder="맛·식감·먹은 곳 분위기, 자유롭게 적어주세요"
            aria-invalid={Boolean(fieldErrors.content)}
            onChange={(event) => updateField('content', event.target.value)}
            className={[inputClass(Boolean(fieldErrors.content)), 'min-h-[96px] resize-y leading-[1.6]'].join(' ')}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <div>
          {!isMemberReview ? (
            <Field label="비밀번호" error={fieldErrors.password} helper="후기를 지울 때만 써요 (4자 이상)">
              <input
                minLength={4}
                maxLength={20}
                type="password"
                value={form.password}
                placeholder="4자 이상"
                aria-invalid={Boolean(fieldErrors.password)}
                onChange={(event) => updateField('password', event.target.value)}
                className={inputClass(Boolean(fieldErrors.password))}
              />
            </Field>
          ) : null}

          <div className={isMemberReview ? '' : 'mt-2'}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center rounded-btn border border-line bg-surface px-3 py-2 text-13 font-bold text-ink transition hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-ink-mute"
            >
              📷 사진 추가
            </button>

            {selectedImage ? (
              <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-btn border border-line bg-chipbg">
                <img src={selectedImage.previewUrl} alt="선택한 후기 사진 미리보기" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isBusy}
                  aria-label="사진 제거"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-black/60 text-xs font-bold leading-none text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {fieldErrors.image ? <span className="mt-1 block text-13 font-medium leading-snug text-red-700 dark:text-red-400">{fieldErrors.image}</span> : null}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {error ? <p className="m-0 text-13 font-medium leading-snug text-red-700 dark:text-red-400">{error}</p> : null}
          <button
            disabled={isBusy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-btn border-0 bg-sea px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sea-deep disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600 sm:w-auto"
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
