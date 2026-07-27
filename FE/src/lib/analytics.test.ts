import { describe, expect, it, vi } from 'vitest';
import { assertAnalyticsPayload, createAnalyticsTracker } from './analytics';

describe('typed analytics', () => {
  it('sends an allowed event exactly once with aggregate search data only', () => {
    const transport = vi.fn();
    const track = createAnalyticsTracker(transport);

    track('search_submitted', { surface: 'hero', queryLength: 3, filterCount: 1 });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('search_submitted', {
      surface: 'hero',
      queryLength: 3,
      filterCount: 1,
    });
  });

  it.each([
    [{ email: 'person@example.com' }],
    [{ nickname: '사용자' }],
    [{ imageUrl: 'https://example.com/private.jpg' }],
    [{ section: 'person@example.com' }],
  ])('rejects PII and raw URL payloads', (payload) => {
    expect(() => assertAnalyticsPayload(payload)).toThrow();
  });

  it('swallows analytics transport failures', () => {
    const track = createAnalyticsTracker(() => {
      throw new Error('blocked');
    });

    expect(() => track('bookmark_changed', {
      fishId: 1,
      action: 'saved',
      authenticated: false,
    })).not.toThrow();
  });
});
