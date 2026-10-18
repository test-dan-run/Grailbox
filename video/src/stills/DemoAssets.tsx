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

const ITEMS: Record<DemoItem, { title: string; bg: string; body: string; belly: string; balls: boolean }> = {
  jumbo: { title: 'Rowlet Jumbo Plush', bg: '#FEF3C7', body: '#65A30D', belly: '#ECFCCB', balls: false },
  juggling: { title: 'Rowlet Juggling Plush', bg: '#DBEAFE', body: '#EA580C', belly: '#FFEDD5', balls: true },
};

/** Size of the scanner's guides on a 1080 × 1920 scene shown on a 9:16 screen (272 dp at 2.625 px per dp is 714 px). */
const GUIDE_PX = 680;

export function DemoItemPhoto({ item }: { item: DemoItem }) {
  const it = ITEMS[item];
  return (
    <AbsoluteFill style={{ backgroundColor: it.bg, alignItems: 'center', justifyContent: 'center', fontFamily }}>
      <svg viewBox="0 0 400 400" style={{ width: '62%', height: '62%' }}>
        <ellipse cx="200" cy="370" rx="130" ry="18" fill="rgba(0,0,0,0.12)" />
        <path d="M110 120 L130 40 L170 100 Z M290 120 L270 40 L230 100 Z" fill={it.body} />
        <ellipse cx="200" cy="220" rx="140" ry="150" fill={it.body} />
        <ellipse cx="200" cy="265" rx="85" ry="90" fill={it.belly} />
        <circle cx="155" cy="170" r="30" fill="white" />
        <circle cx="245" cy="170" r="30" fill="white" />
        <circle cx="160" cy="175" r="14" fill={colors.textPrimary} />
        <circle cx="240" cy="175" r="14" fill={colors.textPrimary} />
        <path d="M188 205 L212 205 L200 225 Z" fill="#F59E0B" />
        {it.balls && (
          <g>
            <circle cx="60" cy="90" r="26" fill="#2563EB" />
            <circle cx="345" cy="70" r="22" fill="#DB2777" />
            <circle cx="350" cy="190" r="24" fill="#16A34A" />
          </g>
        )}
      </svg>
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', color: colors.textPrimary }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, opacity: 0.55 }}>PLACEHOLDER</div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>{it.title}</div>
      </div>
    </AbsoluteFill>
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
          width: GUIDE_PX,
          height: GUIDE_PX,
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 30px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* The whole 1080 px reference photo, scaled down, so the scan looks like it. */}
        <div style={{ width: 1080, height: 1080, transform: `scale(${GUIDE_PX / 1080})`, transformOrigin: 'top left' }}>
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
