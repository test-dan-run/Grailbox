import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { WishlistSheet } from '@/features/wishlist/WishlistSheet';

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockCreateItem = jest.fn(async (_input: unknown) => 'new-id');
jest.mock('@/db/repositories/items', () => ({
  createItem: (input: unknown) => mockCreateItem(input),
  getItem: jest.fn(async () => undefined),
}));
jest.mock('@/db/repositories/collections', () => ({
  listCollections: jest.fn(async () => [
    { id: 'c1', name: 'Rowlet Plushies & Merch', categories: [], sort_order: 0, created_at: '', updated_at: '' },
  ]),
  mostRecentCollectionId: jest.fn(async () => mockRecent),
}));
let mockRecent: string | undefined;

jest.mock('@/lib/money', () => ({
  ...jest.requireActual('@/lib/money'),
  deviceCurrency: () => 'USD',
  deviceLocale: () => 'en-US',
}));

beforeEach(() => {
  mockBack.mockClear();
  mockCreateItem.mockClear();
  mockParams = {};
  mockRecent = undefined;
});

const saveEnabled = () => !screen.getByTestId('wishlist-add').props.accessibilityState?.disabled;

describe('Spot a Wishlist Item', () => {
  it('keeps Save disabled until the item name and collection are set', async () => {
    await render(<WishlistSheet />);
    expect(saveEnabled()).toBe(false);
    await fireEvent.changeText(screen.getByTestId('wishlist-title'), 'Rowlet Juggling Plush');
    // Still no collection: none exists to default to.
    expect(saveEnabled()).toBe(false);
    expect(screen.getByTestId('sheet-save').props.accessibilityState?.disabled).toBe(true);
  });

  it('defaults to the most recent collection and creates a WISHLIST item', async () => {
    mockRecent = 'c1';
    await render(<WishlistSheet />);
    await waitFor(() => expect(screen.getByText('Rowlet Plushies & Merch')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('wishlist-title'), '  Rowlet Juggling Plush ');
    await fireEvent.changeText(screen.getByTestId('wishlist-price'), '28.5');
    await fireEvent.press(screen.getByRole('tab', { name: 'Grail' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Fan-made' }));
    expect(saveEnabled()).toBe(true);
    await fireEvent.press(screen.getByTestId('wishlist-add'));
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalledTimes(1));
    expect(mockCreateItem.mock.calls[0][0]).toMatchObject({
      collection_id: 'c1',
      title: '  Rowlet Juggling Plush ',
      status: 'WISHLIST',
      priority: 'GRAIL',
      origin: 'FAN',
      estimated_price: 2850,
      currency: 'USD',
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('uses the collection it was opened from, and carries a scanned barcode', async () => {
    mockParams = { collectionId: 'c1', barcode: '4521329311119' };
    await render(<WishlistSheet />);
    await fireEvent.changeText(screen.getByTestId('wishlist-title'), 'Mystery box');
    await fireEvent.press(screen.getByTestId('sheet-save'));
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalled());
    expect(mockCreateItem.mock.calls[0][0]).toMatchObject({
      collection_id: 'c1',
      priority: 'HIGH',
      origin: 'OFFICIAL',
      specs: { barcode: '4521329311119' },
    });
  });
});
