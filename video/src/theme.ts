import { loadFont } from '@remotion/google-fonts/PlusJakartaSans';

// Brand tokens, copied from the app's src/theme.ts.
export const colors = {
  brandPrimary: '#0F766E',
  brandMint: '#CCFBF1',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  surfaceCanvas: '#F8FAFC',
  white: '#FFFFFF',
  cameraGround: '#141B24',
};

export const { fontFamily } = loadFont('normal', { weights: ['500', '700', '800'], subsets: ['latin'] });
