import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, FilterIcon, PlusIcon, ShareIcon } from '@/components/Icons';
import {
  AppText,
  EmptyState,
  FilterPill,
  IconButton,
  OriginTag,
  Photo,
  PrimaryButton,
  SegmentedControl,
  STATUS_META,
  StatusChip,
} from '@/components/ui';
import { collectionCounts, getCollection } from '@/db/repositories/collections';
import { earliestAcquisition, listItems } from '@/db/repositories/items';
import { ITEM_STATUSES, type CollectibleItem, type ItemStatus } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { JournalTimeline } from '@/features/journal/JournalTimeline';
import { formatMonthYear } from '@/lib/dates';
import { goBack } from '@/lib/nav';
import { colors, fonts, radii, shadows, spacing } from '@/theme';

type Tab = 'gallery' | 'journal';

/** 03 · Collection Gallery and 05 · Progress Journal: two tabs of one collection screen. */
export function CollectionScreen({ tab }: { tab: Tab }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const collection = useQuery(() => getCollection(id), [id]);
  const counts = useQuery(() => collectionCounts(id), [id]);
  const since = useQuery(() => earliestAcquisition(id), [id]);
  const [showFilter, setShowFilter] = useState(false);
  const [status, setStatus] = useState<ItemStatus | undefined>();

  const c = collection.data;
  const n = counts.data;
  const total = n ? n.owned + n.wishlist + n.in_transit : 0;
  const tally = n
    ? [
        `${total} ${total === 1 ? 'item' : 'items'}`,
        n.owned ? `${n.owned} owned` : null,
        n.wishlist ? `${n.wishlist} wishlist` : null,
        n.in_transit ? `${n.in_transit} in transit` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const share = () => {
    if (!c) return;
    Share.share({ message: `${c.name} — ${tally}. Tracked in Grailbox.` }).catch(() => {});
  };

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    router.replace(next === 'journal' ? `/collection/${id}/journal` : `/collection/${id}`);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <IconButton label="Back to collections" variant="plain" onPress={() => goBack(router)}>
          <ChevronLeftIcon size={22} />
        </IconButton>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton label={tab === 'journal' ? 'Share journal' : 'Share collection'} onPress={share}>
            <ShareIcon size={19} />
          </IconButton>
          {tab === 'gallery' && (
            <IconButton
              label="Filter items by status"
              selected={showFilter || !!status}
              onPress={() => setShowFilter((s) => !s)}
              style={(showFilter || status) && { backgroundColor: colors.textPrimary }}
            >
              <FilterIcon size={19} color={showFilter || status ? colors.white : colors.textPrimary} />
            </IconButton>
          )}
        </View>
      </View>
      <View style={styles.titleBlock}>
        <AppText variant="largeTitle" accessibilityRole="header">
          {c?.name ?? ''}
        </AppText>
        <AppText variant="label" style={{ fontFamily: fonts.regular }} color={colors.textSecondary}>
          {tab === 'gallery' ? tally : since.data ? `Collecting since ${formatMonthYear(since.data)}` : tally}
        </AppText>
      </View>
      <View style={styles.gutter}>
        <SegmentedControl
          label="Collection view"
          height={36}
          value={tab}
          onChange={switchTab}
          options={[
            { value: 'gallery', label: 'Gallery' },
            { value: 'journal', label: 'Journal' },
          ]}
        />
      </View>
    </View>
  );

  if (collection.data === undefined && !collection.loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <EmptyState
          title="This collection is gone"
          body="It may have been deleted."
          action={<PrimaryButton label="Back to collections" onPress={() => router.replace('/dashboard')} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {tab === 'gallery' ? (
        <Gallery
          collectionId={id}
          categories={c?.categories ?? []}
          header={header}
          status={status}
          showStatusFilter={showFilter || !!status}
          onStatus={setStatus}
        />
      ) : (
        <JournalTimeline collectionId={id} header={header} />
      )}
      {tab === 'gallery' && (
        <View style={[styles.floating, { bottom: Math.max(insets.bottom, 24) }]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to Set"
            accessibilityHint="Adds a new item to this collection"
            onPress={() => router.push(`/item/form?collectionId=${id}`)}
            style={({ pressed }) => [styles.addPill, pressed && { opacity: 0.85 }]}
            testID="gallery-add"
          >
            <PlusIcon size={18} color={colors.white} />
            <AppText variant="button" color={colors.white}>
              Add to Set
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Gallery({
  collectionId,
  categories,
  header,
  status,
  showStatusFilter,
  onStatus,
}: {
  collectionId: string;
  categories: string[];
  header: React.ReactElement;
  status?: ItemStatus;
  showStatusFilter: boolean;
  onStatus: (s: ItemStatus | undefined) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const items = useQuery(() => listItems(collectionId), [collectionId]);
  const [category, setCategory] = useState<string>('All');

  const byStatus = useMemo(
    () => (items.data ?? []).filter((i) => !status || i.status === status),
    [items.data, status],
  );
  const shown = useMemo(
    () => (category === 'All' ? byStatus : byStatus.filter((i) => i.category === category)),
    [byStatus, category],
  );
  const pills = [
    { key: 'All', label: `All (${byStatus.length})` },
    ...categories.map((cat) => ({ key: cat, label: `${cat} (${byStatus.filter((i) => i.category === cat).length})` })),
  ];
  const tile = Math.floor((width - spacing.gutter * 2 - 12) / 2);

  const listHeader = (
    <View style={{ gap: 16, paddingBottom: 16 }}>
      {header}
      {showStatusFilter && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          <FilterPill label="Any status" selected={!status} onPress={() => onStatus(undefined)} />
          {ITEM_STATUSES.map((s) => (
            <FilterPill key={s} label={STATUS_META[s].label} selected={status === s} onPress={() => onStatus(status === s ? undefined : s)} />
          ))}
        </ScrollView>
      )}
      {pills.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {pills.map((p) => (
            <FilterPill key={p.key} label={p.label} selected={category === p.key} onPress={() => setCategory(p.key)} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <FlatList<CollectibleItem>
      data={shown}
      keyExtractor={(i) => i.id}
      numColumns={2}
      ListHeaderComponent={listHeader}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      ListEmptyComponent={
        items.loading ? undefined : (
          <EmptyState
            title={items.data?.length ? 'Nothing matches this filter' : 'No items in this set yet'}
            body={items.data?.length ? 'Try another category or status.' : 'Add what you own, or spot something you want.'}
          />
        )
      }
      renderItem={({ item }) => (
        <GalleryTile item={item} size={tile} onPress={() => router.push(`/item/${item.id}`)} />
      )}
    />
  );
}

function GalleryTile({ item, size, onPress }: { item: CollectibleItem; size: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${STATUS_META[item.status].label}. ${item.origin === 'FAN' ? 'Fan-made' : 'Official'}${item.line ? `, ${item.line}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, gap: 10 }, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Photo path={item.photos[0]} tintKey={item.id} glyph={28} style={[styles.tilePhoto, { width: size, height: size }]} />
        <StatusChip status={item.status} style={styles.tileChip} />
      </View>
      <View style={{ gap: 4, paddingHorizontal: 2 }}>
        <AppText variant="cardTitleSmall">{item.title}</AppText>
        <View style={styles.tileMeta}>
          <OriginTag origin={item.origin} />
          {item.line ? (
            <AppText variant="meta" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.line}
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCanvas },
  header: { gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  titleBlock: { gap: 2, paddingHorizontal: spacing.gutter },
  gutter: { paddingHorizontal: spacing.gutter },
  pills: { gap: 8, paddingHorizontal: spacing.gutter, paddingVertical: 2 },
  columns: { gap: 12, paddingHorizontal: spacing.gutter, marginBottom: 20 },
  tilePhoto: { borderRadius: radii.cardSmall },
  tileChip: { position: 'absolute', left: 10, top: 10 },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  floating: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  addPill: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: radii.full,
    backgroundColor: colors.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: shadows.pillButton,
  },
});
