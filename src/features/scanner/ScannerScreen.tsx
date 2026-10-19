import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType, type PictureRef } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, ChevronRightIcon, CloseIcon, FlashIcon, ImageIcon, StarFilledIcon, WarningIcon } from '@/components/Icons';
import { AppText, CONDITION_META, IconButton, Photo, PRIORITY_LABEL, PrimaryButton, SecondaryButton } from '@/components/ui';
import { listVectors } from '@/db/repositories/embeddings';
import { findByBarcode, findItemMatches, grailboxTotals, type ItemMatch } from '@/db/repositories/items';
import { useQuery } from '@/db/useQuery';
import { DEMO, DEMO_SCENES, sceneUri } from '@/features/demo/demo';
import { formatMoney } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { colors, fonts, radii, shadows, spacing, type as typeScale } from '@/theme';

import { saveDebugScan } from './debugScans';
import { EMBEDDING_MODEL, embedImage, getEmbeddingModel, type ImageSource } from './embedder';
import { FRAME, Guides } from './Guides';
import { frameCrop, smallestPictureSize, type CropRect } from './preprocess';
import { updateReferences } from './references';
import { decide, MATCH_MIN_GAP, MATCH_THRESHOLD, rankItems } from './similarity';

/*
 * 06 · Scanner & Dupe Verifier. Two ways to match, behind the same four
 * banner states (matching, already owned, on wishlist, no match):
 * - a barcode equal to an item's specs.barcode, read live by the camera;
 * - "Check this item": one photo of the area inside the guides, embedded on
 *   device and ranked against every item photo (similarity.ts).
 * No photo leaves the device. The demo build (features/demo) shows still
 * scenes in place of the camera.
 */

type Via = { by: 'barcode'; code: string } | { by: 'photo'; score: number };

type ScanState =
  | { kind: 'matching'; checking?: boolean }
  | { kind: 'owned'; match: ItemMatch; via: Via }
  | { kind: 'wishlist'; match: ItemMatch; via: Via }
  | { kind: 'nomatch'; code?: string; suggestions: ItemMatch[]; note?: string };

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr', 'datamatrix'];
// Android captures the full sensor by default (3060 × 4080 on the S24+, 0.6 to 0.8 s a check). A 1080 px short side
// still crops to over twice the model's input. Chosen once per app run: '' means no size fit, so keep the default.
const PHOTO_MIN_SIDE = 1080;
let pictureSize: string | undefined;

