import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronDownIcon,
  ChevronUpIcon,
  FilterIcon,
  MoreIcon,
  PlusIcon,
  ReorderIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  TrashIcon,
  EditIcon,
  CloseIcon,
} from '@/components/Icons';
import { ItemRow } from '@/components/ItemRow';
import { ActionSheet } from '@/components/Sheet';
import {
  AppText,
  Chip,
  DockedBar,
  EmptyState,
  FilterPill,
  IconButton,
  Photo,
  PrimaryButton,
  STATUS_META,
  useDockedPadding,
} from '@/components/ui';
import { deleteCollection, listCollectionSummaries, reorderCollections } from '@/db/repositories/collections';
import { searchItems } from '@/db/repositories/items';
import { ITEM_STATUSES, type CollectionSummary, type ItemSearchResult, type ItemStatus } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { formatMonthYear } from '@/lib/dates';
import { deletePhotoFiles } from '@/lib/photos';
import { colors, radii, shadows, spacing, type as typeScale } from '@/theme';

export function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string }>();
  const searchRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [status, setStatus] = useState<ItemStatus | undefined>();
  const [menuFor, setMenuFor] = useState<CollectionSummary | null>(null);
  const [reorder, setReorder] = useState<CollectionSummary[] | null>(null);
  const dockPad = useDockedPadding();

  // "Search instead" from the scanner opens the Dashboard with the keyboard up.
  useEffect(() => {
    if (params.search) {
      const t = setTimeout(() => searchRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [params.search]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(t);
  }, [query]);

  const summaries = useQuery(listCollectionSummaries, []);
  const searching = debounced.trim().length > 0 || !!status;
  const results = useQuery(() => (searching ? searchItems(debounced, status) : Promise.resolve([])), [debounced, status, searching]);

  const confirmDelete = (c: CollectionSummary) => {
    const total = c.owned + c.wishlist + c.in_transit;
    Alert.alert(
      `Delete “${c.name}”?`,
      total
        ? `This deletes its ${total} ${total === 1 ? 'item' : 'items'}, photos and journal. Export first if you want a backup.`
        : 'This collection is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => deletePhotoFiles(await deleteCollection(c.id)),
        },
      ],
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" color={colors.textSecondary}>
            Grailbox
          </AppText>
          <AppText variant="largeTitle" accessibilityRole="header">
            Collections
          </AppText>
        </View>
        <View style={styles.headerButtons}>
          <IconButton label="Scan an item for duplicates" onPress={() => router.push('/scanner')} testID="dashboard-scan">
            <ScanIcon />
          </IconButton>
          <IconButton label="Spot a wishlist item" onPress={() => router.push('/wishlist/new')} testID="dashboard-spot">
            <StarIcon />
          </IconButton>
          <IconButton label="Settings and export" onPress={() => router.push('/settings')} testID="dashboard-settings">
            <SettingsIcon />
          </IconButton>
        </View>
      </View>

      {!reorder && (
        <>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <SearchIcon size={18} color={colors.textSecondary} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search items, lines, shelves"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Search your Grailbox"
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={styles.searchInput}
                testID="dashboard-search"
              />
              {query ? (
                <IconButton label="Clear search" variant="plain" size={36} onPress={() => setQuery('')}>
                  <CloseIcon size={16} color={colors.textSecondary} />
                </IconButton>
              ) : null}
            </View>
            <IconButton
              label="Filter by status"
              variant="card"
              round
              size={48}
              selected={showFilter || !!status}
              onPress={() => setShowFilter((s) => !s)}
              style={(showFilter || status) && { backgroundColor: colors.textPrimary }}
            >
              <FilterIcon size={18} color={showFilter || status ? colors.white : colors.textPrimary} />
            </IconButton>
          </View>
          {(showFilter || status) && (
            <View style={styles.filterRow}>
              <FilterPill label="Any status" selected={!status} onPress={() => setStatus(undefined)} />
              {ITEM_STATUSES.map((s) => (
                <FilterPill
                  key={s}
                  label={STATUS_META[s].label}
                  selected={status === s}
                  onPress={() => setStatus(status === s ? undefined : s)}
                />
              ))}
            </View>
          )}
        </>
      )}
      {searching && !reorder && (
        <AppText variant="label" color={colors.textSecondary} accessibilityLiveRegion="polite">
          {results.loading && !results.data
            ? 'Searching…'
            : `${results.data?.length ?? 0} ${results.data?.length === 1 ? 'item' : 'items'}${status ? ` · ${STATUS_META[status].label}` : ''}`}
        </AppText>
      )}
    </View>
  );

  // One list for every mode, so the search field in its header keeps focus while typing.
  type Row =
    | { kind: 'collection'; c: CollectionSummary }
    | { kind: 'result'; r: ItemSearchResult }
    | { kind: 'reorder'; c: CollectionSummary; index: number };
  const rows: Row[] = reorder
    ? reorder.map((c, index) => ({ kind: 'reorder', c, index }))
    : searching
      ? (results.data ?? []).map((r) => ({ kind: 'result', r }))
      : (summaries.data ?? []).map((c) => ({ kind: 'collection', c }));

  const empty = reorder ? undefined : searching ? (
    results.loading ? undefined : <EmptyState title="Nothing found" body="Try a title, a maker or shop, or a shelf name." />
  ) : summaries.loading ? undefined : (
    <EmptyState
      title="No collections yet"
      body="Start one for each thing you collect, like a character, an artist or a series."
    />
  );

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'result') {
      const r = row.r;
      return (
        <View style={{ marginBottom: 10 }}>
          <ItemRow
            item={r}
            meta={[r.collection_name, r.storage_location].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/item/${r.id}`)}
          />
        </View>
      );
    }
    if (row.kind === 'reorder' && reorder) {
      const { c, index } = row;
      return (
        <View style={[styles.reorderRow, { marginBottom: 10 }]}>
          <AppText variant="cardTitle" style={{ flex: 1 }} numberOfLines={2}>
            {c.name}
          </AppText>
          <IconButton label={`Move ${c.name} up`} disabled={index === 0} onPress={() => setReorder(move(reorder, index, -1))}>
            <ChevronUpIcon color={index === 0 ? colors.textMuted : colors.textPrimary} />
          </IconButton>
          <IconButton
            label={`Move ${c.name} down`}
            disabled={index === reorder.length - 1}
            onPress={() => setReorder(move(reorder, index, 1))}
          >
            <ChevronDownIcon color={index === reorder.length - 1 ? colors.textMuted : colors.textPrimary} />
          </IconButton>
        </View>
      );
    }
    const c = row.c;
    return (
      <View style={{ marginBottom: spacing.cardGap }}>
        <CollectionCard c={c} onOpen={() => router.push(`/collection/${c.id}`)} onMenu={() => setMenuFor(c)} />
      </View>
    );
  };

  const content = (
    <FlatList<Row>
      data={rows}
      keyExtractor={(row) => `${row.kind}:${row.kind === 'result' ? row.r.id : row.c.id}`}
      renderItem={renderRow}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: dockPad }]}
    />
  );

  return (
    <View style={styles.root}>
      {content}
      <DockedBar>
        {reorder ? (
          <PrimaryButton
            label="Done"
            onPress={async () => {
              await reorderCollections(reorder.map((c) => c.id));
              setReorder(null);
            }}
          />
        ) : (
          <PrimaryButton
            label="New Collection"
            icon={<PlusIcon size={18} color={colors.white} />}
            onPress={() => router.push('/collection/form')}
            testID="dashboard-new-collection"
          />
        )}
      </DockedBar>
      <ActionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        actions={
          menuFor
            ? [
                {
                  label: 'Rename',
                  icon: <EditIcon size={20} />,
                  onPress: () => router.push(`/collection/form?id=${menuFor.id}`),
                },
                {
                  label: 'Reorder',
                  icon: <ReorderIcon size={20} />,
                  onPress: () => setReorder(summaries.data ?? []),
                },
                {
                  label: 'Delete',
                  destructive: true,
                  icon: <TrashIcon size={20} color={colors.danger} />,
                  onPress: () => confirmDelete(menuFor),
                },
              ]
            : []
        }
      />
    </View>
  );
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const [it] = next.splice(index, 1);
  next.splice(index + delta, 0, it);
  return next;
}

function CollectionCard({ c, onOpen, onMenu }: { c: CollectionSummary; onOpen: () => void; onMenu: () => void }) {
  const chips: { status: ItemStatus; n: number }[] = [
    { status: 'OWNED' as const, n: c.owned },
    { status: 'WISHLIST' as const, n: c.wishlist },
    { status: 'IN_TRANSIT' as const, n: c.in_transit },
  ].filter((x) => x.n > 0);
  const meta = [`Updated ${formatMonthYear(c.updated_at)}`, c.latest_title ? `Latest: ${c.latest_title}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable onPress={onOpen} accessibilityRole="link" style={{ flex: 1, paddingVertical: 4 }} hitSlop={4}>
          <AppText variant="cardTitle">{c.name}</AppText>
        </Pressable>
        <IconButton label={`More actions for ${c.name}`} variant="plain" onPress={onMenu} style={styles.more}>
          <MoreIcon />
        </IconButton>
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${c.name}. ${chips.map((x) => `${x.n} ${STATUS_META[x.status].label}`).join(', ') || 'No items yet'}. ${meta}`}
        style={({ pressed }) => [{ gap: 14 }, pressed && { opacity: 0.85 }]}
      >
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((x) => (
              <Chip
                key={x.status}
                label={`${x.n} ${STATUS_META[x.status].label}`}
                bg={STATUS_META[x.status].bg}
                fg={STATUS_META[x.status].fg}
              />
            ))}
          </View>
        ) : (
          <AppText variant="body" color={colors.textSecondary}>
            No items yet. Add the first one from inside the collection.
          </AppText>
        )}
        {c.previews.length > 0 && (
          <View style={styles.previews}>
            {[0, 1, 2, 3].map((i) => {
              const p = c.previews[i];
              return p ? (
                <Photo key={p.item_id} path={p.photo} tintKey={p.item_id} glyph={20} style={styles.preview} />
              ) : (
                <View key={`empty-${i}`} style={[styles.preview, { backgroundColor: 'transparent' }]} />
              );
            })}
          </View>
        )}
        <AppText variant="meta" color={colors.textSecondary}>
          {meta}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCanvas },
  list: { paddingHorizontal: spacing.gutter },
  headerWrap: { gap: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 8 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  search: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
  searchInput: { flex: 1, minWidth: 0, ...typeScale.body, color: colors.textPrimary, paddingVertical: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 },
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  more: { marginVertical: -10, marginRight: -10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previews: { flexDirection: 'row', gap: 8 },
  preview: { flex: 1, aspectRatio: 1, borderRadius: radii.thumb },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
});
