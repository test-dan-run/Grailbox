import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinesIcon, PlusIcon, StarFilledIcon, StarIcon } from '@/components/Icons';
import { AppText, DockedBar, EmptyState, GrailChip, Photo, PrimaryButton, useDockedPadding } from '@/components/ui';
import { listItems } from '@/db/repositories/items';
import { listEntries } from '@/db/repositories/journal';
import type { CollectibleItem, JournalEntry, JournalEntryType } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { formatMonthYear } from '@/lib/dates';
import { colors, fonts, radii, shadows, spacing } from '@/theme';

export const ENTRY_TYPE_LABEL: Record<JournalEntryType, string> = {
  MILESTONE: 'Milestone',
  BATCH_ADD: 'Batch addition',
  NOTE: 'Note',
};

const NODE = 28;
const ROW_GAP = 24;

/** Photos shown for an entry: its own, else its tagged items' covers (or their placeholders). */
export function entryPhotos(entry: JournalEntry, itemsById: Map<string, CollectibleItem>) {
  if (entry.photos.length) return entry.photos.map((p, i) => ({ key: `${entry.id}:${i}`, path: p as string | undefined }));
  return entry.item_ids
    .map((id) => itemsById.get(id))
    .filter((i): i is CollectibleItem => !!i)
    .map((i) => ({ key: i.id, path: i.photos[0] }));
}

/** 05 · Progress Journal: a vertical timeline, newest first. */
export function JournalTimeline({ collectionId, header }: { collectionId: string; header: React.ReactElement }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dockPad = useDockedPadding();
  const entries = useQuery(() => listEntries(collectionId), [collectionId]);
  const items = useQuery(() => listItems(collectionId), [collectionId]);
  const itemsById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const list = entries.data ?? [];

  return (
    <>
      <FlatList<JournalEntry>
        data={list}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={<View style={{ paddingBottom: 24 }}>{header}</View>}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: dockPad }}
        ListEmptyComponent={
          entries.loading ? undefined : (
            <EmptyState
              title="No journal entries yet"
              body="Log a grail find, a haul or a shelf refresh to start the timeline."
            />
          )
        }
        renderItem={({ item, index }) => (
          <TimelineRow
            entry={item}
            last={index === list.length - 1}
            photos={entryPhotos(item, itemsById)}
            onPress={() => router.push(`/journal/${item.id}`)}
          />
        )}
      />
      <DockedBar>
        <PrimaryButton
          label="Upload New Progress Photo / Set"
          icon={<PlusIcon size={18} color={colors.white} />}
          onPress={() => router.push(`/journal/form?collectionId=${collectionId}`)}
          testID="journal-add"
        />
      </DockedBar>
    </>
  );
}

function TimelineRow({
  entry,
  last,
  photos,
  onPress,
}: {
  entry: JournalEntry;
  last: boolean;
  photos: { key: string; path?: string }[];
  onPress: () => void;
}) {
  const dateLine = `${formatMonthYear(entry.date)} · ${ENTRY_TYPE_LABEL[entry.entry_type]}`;
  const label = `Open entry: ${entry.title}, ${formatMonthYear(entry.date)}${entry.is_grail ? ', grail' : ''}`;
  return (
    <View style={styles.row}>
      {/* Dashed spine segment from this node down to the next. */}
      <View style={[styles.spine, { bottom: last ? 0 : -ROW_GAP }]} pointerEvents="none">
        <Svg width={2} height="100%">
          <Line x1={1} y1={0} x2={1} y2="100%" stroke={colors.divider} strokeWidth={2} strokeDasharray="4 4" />
        </Svg>
      </View>
      <Node entry={entry} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.card, entry.entry_type === 'MILESTONE' && styles.milestoneCard, pressed && { opacity: 0.85 }]}
      >
        {entry.entry_type === 'MILESTONE' ? (
          <>
            <View>
              <Photo path={photos[0]?.path} tintKey={photos[0]?.key ?? entry.id} size="full" glyph={30} style={styles.hero} />
              {entry.is_grail && (
                <View style={styles.grailChip}>
                  <GrailChip />
                </View>
              )}
            </View>
            <View style={styles.milestoneBody}>
              <EntryText dateLine={dateLine} entry={entry} />
            </View>
          </>
        ) : entry.entry_type === 'BATCH_ADD' ? (
          <>
            <View style={{ gap: 2 }}>
              <AppText variant="metaMedium" color={colors.textSecondary}>
                {dateLine}
              </AppText>
              <AppText variant="cardTitle">{entry.title}</AppText>
              <AppText variant="label" style={{ fontFamily: fonts.regular }} color={colors.textSecondary}>
                {additionsLabel(entry, photos.length)}
              </AppText>
            </View>
            {photos.length > 0 && <Collage photos={photos} />}
          </>
        ) : (
          <EntryText dateLine={dateLine} entry={entry} />
        )}
      </Pressable>
    </View>
  );
}

