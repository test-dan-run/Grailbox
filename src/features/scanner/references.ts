import { subscribe } from '@/db/database';
import { pendingReferences, setEmbedding, syncReferencePhotos } from '@/db/repositories/embeddings';
import { photoUri } from '@/lib/photos';

import { EMBEDDING_MODEL, embedImage, getEmbeddingModel } from './embedder';

/*
 * Keeps the scanner's reference set current: every item photo gets an
 * embedding, computed on device one photo at a time. Runs at launch and
 * shortly after any data change, so saving, editing, importing or seeding
 * items all end up embedded. The model only loads when a photo needs it.
 */

let running: Promise<void> | null = null;
let again = false;

async function pass() {
  await syncReferencePhotos();
  const pending = await pendingReferences(EMBEDDING_MODEL);
  if (pending.length === 0) return;
  try {
    await getEmbeddingModel();
  } catch (e) {
    console.warn('Reference photos: embedding model unavailable', e);
    return;
  }
  for (const ref of pending) {
    try {
      await setEmbedding(ref.item_id, ref.photo_uri, await embedImage(photoUri(ref.photo_uri)!), EMBEDDING_MODEL);
    } catch (e) {
      console.warn(`Reference photos: could not embed ${ref.photo_uri}`, e);
    }
  }
}

/** Embeds every reference photo that lacks a current vector. Resolves when none are left. */
export function updateReferences(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await pass();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Starts keeping references current. Returns a function that stops listening for changes. */
export function startReferenceUpdates(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => updateReferences().catch((e) => console.warn('Reference photos: update failed', e)), 800);
  };
  schedule();
  const unsubscribe = subscribe(schedule);
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
