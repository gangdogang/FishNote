interface GraphemeSegment {
  segment: string;
}

interface GraphemeSegmenter {
  segment(input: string): Iterable<GraphemeSegment>;
}

type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' },
) => GraphemeSegmenter;

const Segmenter = (Intl as typeof Intl & { Segmenter?: GraphemeSegmenterConstructor }).Segmenter;
const graphemeSegmenter = Segmenter ? new Segmenter('ko-KR', { granularity: 'grapheme' }) : undefined;

export function firstGrapheme(value: string, fallback = '?') {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const firstSegment = graphemeSegmenter?.segment(trimmed)[Symbol.iterator]().next().value;
  return firstSegment?.segment ?? Array.from(trimmed)[0] ?? fallback;
}
