import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChoicePills,
  DateField,
  Field,
  FormSection,
  PhotoField,
  PriceField,
  SelectField,
  SheetHeader,
  Stepper,
  TagsField,
  TextField,
} from '@/components/form';
import { ChevronRightIcon, TrashIcon, VideoIcon } from '@/components/Icons';
import { AppText, CONDITION_META, SecondaryButton, SegmentedControl, STATUS_META } from '@/components/ui';
import { listCollections } from '@/db/repositories/collections';
import { listReferenceFrames, setEmbedding, setReferenceFrames, syncReferencePhotos } from '@/db/repositories/embeddings';
import { createItem, deleteItem, getItem, updateItem } from '@/db/repositories/items';
import { CONDITIONS, ITEM_STATUSES, type Condition, type ItemInput, type ItemStatus, type Origin, type Priority } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { EMBEDDING_MODEL } from '@/features/scanner/embedder';
import type { PickedFrame } from '@/features/scanner/videoFrames';
import { ORIGIN_OPTIONS, PRIORITY_OPTIONS } from '@/features/wishlist/WishlistSheet';
import { todayIso } from '@/lib/dates';
import { deviceCurrency, minorToInput, parsePriceInput } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { deletePhotoFiles } from '@/lib/photos';
import { useUnsavedPhotos } from '@/lib/useUnsavedPhotos';
import { colors, radii, spacing } from '@/theme';

import { ScanAnglesModal, type FormFrame } from './ScanAnglesModal';

interface FormState {
  title: string;
  collection_id?: string;
  status: ItemStatus;
  quantity: number;
  category?: string;
  origin: Origin;
  line: string;
  line_url: string;
  variant_tags: string[];
  priority: Priority;
  price: string;
  currency: string;
  acquisition_date?: string;
  acquisition_source: string;
  condition?: Condition;
  storage_location: string;
  release_year: string;
  manufacturer: string;
  size: string;
  barcode: string;
  photos: string[];
}

const blankState = (): FormState => ({
  title: '',
  status: 'OWNED',
  quantity: 1,
  origin: 'OFFICIAL',
  line: '',
  line_url: '',
  variant_tags: [],
  priority: 'HIGH',
  price: '',
  currency: deviceCurrency(),
  acquisition_date: todayIso(),
  acquisition_source: '',
  storage_location: '',
  release_year: '',
  manufacturer: '',
  size: '',
  barcode: '',
  photos: [],
});

