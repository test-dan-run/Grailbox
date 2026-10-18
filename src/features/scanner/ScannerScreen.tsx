import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon, FlashIcon, ImageIcon, StarFilledIcon, WarningIcon } from '@/components/Icons';
import { AppText, CONDITION_META, IconButton, Photo, PRIORITY_LABEL, PrimaryButton, SecondaryButton } from '@/components/ui';
import { findByBarcode, grailboxTotals, type BarcodeMatch } from '@/db/repositories/items';
import { useQuery } from '@/db/useQuery';
import { formatMoney } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { colors, fonts, radii, shadows, spacing, type as typeScale } from '@/theme';

/*
 * 06 · Scanner & Dupe Verifier, phase 1: exact barcode matching against
 * specs.barcode. Four banner states: matching, already owned, on wishlist,
 * no match. No photo leaves the device.
 */

type ScanState =
  | { kind: 'matching' }
  | { kind: 'owned'; match: BarcodeMatch; code: string }
  | { kind: 'wishlist'; match: BarcodeMatch; code: string }
  | { kind: 'nomatch'; code: string };

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr', 'datamatrix'];
const FRAME = 272;

export function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'matching' });
  const [flash, setFlash] = useState(false);
  const busy = useRef(false);
  const totals = useQuery(grailboxTotals, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const onScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    const code = result.data.trim();
    const match = await findByBarcode(code);
    if (!match) {
      setState({ kind: 'nomatch', code });
      AccessibilityInfo.announceForAccessibility('No match. This item is not in your Grailbox yet.');
      return;
    }
    if (match.item.status === 'WISHLIST') {
      setState({ kind: 'wishlist', match, code });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility(`On wishlist: ${match.item.title}. You wanted this!`);
    } else {
      setState({ kind: 'owned', match, code });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      AccessibilityInfo.announceForAccessibility(`Already owned: ${match.item.title}.`);
    }
  }, []);

  const scanAgain = () => {
    busy.current = false;
    setState({ kind: 'matching' });
  };

  const matching = state.kind === 'matching';
  const granted = !!permission?.granted;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {granted && focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flash}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={matching ? onScanned : undefined}
          accessible
          accessibilityLabel="Live camera view"
        />
      ) : (
        <View style={styles.cameraPlaceholder} accessible accessibilityLabel="Camera is off">
          <ImageIcon size={40} color={colors.textSecondary} strokeWidth={1.4} />
        </View>
      )}

      <Guides sweeping={matching && granted && !reduceMotion} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topButtons}>
          <IconButton label="Close scanner" variant="camera" round onPress={() => goBack(router)} testID="scanner-close">
            <CloseIcon color={colors.white} />
          </IconButton>
          <IconButton
            label="Toggle flash"
            variant="camera"
            round
            selected={flash}
            onPress={() => setFlash((f) => !f)}
            style={flash && { backgroundColor: colors.statusAlertBg }}
            testID="scanner-flash"
          >
            <FlashIcon color={flash ? colors.statusAlertText : colors.white} />
          </IconButton>
        </View>

        {!granted ? (
          <PermissionCard
            canAsk={permission?.canAskAgain ?? true}
            onAsk={requestPermission}
            onSearch={() => router.dismissTo('/dashboard?search=1')}
          />
        ) : state.kind === 'matching' ? (
          <MatchingBanner items={totals.data?.items} collections={totals.data?.collections} still={reduceMotion} />
        ) : state.kind === 'owned' ? (
          <OwnedBanner match={state.match} />
        ) : state.kind === 'wishlist' ? (
          <WishlistBanner match={state.match} />
        ) : (
          <NoMatchBanner
            code={state.code}
            onAdd={() => router.push(`/item/form?status=OWNED&barcode=${encodeURIComponent(state.code)}`)}
            onSpot={() => router.push(`/wishlist/new?barcode=${encodeURIComponent(state.code)}`)}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        {matching && granted && (
          <View style={{ alignItems: 'center', gap: 2, marginBottom: 6 }}>
            <AppText variant="label" style={{ fontFamily: fonts.regular, textAlign: 'center' }} color="#CBD5E1">
              Hold steady — center the item in the frame
            </AppText>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.dismissTo('/dashboard?search=1')}
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
              testID="scanner-search-instead"
            >
              <AppText variant="label" color="#5EEAD4" style={{ textDecorationLine: 'underline' }}>
                No barcode? Search instead
              </AppText>
            </Pressable>
          </View>
        )}
        {state.kind === 'owned' && (
          <PrimaryButton label="View Existing Item in Grailbox" onPress={() => router.push(`/item/${state.match.item.id}`)} />
        )}
        {state.kind === 'wishlist' && (
          <PrimaryButton label="View on Wishlist" onPress={() => router.push(`/item/${state.match.item.id}`)} />
        )}
        <SecondaryButton
          label={matching ? 'Cancel' : 'Scan Again'}
          color={colors.white}
          background="rgba(255, 255, 255, 0.14)"
          onPress={matching ? () => goBack(router) : scanAgain}
          testID="scanner-secondary"
        />
      </View>
    </View>
  );
}

