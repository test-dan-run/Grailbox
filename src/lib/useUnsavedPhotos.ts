import { useEffect, useMemo, useRef } from 'react';

import { deletePhotoFiles } from './photos';

/**
 * Forms import photos into app storage as soon as they are picked. When a
 * form closes without saving, this removes the photos it imported, keeping
 * any that were already saved on the record being edited. It also removes
 * photos that were imported and then removed again before saving, e.g.,
 * scan angle frames replaced by a new recording.
 */
export function useUnsavedPhotos(photos: string[]) {
  const latest = useRef(photos);
  const seen = useRef(new Set<string>());
  const initial = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    latest.current = photos;
    for (const p of photos) seen.current.add(p);
  }, [photos]);

  useEffect(
    () => () => {
      const keep = new Set(saved.current ? [...latest.current, ...initial.current] : initial.current);
      deletePhotoFiles([...seen.current].filter((p) => !keep.has(p)));
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
