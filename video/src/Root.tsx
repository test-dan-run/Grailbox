import { Composition, Folder, Still } from 'remotion';

import { calculatePromoMetadata, type PromoProps } from './metadata';
import { Promo } from './Promo';
import { FPS } from './scenes';
import { DemoBarcodeScene, DemoItemPhoto, DemoPhotoScene } from './stills/DemoAssets';

// The seed's barcode for the Rowlet Jumbo Plush (src/db/seed.ts, SEED_BARCODES.jumboPlush).
const JUMBO_BARCODE = '4521329266181';

export function Root() {
  return (
    <>
      <Composition
        id="Promo"
        component={Promo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={1}
        defaultProps={{ scenes: [], music: false } satisfies PromoProps}
        calculateMetadata={calculatePromoMetadata}
      />
      <Folder name="DemoAssets">
        <Still id="DemoItemPhoto" component={DemoItemPhoto} width={1080} height={1080} defaultProps={{ item: 'jumbo' as const }} />
        <Still id="DemoPhotoScene" component={DemoPhotoScene} width={1080} height={1920} />
        <Still id="DemoBarcodeScene" component={DemoBarcodeScene} width={1080} height={1920} defaultProps={{ code: JUMBO_BARCODE }} />
      </Folder>
    </>
  );
}
