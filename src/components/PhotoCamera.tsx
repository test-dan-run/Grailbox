import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { importPhoto } from '@/lib/photos';
import { colors, radii, spacing } from '@/theme';

import { CloseIcon, FlashIcon } from './Icons';
import { AppText, IconButton, PrimaryButton } from './ui';

/*
 * The app's own camera for item, wishlist and journal photos. It always opens
 * on the back camera, where the merch is. The picker's system camera can't
 * promise that: Samsung Camera ignores the request for the back lens and
 * reopens whichever lens was used last, e.g., the front one after a selfie.
 */

const SHUTTER = 76;
/** Points of pinch movement for the full zoom range. */
const PINCH_RANGE = 600;

export function PhotoCamera({ onCapture, onClose }: { onCapture: (path: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const camera = useRef<CameraView>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // Two-finger pinch zooms; single taps pass through to the buttons. Created once.
  const [pinch] = useState(() => {
    let level = 0;
    let start = { distance: 0, zoom: 0 };
    const distance = (touches: readonly { pageX: number; pageY: number }[]) =>
      Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
    return PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) start = { distance: distance(e.nativeEvent.touches), zoom: level };
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length !== 2) return;
        if (!start.distance) start = { distance: distance(touches), zoom: level };
        level = Math.min(1, Math.max(0, start.zoom + (distance(touches) - start.distance) / PINCH_RANGE));
        setZoom(level);
      },
      onPanResponderRelease: () => {
        start = { distance: 0, zoom: 0 };
      },
    });
  });

  const capture = async () => {
    const cam = camera.current;
    if (!cam || !ready || busy) return;
    setBusy(true);
    try {
      const picture = await cam.takePictureAsync({ quality: 1, shutterSound: false });
      const path = await importPhoto(picture);
      if (picture.uri.startsWith(Paths.cache.uri)) {
        try {
          new File(picture.uri).delete();
        } catch {
          // The cache is cleared eventually anyway.
        }
      }
      onCapture(path);
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not take the photo', String((e as Error).message ?? e));
    }
  };

  const granted = !!permission?.granted;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root} {...pinch.panHandlers}>
        <StatusBar style="light" />
        {granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            zoom={zoom}
            enableTorch={torch}
            onCameraReady={() => setReady(true)}
            accessible
            accessibilityLabel="Live camera view"
          />
        ) : (
          <View style={styles.center}>
            <AppText variant="cardTitle" color={colors.white} style={{ textAlign: 'center' }}>
              Camera access is off
            </AppText>
            <AppText variant="body" color={colors.divider} style={{ textAlign: 'center' }}>
              Allow camera access to photograph your items. Photos stay on this phone.
            </AppText>
            <PrimaryButton
              label={permission && !permission.canAskAgain ? 'Open Settings' : 'Allow camera'}
              onPress={permission && !permission.canAskAgain ? () => Linking.openSettings() : requestPermission}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        )}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <IconButton label="Close camera" variant="camera" round onPress={onClose} testID="photo-camera-close">
            <CloseIcon color={colors.white} />
          </IconButton>
          {granted && (
            <IconButton
              label="Toggle flash"
              variant="camera"
              round
              selected={torch}
              onPress={() => setTorch((t) => !t)}
              style={torch && { backgroundColor: colors.statusAlertBg }}
            >
              <FlashIcon color={torch ? colors.statusAlertText : colors.white} />
            </IconButton>
          )}
        </View>

        {granted && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]} pointerEvents="box-none">
            {zoom > 0.01 && (
              <AppText variant="label" color={colors.divider} style={{ textAlign: 'center' }}>
                Zoom {Math.round(zoom * 100)}%
              </AppText>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: !ready, busy }}
              disabled={!ready || busy}
              onPress={capture}
              style={({ pressed }) => [styles.shutter, (pressed || !ready) && { opacity: 0.6 }]}
              testID="photo-camera-shutter"
            >
              {busy ? <ActivityIndicator color={colors.textPrimary} /> : <View style={styles.shutterInner} />}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cameraGround },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 14, alignItems: 'center', paddingHorizontal: spacing.gutter },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: radii.full,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: radii.full, backgroundColor: colors.white },
});
