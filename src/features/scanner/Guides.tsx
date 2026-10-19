import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radii } from '@/theme';

/** Side of the square guides, in points. Scans and scan angle frames are cropped to it with frameCrop. */
export const FRAME = 272;

/** Four white rounded corner guides, centred on the screen, with a teal line sweeping while matching. */
export function Guides({ sweeping = false }: { sweeping?: boolean }) {
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

const styles = StyleSheet.create({
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
});