/** Four white rounded corner guides, with a teal line sweeping while matching. */
function Guides({ sweeping }: { sweeping: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (sweeping) {
      t.value = 0;
      t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(t);
    }
  }, [sweeping, t]);
  const line = useAnimatedStyle(() => ({ top: FRAME * (0.08 + 0.8 * t.value) }));
  return (
    <View style={styles.frame} pointerEvents="none" accessible={false}>
      <View style={[styles.corner, { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 22 }]} />
      <View style={[styles.corner, { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 22 }]} />
      <View style={[styles.corner, { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 22 }]} />
      <View style={[styles.corner, { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 22 }]} />
      {sweeping && <Animated.View style={[styles.scanLine, line]} />}
    </View>
  );
}

function MatchingBanner({ items, collections, still }: { items?: number; collections?: number; still: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!still) t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1);
  }, [still, t]);
  const bar = useAnimatedStyle(() => ({ left: `${-40 + 140 * t.value}%` }));
  const sub =
    items === undefined
      ? 'Getting ready…'
      : `Checking ${items} ${items === 1 ? 'item' : 'items'} across ${collections} ${collections === 1 ? 'collection' : 'collections'}`;
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surfaceCard }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Matching against your Grailbox. ${sub}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.bannerHead}>
        <ActivityIndicator color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontFamily: typeScale.button.fontFamily }}>
            Matching against your Grailbox…
          </AppText>
          <AppText variant="meta" color={colors.textSecondary}>
            {sub}
          </AppText>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.trackBar, still ? { left: '30%' } : bar]} />
      </View>
    </View>
  );
}

function matchLine(m: BarcodeMatch, kind: 'owned' | 'wishlist') {
  const it = m.item;
  const parts = [m.collection_name];
  if (kind === 'owned') {
    if (it.condition) parts.push(CONDITION_META[it.condition].short);
    if (it.purchase_price !== undefined) parts.push(formatMoney(it.purchase_price, it.currency));
  } else if (it.estimated_price !== undefined) {
    parts.push(`Target ${formatMoney(it.estimated_price, it.currency)}`);
  }
  return parts.join(' · ');
}

function MatchRow({ m, kind }: { m: BarcodeMatch; kind: 'owned' | 'wishlist' }) {
  return (
    <View style={styles.matchRow}>
      <Photo path={m.item.photos[0]} tintKey={m.item.id} glyph={18} style={styles.matchPhoto} label={`Photo of ${m.item.title}`} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" style={{ fontFamily: typeScale.button.fontFamily }} numberOfLines={2}>
          {m.item.title}
        </AppText>
        <AppText variant="meta" color={colors.textSecondary} numberOfLines={2}>
          {matchLine(m, kind)}
        </AppText>
      </View>
      {kind === 'owned' && (
        <View style={styles.confidence}>
          <AppText variant="chip" color={colors.statusOwnedText}>
            Barcode match
          </AppText>
        </View>
      )}
    </View>
  );
}

