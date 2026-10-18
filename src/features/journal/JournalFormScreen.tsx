import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField, Field, PhotoField, SheetHeader, TextField, ToggleField } from '@/components/form';
import { CheckIcon, PlusIcon, TrashIcon } from '@/components/Icons';
import { BottomSheet } from '@/components/Sheet';
import { AppText, Photo, SecondaryButton, SegmentedControl, StatusChip } from '@/components/ui';
import { listItems } from '@/db/repositories/items';
import { createEntry, deleteEntry, getEntry, updateEntry } from '@/db/repositories/journal';
import { JOURNAL_ENTRY_TYPES, type JournalEntryType } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { todayIso } from '@/lib/dates';
import { goBack } from '@/lib/nav';
import { deletePhotoFiles } from '@/lib/photos';
import { useUnsavedPhotos } from '@/lib/useUnsavedPhotos';
import { colors, radii, spacing } from '@/theme';

import { ENTRY_TYPE_LABEL } from './JournalTimeline';

/** New or edit journal entry, with photos and tagged items. */
export function JournalFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; collectionId?: string }>();
  const [collectionId, setCollectionId] = useState(params.collectionId);
  const [date, setDate] = useState<string | undefined>(todayIso());
  const [title, setTitle] = useState('');
  const [type, setType] = useState<JournalEntryType>('BATCH_ADD');
  const [grail, setGrail] = useState(false);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [tagging, setTagging] = useState(false);
  const [loaded, setLoaded] = useState(!params.id);
  const [saving, setSaving] = useState(false);
  const unsaved = useUnsavedPhotos(photos);
  const items = useQuery(async () => (collectionId ? listItems(collectionId) : []), [collectionId]);

  useEffect(() => {
    if (!params.id) return;
    getEntry(params.id).then((e) => {
      if (!e) return;
      unsaved.setInitial(e.photos);
      setCollectionId(e.collection_id);
      setDate(e.date);
      setTitle(e.title);
      setType(e.entry_type);
      setGrail(!!e.is_grail);
      setNotes(e.notes ?? '');
      setPhotos(e.photos);
      setItemIds(e.item_ids);
      setLoaded(true);
    });
  }, [params.id, unsaved]);


  const canSave = loaded && !!collectionId && title.trim().length > 0 && !!date && !saving;

  const save = async () => {
    if (!canSave || !collectionId || !date) return;
    setSaving(true);
    const input = {
      collection_id: collectionId,
      date,
      title,
      notes,
      entry_type: type,
      is_grail: type === 'MILESTONE' && grail,
      item_ids: itemIds,
      photos,
    };
    try {
      if (params.id) {
        await updateEntry(params.id, input);
        deletePhotoFiles(unsaved.initial().filter((p) => !photos.includes(p)));
      } else {
        await createEntry(input);
      }
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
    Alert.alert(`Delete “${title}”?`, 'Its photos are deleted too. Tagged items stay in your collection.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deletePhotoFiles([...(await deleteEntry(params.id!)), ...photos]);
          unsaved.markSaved();
          if (router.canDismiss()) router.dismiss(2);
          else router.replace('/dashboard');
        },
      },
    ]);
  };

  const allItems = items.data ?? [];
  const taggedItems = itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i) => !!i);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader
        title={params.id ? 'Edit Entry' : 'New Journal Entry'}
        onCancel={() => goBack(router)}
        onSave={save}
        saveDisabled={!canSave}
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <PhotoField
          photos={photos}
          onChange={setPhotos}
          tintKey={params.id ?? 'new-entry'}
          title="Upload progress photos"
          subtitle="Your shelf, a haul or a single find"
        />
        <Field label="Entry type">
          <SegmentedControl
            label="Entry type"
            value={type}
            onChange={setType}
            options={JOURNAL_ENTRY_TYPES.map((t) => ({ value: t, label: ENTRY_TYPE_LABEL[t] }))}
          />
        </Field>
        {type === 'MILESTONE' && (
          <ToggleField
            label="Grail find"
            description="Shows the GRAIL chip and an amber node on the timeline"
            value={grail}
            onChange={setGrail}
          />
        )}
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={type === 'MILESTONE' ? 'e.g. Grail Found' : type === 'BATCH_ADD' ? 'e.g. Shelf Refresh' : 'e.g. Shelf reorganization'}
          testID="journal-title"
        />
        <DateField label="Date" value={date} onChange={setDate} />
        <TextField label="Collector note" value={notes} onChangeText={setNotes} multiline placeholder="What happened?" />

        <Field label="Tagged in this entry">
          <View style={{ gap: 8 }}>
            {taggedItems.map((it) => (
              <View key={it.id} style={styles.taggedRow}>
                <Photo path={it.photos[0]} tintKey={it.id} glyph={16} style={styles.taggedPhoto} />
                <AppText variant="cardTitleSmall" style={{ flex: 1 }} numberOfLines={2}>
                  {it.title}
                </AppText>
                <StatusChip status={it.status} />
              </View>
            ))}
            <SecondaryButton
              label={taggedItems.length ? 'Change tagged items' : 'Tag items'}
              icon={<PlusIcon size={18} />}
              onPress={() => setTagging(true)}
            />
          </View>
        </Field>

        {params.id && (
          <SecondaryButton label="Delete entry" color={colors.danger} icon={<TrashIcon size={18} color={colors.danger} />} onPress={remove} />
        )}
      </ScrollView>

      <BottomSheet visible={tagging} onClose={() => setTagging(false)} title="Tag items" fill>
        <FlatList
          data={allItems}
          keyExtractor={(i) => i.id}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <AppText variant="body" color={colors.textSecondary} style={{ textAlign: 'center', padding: 24 }}>
              This collection has no items yet.
            </AppText>
          }
          renderItem={({ item }) => {
            const on = itemIds.includes(item.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.title}
                onPress={() => setItemIds((ids) => (on ? ids.filter((x) => x !== item.id) : [...ids, item.id]))}
                style={styles.pickRow}
              >
                <Photo path={item.photos[0]} tintKey={item.id} glyph={16} style={styles.taggedPhoto} />
                <AppText variant="cardTitleSmall" style={{ flex: 1 }} numberOfLines={2}>
                  {item.title}
                </AppText>
                <View style={[styles.check, on && styles.checkOn]}>{on && <CheckIcon size={16} color={colors.white} />}</View>
              </Pressable>
            );
          }}
        />
        <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 8 }}>
          <SecondaryButton label="Done" onPress={() => setTagging(false)} />
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCard },
  body: { gap: 20, paddingHorizontal: spacing.gutter, paddingTop: 8 },
  taggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
  },
  taggedPhoto: { width: 44, height: 44, borderRadius: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.gutter, paddingVertical: 8, minHeight: 56 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
});
