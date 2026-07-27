import { track } from '@vercel/analytics';
import type { FishSort } from '../types/fish';
import type { FishClaimType, VerificationStatus } from '../types/source';

export interface AnalyticsEventMap {
  search_submitted: { surface: 'hero' | 'header' | 'search'; queryLength: number; filterCount: number };
  search_results_viewed: { resultCount: number; zeroResult: boolean; filterCount: number };
  fish_card_clicked: { fishId: number; section: string; position: number; sort?: FishSort };
  fish_detail_viewed: {
    fishId: number;
    sourceSection: string;
    inSeason: boolean;
    hasPrice: boolean;
    verificationStatus?: VerificationStatus;
  };
  bookmark_changed: { fishId: number; action: 'saved' | 'removed'; authenticated: boolean };
  price_variant_selected: { fishId: number; variantKey: string };
  source_link_clicked: { fishId: number; claimType: FishClaimType };
  share_completed: { fishId: number; method: 'native' | 'clipboard' };
  review_started: { fishId: number; authenticated: boolean };
  review_submitted: { fishId: number; authenticated: boolean; hasImage: boolean };
  correction_submitted: { fishId: number; claimType: FishClaimType };
}

type AnalyticsEventName = keyof AnalyticsEventMap;
type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsTransport = (name: string, properties?: Record<string, AnalyticsValue>) => void;

const FORBIDDEN_KEY_PARTS = [
  'email',
  'nickname',
  'password',
  'token',
  'reviewbody',
  'reviewtext',
  'imageurl',
  'searchquery',
  'querytext',
];
const EMAIL_LIKE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const URL_OR_TOKEN_LIKE = /(?:https?:\/\/|bearer\s+|eyJ[a-zA-Z0-9_-]{8,}\.)/i;

export function assertAnalyticsPayload(properties: Record<string, AnalyticsValue>) {
  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = key.toLowerCase().replace(/_/g, '');
    if (FORBIDDEN_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
      throw new Error(`analytics payload contains forbidden field: ${key}`);
    }
    if (typeof value === 'string') {
      if (value.length > 120) throw new Error(`analytics string is too long: ${key}`);
      if (EMAIL_LIKE.test(value) || URL_OR_TOKEN_LIKE.test(value)) {
        throw new Error(`analytics payload contains sensitive-looking text: ${key}`);
      }
    }
  }
}

export function createAnalyticsTracker(transport: AnalyticsTransport = track) {
  return function sendAnalyticsEvent<Name extends AnalyticsEventName>(
    name: Name,
    properties: AnalyticsEventMap[Name],
  ) {
    try {
      const flatProperties = properties as Record<string, AnalyticsValue>;
      assertAnalyticsPayload(flatProperties);
      transport(name, flatProperties);
    } catch {
      // Analytics must never interrupt navigation, form submission, or mutation flows.
    }
  };
}

export const trackAnalyticsEvent = createAnalyticsTracker();
