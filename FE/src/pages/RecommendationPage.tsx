import { Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import FishCard from '../components/FishCard';
import { ErrorState, SkeletonCards } from '../components/Skeletons';
import { useFishList } from '../hooks/useFish';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  rankRecommendations,
  type RecommendationBudget,
  type RecommendationOccasion,
  type RecommendationPreferences,
  type RecommendationTaste,
} from '../lib/recommendation';

const tasteOptions: Array<{ value: RecommendationTaste; label: string; copy: string }> = [
  { value: 'ANY', label: '상관없어요', copy: '폭넓게 골라볼게요' },
  { value: '담백', label: '담백한 맛', copy: '깔끔하고 은은하게' },
  { value: '고소', label: '고소한 맛', copy: '기름지고 풍성하게' },
  { value: '쫄깃', label: '쫄깃한 식감', copy: '씹는 맛이 또렷하게' },
  { value: '부드러운', label: '부드러운 식감', copy: '입안에서 편안하게' },
];

const budgetOptions: Array<{ value: RecommendationBudget; label: string; copy: string }> = [
  { value: 'ANY', label: '가격 무관', copy: '취향을 먼저 볼게요' },
  { value: 1, label: '가볍게', copy: '비교적 부담 없는 가격' },
  { value: 2, label: '적당하게', copy: '가격과 만족의 균형' },
  { value: 3, label: '제대로', copy: '특별한 날의 고급 횟감' },
];

const occasionOptions: Array<{ value: RecommendationOccasion; label: string; copy: string }> = [
  { value: 'ANY', label: '오늘 기분대로', copy: '전체 조건을 균형 있게' },
  { value: 'BEGINNER', label: '처음 먹어요', copy: '친숙하고 실패 적은 선택' },
  { value: 'SEASONAL', label: '제철이 중요해요', copy: '지금 맛있는 횟감 우선' },
  { value: 'ADVENTURE', label: '새로운 걸 원해요', copy: '평소와 다른 별미 도전' },
];

