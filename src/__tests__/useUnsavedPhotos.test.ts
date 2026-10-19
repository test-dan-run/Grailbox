import { renderHook } from '@testing-library/react-native';

import { useUnsavedPhotos } from '@/lib/useUnsavedPhotos';

const mockDelete = jest.fn();
jest.mock('@/lib/photos', () => ({ deletePhotoFiles: (paths: string[]) => mockDelete(paths) }));

beforeEach(() => mockDelete.mockClear());

describe('unsaved photo cleanup', () => {
  it('deletes every photo imported in a form that closes without saving', async () => {
    const { rerender, unmount } = await renderHook(({ photos }: { photos: string[] }) => useUnsavedPhotos(photos), {
      initialProps: { photos: [] },
    });
    await rerender({ photos: ['photos/a.jpg'] });
    // A new recording replaces a.jpg before the form closes.
    await rerender({ photos: ['photos/b.jpg'] });
    await unmount();
    expect(mockDelete).toHaveBeenCalledWith(['photos/a.jpg', 'photos/b.jpg']);
  });

  it('keeps the record’s saved photos when an edit is cancelled', async () => {
    const { result, rerender, unmount } = await renderHook(({ photos }: { photos: string[] }) => useUnsavedPhotos(photos), {
      initialProps: { photos: [] },
    });
    result.current.setInitial(['photos/old.jpg']);
    await rerender({ photos: ['photos/old.jpg'] });
    await rerender({ photos: ['photos/old.jpg', 'photos/new.jpg'] });
    await unmount();
    expect(mockDelete).toHaveBeenCalledWith(['photos/new.jpg']);
  });

  it('after saving, deletes only photos that were imported and then removed', async () => {
    const { result, rerender, unmount } = await renderHook(({ photos }: { photos: string[] }) => useUnsavedPhotos(photos), {
      initialProps: { photos: [] },
    });
    await rerender({ photos: ['photos/a.jpg', 'photos/b.jpg'] });
    await rerender({ photos: ['photos/b.jpg'] });
    result.current.markSaved();
    await unmount();
    expect(mockDelete).toHaveBeenCalledWith(['photos/a.jpg']);
  });
});
