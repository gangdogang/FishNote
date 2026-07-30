import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Fish,
  History,
  MessageSquareText,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import {
  createAdminFish,
  deleteAdminReview,
  getAdminCorrections,
  getAdminFishes,
  getAdminOverview,
  getAdminReviews,
  updateAdminCorrection,
  updateAdminFish,
  type AdminCorrection,
  type AdminFish,
  type AdminFishInput,
  type AdminReview,
  type CorrectionStatus,
} from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../hooks/useToast';
import { getErrorMessage } from '../lib/errors';
import type { FishCategory } from '../types/fish';

type AdminTab = 'overview' | 'catalog' | 'corrections' | 'reviews';
type CorrectionFilter = CorrectionStatus | 'ALL';

const adminQueryKey = ['admin'] as const;

export default function AdminPage() {
  usePageMeta('관리자', undefined, null, { noindex: true });
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { accessToken, user, isAuthLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [correctionFilter, setCorrectionFilter] = useState<CorrectionFilter>('PENDING');
  const isAdmin = user?.role === 'ADMIN';

  const overviewQuery = useQuery({
    queryKey: [...adminQueryKey, 'overview'],
    queryFn: getAdminOverview,
    enabled: isAdmin,
  });
  const fishesQuery = useQuery({
    queryKey: [...adminQueryKey, 'fishes'],
    queryFn: getAdminFishes,
    enabled: isAdmin,
  });
  const correctionsQuery = useQuery({
    queryKey: [...adminQueryKey, 'corrections', correctionFilter],
    queryFn: () => getAdminCorrections(correctionFilter === 'ALL' ? undefined : correctionFilter),
    enabled: isAdmin,
  });
  const reviewsQuery = useQuery({
    queryKey: [...adminQueryKey, 'reviews'],
    queryFn: getAdminReviews,
    enabled: isAdmin,
  });

  const fishMutation = useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AdminFishInput }) => (
      id ? updateAdminFish(id, input) : createAdminFish(input)
    ),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['fish'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ]);
      showToast(`${saved.name} 정보를 저장했습니다.`);
    },
  });

  const correctionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CorrectionStatus }) => (
      updateAdminCorrection(id, status)
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKey });
      showToast('제보 처리 상태를 변경했습니다.');
    },
  });

  const reviewDeleteMutation = useMutation({
    mutationFn: deleteAdminReview,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['fish'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ]);
      showToast('후기를 삭제했습니다.');
    },
  });

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAuthLoading || !user) {
    return <AdminLoading />;
  }

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  const overview = overviewQuery.data;
  const tabs: Array<{ id: AdminTab; label: string; icon: typeof ShieldCheck; badge?: number }> = [
    { id: 'overview', label: '운영 현황', icon: ShieldCheck },
    { id: 'catalog', label: '도감 관리', icon: Fish, badge: overview?.fishCount },
    {
      id: 'corrections',
      label: '오류 제보',
      icon: ClipboardList,
      badge: overview?.pendingCorrectionCount,
    },
    { id: 'reviews', label: '후기 관리', icon: MessageSquareText, badge: overview?.reviewCount },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-8 sm:px-7 sm:pt-11">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 mt-0 flex items-center gap-1.5 text-13 font-bold text-accent">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            ADMIN CONSOLE
          </p>
          <h1 className="m-0 text-30 font-extrabold tracking-[-0.035em] text-ink">FishNote 운영 관리</h1>
          <p className="mb-0 mt-2 text-14.5 leading-relaxed text-ink-mute">
            도감 콘텐츠와 사용자 제보를 한곳에서 안전하게 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-13 text-ink-mute">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          <strong className="text-ink">{user.nickname}</strong>
          관리자
        </div>
      </header>

      <nav
        aria-label="관리자 메뉴"
        className="mb-6 flex gap-1 overflow-x-auto rounded-card border border-line bg-surface p-1.5"
      >
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={[
              'inline-flex min-h-11 flex-none items-center gap-2 rounded-btn px-3.5 text-body-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              tab === id
                ? 'bg-primary text-on-primary'
                : 'bg-transparent text-ink-mute hover:bg-mist hover:text-accent',
            ].join(' ')}
          >
            <Icon className="h-[17px] w-[17px]" aria-hidden />
            {label}
            {badge !== undefined ? (
              <span
                className={[
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-11 font-extrabold',
                  tab === id ? 'bg-white/15 text-on-primary' : 'bg-chipbg text-ink-mute',
                ].join(' ')}
              >
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <OverviewPanel
          overview={overview}
          isLoading={overviewQuery.isLoading}
          error={overviewQuery.error}
          onNavigate={setTab}
        />
      ) : null}

      {tab === 'catalog' ? (
        <CatalogPanel
          fishes={fishesQuery.data ?? []}
          isLoading={fishesQuery.isLoading}
          error={fishesQuery.error}
          isSaving={fishMutation.isPending}
          saveError={fishMutation.error}
          onSave={(id, input) => fishMutation.mutateAsync({ id, input })}
        />
      ) : null}

      {tab === 'corrections' ? (
        <CorrectionsPanel
          corrections={correctionsQuery.data ?? []}
          filter={correctionFilter}
          isLoading={correctionsQuery.isLoading}
          error={correctionsQuery.error}
          actionError={correctionMutation.error}
          isUpdating={correctionMutation.isPending}
          onFilterChange={setCorrectionFilter}
          onUpdate={(id, status) => correctionMutation.mutateAsync({ id, status })}
        />
      ) : null}

      {tab === 'reviews' ? (
        <ReviewsPanel
          reviews={reviewsQuery.data ?? []}
          isLoading={reviewsQuery.isLoading}
          error={reviewsQuery.error}
          actionError={reviewDeleteMutation.error}
          deletingId={reviewDeleteMutation.isPending ? reviewDeleteMutation.variables : undefined}
          onDelete={(id) => reviewDeleteMutation.mutateAsync(id)}
        />
      ) : null}
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="mx-auto max-w-content px-4 pb-20 pt-12 text-body-sm text-ink-mute sm:px-7">
      관리자 권한을 확인하고 있어요...
    </div>
  );
}

