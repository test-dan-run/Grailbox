import type { PictureRef } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';

import type { CropRect } from './preprocess';
import type { RankedMatch } from './similarity';

/*
 * Development only: keeps each scanner photo with the crop and scores it got,
 * so matching can be tuned offline on real scans. Pull them with
 * `adb exec-out run-as app.grailbox tar c files/scan-debug | tar x`.
 */

export async function saveDebugScan(
  picture: PictureRef,
  info: { crop?: CropRect; screen: { width: number; height: number }; ranked: RankedMatch[] },
) {
  const dir = new Directory(Paths.document, 'scan-debug');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = new Date().toISOString().replace(/[:.]/g, '-');
  // quality must be 1: expo-camera's Android savePictureAsync does `quality.toInt() * 100`, so anything below 1 saves at 0.
  const saved = new File((await picture.savePictureAsync({ quality: 1 })).uri);
  saved.moveSync(new File(dir, `${name}.jpg`));
  new File(dir, `${name}.json`).write(
    JSON.stringify({ width: picture.width, height: picture.height, ...info }, null, 2),
  );
}