function additionsLabel(entry: JournalEntry, photoCount: number) {
  const n = entry.item_ids.length || photoCount;
  return `${n} new ${n === 1 ? 'addition' : 'additions'} uploaded`;
}

function EntryText({ dateLine, entry }: { dateLine: string; entry: JournalEntry }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="metaMedium" color={colors.textSecondary}>
        {dateLine}
      </AppText>
      <AppText variant="cardTitle">{entry.title}</AppText>
      {entry.notes ? (
        <AppText variant="body" color={colors.textBody} numberOfLines={3}>
          {entry.notes}
        </AppText>
      ) : null}
    </View>
  );
}

function Collage({ photos }: { photos: { key: string; path?: string }[] }) {
  const [a, b, c] = photos;
  return (
    <View style={styles.collage}>
      <Photo path={a.path} tintKey={a.key} glyph={22} style={[styles.collageBig, !b && { flex: 1 }]} />
      {b && (
        <View style={styles.collageSide}>
          <Photo path={b.path} tintKey={b.key} glyph={18} style={styles.collageSmall} />
          {c ? <Photo path={c.path} tintKey={c.key} glyph={18} style={styles.collageSmall} /> : <View style={styles.collageSmall} />}
        </View>
      )}
    </View>
  );
}

function Node({ entry }: { entry: JournalEntry }) {
  if (entry.entry_type === 'MILESTONE' && entry.is_grail) {
    return (
      <View style={[styles.node, { backgroundColor: colors.statusAlertBg }]}>
        <StarFilledIcon size={14} color={colors.statusAlertText} />
      </View>
    );
  }
  if (entry.entry_type === 'MILESTONE') {
    return (
      <View style={[styles.node, styles.nodeWhite]}>
        <StarIcon size={14} strokeWidth={2} />
      </View>
    );
  }
  if (entry.entry_type === 'BATCH_ADD') {
    return (
      <View style={[styles.node, styles.nodeWhite]}>
        <PlusIcon size={14} strokeWidth={2.2} />
      </View>
    );
  }
  return (
    <View style={[styles.node, { backgroundColor: colors.surfaceSubtle }]}>
      <LinesIcon size={14} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: spacing.gutter,
    marginBottom: ROW_GAP,
  },
  spine: { position: 'absolute', left: spacing.gutter + NODE / 2 - 1, top: 14, width: 2 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 0px 4px ${colors.surfaceCanvas}`,
  },
  nodeWhite: {
    backgroundColor: colors.surfaceCard,
    boxShadow: `0px 0px 0px 4px ${colors.surfaceCanvas}, 0px 4px 12px -2px rgba(15, 23, 42, 0.12)`,
  },
  card: {
    flex: 1,
    minWidth: 0,
    gap: 12,
    padding: 14,
    borderRadius: radii.journalCard,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
  milestoneCard: { padding: 0, gap: 0, overflow: 'hidden' },
  hero: { height: 168, width: '100%' },
  grailChip: { position: 'absolute', left: 12, top: 12 },
  milestoneBody: { padding: 14 },
  collage: { flexDirection: 'row', gap: 6, height: 114 },
  collageBig: { flex: 2, borderRadius: radii.thumb },
  collageSide: { flex: 1, gap: 6 },
  collageSmall: { flex: 1, borderRadius: radii.thumb },
});
