import { Pressable, StyleSheet, View } from 'react-native';

import type { CollectibleItem } from '@/db/types';
import { colors, radii, shadows } from '@/theme';

import { ChevronRightIcon } from './Icons';
import { AppText, Photo, StatusChip } from './ui';

/** A tappable item row: photo, title, status chip, meta line, chevron. */
export function ItemRow({
  item,
  meta,
  onPress,
  testID,
}: {
  item: CollectibleItem;
  meta?: string;
  onPress: () => void;
  testID?: string;
}) {
  const line = meta ?? [item.line, item.specs.release_year].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.status === 'IN_TRANSIT' ? 'in transit' : item.status.toLowerCase()}${line ? `, ${line}` : ''}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <Photo path={item.photos[0]} tintKey={item.id} style={styles.photo} glyph={18} />
      <View style={styles.body}>
        <AppText variant="cardTitleSmall">{item.title}</AppText>
        <View style={styles.metaRow}>
          <StatusChip status={item.status} />
          {line ? (
            <AppText variant="meta" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
              {line}
            </AppText>
          ) : null}
        </View>
      </View>
      <ChevronRightIcon size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.cardSmall,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
  photo: { width: 52, height: 52, borderRadius: radii.thumb },
  body: { flex: 1, minWidth: 0, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
