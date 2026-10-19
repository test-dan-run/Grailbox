import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { CloseIcon, FlashIcon, ImageIcon } from '@/components/Icons';
import { AppText, IconButton, Photo, PrimaryButton, SecondaryButton } from '@/components/ui';
import { FRAME, Guides } from '@/features/scanner/Guides';
import { centerSquare, frameCrop, type CropRect } from '@/features/scanner/preprocess';
import { deleteCachedVideo, PickCancelled, pickScanAngles, type PickedFrame, type PickProgress } from '@/features/scanner/videoFrames';
import { deletePhotoFiles } from '@/lib/photos';
import { colors, fonts, radii, spacing, type as typeScale } from '@/theme';

/*
 * Scan angles: the user records a short video while turning the item, and the
 * app keeps a few frames from different angles as hidden reference photos for
 * the scanner (features/scanner/videoFrames.ts). Opens on the camera, or on
 * the item's current frames for review. Frames this screen stores but the
 * user doesn't keep are deleted when it closes.
 */

/** A scan angle frame in a form: its stored path, and its vector when the app has just computed it. */
export interface FormFrame {
  path: string;
  vector?: Float32Array;
}

const MAX_SECONDS = 10;
const MIN_SECONDS = 2;
const RECORD_SIZE = 76;
const RING = 3;

type Phase = { kind: 'camera'; recording?: boolean } | { kind: 'picking'; progress?: PickProgress } | { kind: 'review' };

