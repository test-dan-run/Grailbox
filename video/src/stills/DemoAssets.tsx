import { AbsoluteFill, Img, staticFile } from 'remotion';

/*
 * The scanner's "camera" scenes for the demo build's assets/demo/ folder,
 * rendered by `npm run demo-assets`. A product photo (public/products/, from
 * scripts/fetch-products.sh) sits on a desk. The photos have white
 * backgrounds, and a multiply blend drops the white, so the item looks like
 * it stands on the desk.
 */

/**
 * Side of the photo on the 1080 × 1920 scene. The scanner's guides cover
 * 714 px on a 9:16 screen (272 dp at 2.625 px per dp), and it checks a square
 * 15% wider than that, so the item fills most of the checked square.
 */
const ITEM_PX = 820;

export function DemoScanScene({ src }: { src: string }) {
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at 50% 42%, #FFFFFF 0%, #EEEAE4 50%, #CFC8BE 100%)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Img src={staticFile(src)} style={{ width: ITEM_PX, height: ITEM_PX, objectFit: 'contain', mixBlendMode: 'multiply' }} />
    </AbsoluteFill>
  );
}