/** Add or edit an item: every field of the data model, in the wishlist sheet's patterns. */
export function ItemFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; collectionId?: string; barcode?: string; status?: ItemStatus }>();
  const editing = !!params.id;
  const collections = useQuery(listCollections, []);
  const [f, setF] = useState<FormState>(() => ({
    ...blankState(),
    collection_id: params.collectionId,
    barcode: params.barcode ?? '',
    status: params.status && ITEM_STATUSES.includes(params.status) ? params.status : 'OWNED',
  }));
  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);
  // Scan angles: hidden reference frames from a video, and the cover photo's vector when the app just computed it.
  const [frames, setFrames] = useState<FormFrame[]>([]);
  const [coverVector, setCoverVector] = useState<PickedFrame>();
  const [angles, setAngles] = useState<'record' | 'review'>();

  // Photos and frames imported in this session but not saved are cleaned up on close.
  const files = useMemo(() => [...f.photos, ...frames.map((x) => x.path)], [f.photos, frames]);
  const unsaved = useUnsavedPhotos(files);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!params.id) return;
    Promise.all([getItem(params.id), listReferenceFrames(params.id)]).then(([it, framePaths]) => {
      if (!it) return;
      unsaved.setInitial([...it.photos, ...framePaths]);
      setFrames(framePaths.map((path) => ({ path })));
      const price = it.status === 'WISHLIST' ? it.estimated_price : it.purchase_price;
      setF({
        title: it.title,
        collection_id: it.collection_id,
        status: it.status,
        quantity: it.quantity,
        category: it.category,
        origin: it.origin,
        line: it.line ?? '',
        line_url: it.line_url ?? '',
        variant_tags: it.variant_tags,
        priority: it.priority ?? 'HIGH',
        price: minorToInput(price, it.currency),
        currency: it.currency,
        acquisition_date: it.acquisition_date,
        acquisition_source: it.acquisition_source ?? '',
        condition: it.condition,
        storage_location: it.storage_location ?? '',
        release_year: it.specs.release_year?.toString() ?? '',
        manufacturer: it.specs.manufacturer ?? '',
        size: it.specs.size ?? '',
        barcode: it.specs.barcode ?? '',
        photos: it.photos,
      });
      setLoaded(true);
    });
  }, [params.id, unsaved]);


  const collection = collections.data?.find((c) => c.id === f.collection_id);
  const wish = f.status === 'WISHLIST';
  const canSave = loaded && f.title.trim().length > 0 && !!f.collection_id && !saving;

  const save = async () => {
    if (!canSave || !f.collection_id) return;
    setSaving(true);
    const price = parsePriceInput(f.price, f.currency);
    const year = parseInt(f.release_year, 10);
    const input: ItemInput = {
      collection_id: f.collection_id,
      title: f.title,
      status: f.status,
      quantity: wish ? 1 : f.quantity,
      category: collection?.categories.includes(f.category ?? '') ? f.category : undefined,
      origin: f.origin,
      line: f.line,
      line_url: f.line_url,
      variant_tags: f.variant_tags,
      priority: wish ? f.priority : undefined,
      estimated_price: wish ? price : undefined,
      purchase_price: wish ? undefined : price,
      currency: f.currency,
      acquisition_date: wish ? undefined : f.acquisition_date,
      acquisition_source: f.acquisition_source,
      condition: wish ? undefined : f.condition,
      storage_location: f.storage_location,
      specs: {
        release_year: Number.isFinite(year) ? year : undefined,
        manufacturer: f.manufacturer,
        size: f.size,
        barcode: f.barcode,
      },
      photos: f.photos,
    };
    try {
      let id = params.id;
      if (id) await updateItem(id, input);
      else id = await createItem(input);
      await setReferenceFrames(id, frames.map((x) => ({ photo_uri: x.path, vector: x.vector })), EMBEDDING_MODEL);
      if (coverVector && f.photos.includes(coverVector.path)) {
        // The app already embedded the cover photo to check the frames, so store that vector instead of computing it again.
        await syncReferencePhotos();
        await setEmbedding(id, coverVector.path, coverVector.vector, EMBEDDING_MODEL);
      }
      if (params.id) deletePhotoFiles(unsaved.initial().filter((p) => !files.includes(p)));
      unsaved.markSaved();
      goBack(router);
    } catch (e) {
      Alert.alert('Could not save', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!params.id) return;
    Alert.alert(`Delete “${f.title}”?`, 'Its photos are deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const photos = await deleteItem(params.id!);
          deletePhotoFiles([...photos, ...files]);
          unsaved.markSaved();
          // Edit opens over Item Details: leave both the form and the deleted item.
          if (router.canDismiss()) router.dismiss(2);
          else router.replace('/dashboard');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title={editing ? 'Edit Item' : 'Add to Set'} onCancel={() => goBack(router)} onSave={save} saveDisabled={!canSave} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoField
          photos={f.photos}
          onChange={(p) => set('photos', p)}
          tintKey={params.id ?? 'new-item'}
          title="Add or snap photos"
          subtitle="The first photo is the cover"
          extraActions={[
            {
              label: frames.length ? 'Record scan angles again' : 'Record scan angles',
              icon: <VideoIcon size={20} />,
              onPress: () => setAngles('record'),
              disabled: f.photos.length === 0,
              hint:
                f.photos.length === 0
                  ? 'Take a cover photo first'
                  : frames.length
                    ? `Replaces the ${frames.length} current ${frames.length === 1 ? 'angle' : 'angles'}`
                    : 'A short video helps the scanner recognize the item from any side',
            },
          ]}
          onAdded={() => {
            // Offer scan angles right after the cover photo, for items the user has in hand.
            if (f.photos.length > 0 || frames.length > 0 || f.status === 'WISHLIST') return;
            Alert.alert('Record scan angles?', 'Record a short video while you turn the item, so the scanner recognizes it from any side.', [
              { text: 'Not now', style: 'cancel' },
              { text: 'Record', onPress: () => setAngles('record') },
            ]);
          }}
        />
        {frames.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Shows the hidden frames the scanner compares scans with"
            onPress={() => setAngles('review')}
            style={({ pressed }) => [styles.anglesChip, pressed && { opacity: 0.7 }]}
            testID="item-scan-angles"
          >
            <VideoIcon size={16} color={colors.brandPrimary} />
            <AppText variant="label" color={colors.brandPrimary}>
              {frames.length} scan {frames.length === 1 ? 'angle' : 'angles'}
            </AppText>
            <ChevronRightIcon size={14} color={colors.brandPrimary} />
          </Pressable>
        )}
        <TextField label="Item name" value={f.title} onChangeText={(t) => set('title', t)} placeholder="e.g. Rowlet Jumbo Plush" testID="item-title" />
        <SelectField
          label="Collection"
          value={f.collection_id}
          onChange={(v) => set('collection_id', v)}
          placeholder="Choose a collection"
          options={(collections.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Field label="Status">
          <SegmentedControl
            label="Status"
            value={f.status}
            onChange={(v) => set('status', v)}
            options={ITEM_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          />
        </Field>
        {!wish && <Stepper label="Copies owned" value={f.quantity} onChange={(n) => set('quantity', n)} />}
        <ChoicePills label="Category" options={collection?.categories ?? []} value={f.category} onChange={(v) => set('category', v)} />

        <FormSection title="Maker">
          <Field label="Merch type">
            <SegmentedControl label="Merch type" options={ORIGIN_OPTIONS} value={f.origin} onChange={(v) => set('origin', v)} />
          </Field>
          <TextField
            label="Artist, brand or shop"
            value={f.line}
            onChangeText={(t) => set('line', t)}
            placeholder="Shown under the title"
          />
          <TextField
            label="Link to their page"
            value={f.line_url}
            onChangeText={(t) => set('line_url', t)}
            placeholder="https://"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TagsField
            label="Variant tags"
            value={f.variant_tags}
            onChange={(t) => set('variant_tags', t)}
            placeholder="e.g. Jumbo size, Japan release"
          />
        </FormSection>

        <FormSection title={wish ? 'Wishlist' : 'Acquisition'}>
          {wish && (
            <Field label="Priority">
              <SegmentedControl label="Priority" options={PRIORITY_OPTIONS} value={f.priority} onChange={(v) => set('priority', v)} />
            </Field>
          )}
          <PriceField
            label={wish ? 'Target / estimated price' : 'Purchase price'}
            value={f.price}
            onChangeText={(t) => set('price', t)}
            currency={f.currency}
            onCurrencyChange={(c) => set('currency', c)}
          />
          {!wish && (
            <>
              <DateField
                label={f.status === 'IN_TRANSIT' ? 'Ordered' : 'Acquired'}
                value={f.acquisition_date}
                onChange={(d) => set('acquisition_date', d)}
                clearable
              />
              <TextField
                label="Where from"
                value={f.acquisition_source}
                onChangeText={(t) => set('acquisition_source', t)}
                placeholder="e.g. Pokémon Center Tokyo"
              />
              <ChoicePills
                label="Condition"
                options={CONDITIONS.map((c) => CONDITION_META[c].short)}
                value={f.condition ? CONDITION_META[f.condition].short : undefined}
                onChange={(v) => set('condition', CONDITIONS.find((c) => CONDITION_META[c].short === v))}
              />
            </>
          )}
          <TextField
            label="Storage location"
            value={f.storage_location}
            onChangeText={(t) => set('storage_location', t)}
            placeholder="e.g. Shelf B, Display Case 1"
          />
        </FormSection>

        <FormSection title="Specifications">
          <View style={styles.twoUp}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Release year"
                value={f.release_year}
                onChangeText={(t) => set('release_year', t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="2016"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Size" value={f.size} onChangeText={(t) => set('size', t)} placeholder="e.g. 46 cm" />
            </View>
          </View>
          <TextField label="Manufacturer" value={f.manufacturer} onChangeText={(t) => set('manufacturer', t)} />
          <TextField
            label="Barcode / SKU"
            value={f.barcode}
            onChangeText={(t) => set('barcode', t)}
            autoCapitalize="characters"
            autoCorrect={false}
            hint="The scanner matches this code"
          />
        </FormSection>

        {editing && (
          <SecondaryButton
            label="Delete item"
            color={colors.danger}
            icon={<TrashIcon size={18} color={colors.danger} />}
            onPress={remove}
          />
        )}
      </ScrollView>
      {angles && (
        <ScanAnglesModal
          start={angles}
          cover={f.photos[0]}
          frames={frames}
          onDone={(next, cover) => {
            setFrames(next);
            if (cover) setCoverVector(cover);
            setAngles(undefined);
          }}
          onClose={() => setAngles(undefined)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCard },
  body: { gap: 20, paddingHorizontal: spacing.gutter, paddingTop: 8 },
  twoUp: { flexDirection: 'row', gap: 12 },
  anglesChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: -8,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.brandMint,
  },
});