export default function RecommendationPage() {
  usePageMeta('오늘 뭐 먹지?', '맛·가격·상황에 맞는 오늘의 횟감을 추천받아 보세요.');
  const [searchParams, setSearchParams] = useSearchParams();
  const [preferences, setPreferences] = useState<RecommendationPreferences>(() => readPreferences(searchParams));
  const [submitted, setSubmitted] = useState(() => searchParams.has('result'));
  const currentMonth = new Date().getMonth() + 1;
  const { data: fishes = [], isLoading, isError, refetch } = useFishList({ sort: 'popular' });
  const recommendations = useMemo(
    () => rankRecommendations(fishes, preferences, currentMonth),
    [fishes, preferences, currentMonth],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      result: '1',
      taste: String(preferences.taste),
      budget: String(preferences.budget),
      occasion: preferences.occasion,
    });
    setSearchParams(params, { replace: true });
    setSubmitted(true);
    window.requestAnimationFrame(() => document.getElementById('recommendation-results')?.focus());
  }

  function reset() {
    setPreferences({ taste: 'ANY', budget: 'ANY', occasion: 'ANY' });
    setSubmitted(false);
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-8 sm:px-7">
      <header className="mx-auto max-w-[760px] text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] bg-accent-soft text-accent">
          <Sparkles className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="m-0 text-30 font-extrabold tracking-[-0.035em] text-ink">오늘 뭐 먹지?</h1>
        <p className="mx-auto mb-0 mt-2 max-w-[580px] text-14.5 leading-[1.65] text-ink-mute">
          세 가지만 알려주면 현재 제철과 도감 정보를 함께 보고 잘 맞는 횟감을 골라드려요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto mt-8 grid max-w-[900px] gap-5" aria-label="횟감 추천 조건">
        <ChoiceGroup
          step="01"
          legend="어떤 맛을 좋아하세요?"
          name="taste"
          value={preferences.taste}
          options={tasteOptions}
          onChange={(taste) => setPreferences((previous) => ({ ...previous, taste }))}
        />
        <ChoiceGroup
          step="02"
          legend="예산은 어느 정도인가요?"
          name="budget"
          value={preferences.budget}
          options={budgetOptions}
          onChange={(budget) => setPreferences((previous) => ({ ...previous, budget }))}
        />
        <ChoiceGroup
          step="03"
          legend="오늘은 어떤 자리인가요?"
          name="occasion"
          value={preferences.occasion}
          options={occasionOptions}
          onChange={(occasion) => setPreferences((previous) => ({ ...previous, occasion }))}
        />

        <button
          type="submit"
          disabled={isLoading || isError}
          className="mx-auto inline-flex min-h-12 w-full max-w-[360px] items-center justify-center gap-2 rounded-btn bg-primary px-6 py-3 text-[15px] font-extrabold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          내 취향 횟감 추천받기
        </button>
      </form>

      {isLoading ? <SkeletonCards count={3} className="mx-auto mt-10 grid max-w-[900px] gap-5 sm:grid-cols-3" /> : null}
      {isError ? <div className="mx-auto mt-10 max-w-[900px]"><ErrorState onRetry={() => void refetch()} /></div> : null}

      {submitted && !isLoading && !isError ? (
        <section id="recommendation-results" tabIndex={-1} className="mt-12 scroll-mt-24 focus:outline-none">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="m-0 text-caption font-extrabold tracking-[0.12em] text-accent">TODAY'S PICKS</p>
              <h2 className="m-0 mt-1 text-24 font-extrabold tracking-[-0.025em] text-ink">오늘 잘 맞는 횟감 3가지</h2>
            </div>
            <button type="button" onClick={reset} className="min-h-11 self-start px-1 text-body-sm font-bold text-ink-mute transition hover:text-accent">
              조건 다시 고르기
            </button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((recommendation, index) => (
              <div key={recommendation.fish.id} className="min-w-0">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="text-13 font-extrabold text-accent">추천 {index + 1}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {recommendation.reasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-chipbg px-2 py-1 text-caption font-bold text-ink-mute">{reason}</span>
                    ))}
                  </div>
                </div>
                <FishCard fish={recommendation.fish} analyticsSection="recommendation" analyticsPosition={index + 1} />
              </div>
            ))}
          </div>
          {recommendations.length > 1 ? (
            <div className="mt-7 text-center">
              <Link
                to={`/compare?fish=${recommendations.map(({ fish }) => fish.id).join(',')}`}
                className="inline-flex min-h-11 items-center justify-center rounded-btn border border-accent bg-surface px-5 py-2.5 text-body-sm font-extrabold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                추천 횟감 한눈에 비교하기
              </Link>
            </div>
          ) : null}
          <p className="mx-auto mb-0 mt-6 max-w-[680px] text-center text-caption leading-[1.6] text-ink-mute">
            추천은 도감의 대표 제철·맛·가격 정보를 기준으로 한 참고용이에요. 실제 상태는 산지와 유통 환경에 따라 달라질 수 있어요.{' '}
            <Link to="/sources" className="font-bold text-accent">정보 출처 보기</Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ChoiceGroup<Value extends string | number>({
  step,
  legend,
  name,
  value,
  options,
  onChange,
}: {
  step: string;
  legend: string;
  name: string;
  value: Value;
  options: Array<{ value: Value; label: string; copy: string }>;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="m-0 rounded-card border border-line bg-surface p-4 sm:p-5">
      <legend className="px-1 text-[17px] font-extrabold text-ink">
        <span className="mr-2 text-13 font-black tracking-[0.08em] text-accent">{step}</span>
        {legend}
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={[
                'relative flex min-h-[76px] cursor-pointer flex-col justify-center rounded-[14px] border px-3.5 py-3 transition focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2',
                checked ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-mist text-ink hover:border-accent/45',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-body-sm font-extrabold">{option.label}</span>
              <span className={checked ? 'mt-1 text-caption leading-snug text-accent/80' : 'mt-1 text-caption leading-snug text-ink-mute'}>{option.copy}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function readPreferences(params: URLSearchParams): RecommendationPreferences {
  const taste = params.get('taste');
  const budget = params.get('budget');
  const occasion = params.get('occasion');
  return {
    taste: tasteOptions.some((option) => String(option.value) === taste) ? taste as RecommendationTaste : 'ANY',
    budget: budgetOptions.find((option) => String(option.value) === budget)?.value ?? 'ANY',
    occasion: occasionOptions.some((option) => option.value === occasion) ? occasion as RecommendationOccasion : 'ANY',
  };
}
