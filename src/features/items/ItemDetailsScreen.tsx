import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronLeftIcon,
  DupeCheckIcon,
  EditIcon,
  LinkIcon,
  PinIcon,
  PriceTagIcon,
  ShareIcon,
  StarIcon,
  StorageIcon,
} from '@/components/Icons';
import {
  AppText,
  Chip,
  CONDITION_META,
  EmptyState,
  IconButton,
  OriginTag,
  Photo,
  PrimaryButton,
  PRIORITY_LABEL,
  StatusChip,
  TagChip,
} from '@/components/ui';
import { getCollection } from '@/db/repositories/collections';
import { markDupeCheck, referenceCount } from '@/db/repositories/embeddings';
import { getItem } from '@/db/repositories/items';
import type { CollectibleItem } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { formatMonthYear } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { photoUri } from '@/lib/photos';
import { colors, fonts, radii, shadows, spacing } from '@/theme';

const HERO = 404;

/** 04 · Item Details & Provenance. */
export function ItemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const item = useQuery(() => getItem(id), [id]);
  const collection = useQuery(async () => (item.data ? getCollection(item.data.collection_id) : undefined), [item.data?.collection_id]);
  const refs = useQuery(() => referenceCount(id), [id]);
  const [page, setPage] = useState(0);

  const it = item.data;
  if (!it) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        {!item.loading && (
          <EmptyState
            title="This item is gone"
            body="It may have been deleted."
            action={<PrimaryButton label="Go back" onPress={() => goBack(router)} />}
          />
        )}
      </View>
    );
  }

  const heroPhotos = it.photos.length ? it.photos : [undefined];

  const onDupeCheck = async () => {
    if (it.photos.length === 0) {
      Alert.alert('Add a photo first', 'The scanner matches by photo. Edit the item to add one, then try again.');
      return;
    }
    const { added, total } = await markDupeCheck(it.id);
    const msg = added
      ? `Added ${added} ${added === 1 ? 'photo' : 'photos'} to the scanner's reference set.`
      : `Already in the reference set (${total} ${total === 1 ? 'photo' : 'photos'}).`;
    AccessibilityInfo.announceForAccessibility(msg);
    Alert.alert('Dupe check', msg);
  };

  const onShare = () => shareItem(it, collection.data?.name);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} bounces={false}>
        <View style={{ height: HERO }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            accessibilityLabel={`Photos of ${it.title}`}
          >
            {heroPhotos.map((p, i) => (
              <Photo
                key={p ?? 'placeholder'}
                path={p}
                size="full"
                tintKey={it.id}
                glyph={44}
                style={{ width, height: HERO }}
                label={`Photo ${i + 1} of ${heroPhotos.length} of ${it.title}`}
              />
            ))}
          </ScrollView>
          {heroPhotos.length > 1 && (
            <View style={styles.dots} accessible={false}>
              {heroPhotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={{ gap: 10 }}>
            <AppText variant="largeTitle" accessibilityRole="header">
              {it.title}
            </AppText>
            {it.line ? <LineLink item={it} /> : null}
            <View style={styles.chips}>
              <StatusChip status={it.status} quantity={it.status === 'WISHLIST' ? undefined : it.quantity} size="md" />
              <OriginTag origin={it.origin} long />
              {it.status === 'WISHLIST' && it.priority ? (
                <Chip
                  label={`Priority: ${PRIORITY_LABEL[it.priority]}`}
                  bg={it.priority === 'GRAIL' ? colors.statusAlertBg : colors.tagBg}
                  fg={it.priority === 'GRAIL' ? colors.statusAlertText : colors.tagText}
                />
              ) : null}
              {it.category ? <TagChip label={it.category} /> : null}
              {it.variant_tags.map((t) => (
                <TagChip key={t} label={t} />
              ))}
            </View>
          </View>

          <Specs item={it} />
          <Provenance item={it} />

          <View style={styles.actions}>
            <ActionTile
              label={refs.data ? 'In Dupe Check' : 'Mark as Dupe Check'}
              hint="Adds this item's photos to the scanner's reference set"
              icon={<DupeCheckIcon size={20} />}
              onPress={onDupeCheck}
            />
            <ActionTile
              label="Add to Wishlist"
              hint="Spot a second copy or a variant"
              icon={<StarIcon size={20} />}
              onPress={() => router.push(`/wishlist/new?fromItem=${it.id}`)}
            />
            <ActionTile label="Share" icon={<ShareIcon size={20} />} onPress={onShare} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topButtons, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton label="Back" variant="floating" round onPress={() => goBack(router)}>
          <ChevronLeftIcon size={20} />
        </IconButton>
        <IconButton label="Edit item" variant="floating" round onPress={() => router.push(`/item/form?id=${it.id}`)} testID="item-edit">
          <EditIcon size={18} />
        </IconButton>
      </View>
    </View>
  );
}

async function shareItem(it: CollectibleItem, collectionName?: string) {
  const message = [it.title, it.line, collectionName].filter(Boolean).join(' · ');
  const uri = photoUri(it.photos[0]);
  try {
    if (uri && Platform.OS === 'ios') {
      await Share.share({ url: uri, message });
    } else if (uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { dialogTitle: message, mimeType: 'image/jpeg' });
    } else {
      await Share.share({ message });
    }
  } catch {
    // The user closed the share sheet.
  }
}

function LineLink({ item }: { item: CollectibleItem }) {
  if (!item.line_url) {
    return (
      <AppText variant="label" color={colors.textSecondary}>
        {item.line}
      </AppText>
    );
  }
  const url = /^https?:\/\//i.test(item.line_url) ? item.line_url : `https://${item.line_url}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.line}, opens their page in the browser`}
      onPress={() => Linking.openURL(url).catch(() => Alert.alert('Could not open the link', url))}
      style={styles.lineLink}
      hitSlop={10}
    >
      <AppText variant="label" color={colors.brandPrimary} style={{ textDecorationLine: 'underline' }}>
        {item.line}
      </AppText>
      <LinkIcon size={14} color={colors.brandPrimary} />
    </Pressable>
  );
}

