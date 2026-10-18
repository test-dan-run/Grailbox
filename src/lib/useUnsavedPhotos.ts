import { useEffect, useMemo, useRef } from 'react';

import { deletePhotoFiles } from './photos';

/**
 * Forms import photos into app storage as soon as they are picked. When a
 * form closes without saving, this removes the photos it imported, keeping
 * any that were already saved on the record being edited.
 */
export function useUnsavedPhotos(photos: string[]) {
  const latest = useRef(photos);
  const initial = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      if (!saved.current) deletePhotoFiles(latest.current.filter((p) => !initial.current.includes(p)));
    },
    [],
  );

  return useMemo(
    () => ({
      /** Photos the record had before editing. */
      setInitial: (p: string[]) => {
        initial.current = p;
      },
      initial: () => initial.current,
      markSaved: () => {
        saved.current = true;
      },
    }),
    [],
  );
}
