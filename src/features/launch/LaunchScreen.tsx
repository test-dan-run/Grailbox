import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CapsuleLogo, StarOnly } from '@/components/Icons';
import { AppText } from '@/components/ui';
import { launchPalette, type as typeScale } from '@/theme';

/*
 * 00 · Launch screen. About 1.5 s: the capsule drops in and settles (0.9 s),
 * the star spins in on the seam (0.6 s from 0.75 s), wordmark and tagline
 * fade up from 1.0 s, dots appear at 1.3 s. Reduce Motion shows the final
 * frame without animating.
 */

const LOGO = 152;
// The logo's viewBox is 68 units wide; the star is centred at (50, 49) in a 24-unit box.
const UNIT = LOGO / 68;
const STAR = 24 * UNIT;
const STAR_LEFT = (50 - 16) * UNIT - STAR / 2;
const STAR_TOP = (49 - 16) * UNIT - STAR / 2;

const settle = Easing.bezier(0.3, 0.7, 0.4, 1);
const pop = Easing.bezier(0.3, 0.7, 0.4, 1.4);
const LEAVE_AFTER_MS = 1900;

export function LaunchScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const p = scheme === 'dark' ? launchPalette.dark : launchPalette.light;
  const reduceMotion = useReducedMotion();

  const drop = useSharedValue(reduceMotion ? 1 : 0);
  const star = useSharedValue(reduceMotion ? 1 : 0);
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const dots = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) {
      drop.value = withTiming(1, { duration: 900, easing: settle });
      star.value = withDelay(750, withTiming(1, { duration: 600, easing: pop }));
      rise.value = withDelay(1000, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
      dots.value = withDelay(1300, withTiming(1, { duration: 400 }));
      pulse.value = withDelay(1400, withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1));
    }
    const t = setTimeout(() => router.replace('/dashboard'), reduceMotion ? 700 : LEAVE_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Drop: from 60 px above, overshoot 6 px, recoil 3 px, settle.
  const capsuleStyle = useAnimatedStyle(() => {
    const t = drop.value;
    const y = t < 0.6 ? -60 + (66 * t) / 0.6 : t < 0.8 ? 6 - (9 * (t - 0.6)) / 0.2 : -3 + (3 * (t - 0.8)) / 0.2;
    const s = t < 0.6 ? 0.9 + (0.12 * t) / 0.6 : t < 0.8 ? 1.02 - (0.03 * (t - 0.6)) / 0.2 : 0.99 + (0.01 * (t - 0.8)) / 0.2;
    return { opacity: Math.min(1, t / 0.6), transform: [{ translateY: y }, { scale: s }] };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const t = drop.value;
    const sx = t < 0.6 ? 0.4 + (0.68 * t) / 0.6 : 1.08 - (0.08 * (t - 0.6)) / 0.4;
    return { opacity: Math.min(1, t / 0.6), transform: [{ scaleX: sx }] };
  });
  const starStyle = useAnimatedStyle(() => {
    const t = star.value;
    const s = t < 0.7 ? (1.25 * t) / 0.7 : 1.25 - (0.25 * (t - 0.7)) / 0.3;
    const r = t < 0.7 ? -90 + (98 * t) / 0.7 : 8 - (8 * (t - 0.7)) / 0.3;
    return { opacity: Math.min(1, t / 0.7), transform: [{ scale: s }, { rotate: `${r}deg` }] };
  });
  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: 12 * (1 - rise.value) }],
  }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dots.value, transform: [{ translateY: 12 * (1 - dots.value) }] }));

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.stack}>
        <View style={styles.logoBox} accessible accessibilityRole="image" accessibilityLabel="Grailbox logo">
          <Animated.View style={capsuleStyle}>
            <CapsuleLogo size={LOGO} seam={p.seam} shine={p.shine} hideStar />
            <Animated.View style={[styles.star, starStyle]}>
              <StarOnly size={STAR} seam={p.seam} />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.shadow, { backgroundColor: p.shadow }, shadowStyle]} />
        </View>
        <Animated.View style={[styles.words, riseStyle]}>
          <AppText variant="wordmark" color={p.ink} accessibilityRole="header">
            Grailbox
          </AppText>
          <AppText style={styles.tagline} color={p.sub}>
            Every grail, accounted for.
          </AppText>
        </Animated.View>
      </View>
      <Animated.View style={[styles.dots, dotsStyle]} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} color={p.dot} pulse={pulse} still={reduceMotion} />
        ))}
      </Animated.View>
    </View>
  );
}

function Dot({
  index,
  color,
  pulse,
  still,
}: {
  index: number;
  color: string;
  pulse: { value: number };
  still: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6, transform: [{ scale: 1 }] };
    // Each dot peaks 0.15 s (1/8 of the 1.2 s cycle) after the one before.
    const phase = (pulse.value - index / 8 + 1) % 1;
    const k = phase < 0.4 ? phase / 0.4 : phase < 0.8 ? 1 - (phase - 0.4) / 0.4 : 0;
    return { opacity: 0.25 + 0.75 * k, transform: [{ scale: 0.8 + 0.2 * k }] };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', gap: 28, marginTop: -40 },
  logoBox: { width: LOGO, height: 168, alignItems: 'center' },
  star: { position: 'absolute', left: STAR_LEFT, top: STAR_TOP, width: STAR, height: STAR },
  shadow: { width: 96, height: 12, marginTop: 4, borderRadius: 9999 },
  words: { alignItems: 'center', gap: 8 },
  tagline: { ...typeScale.label, fontSize: 15, lineHeight: 22 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 84, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 9999 },
});