function AdminAccessDenied() {
  return (
    <div className="mx-auto max-w-[620px] px-4 pb-24 pt-16 text-center sm:px-7">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <ShieldCheck className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="mb-2 mt-5 text-24 font-extrabold text-ink">관리자 권한이 필요합니다</h1>
      <p className="mx-auto mb-6 mt-0 max-w-md text-14.5 leading-relaxed text-ink-mute">
        이 계정에는 운영 관리 권한이 없습니다. 관리자 승격은 데이터베이스에서 명시적으로 진행해야 합니다.
      </p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center justify-center rounded-btn bg-primary px-5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        도감으로 돌아가기
      </Link>
    </div>
  );
}

interface OverviewPanelProps {
  overview: Awaited<ReturnType<typeof getAdminOverview>> | undefined;
  isLoading: boolean;
  error: unknown;
  onNavigate: (tab: AdminTab) => void;
}

function OverviewPanel({ overview, isLoading, error, onNavigate }: OverviewPanelProps) {
  if (isLoading) return <PanelLoading label="운영 현황을 불러오는 중" />;
  if (error || !overview) return <PanelError error={error} />;

  const cards = [
    { label: '등록 횟감', value: overview.fishCount, icon: Fish, tab: 'catalog' as const },
    { label: '대기 중 제보', value: overview.pendingCorrectionCount, icon: ClipboardList, tab: 'corrections' as const },
    { label: '전체 후기', value: overview.reviewCount, icon: MessageSquareText, tab: 'reviews' as const },
    { label: '가입 회원', value: overview.userCount, icon: Users },
  ];

  return (
    <div className="grid gap-6">
      <section aria-label="운영 지표" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tab }) => {
          const content = (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-accent-soft text-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="mt-5 block text-28 font-extrabold tracking-[-0.03em] text-ink">{value}</span>
              <span className="mt-1 block text-13 font-semibold text-ink-mute">{label}</span>
            </>
          );
          return tab ? (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(tab)}
              className="rounded-card border border-line bg-surface p-5 text-left transition hover:border-accent/40 hover:bg-accent-soft/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {content}
            </button>
          ) : (
            <div key={label} className="rounded-card border border-line bg-surface p-5">
              {content}
            </div>
          );
        })}
      </section>

      <section className="rounded-card border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4 sm:px-6">
          <History className="h-[18px] w-[18px] text-accent" aria-hidden />
          <h2 className="m-0 text-18 font-extrabold text-ink">최근 관리자 작업</h2>
        </div>
        {overview.recentActions.length > 0 ? (
          <ol className="m-0 divide-y divide-line p-0">
            {overview.recentActions.map((action) => (
              <li key={action.id} className="flex gap-3 px-5 py-4 sm:px-6">
                <span className="mt-1 h-2 w-2 flex-none rounded-full bg-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-body-sm font-semibold text-ink">{action.summary}</p>
                  <p className="mb-0 mt-1 text-caption text-ink-mute">
                    {action.actorNickname} · {formatDateTime(action.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={History} title="아직 관리자 작업이 없습니다" description="도감이나 제보를 수정하면 이곳에 기록됩니다." />
        )}
      </section>
    </div>
  );
}

interface CatalogPanelProps {
  fishes: AdminFish[];
  isLoading: boolean;
  error: unknown;
  isSaving: boolean;
  saveError: unknown;
  onSave: (id: number | undefined, input: AdminFishInput) => Promise<AdminFish>;
}

function CatalogPanel({ fishes, isLoading, error, isSaving, saveError, onSave }: CatalogPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(
    () => fishes.filter((fish) => (
      !normalizedSearch
      || fish.name.toLowerCase().includes(normalizedSearch)
      || fish.slug.toLowerCase().includes(normalizedSearch)
      || fish.aliases.some((alias) => alias.toLowerCase().includes(normalizedSearch))
    )),
    [fishes, normalizedSearch],
  );
  const selectedFish = selectedId === null
    ? undefined
    : fishes.find((fish) => fish.id === selectedId);

  if (isLoading) return <PanelLoading label="도감 목록을 불러오는 중" />;
  if (error) return <PanelError error={error} />;

  return (
    <section className="grid min-h-[640px] overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-[300px_1fr]">
      <div className="border-b border-line bg-mist/45 p-4 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-17 font-extrabold text-ink">횟감 {fishes.length}종</h2>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-btn bg-primary px-3 text-13 font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Plus className="h-4 w-4" aria-hidden />
            새 횟감
          </button>
        </div>
        <label htmlFor="admin-fish-search" className="sr-only">관리할 횟감 검색</label>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input
            id="admin-fish-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름, 슬러그, 별칭 검색"
            className="block w-full rounded-btn border border-control-border bg-surface py-2.5 pl-9 pr-3 text-body-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
        <div className="grid max-h-[520px] gap-1 overflow-y-auto pr-1">
          {filtered.map((fish) => (
            <button
              key={fish.id}
              type="button"
              onClick={() => setSelectedId(fish.id)}
              className={[
                'flex min-h-12 items-center gap-3 rounded-btn px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                selectedId === fish.id
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink hover:bg-surface hover:text-accent',
              ].join(' ')}
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full bg-chipbg">
                {fish.imageUrl ? (
                  <img src={fish.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Fish className="h-4 w-4 text-ink-mute" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-bold">{fish.name}</span>
                <span className="block truncate text-caption text-ink-mute">/{fish.slug}</span>
              </span>
              {fish.featured ? <Star className="h-4 w-4 fill-star text-star" aria-label="추천 횟감" /> : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3 py-7 text-center text-13 text-ink-mute">검색 결과가 없습니다.</p>
          ) : null}
        </div>
      </div>

      <FishEditor
        key={selectedFish?.id ?? 'new'}
        fish={selectedFish}
        isSaving={isSaving}
        saveError={saveError}
        onSave={async (input) => {
          const saved = await onSave(selectedFish?.id, input);
          setSelectedId(saved.id);
        }}
      />
    </section>
  );
}

interface FishEditorProps {
  fish?: AdminFish;
  isSaving: boolean;
  saveError: unknown;
  onSave: (input: AdminFishInput) => Promise<void>;
}

interface FishFormState {
  name: string;
  nameEn: string;
  slug: string;
  category: FishCategory;
  scientificName: string;
  imageUrl: string;
  tasteDesc: string;
  priceLevel: string;
  featured: boolean;
  description: string;
  seasonMonths: number[];
  tasteTags: string;
  tips: string;
  aliases: string;
}

function FishEditor({ fish, isSaving, saveError, onSave }: FishEditorProps) {
  const [form, setForm] = useState<FishFormState>(() => fishFormState(fish));
  const [clientError, setClientError] = useState('');

  function update<K extends keyof FishFormState>(key: K, value: FishFormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setClientError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!form.name.trim()) {
      setClientError('이름을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setClientError('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }
    const priceLevel = form.priceLevel ? Number(form.priceLevel) : null;
    if (priceLevel !== null && ![1, 2, 3].includes(priceLevel)) {
      setClientError('가격 단계는 1~3 중에서 선택해 주세요.');
      return;
    }

    setClientError('');
    try {
      await onSave({
        name: form.name.trim(),
        nameEn: optionalText(form.nameEn),
        slug: form.slug.trim(),
        category: form.category,
        scientificName: optionalText(form.scientificName),
        imageUrl: optionalText(form.imageUrl),
        tasteDesc: optionalText(form.tasteDesc),
        priceLevel,
        featured: form.featured,
        description: optionalText(form.description),
        seasonMonths: [...form.seasonMonths].sort((a, b) => a - b),
        tasteTags: splitCommaValues(form.tasteTags),
        tips: splitLineValues(form.tips),
        aliases: splitCommaValues(form.aliases),
      });
    } catch {
      // The mutation exposes its normalized server error next to the form.
    }
  }

  const displayedError = clientError || (saveError ? getErrorMessage(saveError) : '');

  return (
    <form onSubmit={handleSubmit} className="min-w-0 p-5 sm:p-6 lg:p-7" noValidate aria-busy={isSaving}>
      <div className="mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 mt-0 text-caption font-bold uppercase tracking-[0.08em] text-accent">
            {fish ? `FISH #${fish.id}` : 'NEW FISH'}
          </p>
          <h2 className="m-0 text-20 font-extrabold text-ink">
            {fish ? `${fish.name} 정보 수정` : '새 횟감 등록'}
          </h2>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-primary px-5 text-body-sm font-bold text-on-primary transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fish ? <PencilLine className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {isSaving ? '저장 중...' : fish ? '변경사항 저장' : '횟감 등록'}
        </button>
      </div>

      {displayedError ? (
        <p role="alert" className="mb-5 mt-0 rounded-btn bg-red-50 px-3.5 py-3 text-13 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {displayedError}
        </p>
      ) : null}

      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="이름" htmlFor="admin-fish-name" required>
            <input id="admin-fish-name" name="name" value={form.name} onChange={(e) => update('name', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="슬러그" htmlFor="admin-fish-slug" helper="영문 소문자와 하이픈을 사용합니다." required>
            <input id="admin-fish-slug" name="slug" value={form.slug} onChange={(e) => update('slug', e.target.value.toLowerCase())} className={adminInputClass} />
          </AdminField>
          <AdminField label="영문명" htmlFor="admin-fish-name-en">
            <input id="admin-fish-name-en" name="nameEn" value={form.nameEn} onChange={(e) => update('nameEn', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="학명" htmlFor="admin-fish-scientific">
            <input id="admin-fish-scientific" name="scientificName" value={form.scientificName} onChange={(e) => update('scientificName', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="분류" htmlFor="admin-fish-category" required>
            <select id="admin-fish-category" name="category" value={form.category} onChange={(e) => update('category', e.target.value as FishCategory)} className={adminInputClass}>
              <option value="FISH">어류</option>
              <option value="SHELLFISH">패류</option>
              <option value="CEPHALOPOD">두족류</option>
            </select>
          </AdminField>
          <AdminField label="가격 단계" htmlFor="admin-fish-price">
            <select id="admin-fish-price" name="priceLevel" value={form.priceLevel} onChange={(e) => update('priceLevel', e.target.value)} className={adminInputClass}>
              <option value="">미설정</option>
              <option value="1">1 · 부담 적음</option>
              <option value="2">2 · 보통</option>
              <option value="3">3 · 높은 편</option>
            </select>
          </AdminField>
        </div>

        <AdminField label="기본 이미지 URL" htmlFor="admin-fish-image" helper="새 횟감의 목록 이미지입니다. 검수된 미디어 메타데이터 편집은 후속 기능입니다.">
          <input id="admin-fish-image" name="imageUrl" type="url" value={form.imageUrl} onChange={(e) => update('imageUrl', e.target.value)} className={adminInputClass} />
        </AdminField>

        <AdminField label="한 줄 소개" htmlFor="admin-fish-description">
          <textarea id="admin-fish-description" name="description" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} className={adminInputClass} />
        </AdminField>

        <AdminField label="맛 설명" htmlFor="admin-fish-taste-desc">
          <textarea id="admin-fish-taste-desc" name="tasteDesc" rows={3} value={form.tasteDesc} onChange={(e) => update('tasteDesc', e.target.value)} className={adminInputClass} />
        </AdminField>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="맛 태그" htmlFor="admin-fish-tags" helper="쉼표로 구분합니다.">
            <input id="admin-fish-tags" name="tasteTags" value={form.tasteTags} onChange={(e) => update('tasteTags', e.target.value)} placeholder="고소한, 담백한" className={adminInputClass} />
          </AdminField>
          <AdminField label="시장 별칭" htmlFor="admin-fish-aliases" helper="기본 이름은 자동 등록됩니다.">
            <input id="admin-fish-aliases" name="aliases" value={form.aliases} onChange={(e) => update('aliases', e.target.value)} placeholder="넙치, 제주광어" className={adminInputClass} />
          </AdminField>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 block text-13 font-bold text-ink">제철 월</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
              const checked = form.seasonMonths.includes(month);
              return (
                <label
                  key={month}
                  className={[
                    'flex min-h-10 cursor-pointer items-center justify-center rounded-btn border text-13 font-bold transition',
                    checked
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-control-border bg-mist text-ink-mute hover:border-accent/50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    value={month}
                    checked={checked}
                    onChange={() => update(
                      'seasonMonths',
                      checked
                        ? form.seasonMonths.filter((value) => value !== month)
                        : [...form.seasonMonths, month],
                    )}
                    className="sr-only"
                  />
                  {month}월
                </label>
              );
            })}
          </div>
        </fieldset>

        <AdminField label="먹는 팁" htmlFor="admin-fish-tips" helper="한 줄에 하나씩 입력합니다.">
          <textarea id="admin-fish-tips" name="tips" rows={4} value={form.tips} onChange={(e) => update('tips', e.target.value)} className={adminInputClass} />
        </AdminField>

        <label className="flex cursor-pointer items-start gap-3 rounded-btn border border-line bg-mist px-4 py-3.5">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(event) => update('featured', event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]"
          />
          <span>
            <span className="block text-body-sm font-bold text-ink">추천 횟감으로 노출</span>
            <span className="mt-0.5 block text-caption leading-relaxed text-ink-mute">홈의 추천 섹션에 이 횟감을 표시합니다.</span>
          </span>
        </label>
      </div>
    </form>
  );
}

interface CorrectionsPanelProps {
  corrections: AdminCorrection[];
  filter: CorrectionFilter;
  isLoading: boolean;
  error: unknown;
  actionError: unknown;
  isUpdating: boolean;
  onFilterChange: (status: CorrectionFilter) => void;
  onUpdate: (id: number, status: CorrectionStatus) => Promise<AdminCorrection>;
}

function CorrectionsPanel({
  corrections,
  filter,
  isLoading,
  error,
  actionError,
  isUpdating,
  onFilterChange,
  onUpdate,
}: CorrectionsPanelProps) {
  const filters: Array<{ id: CorrectionFilter; label: string }> = [
    { id: 'PENDING', label: '대기 중' },
    { id: 'RESOLVED', label: '반영 완료' },
    { id: 'REJECTED', label: '반려' },
    { id: 'ALL', label: '전체' },
  ];

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="m-0 text-18 font-extrabold text-ink">정보 오류 제보</h2>
          <p className="mb-0 mt-1 text-13 text-ink-mute">사용자가 남긴 제보의 근거를 확인하고 처리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={[
                'min-h-10 rounded-full px-3 text-13 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                filter === id ? 'bg-primary text-on-primary' : 'bg-chipbg text-ink-mute hover:text-accent',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <PanelLoading label="오류 제보를 불러오는 중" borderless /> : null}
      {error ? <PanelError error={error} borderless /> : null}
      {actionError ? (
        <p role="alert" className="mx-5 mb-0 mt-5 rounded-btn bg-red-50 px-3.5 py-3 text-13 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300 sm:mx-6">
          {getErrorMessage(actionError)}
        </p>
      ) : null}
      {!isLoading && !error && corrections.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="해당하는 제보가 없습니다" description="현재 선택한 상태의 제보가 모두 정리되었습니다." />
      ) : null}
      {!isLoading && !error && corrections.length > 0 ? (
        <div className="divide-y divide-line">
          {corrections.map((correction) => (
            <article key={correction.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <strong className="text-body-sm text-ink">{correction.fishName}</strong>
                  <StatusBadge status={correction.status} />
                  <span className="rounded-full bg-chipbg px-2 py-1 text-11 font-bold text-ink-mute">
                    {claimTypeLabel(correction.claimType)}
                  </span>
                </div>
                <p className="m-0 whitespace-pre-wrap text-14 leading-relaxed text-ink">{correction.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-mute">
                  <span>{formatDateTime(correction.createdAt)}</span>
                  {correction.sourceUrl ? (
                    <a
                      href={correction.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent underline decoration-accent/30 underline-offset-2"
                    >
                      제보 근거 열기
                    </a>
                  ) : (
                    <span>첨부 근거 없음</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {correction.status !== 'RESOLVED' ? (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void onUpdate(correction.id, 'RESOLVED').catch(() => undefined)}
                    className="min-h-10 rounded-btn bg-primary px-3.5 text-13 font-bold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
                  >
                    반영 완료
                  </button>
                ) : null}
                {correction.status !== 'REJECTED' ? (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void onUpdate(correction.id, 'REJECTED').catch(() => undefined)}
                    className="min-h-10 rounded-btn border border-line bg-surface px-3.5 text-13 font-bold text-ink-mute transition hover:border-red-300 hover:text-red-700 disabled:opacity-60 dark:hover:text-red-300"
                  >
                    반려
                  </button>
                ) : null}
                {correction.status !== 'PENDING' ? (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void onUpdate(correction.id, 'PENDING').catch(() => undefined)}
                    className="min-h-10 rounded-btn border border-line bg-surface px-3.5 text-13 font-bold text-ink-mute transition hover:text-accent disabled:opacity-60"
                  >
                    다시 열기
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface ReviewsPanelProps {
  reviews: AdminReview[];
  isLoading: boolean;
  error: unknown;
  actionError: unknown;
  deletingId?: number;
  onDelete: (id: number) => Promise<void>;
}

function ReviewsPanel({ reviews, isLoading, error, actionError, deletingId, onDelete }: ReviewsPanelProps) {
  function confirmDelete(review: AdminReview) {
    if (!window.confirm(`${review.nickname}님의 후기를 삭제할까요? 삭제 후 복구할 수 없습니다.`)) return;
    void onDelete(review.id).catch(() => undefined);
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="m-0 text-18 font-extrabold text-ink">최근 후기</h2>
        <p className="mb-0 mt-1 text-13 text-ink-mute">최신순 최대 100건입니다. 운영 정책을 위반한 후기만 삭제해 주세요.</p>
      </div>
      {isLoading ? <PanelLoading label="후기를 불러오는 중" borderless /> : null}
      {error ? <PanelError error={error} borderless /> : null}
      {actionError ? (
        <p role="alert" className="mx-5 mb-0 mt-5 rounded-btn bg-red-50 px-3.5 py-3 text-13 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300 sm:mx-6">
          {getErrorMessage(actionError)}
        </p>
      ) : null}
      {!isLoading && !error && reviews.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="등록된 후기가 없습니다" description="새 후기가 등록되면 이곳에서 확인할 수 있습니다." />
      ) : null}
      {!isLoading && !error && reviews.length > 0 ? (
        <div className="divide-y divide-line">
          {reviews.map((review) => (
            <article key={review.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-13">
                  <strong className="text-ink">{review.nickname}</strong>
                  <span className="text-ink-mute">·</span>
                  <span className="font-semibold text-accent">{review.fishName}</span>
                  {review.rating ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-chipbg px-2 py-1 font-bold text-ink">
                      <Star className="h-3 w-3 fill-star text-star" aria-hidden />
                      {review.rating}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-14 leading-relaxed text-ink">{review.content}</p>
                <p className="mb-0 mt-2 text-caption text-ink-mute">
                  {formatDateTime(review.createdAt)} · 도움돼요 {review.helpfulCount}
                </p>
              </div>
              <button
                type="button"
                disabled={deletingId === review.id}
                onClick={() => confirmDelete(review)}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-btn border border-red-200 bg-surface px-3.5 text-13 font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {deletingId === review.id ? '삭제 중...' : '삭제'}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatusBadge({ status }: { status: CorrectionStatus }) {
  const styles: Record<CorrectionStatus, { label: string; className: string }> = {
    PENDING: { label: '대기 중', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
    RESOLVED: { label: '반영 완료', className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
    REJECTED: { label: '반려', className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  };
  const style = styles[status];
  return <span className={`rounded-full px-2 py-1 text-11 font-bold ${style.className}`}>{style.label}</span>;
}

function AdminField({
  label,
  htmlFor,
  helper,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-13 font-bold text-ink">
        {label}
        {required ? <span className="ml-1 text-red-600" aria-hidden>*</span> : null}
      </label>
      {children}
      {helper ? <p className="mb-0 mt-1.5 text-caption leading-relaxed text-ink-mute">{helper}</p> : null}
    </div>
  );
}

function PanelLoading({ label, borderless = false }: { label: string; borderless?: boolean }) {
  return (
    <div
      role="status"
      className={[
        'flex min-h-48 items-center justify-center text-body-sm font-semibold text-ink-mute',
        borderless ? '' : 'rounded-card border border-line bg-surface',
      ].join(' ')}
    >
      {label}...
    </div>
  );
}

function PanelError({ error, borderless = false }: { error: unknown; borderless?: boolean }) {
  return (
    <div
      role="alert"
      className={[
        'px-5 py-12 text-center text-body-sm font-semibold text-red-700 dark:text-red-300',
        borderless ? '' : 'rounded-card border border-red-200 bg-surface dark:border-red-900',
      ].join(' ')}
    >
      {getErrorMessage(error)}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpenCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <Icon className="mx-auto h-7 w-7 text-ink-mute" aria-hidden />
      <p className="mb-1 mt-3 text-body-sm font-bold text-ink">{title}</p>
      <p className="m-0 text-13 text-ink-mute">{description}</p>
    </div>
  );
}

const adminInputClass = 'block w-full rounded-btn border border-control-border bg-mist px-3 py-2.5 text-base text-ink outline-none transition placeholder:text-ink-mute focus:border-accent focus-visible:ring-2 focus-visible:ring-focus xl:text-body-sm';

function fishFormState(fish?: AdminFish): FishFormState {
  return {
    name: fish?.name ?? '',
    nameEn: fish?.nameEn ?? '',
    slug: fish?.slug ?? '',
    category: fish?.category ?? 'FISH',
    scientificName: fish?.scientificName ?? '',
    imageUrl: fish?.imageUrl ?? '',
    tasteDesc: fish?.tasteDesc ?? '',
    priceLevel: fish?.priceLevel ? String(fish.priceLevel) : '',
    featured: fish?.featured ?? false,
    description: fish?.description ?? '',
    seasonMonths: fish?.seasonMonths ?? [],
    tasteTags: fish?.tasteTags.join(', ') ?? '',
    tips: fish?.tips.join('\n') ?? '',
    aliases: fish?.aliases.join(', ') ?? '',
  };
}

function splitCommaValues(value: string) {
  return uniqueValues(value.split(','));
}

function splitLineValues(value: string) {
  return uniqueValues(value.split('\n'));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function claimTypeLabel(claimType: string) {
  const labels: Record<string, string> = {
    IDENTITY: '기본 정보',
    SEASON: '제철',
    TASTE: '맛',
    PRICE: '가격',
    PHOTO: '사진',
  };
  return labels[claimType] ?? claimType;
}