function OwnedBanner({ match }: { match: BarcodeMatch }) {
  const it = match.item;
  const where = it.status === 'IN_TRANSIT' ? 'In transit' : it.storage_location;
  const sub = `${it.quantity} in Grailbox${where ? ` — ${where}` : ''}`;
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.statusAlertBg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`Already owned. ${sub}. ${it.title}, ${matchLine(match, 'owned')}`}
    >
      <View style={styles.bannerHead}>
        <WarningIcon size={22} color={colors.statusAlertText} />
        <View style={{ flex: 1 }}>
          <AppText variant="meta" style={styles.bannerKicker} color={colors.statusAlertText}>
            ALREADY OWNED
          </AppText>
          <AppText variant="body" style={{ fontFamily: typeScale.label.fontFamily }} color={colors.statusAlertText}>
            {sub}
          </AppText>
        </View>
      </View>
      <MatchRow m={match} kind="owned" />
    </View>
  );
}

function WishlistBanner({ match }: { match: BarcodeMatch }) {
  const p = match.item.priority;
  const kicker = `ON WISHLIST${p ? ` · PRIORITY: ${PRIORITY_LABEL[p].toUpperCase()}` : ''}`;
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.statusWishBg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${kicker}. You wanted this! ${match.item.title}, ${matchLine(match, 'wishlist')}`}
    >
      <View style={styles.bannerHead}>
        <StarFilledIcon size={22} color={colors.statusWishText} />
        <View style={{ flex: 1 }}>
          <AppText variant="meta" style={styles.bannerKicker} color={colors.statusWishText}>
            {kicker}
          </AppText>
          <AppText variant="body" style={{ fontFamily: typeScale.label.fontFamily }} color={colors.statusWishText}>
            You wanted this!
          </AppText>
        </View>
      </View>
      <MatchRow m={match} kind="wishlist" />
    </View>
  );
}

function NoMatchBanner({ code, onAdd, onSpot }: { code: string; onAdd: () => void; onSpot: () => void }) {
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surfaceCard }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={{ gap: 2 }}>
        <AppText variant="meta" style={styles.bannerKicker} color={colors.textSecondary}>
          NO MATCH
        </AppText>
        <AppText variant="body" style={{ fontFamily: typeScale.button.fontFamily }}>
          Not in your Grailbox yet
        </AppText>
        <AppText variant="meta" color={colors.textSecondary} selectable>
          Code {code}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SecondaryButton label="Add to collection" onPress={onAdd} style={{ flex: 1, paddingHorizontal: 8 }} />
        <SecondaryButton label="Spot for wishlist" onPress={onSpot} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>
    </View>
  );
}

function PermissionCard({ canAsk, onAsk, onSearch }: { canAsk: boolean; onAsk: () => void; onSearch: () => void }) {
  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceCard }]} accessibilityRole="alert">
      <AppText variant="body" style={{ fontFamily: typeScale.button.fontFamily }}>
        Grailbox needs the camera to scan
      </AppText>
      <AppText variant="meta" color={colors.textSecondary}>
        Codes are read on this phone. Nothing is uploaded.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SecondaryButton
          label={canAsk ? 'Allow camera' : 'Open Settings'}
          onPress={canAsk ? onAsk : () => Linking.openSettings()}
          style={{ flex: 1, paddingHorizontal: 8 }}
        />
        <SecondaryButton label="Search instead" onPress={onSearch} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cameraGround },
  cameraPlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: FRAME,
    height: FRAME,
    marginLeft: -FRAME / 2,
    marginTop: -FRAME / 2,
  },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: colors.white },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    borderRadius: radii.full,
    backgroundColor: '#5EEAD4',
    boxShadow: '0px 0px 14px 2px rgba(94, 234, 212, 0.55)',
  },
  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 12, paddingHorizontal: 16 },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  banner: { gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radii.cardSmall, boxShadow: shadows.floating },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerKicker: { fontFamily: fonts.bold, letterSpacing: 0.72 },
  track: { height: 4, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  trackBar: { position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: radii.full, backgroundColor: colors.brandPrimary },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: radii.input,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  matchPhoto: { width: 44, height: 44, borderRadius: 10 },
  confidence: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: colors.statusOwnedBg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: spacing.gutter },
});