export function ScanAnglesModal({
  start,
  cover,
  frames,
  onDone,
  onClose,
}: {
  /** Open on the camera, or on the frames the item already has. */
  start: 'record' | 'review';
  /** The stored cover photo. Recording needs it, because the app checks the frames against it. */
  cover?: string;
  frames: FormFrame[];
  /** The frames to keep, and the cover photo's vector when the app computed it. */
  onDone: (frames: FormFrame[], cover?: PickedFrame) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>(start === 'record' && cover ? { kind: 'camera' } : { kind: 'review' });
  const [draft, setDraft] = useState(frames);
  const [coverResult, setCoverResult] = useState<PickedFrame>();
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const camera = useRef<CameraView>(null);
  const seconds = useRef(0);
  const cancelled = useRef(false);
  const alive = useRef(true);
  // Frames stored while this screen is open; the ones not kept are deleted on close.
  const created = useRef<string[]>([]);

  useEffect(
    () => () => {
      alive.current = false;
      cancelled.current = true;
    },
    [],
  );

  const cameraPhase = phase.kind === 'camera';
  useEffect(() => {
    if (cameraPhase && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [cameraPhase, permission, requestPermission]);

  const close = () => {
    cancelled.current = true;
    camera.current?.stopRecording();
    deletePhotoFiles(created.current);
    onClose();
  };

  const done = () => {
    const kept = new Set(draft.map((f) => f.path));
    deletePhotoFiles(created.current.filter((p) => !kept.has(p)));
    onDone(draft, coverResult);
  };

  const pick = async (video: string, crop: (width: number, height: number) => CropRect) => {
    if (!cover) return;
    cancelled.current = false;
    // The camera closes while the app picks frames, and reports ready again when it reopens.
    setCameraReady(false);
    setPhase({ kind: 'picking' });
    try {
      const result = await pickScanAngles(video, {
        cover,
        crop,
        onProgress: (progress) => alive.current && setPhase({ kind: 'picking', progress }),
        cancelled: () => cancelled.current,
      });
      const paths = result.frames.map((f) => f.path);
      if (!alive.current) {
        deletePhotoFiles(paths);
        return;
      }
      created.current.push(...paths);
      // A new video replaces the frames from the last one.
      setDraft(result.frames);
      setCoverResult(result.cover);
      setPhase({ kind: 'review' });
      AccessibilityInfo.announceForAccessibility(
        paths.length ? `Kept ${paths.length} scan ${paths.length === 1 ? 'angle' : 'angles'}.` : 'No usable frames. Record again.',
      );
    } catch (e) {
      if (!alive.current) return;
      setPhase({ kind: 'camera' });
      if (!(e instanceof PickCancelled)) Alert.alert('Could not read the video', String((e as Error).message ?? e));
    } finally {
      deleteCachedVideo(video);
    }
  };

  const record = async () => {
    const cam = camera.current;
    if (!cam || !cameraReady) return;
    if (phase.kind === 'camera' && phase.recording) {
      cam.stopRecording();
      return;
    }
    seconds.current = 0;
    setElapsed(0);
    setPhase({ kind: 'camera', recording: true });
    AccessibilityInfo.announceForAccessibility('Recording. Turn the item slowly.');
    let video: string | undefined;
    try {
      video = (await cam.recordAsync({ maxDuration: MAX_SECONDS, progressUpdateInterval: 0.25 }))?.uri;
    } catch (e) {
      if (!alive.current) return;
      setPhase({ kind: 'camera' });
      Alert.alert('Could not record', String((e as Error).message ?? e));
      return;
    }
    if (!video || !alive.current || cancelled.current) {
      if (video) deleteCachedVideo(video);
      if (alive.current) setPhase({ kind: 'camera' });
      return;
    }
    if (seconds.current < MIN_SECONDS) {
      deleteCachedVideo(video);
      setPhase({ kind: 'camera' });
      Alert.alert('Record a little longer', `Turn the item for at least ${MIN_SECONDS} seconds, so the app sees it from several sides.`);
      return;
    }
    AccessibilityInfo.announceForAccessibility('Recording stopped. Picking angles.');
    // The preview fills the screen like the scanner's, so the same crop keeps what was inside the guides.
    await pick(video, (w, h) => frameCrop(w, h, screen.width, screen.height, FRAME));
  };

  const chooseVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (result.canceled || !alive.current) return;
    // A library video wasn't framed with the guides, so it gets the same centered square as photos.
    await pick(result.assets[0].uri, centerSquare);
  };

  const recording = phase.kind === 'camera' && !!phase.recording;
  const granted = !!permission?.granted;

  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      {phase.kind === 'review' ? (
        <View style={[styles.review, { paddingTop: insets.top + 8 }]}>
          <StatusBar style="dark" />
          <View style={styles.reviewBar}>
            <IconButton label="Close without saving changes" variant="plain" onPress={close} testID="angles-close">
              <CloseIcon />
            </IconButton>
            <AppText variant="cardTitle" style={styles.reviewTitle} accessibilityRole="header">
              Scan angles
            </AppText>
            <View style={{ width: spacing.touch }} />
          </View>
          <ScrollView contentContainerStyle={styles.reviewBody}>
            <AppText variant="body" color={colors.textSecondary}>
              {draft.length
                ? 'The scanner also compares scans with these frames. They stay hidden from your gallery. Remove any frame that doesn’t show the item.'
                : 'No frames were kept. Record again in good light, and turn the item slowly inside the frame.'}
            </AppText>
            <View style={styles.grid}>
              {draft.map((f, i) => {
                const side = (screen.width - 2 * spacing.gutter - 2 * 10) / 3;
                return (
                  <View key={f.path}>
                    <Photo
                      path={f.path}
                      size="full"
                      tintKey={f.path}
                      style={{ width: side, height: side, borderRadius: radii.thumb }}
                      label={`Scan angle ${i + 1} of ${draft.length}`}
                    />
                    <IconButton
                      label={`Remove scan angle ${i + 1}`}
                      variant="floating"
                      round
                      size={32}
                      onPress={() => setDraft((d) => d.filter((x) => x.path !== f.path))}
                      style={styles.remove}
                    >
                      <CloseIcon size={14} />
                    </IconButton>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={[styles.reviewFooter, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <PrimaryButton label="Done" onPress={done} testID="angles-done" />
            {cover && (
              <SecondaryButton
                label="Record again"
                onPress={() => {
                  setCameraReady(false);
                  setPhase({ kind: 'camera' });
                }}
                testID="angles-record-again"
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.root}>
          <StatusBar style="light" />
          {phase.kind === 'camera' && granted ? (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="video"
              // Muted, so recording needs no microphone permission.
              mute
              videoQuality="1080p"
              enableTorch={flash}
              onCameraReady={() => setCameraReady(true)}
              onRecordingProgress={(e) => {
                seconds.current = e.duration;
                setElapsed(e.duration);
              }}
              accessible
              accessibilityLabel="Live camera view"
            />
          ) : null}
          {phase.kind === 'camera' && <Guides />}

          <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <IconButton label="Close" variant="camera" round onPress={close} testID="angles-close">
              <CloseIcon color={colors.white} />
            </IconButton>
            {phase.kind === 'camera' && granted && (
              <IconButton
                label="Toggle flash"
                variant="camera"
                round
                selected={flash}
                onPress={() => setFlash((x) => !x)}
                style={flash && { backgroundColor: colors.statusAlertBg }}
              >
                <FlashIcon color={flash ? colors.statusAlertText : colors.white} />
              </IconButton>
            )}
          </View>

          {phase.kind === 'picking' ? (
            <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.white} size="large" />
              <AppText variant="cardTitle" color={colors.white} style={{ textAlign: 'center' }}>
                {progressLabel(phase.progress)}
              </AppText>
              <AppText variant="body" color={colors.divider} style={{ textAlign: 'center' }}>
                The app keeps the frames that show the item from the most different angles.
              </AppText>
            </View>
          ) : !granted ? (
            <View style={styles.center}>
              <AppText variant="cardTitle" color={colors.white} style={{ textAlign: 'center' }}>
                Camera access is off
              </AppText>
              <AppText variant="body" color={colors.divider} style={{ textAlign: 'center' }}>
                Allow camera access to record the item, or choose a video from your library.
              </AppText>
              <PrimaryButton
                label={permission && !permission.canAskAgain ? 'Open Settings' : 'Allow camera'}
                onPress={permission && !permission.canAskAgain ? () => Linking.openSettings() : requestPermission}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          ) : null}

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            {phase.kind === 'picking' ? (
              <SecondaryButton
                label="Cancel"
                color={colors.white}
                background="rgba(255, 255, 255, 0.14)"
                onPress={() => {
                  cancelled.current = true;
                }}
                testID="angles-cancel"
              />
            ) : (
              <>
                <AppText variant="label" color={colors.divider} style={{ textAlign: 'center', fontFamily: fonts.regular }}>
                  {recording
                    ? `Turn the item slowly. ${Math.floor(elapsed)} of ${MAX_SECONDS} s`
                    : 'Fit the whole item inside the frame. Then tap record, and turn the item slowly.'}
                </AppText>
                <View style={styles.controls}>
                  <IconButton
                    label="Choose a video"
                    variant="camera"
                    round
                    size={52}
                    onPress={chooseVideo}
                    disabled={recording}
                    style={recording && { opacity: 0.4 }}
                    testID="angles-library"
                  >
                    <ImageIcon color={colors.white} />
                  </IconButton>
                  <RecordButton
                    recording={recording}
                    progress={elapsed / MAX_SECONDS}
                    disabled={!granted || !cameraReady}
                    onPress={record}
                  />
                  <View style={{ width: 52 }} />
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </Modal>
  );
}

function progressLabel(p?: PickProgress) {
  if (!p) return 'Opening the video…';
  if (p.stage === 'reading') return `Reading the video, ${p.done} of ${p.total} frames`;
  return `Picking angles, ${p.done} of ${p.total}`;
}

/** A round record button with a ring that fills as the recording nears its limit. */
function RecordButton({
  recording,
  progress,
  disabled,
  onPress,
}: {
  recording: boolean;
  progress: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const r = (RECORD_SIZE - RING) / 2;
  const length = 2 * Math.PI * r;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.record, (pressed || disabled) && { opacity: 0.6 }]}
      testID="angles-record"
    >
      <Svg width={RECORD_SIZE} height={RECORD_SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={RECORD_SIZE / 2} cy={RECORD_SIZE / 2} r={r} stroke="rgba(255, 255, 255, 0.4)" strokeWidth={RING} fill="none" />
        {recording && (
          <Circle
            cx={RECORD_SIZE / 2}
            cy={RECORD_SIZE / 2}
            r={r}
            stroke="#5EEAD4"
            strokeWidth={RING}
            fill="none"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - Math.min(1, progress))}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RECORD_SIZE / 2}, ${RECORD_SIZE / 2}`}
          />
        )}
      </Svg>
      <View style={recording ? styles.stopMark : styles.recordMark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cameraGround },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 14, paddingHorizontal: spacing.gutter },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  record: { width: RECORD_SIZE, height: RECORD_SIZE, alignItems: 'center', justifyContent: 'center' },
  recordMark: { width: 58, height: 58, borderRadius: radii.full, backgroundColor: colors.danger },
  stopMark: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.danger },
  review: { flex: 1, backgroundColor: colors.surfaceCard },
  reviewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  reviewTitle: { flex: 1, textAlign: 'center', fontFamily: typeScale.button.fontFamily },
  reviewBody: { gap: 16, paddingHorizontal: spacing.gutter, paddingTop: 8, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  remove: { position: 'absolute', right: 4, top: 4 },
  reviewFooter: { gap: 10, paddingHorizontal: spacing.gutter, paddingTop: 10 },
});
