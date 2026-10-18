import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, ChevronRightIcon, EditIcon, ShareIcon } from '@/components/Icons';
import { ItemRow } from '@/components/ItemRow';
import { AppText, EmptyState, GrailChip, IconButton, Photo, PrimaryButton, TagChip } from '@/components/ui';
import { getCollection } from '@/db/repositories/collections';
import { getItems } from '@/db/repositories/items';
import { entryNeighbours, getEntry } from '@/db/repositories/journal';
import type { JournalEntry } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { formatMonthYear } from '@/lib/dates';
import { goBack } from '@/lib/nav';
import { photoUri } from '@/lib/photos';
import { colors, fonts, radii, spacing } from '@/theme';

import { ENTRY_TYPE_LABEL, entryPhotos } from './JournalTimeline';

const HERO = 440;

/** 05a · Journal Entry (expanded). */
export function JournalEntryScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const entry = useQuery(() => getEntry(entryId), [entryId]);
  const e = entry.data;
  const collection = useQuery(async () => (e ? getCollection(e.collection_id) : undefined), [e?.collection_id]);
  const tagged = useQuery(() => getItems(e?.item_ids ?? []), [e?.item_ids.join(',')]);
  const neighbours = useQuery(
    async (): Promise<{ earlier?: JournalEntry; later?: JournalEntry }> => (e ? entryNeighbours(e) : {}),
    [e?.id, e?.date],
  );
  const [current, setCurrent] = useState(0);

  const itemsById = useMemo(() => new Map((tagged.data ?? []).map((i) => [i.id, i])), [tagged.data]);
  const photos = e ? entryPhotos(e, itemsById) : [];
  const shown = photos.length ? photos : [{ key: entryId, path: undefined }];
  const hero = shown[Math.min(current, shown.length - 1)];

  if (!e) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        {!entry.loading && (
          <EmptyState
            title="This entry is gone"
            body="It may have been deleted."
            action={<PrimaryButton label="Go back" onPress={() => goBack(router)} />}
          />
        )}
      </View>
    );
  }

  const share = async () => {
    const message = `${e.title} · ${formatMonthYear(e.date)}${collection.data ? ` · ${collection.data.name}` : ''}`;
    const uri = photoUri(e.photos[0]);
    try {
      if (uri && Platform.OS === 'ios') await Share.share({ url: uri, message });
      else if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { dialogTitle: message, mimeType: 'image/jpeg' });
      else await Share.share({ message: e.notes ? `${message}\n\n${e.notes}` : message });
    } catch {
      // The user closed the share sheet.
    }
  };

  // Earlier / Later replace this screen, so Back still returns to the timeline.
  const openEntry = (other: JournalEntry) => router.replace(`/journal/${other.id}`);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} bounces={false}>
        <Photo
          path={hero.path}
          tintKey={hero.key}
          size="full"
          glyph={44}
          style={{ width, height: HERO }}
          label={`Photo ${current + 1} of ${shown.length}`}
        />
        {shown.length > 1 && (
          <View style={styles.counter} accessible={false}>
            <AppText variant="chip" style={{ fontSize: 12 }} color={colors.white}>
              {current + 1} / {shown.length}
            </AppText>
          </View>
        )}
        <View style={styles.sheet}>
          <View style={{ gap: 10 }}>
            <View style={styles.chips}>
              {e.is_grail && <GrailChip withIcon />}
              <TagChip label={ENTRY_TYPE_LABEL[e.entry_type]} />
            </View>
            <View style={{ gap: 2 }}>
              <AppText variant="largeTitle" accessibilityRole="header">
                {e.title}
              </AppText>
              <AppText variant="label" style={{ fontFamily: fonts.regular }} color={colors.textSecondary}>
                {formatMonthYear(e.date)}
                {collection.data ? ` · ${collection.data.name}` : ''}
              </AppText>
            </View>
          </View>

          {shown.length > 1 && (
            <View style={styles.thumbs}>
              {shown.slice(0, 8).map((p, i) => (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Show photo ${i + 1}`}
                  accessibilityState={{ selected: i === current }}
                  onPress={() => setCurrent(i)}
                  style={[styles.thumbBox, i === current ? styles.thumbOn : { opacity: 0.8 }]}
                >
                  <Photo path={p.path} tintKey={p.key} glyph={18} style={styles.thumb} />
                </Pressable>
              ))}
            </View>
          )}

          {e.notes ? (
            <View style={{ gap: 8 }}>
              <AppText variant="label" color={colors.textSecondary} accessibilityRole="header">
                Collector note
              </AppText>
              <AppText variant="bodyLong" color="#1E293B">
                {e.notes}
              </AppText>
            </View>
          ) : null}

          {(tagged.data?.length ?? 0) > 0 && (
            <View style={{ gap: 10 }}>
              <AppText variant="label" color={colors.textSecondary} accessibilityRole="header">
                Tagged in this entry
              </AppText>
              {tagged.data!.map((it) => (
                <ItemRow key={it.id} item={it} onPress={() => router.push(`/item/${it.id}`)} />
              ))}
            </View>
          )}

          {(neighbours.data?.earlier || neighbours.data?.later) && (
            <View style={styles.nav} accessibilityLabel="More journal entries">
              {neighbours.data?.earlier ? (
                <NeighbourCard entry={neighbours.data.earlier} dir="earlier" onPress={openEntry} />
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {neighbours.data?.later ? (
                <NeighbourCard entry={neighbours.data.later} dir="later" onPress={openEntry} />
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.topButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton label="Back to journal" variant="floating" round onPress={() => goBack(router)}>
          <ChevronLeftIcon size={20} />
        </IconButton>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton label="Share entry" variant="floating" round onPress={share}>
            <ShareIcon size={18} />
          </IconButton>
          <IconButton label="Edit entry" variant="floating" round onPress={() => router.push(`/journal/form?id=${e.id}`)}>
            <EditIcon size={18} />
          </IconButton>
        </View>
      </View>
    </View>
  );
}

function NeighbourCard({
  entry,
  dir,
  onPress,
}: {
  entry: JournalEntry;
  dir: 'earlier' | 'later';
  onPress: (e: JournalEntry) => void;
}) {
  const later = dir === 'later';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${later ? 'Later' : 'Earlier'} entry: ${entry.title}, ${formatMonthYear(entry.date)}`}
      onPress={() => onPress(entry)}
      style={({ pressed }) => [styles.neighbour, later && { alignItems: 'flex-end' }, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.neighbourMeta}>
        {!later && <ChevronLeftIcon size={14} color={colors.textSecondary} strokeWidth={2} />}
        <AppText variant="meta" color={colors.textSecondary}>
          {later ? 'Later' : 'Earlier'} · {formatMonthYear(entry.date)}
        </AppText>
        {later && <ChevronRightIcon size={14} color={colors.textSecondary} strokeWidth={2} />}
      </View>
      <AppText variant="body" style={{ fontFamily: fonts.medium, textAlign: later ? 'right' : 'left' }}>
        {entry.title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCanvas },
  counter: {
    position: 'absolute',
    right: 16,
    top: HERO - 48,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  sheet: {
    marginTop: -20,
    gap: 20,
    paddingTop: 24,
    paddingHorizontal: spacing.gutter,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surfaceCanvas,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbBox: { width: '22.5%', aspectRatio: 1, borderRadius: radii.thumb },
  thumbOn: { boxShadow: `0px 0px 0px 2px ${colors.surfaceCanvas}, 0px 0px 0px 4px ${colors.textPrimary}` },
  thumb: { flex: 1, borderRadius: radii.thumb },
  nav: { flexDirection: 'row', gap: 8, marginTop: 4 },
  neighbour: {
    flex: 1,
    minHeight: 64,
    gap: 2,
    padding: 12,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSubtle,
  },
  neighbourMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topButtons: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
});
