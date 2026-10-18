import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoField, PriceField, SelectField, SheetHeader, TextField, Field } from '@/components/form';
import { StarIcon } from '@/components/Icons';
import { PrimaryButton, SegmentedControl, type SegmentOption } from '@/components/ui';
import { listCollections, mostRecentCollectionId } from '@/db/repositories/collections';
import { createItem, getItem } from '@/db/repositories/items';
import type { Origin, Priority } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { deviceCurrency, parsePriceInput } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { useUnsavedPhotos } from '@/lib/useUnsavedPhotos';
import { colors, spacing } from '@/theme';

export const PRIORITY_OPTIONS: SegmentOption<Priority>[] = [
  { value: 'GRAIL', label: 'Grail', activeBg: colors.statusAlertBg, activeFg: colors.statusAlertText },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export const ORIGIN_OPTIONS: SegmentOption<Origin>[] = [
  { value: 'OFFICIAL', label: 'Official' },
  { value: 'FAN', label: 'Fan-made', activeBg: colors.originFanBg, activeFg: colors.originFanText },
];

/**
 * 01 · Spot a Wishlist Item. Opened from the Dashboard, from Item Details
 * (prefilled from that item, for a second copy or variant) and from a
 * scanner result (carrying the scanned barcode).
 */
export function WishlistSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ collectionId?: string; fromItem?: string; barcode?: string }>();
  const collections = useQuery(listCollections, []);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency);
  const [priority, setPriority] = useState<Priority>('HIGH');
  const [origin, setOrigin] = useState<Origin>('OFFICIAL');
  const [collectionId, setCollectionId] = useState<string | undefined>(params.collectionId);
  const [photos, setPhotos] = useState<string[]>([]);
  const [line, setLine] = useState<string | undefined>();
  const [lineUrl, setLineUrl] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Default collection: the one the user came from, else the most recent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (params.fromItem) {
        const src = await getItem(params.fromItem);
        if (src && !cancelled) {
          setTitle(src.title);
          setCollectionId(src.collection_id);
          setOrigin(src.origin);
          setLine(src.line);
          setLineUrl(src.line_url);
          setCategory(src.category);
          setCurrency(src.currency);
          return;
        }
      }
      if (!params.collectionId) {
        const recent = await mostRecentCollectionId();
        if (!cancelled) setCollectionId((c) => c ?? recent);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.fromItem, params.collectionId]);

  // Photos imported but never saved are removed when the sheet closes.
  const unsaved = useUnsavedPhotos(photos);

  const canSave = title.trim().length > 0 && !!collectionId && !saving;

  const save = async () => {
    if (!canSave || !collectionId) return;
    setSaving(true);
    try {
      await createItem({
        collection_id: collectionId,
        title,
        status: 'WISHLIST',
        origin,
        priority,
        quantity: 1,
        variant_tags: [],
        estimated_price: parsePriceInput(price, currency),
        currency,
        line,
        line_url: lineUrl,
        category,
        specs: params.barcode ? { barcode: params.barcode } : {},
        photos,
      });
      unsaved.markSaved();
      goBack(router);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title="Spot a Wishlist Item" onCancel={() => goBack(router)} onSave={save} saveDisabled={!canSave} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <PhotoField photos={photos} onChange={setPhotos} tintKey="wishlist" />
        <TextField
          label="Item name"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Rowlet Juggling Plush"
          returnKeyType="next"
          testID="wishlist-title"
        />
        <PriceField
          label="Target / estimated price"
          value={price}
          onChangeText={setPrice}
          currency={currency}
          onCurrencyChange={setCurrency}
          testID="wishlist-price"
        />
        <Field label="Priority">
          <SegmentedControl label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </Field>
        <Field label="Merch type">
          <SegmentedControl label="Merch type" options={ORIGIN_OPTIONS} value={origin} onChange={setOrigin} />
        </Field>
        <SelectField
          label="Collection"
          value={collectionId}
          onChange={setCollectionId}
          placeholder="Choose a collection"
          options={(collections.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          testID="wishlist-collection"
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        <PrimaryButton
          label="Add to Wishlist"
          icon={<StarIcon size={18} color={colors.white} />}
          onPress={save}
          disabled={!canSave}
          loading={saving}
          testID="wishlist-add"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCard },
  body: { gap: 20, paddingHorizontal: spacing.gutter, paddingTop: 8, paddingBottom: 16 },
  footer: { paddingHorizontal: spacing.gutter, paddingTop: 16 },
});
