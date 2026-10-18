import type { TextStyle } from 'react-native';

/**
 * Design tokens from the Grailbox handoff. Reference tokens by name everywhere;
 * never hard-code a hex value in a screen.
 */
export const colors = {
  surfaceCanvas: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  /** Placeholders and disabled text only: fails contrast for body text. */
  textMuted: '#94A3B8',
  textBody: '#334155',

  statusOwnedBg: '#D1FAE5',
  statusOwnedText: '#065F46',
  statusWishBg: '#E0F2FE',
  statusWishText: '#0369A1',
  statusAlertBg: '#FEF3C7',
  statusAlertText: '#92400E',

  originOfficialBg: '#E2E8F0',
  originOfficialText: '#334155',
  originFanBg: '#EDE9FE',
  originFanText: '#5B21B6',

  brandPrimary: '#0F766E',
  brandMint: '#CCFBF1',
  accentStar: '#FBBF24',
  cameraGround: '#141B24',

  // Supporting values drawn on the canvas.
  tagBg: '#F1F5F9',
  tagText: '#475569',
  divider: '#CBD5E1',
  sheetBackdrop: 'rgba(15, 23, 42, 0.32)',
  danger: '#B91C1C',
  white: '#FFFFFF',
} as const;

/** Launch screen palettes (the only screen with a dark variant). */
export const launchPalette = {
  light: {
    bg: colors.brandMint,
    ink: colors.textPrimary,
    sub: '#115E59',
    seam: colors.textPrimary,
    shine: colors.brandMint,
    shadow: 'rgba(15, 118, 110, 0.18)',
    dot: colors.brandPrimary,
  },
  dark: {
    bg: '#0F172A',
    ink: '#FFFFFF',
    sub: '#99F6E4',
    seam: '#334155',
    shine: '#E2E8F0',
    shadow: 'rgba(0, 0, 0, 0.35)',
    dot: '#5EEAD4',
  },
} as const;

/** Photo placeholder tints: tile background and glyph color. */
export const placeholderTints = [
  { bg: '#E4EFE7', fg: '#7E9A86' },
  { bg: '#EFE8DD', fg: '#A08F74' },
  { bg: '#E6EEF5', fg: '#8193A8' },
  { bg: '#F1E6EC', fg: '#A68597' },
  { bg: '#E9E6F3', fg: '#8D86AA' },
] as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  largeTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, letterSpacing: -0.24 },
  sectionHeading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26 },
  cardTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  cardTitleSmall: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodyLong: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  metaMedium: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  chip: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 },
  chipLarge: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
} as const satisfies Record<string, TextStyle>;

export const radii = {
  card: 20,
  cardSmall: 16,
  journalCard: 18,
  input: 12,
  button: 14,
  thumb: 12,
  full: 9999,
} as const;

export const shadows = {
  ambient: '0px 4px 20px -2px rgba(15, 23, 42, 0.05)',
  segment: '0px 2px 8px -2px rgba(15, 23, 42, 0.12)',
  floating: '0px 4px 20px -2px rgba(15, 23, 42, 0.12)',
  primaryButton: '0px 8px 24px -8px rgba(15, 118, 110, 0.45)',
  pillButton: '0px 10px 28px -8px rgba(15, 23, 42, 0.35)',
} as const;

export const spacing = {
  gutter: 20,
  cardGap: 16,
  cardPadding: 16,
  /** Floating buttons sit this far above the bottom edge (home indicator). */
  floatingBottom: 34,
  touch: 44,
} as const;

export const theme = { colors, type, radii, shadows, spacing, fonts, placeholderTints, launchPalette };
export default theme;
