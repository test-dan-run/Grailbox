import { Composition, Folder, Still } from 'remotion';

import { calculatePromoMetadata, type PromoProps } from './metadata';
import { Promo } from './Promo';
import { FPS } from './scenes';
import { DemoScanScene } from './stills/DemoAssets';

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
        <Still
          id="DemoScanScene"
          component={DemoScanScene}
          width={1080}
          height={1920}
          defaultProps={{ src: 'products/moncolle-figure-1.jpg' }}
        />
      </Folder>
    </>
  );
}