function Specs({ item }: { item: CollectibleItem }) {
  const s = item.specs;
  const fields = [
    { k: 'Release year', v: s.release_year?.toString() },
    { k: 'Manufacturer', v: s.manufacturer },
    { k: 'Size', v: s.size },
    { k: 'Barcode / SKU', v: s.barcode },
  ].filter((f) => f.v);
  if (fields.length === 0) return null;
  return (
    <View style={styles.card}>
      <AppText variant="sectionHeading" accessibilityRole="header">
        Specifications
      </AppText>
      <View style={styles.grid}>
        {fields.map((f) => (
          <View key={f.k} style={styles.gridCell} accessible accessibilityLabel={`${f.k}: ${f.v}`}>
            <AppText variant="meta" color={colors.textSecondary}>
              {f.k}
            </AppText>
            <AppText variant="body" style={{ fontFamily: fonts.medium }} selectable>
              {f.v}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Provenance({ item }: { item: CollectibleItem }) {
  const wish = item.status === 'WISHLIST';
  const rows: { icon: React.ReactNode; title: string; sub: string; chip?: string }[] = [];
  if (wish) {
    if (item.estimated_price !== undefined) {
      rows.push({ icon: <PriceTagIcon size={18} />, title: formatMoney(item.estimated_price, item.currency), sub: 'Target price' });
    }
  } else {
    if (item.acquisition_source || item.acquisition_date) {
      const verb = item.status === 'IN_TRANSIT' ? 'Ordered' : 'Acquired';
      const when = item.acquisition_date ? `${verb} ${formatMonthYear(item.acquisition_date)}` : undefined;
      rows.push({
        icon: <PinIcon size={18} />,
        // Without a store, the date is the headline.
        title: item.acquisition_source ?? when ?? '',
        sub: item.acquisition_source ? (when ?? (item.status === 'IN_TRANSIT' ? 'In transit' : 'Acquired')) : 'Acquisition date',
      });
    }
    if (item.purchase_price !== undefined || item.condition) {
      rows.push({
        icon: <PriceTagIcon size={18} />,
        title: item.purchase_price !== undefined ? formatMoney(item.purchase_price, item.currency) : 'Price not set',
        sub: 'Purchase price',
        chip: item.condition ? CONDITION_META[item.condition].long : undefined,
      });
    }
  }
  if (item.storage_location) {
    rows.push({ icon: <StorageIcon size={18} />, title: item.storage_location, sub: 'Storage location' });
  }
  if (rows.length === 0) return null;
  return (
    <View style={[styles.card, { gap: 14 }]}>
      <AppText variant="sectionHeading" accessibilityRole="header">
        {wish ? 'Wishlist details' : 'Acquisition history'}
      </AppText>
      {rows.map((r) => (
        <View key={r.sub} style={styles.provRow} accessible accessibilityLabel={`${r.sub}: ${r.title}${r.chip ? `, ${r.chip}` : ''}`}>
          <View style={styles.provIcon}>{r.icon}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="body" style={{ fontFamily: fonts.medium }}>
              {r.title}
            </AppText>
            <AppText variant="meta" color={colors.textSecondary}>
              {r.sub}
            </AppText>
          </View>
          {r.chip ? <Chip label={r.chip} bg={colors.statusOwnedBg} fg={colors.statusOwnedText} size="sm" /> : null}
        </View>
      ))}
    </View>
  );
}

function ActionTile({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      {icon}
      <AppText variant="metaMedium" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCanvas },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 42, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: 'rgba(15, 23, 42, 0.25)' },
  dotOn: { width: 18, backgroundColor: colors.textPrimary },
  sheet: {
    marginTop: -24,
    gap: 16,
    paddingTop: 24,
    paddingHorizontal: spacing.gutter,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surfaceCanvas,
  },
  lineLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: {
    gap: 16,
    padding: 18,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceCard,
    boxShadow: shadows.ambient,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  gridCell: { width: '50%', gap: 2, paddingRight: 12 },
  provRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  provIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minHeight: 76,
    padding: 10,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  topButtons: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
});