export function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const screen = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'matching' });
  const [flash, setFlash] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [size, setSize] = useState(pictureSize);
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = DEMO_SCENES[sceneIndex];
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const totals = useQuery(grailboxTotals, []);

  useEffect(() => {
    if (!DEMO && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // The camera unmounts when another screen covers the scanner, and is not ready again until it says so.
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (!focused) setCameraReady(false);
  }

  // Load the model and catch up on reference photos while the user aims.
  useEffect(() => {
    getEmbeddingModel().catch(() => {});
    updateReferences().catch(() => {});
  }, []);

  const showMatch = useCallback((match: ItemMatch, via: Via) => {
    if (match.item.status === 'WISHLIST') {
      setState({ kind: 'wishlist', match, via });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility(`On wishlist: ${match.item.title}. You wanted this!`);
    } else {
      setState({ kind: 'owned', match, via });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      AccessibilityInfo.announceForAccessibility(`Already owned: ${match.item.title}.`);
    }
  }, []);

  const showNoMatch = useCallback((next: Omit<Extract<ScanState, { kind: 'nomatch' }>, 'kind'>) => {
    setState({ kind: 'nomatch', ...next });
    AccessibilityInfo.announceForAccessibility(
      next.note ?? `No match. This item is not in your Grailbox yet.${next.suggestions.length ? ' Closest items are listed.' : ''}`,
    );
  }, []);

  const onScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (busy.current) return;
      busy.current = true;
      const code = result.data.trim();
      const match = await findByBarcode(code);
      if (match) showMatch(match, { by: 'barcode', code });
      else showNoMatch({ code, suggestions: [] });
    },
    [showMatch, showNoMatch],
  );

  const checkPhoto = useCallback(async () => {
    const cam = camera.current;
    if (busy.current || (!DEMO && !cam)) return;
    busy.current = true;
    setState({ kind: 'matching', checking: true });
    let picture: PictureRef | undefined;
    try {
      const t0 = performance.now();
      let source: ImageSource;
      if (DEMO) source = await sceneUri(scene);
      else source = picture = await cam!.takePictureAsync({ pictureRef: true, shutterSound: false });
      const t1 = performance.now();
      let crop: CropRect | undefined;
      const [vector] = await Promise.all([
        // The demo scene fills the screen like the camera preview does, so the same crop applies.
        embedImage(source, (w, h) => (crop = frameCrop(w, h, screen.width, screen.height, FRAME))),
        updateReferences(),
      ]);
      const refs = await listVectors(EMBEDDING_MODEL);
      if (refs.length === 0) {
        showNoMatch({ suggestions: [], note: 'No item photos to compare with yet. Add photos to your items first.' });
        return;
      }
      const ranked = rankItems(vector, refs, 3);
      const result = decide(ranked, MATCH_THRESHOLD, MATCH_MIN_GAP);
      if (__DEV__ && picture) {
        const scores = ranked.map((r) => `${r.item_id.slice(0, 8)} ${r.score.toFixed(3)}`).join(', ');
        const timing = `capture ${Math.round(t1 - t0)} ms (${picture.width}×${picture.height}), embed ${Math.round(performance.now() - t1)} ms`;
        console.log(`[Scanner] ${timing}; scores ${scores}`);
        await saveDebugScan(picture, { crop, screen, ranked }).catch((e) => console.warn('Debug scan not saved', e));
      }
      if (result.kind === 'match') {
        const [match] = await findItemMatches([result.match.item_id]);
        if (match) {
          showMatch(match, { by: 'photo', score: result.match.score });
          return;
        }
      }
      showNoMatch({ suggestions: await findItemMatches(ranked.map((r) => r.item_id)) });
    } catch (e) {
      console.warn('Photo check failed', e);
      busy.current = false;
      setState({ kind: 'matching' });
      Alert.alert('Could not check the photo', String((e as Error).message ?? e));
    } finally {
      picture?.release();
    }
  }, [scene, screen, showMatch, showNoMatch]);

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
    if (Platform.OS !== 'android' || pictureSize !== undefined) return;
    camera.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) => {
        pictureSize = smallestPictureSize(sizes, PHOTO_MIN_SIDE) ?? '';
        // A new size rebinds the camera, which reports ready again once it reopens.
        if (pictureSize) setCameraReady(false);
        setSize(pictureSize);
      })
      .catch(() => {});
  }, []);

  const scanAgain = () => {
    busy.current = false;
    setState({ kind: 'matching' });
    if (DEMO) {
      setCameraReady(false);
      setSceneIndex((i) => (i + 1) % DEMO_SCENES.length);
    }
  };

  const matching = state.kind === 'matching';
  const checking = state.kind === 'matching' && !!state.checking;
  const granted = DEMO || !!permission?.granted;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {granted && focused && DEMO ? (
        <Image
          source={scene.image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onLoad={() => setCameraReady(true)}
          accessible
          accessibilityLabel="Live camera view"
        />
      ) : granted && focused ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={flash}
          animateShutter={false}
          pictureSize={size || undefined}
          onCameraReady={onCameraReady}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          // Stays bound during a photo check (busy ignores codes then): unbinding rebuilds the camera session and aborts the capture.
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
          <OwnedBanner match={state.match} via={state.via} />
        ) : state.kind === 'wishlist' ? (
          <WishlistBanner match={state.match} />
        ) : (
          <NoMatchBanner
            code={state.code}
            note={state.note}
            suggestions={state.suggestions}
            onOpen={(id) => router.push(`/item/${id}`)}
            onAdd={() => router.push(`/item/form?status=OWNED${barcodeParam(state.code)}`)}
            onSpot={() => router.push(state.code ? `/wishlist/new?barcode=${encodeURIComponent(state.code)}` : '/wishlist/new')}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
        {matching && granted && (
          <View style={{ alignItems: 'center', gap: 2, marginBottom: 6 }}>
            <AppText variant="label" style={{ fontFamily: fonts.regular, textAlign: 'center' }} color="#CBD5E1">
              {checking ? 'Hold steady…' : 'Fit the whole item inside the frame, then tap Check'}
            </AppText>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.dismissTo('/dashboard?search=1')}
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
              testID="scanner-search-instead"
            >
              <AppText variant="label" color="#5EEAD4" style={{ textDecorationLine: 'underline' }}>
                Search by name instead
              </AppText>
            </Pressable>
          </View>
        )}
        {matching && granted && (
          <PrimaryButton
            label={checking ? 'Checking…' : 'Check this item'}
            icon={<CameraIcon size={18} color={colors.white} />}
            onPress={checkPhoto}
            disabled={!cameraReady || checking}
            loading={checking}
            accessibilityHint="Takes a photo of the item in the frame and compares it with your item photos"
            testID="scanner-check-photo"
          />
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

function barcodeParam(code?: string) {
  return code ? `&barcode=${encodeURIComponent(code)}` : '';
}

function matchLine(m: ItemMatch, kind: 'owned' | 'wishlist') {
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

function confidenceLabel(via: Via) {
  if (via.by === 'barcode') return 'Barcode match';
  return __DEV__ ? `Photo match ${via.score.toFixed(2)}` : 'Photo match';
}

function MatchRow({ m, kind, via }: { m: ItemMatch; kind: 'owned' | 'wishlist'; via?: Via }) {
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
      {kind === 'owned' && via && (
        <View style={styles.confidence}>
          <AppText variant="chip" color={colors.statusOwnedText}>
            {confidenceLabel(via)}
          </AppText>
        </View>
      )}
    </View>
  );
}

function OwnedBanner({ match, via }: { match: ItemMatch; via: Via }) {
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
      <MatchRow m={match} kind="owned" via={via} />
    </View>
  );
}

function WishlistBanner({ match }: { match: ItemMatch }) {
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

function NoMatchBanner({
  code,
  note,
  suggestions,
  onOpen,
  onAdd,
  onSpot,
}: {
  code?: string;
  note?: string;
  suggestions: ItemMatch[];
  onOpen: (itemId: string) => void;
  onAdd: () => void;
  onSpot: () => void;
}) {
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
        {note && (
          <AppText variant="meta" color={colors.textSecondary}>
            {note}
          </AppText>
        )}
        {code && (
          <AppText variant="meta" color={colors.textSecondary} selectable>
            Code {code}
          </AppText>
        )}
      </View>
      {suggestions.length > 0 && (
        <View style={{ gap: 6 }}>
          <AppText variant="meta" color={colors.textSecondary}>
            Closest in your Grailbox
          </AppText>
          {suggestions.map((m) => (
            <Pressable
              key={m.item.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.item.title}, ${m.collection_name}. Open item`}
              onPress={() => onOpen(m.item.id)}
              style={[styles.matchRow, styles.suggestion]}
            >
              <Photo path={m.item.photos[0]} tintKey={m.item.id} glyph={16} style={styles.suggestionPhoto} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="label" numberOfLines={1}>
                  {m.item.title}
                </AppText>
                <AppText variant="meta" color={colors.textSecondary} numberOfLines={1}>
                  {m.collection_name}
                </AppText>
              </View>
              <ChevronRightIcon size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}
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
  suggestion: { minHeight: 52, backgroundColor: colors.surfaceSubtle },
  suggestionPhoto: { width: 36, height: 36, borderRadius: 8 },
  confidence: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: colors.statusOwnedBg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: spacing.gutter },
});
