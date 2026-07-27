import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

type Rgb = readonly [number, number, number];

const TEXT_PAIRS = [
  ['ink', 'mist'],
  ['ink', 'surface'],
  ['surface', 'ink'],
  ['ink-mute', 'mist'],
  ['ink-mute', 'surface'],
  ['accent', 'mist'],
  ['accent', 'surface'],
  ['accent', 'accent-soft'],
  ['accent-hover', 'mist'],
  ['accent-hover', 'surface'],
  ['star', 'mist'],
  ['star', 'surface'],
  ['on-hero', 'hero-surface'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
] as const;

const NON_TEXT_PAIRS = [
  ['primary', 'mist'],
  ['primary', 'surface'],
  ['primary-hover', 'mist'],
  ['primary-hover', 'surface'],
  ['focus', 'mist'],
  ['focus', 'surface'],
  ['control-border', 'mist'],
  ['control-border', 'surface'],
] as const;

function themeTokens(selector: ':root' | '.dark') {
  const escapedSelector = selector.replace('.', '\\.');
  const block = themeCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`${selector} theme block is missing`);

  return (name: string): Rgb => {
    const match = block.match(new RegExp(`--c-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    if (!match) throw new Error(`${selector} --c-${name} is missing`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
}

function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb) {
  return (
    0.2126 * linearChannel(red)
    + 0.7152 * linearChannel(green)
    + 0.0722 * linearChannel(blue)
  );
}

function contrastRatio(first: Rgb, second: Rgb) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each([':root', '.dark'] as const)('%s semantic color tokens', (selector) => {
  const token = themeTokens(selector);

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA text contrast', (foreground, background) => {
    expect(contrastRatio(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s against %s meets non-text contrast', (foreground, background) => {
    expect(contrastRatio(token(foreground), token(background))).toBeGreaterThanOrEqual(3);
  });
});
