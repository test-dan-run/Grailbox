import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, SheetHeader, TextField } from '@/components/form';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, PlusIcon } from '@/components/Icons';
import { AppText, IconButton } from '@/components/ui';
import { createCollection, getCollection, updateCollection } from '@/db/repositories/collections';
import { goBack } from '@/lib/nav';
import { colors, radii, spacing, type as typeScale } from '@/theme';

const SUGGESTED = ['Plushies', 'Figures', 'Pin & Flat Merch'];

/** New collection, or rename / edit categories of an existing one. */
export function CollectionFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>(id ? [] : SUGGESTED);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCollection(id).then((c) => {
      if (c) {
        setName(c.name);
        setCategories(c.categories);
      }
      setLoaded(true);
    });
  }, [id]);

  const addDraft = () => {
    const t = draft.trim();
    if (t && !categories.some((c) => c.toLowerCase() === t.toLowerCase())) setCategories([...categories, t]);
    setDraft('');
  };

  const move = (i: number, d: number) => {
    const next = [...categories];
    const [c] = next.splice(i, 1);
    next.splice(i + d, 0, c);
    setCategories(next);
  };

  const canSave = loaded && name.trim().length > 0 && !saving;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const cats = draft.trim() ? [...categories, draft.trim()] : categories;
    try {
      if (id) {
        await updateCollection(id, { name, categories: cats });
        goBack(router);
      } else {
        const newId = await createCollection({ name, categories: cats });
        router.replace(`/collection/${newId}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title={id ? 'Edit Collection' : 'New Collection'} onCancel={() => goBack(router)} onSave={save} saveDisabled={!canSave} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Rowlet Plushies & Merch"
          autoFocus={!id}
          returnKeyType="done"
          testID="collection-name"
        />
        <Field label="Categories" hint="These become the filter pills in the gallery. Reorder them with the arrows.">
          <View style={{ gap: 8 }}>
            {categories.map((c, i) => (
              <View key={c} style={styles.catRow}>
                <AppText variant="body" style={{ flex: 1 }}>
                  {c}
                </AppText>
                <IconButton label={`Move ${c} up`} variant="plain" disabled={i === 0} onPress={() => move(i, -1)}>
                  <ChevronUpIcon size={18} color={i === 0 ? colors.textMuted : colors.textPrimary} />
                </IconButton>
                <IconButton
                  label={`Move ${c} down`}
                  variant="plain"
                  disabled={i === categories.length - 1}
                  onPress={() => move(i, 1)}
                >
                  <ChevronDownIcon size={18} color={i === categories.length - 1 ? colors.textMuted : colors.textPrimary} />
                </IconButton>
                <IconButton label={`Remove ${c}`} variant="plain" onPress={() => setCategories(categories.filter((x) => x !== c))}>
                  <CloseIcon size={16} color={colors.textSecondary} />
                </IconButton>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addDraft}
                placeholder="Add a category"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="New category name"
                returnKeyType="done"
                submitBehavior="submit"
                style={styles.addInput}
              />
              <IconButton label="Add category" onPress={addDraft} disabled={!draft.trim()} variant="card">
                <PlusIcon size={18} color={draft.trim() ? colors.textPrimary : colors.textMuted} />
              </IconButton>
            </View>
          </View>
        </Field>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCard },
  body: { gap: 20, paddingHorizontal: spacing.gutter, paddingTop: 8 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: 14,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
    ...typeScale.body,
    color: colors.textPrimary,
  },
});
