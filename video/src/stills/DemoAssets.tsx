import { AbsoluteFill } from 'remotion';

import { colors, fontFamily } from '../theme';
import { ean13 } from './ean13';

/*
 * Placeholder images for the demo build's assets/demo/ folder, rendered by
 * `npm run demo-assets`. Swap in real photos when you have them (see
 * README.md). The photo scene shows the juggling plush's own placeholder, so
 * the app's photo matcher finds it.
 */

export type DemoItem = 'jumbo' | 'juggling';

// Two clearly different drawings, so the photo matcher tells them apart.
const ITEMS: Record<DemoItem, { title: string; bg: string; drawing: React.ReactNode }> = {
  jumbo: { title: 'Rowlet Jumbo Plush', bg: '#FEF3C7', drawing: <Owl /> },
  juggling: { title: 'Rowlet Juggling Plush', bg: '#FCE7F3', drawing: <Juggler /> },
};

/** Side of the item in the photo scene: a little over the guides, so the scanner's crop is mostly the item. */
const SCENE_ITEM_PX = 780;

/** Size of the scanner's guides on a 1080 × 1920 scene shown on a 9:16 screen (272 dp at 2.625 px per dp is 714 px). */
const GUIDE_PX = 680;

export function DemoItemPhoto({ item }: { item: DemoItem }) {
  const it = ITEMS[item];
  return (
    <AbsoluteFill style={{ backgroundColor: it.bg, alignItems: 'center', justifyContent: 'center', fontFamily }}>
      <svg viewBox="0 0 400 400" style={{ width: '62%', height: '62%' }}>
        {it.drawing}
      </svg>
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', color: colors.textPrimary }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, opacity: 0.55 }}>PLACEHOLDER</div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>{it.title}</div>
      </div>
    </AbsoluteFill>
  );
}

function Owl() {
  return (
    <g>
      <ellipse cx="200" cy="370" rx="130" ry="18" fill="rgba(0,0,0,0.12)" />
      <path d="M110 120 L130 40 L170 100 Z M290 120 L270 40 L230 100 Z" fill="#65A30D" />
      <ellipse cx="200" cy="220" rx="140" ry="150" fill="#65A30D" />
      <ellipse cx="200" cy="265" rx="85" ry="90" fill="#ECFCCB" />
      <circle cx="155" cy="170" r="30" fill="white" />
      <circle cx="245" cy="170" r="30" fill="white" />
      <circle cx="160" cy="175" r="14" fill={colors.textPrimary} />
      <circle cx="240" cy="175" r="14" fill={colors.textPrimary} />
      <path d="M188 205 L212 205 L200 225 Z" fill="#F59E0B" />
    </g>
  );
}

/** A long, lying plush under an arc of balls. */
function Juggler() {
  return (
    <g>
      <ellipse cx="200" cy="372" rx="170" ry="14" fill="rgba(0,0,0,0.12)" />
      <rect x="40" y="250" width="320" height="115" rx="57" fill="#7C3AED" />
      <circle cx="300" cy="245" r="70" fill="#7C3AED" />
      <circle cx="280" cy="235" r="12" fill={colors.textPrimary} />
      <circle cx="325" cy="235" r="12" fill={colors.textPrimary} />
      <rect x="70" y="300" width="160" height="16" rx="8" fill="#DDD6FE" />
      <circle cx="60" cy="150" r="28" fill="#2563EB" />
      <circle cx="140" cy="80" r="28" fill="#F97316" />
      <circle cx="240" cy="60" r="28" fill="#16A34A" />
      <circle cx="340" cy="110" r="28" fill="#DC2626" />
    </g>
  );
}

function Tabletop({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at 50% 45%, #6B6259 0%, #3F3A36 55%, #211E1B 100%)',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** The scanner aimed at the juggling plush. */
export function DemoPhotoScene() {
  return (
    <Tabletop>
      <div
        style={{
          width: SCENE_ITEM_PX,
          height: SCENE_ITEM_PX,
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* The whole 1080 px reference photo, scaled down, so the scan looks like it. */}
        <div style={{ width: 1080, height: 1080, transform: `scale(${SCENE_ITEM_PX / 1080})`, transformOrigin: 'top left' }}>
          <DemoItemPhoto item="juggling" />
        </div>
      </div>
    </Tabletop>
  );
}

/** The scanner aimed at the jumbo plush's tag. */
export function DemoBarcodeScene({ code }: { code: string }) {
  const { modules, guards } = ean13(code);
  const unit = 6;
  return (
    <Tabletop>
      <div
        style={{
          width: GUIDE_PX,
          padding: '44px 0 36px',
          borderRadius: 20,
          backgroundColor: colors.white,
          boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
          transform: 'rotate(-3deg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          color: colors.textPrimary,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>JUMBO PLUSH · 46 cm</div>
        <svg width={modules.length * unit} height={300}>
          {[...modules].map((m, i) =>
            m === '1' ? <rect key={i} x={i * unit} y={0} width={unit} height={guards.has(i) ? 300 : 270} fill="#000" /> : null,
          )}
        </svg>
        <div style={{ fontSize: 40, fontWeight: 500, letterSpacing: 10, fontVariantNumeric: 'tabular-nums' }}>{code}</div>
      </div>
    </Tabletop>
  );
}
