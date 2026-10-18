import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Condition, ItemStatus, Origin, Priority } from '@/db/types';
import { photoUri } from '@/lib/photos';
import { colors, fonts, placeholderTints, radii, shadows, spacing, type as typeScale } from '@/theme';

import { BadgeIcon, ImageIcon, StarFilledIcon } from './Icons';

/* ----------------------------------------------------------------- Text */

type Variant = keyof typeof typeScale;

export function AppText({
  variant = 'body',
  color = colors.textPrimary,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[typeScale[variant], { color }, style]} />;
}

/* -------------------------------------------------------------- Buttons */

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  style,
  accessibilityHint,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.primary,
        (disabled || loading) && styles.primaryDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : icon}
      <AppText variant="button" color={colors.white}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  icon,
  onPress,
  style,
  color = colors.textPrimary,
  background = colors.surfaceSubtle,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  background?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.secondary, { backgroundColor: background }, pressed && styles.pressed, style]}
    >
      {icon}
      <AppText variant="button" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  label,
  children,
  variant = 'subtle',
  round,
  size = spacing.touch,
  selected,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  children: React.ReactNode;
  variant?: 'subtle' | 'plain' | 'floating' | 'card' | 'camera';
  round?: boolean;
  size?: number;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={size < spacing.touch ? (spacing.touch - size) / 2 : undefined}
      {...rest}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: round ? radii.full : radii.input },
        iconVariants[variant],
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const iconVariants = StyleSheet.create({
  subtle: { backgroundColor: colors.surfaceSubtle },
  plain: { backgroundColor: 'transparent' },
  floating: { backgroundColor: 'rgba(255, 255, 255, 0.9)', boxShadow: shadows.floating },
  card: { backgroundColor: colors.surfaceCard, boxShadow: shadows.ambient },
  camera: { backgroundColor: 'rgba(15, 23, 42, 0.55)' },
});

/** Text-only header action (Cancel / Save in sheets). */
export function TextButton({
  label,
  onPress,
  color = colors.brandPrimary,
  bold,
  disabled,
  align = 'flex-start',
  testID,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
  bold?: boolean;
  disabled?: boolean;
  align?: 'flex-start' | 'flex-end' | 'center';
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [styles.textButton, { justifyContent: align }, pressed && styles.pressed]}
    >
      <AppText
        style={{ fontSize: 15, lineHeight: 20 }}
        variant={bold ? 'button' : 'label'}
        color={disabled ? colors.textMuted : color}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Chips */

export function Chip({
  label,
  bg,
  fg,
  icon,
  size = 'md',
  style,
  textStyle,
}: {
  label: string;
  bg: string;
  fg: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.chip, size === 'sm' ? styles.chipSm : styles.chipMd, { backgroundColor: bg }, style]}>
      {icon}
      <AppText variant={size === 'sm' ? 'chip' : 'chipLarge'} color={fg} style={textStyle} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export const STATUS_META: Record<ItemStatus, { label: string; bg: string; fg: string }> = {
  OWNED: { label: 'Owned', bg: colors.statusOwnedBg, fg: colors.statusOwnedText },
  WISHLIST: { label: 'Wishlist', bg: colors.statusWishBg, fg: colors.statusWishText },
  IN_TRANSIT: { label: 'In transit', bg: colors.statusAlertBg, fg: colors.statusAlertText },
};

export const ORIGIN_META: Record<Origin, { label: string; long: string; bg: string; fg: string }> = {
  OFFICIAL: { label: 'Official', long: 'Official merch', bg: colors.originOfficialBg, fg: colors.originOfficialText },
  FAN: { label: 'Fan-made', long: 'Fan-made', bg: colors.originFanBg, fg: colors.originFanText },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  GRAIL: 'Grail',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const CONDITION_META: Record<Condition, { short: string; long: string }> = {
  NWT: { short: 'NWT', long: 'NWT · New with Tags' },
  LOOSE_MINT: { short: 'Loose mint', long: 'Loose · Mint' },
  BOXED: { short: 'Boxed', long: 'Boxed' },
  DISPLAY_ONLY: { short: 'Display only', long: 'Display only' },
};

export function StatusChip({
  status,
  quantity,
  size = 'sm',
  style,
}: {
  status: ItemStatus;
  quantity?: number;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const m = STATUS_META[status];
  const label = quantity !== undefined && status !== 'WISHLIST' ? `${m.label} (${quantity})` : m.label;
  return <Chip label={label} bg={m.bg} fg={m.fg} size={size} style={style} textStyle={size === 'md' ? { fontFamily: typeScale.chip.fontFamily } : undefined} />;
}

export function OriginTag({ origin, long }: { origin: Origin; long?: boolean }) {
  const m = ORIGIN_META[origin];
  if (long) {
    return (
      <Chip
        label={m.long}
        bg={m.bg}
        fg={m.fg}
        icon={<BadgeIcon size={13} color={m.fg} />}
        textStyle={{ fontFamily: typeScale.chip.fontFamily }}
      />
    );
  }
  return <Chip label={m.label} bg={m.bg} fg={m.fg} size="sm" style={styles.originTag} />;
}

export function TagChip({ label }: { label: string }) {
  return <Chip label={label} bg={colors.tagBg} fg={colors.tagText} />;
}

export function GrailChip({ withIcon }: { withIcon?: boolean }) {
  return (
    <Chip
      label="GRAIL"
      bg={colors.statusAlertBg}
      fg={colors.statusAlertText}
      size="sm"
      icon={withIcon ? <StarFilledIcon size={12} color={colors.statusAlertText} /> : undefined}
      textStyle={{ fontFamily: fonts.bold, letterSpacing: 0.44 }}
    />
  );
}

/* ------------------------------------------------------- Segmented etc. */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Selected colours, for segments with their own accent (Grail, Fan-made). */
  activeBg?: string;
  activeFg?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  height = 40,
}: {
  options: SegmentOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  height?: number;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[
              styles.segment,
              { minHeight: height },
              active && { backgroundColor: o.activeBg ?? colors.surfaceCard, boxShadow: shadows.segment },
            ]}
          >
            <AppText
              variant={active ? 'button' : 'label'}
              style={{ fontSize: 13, lineHeight: 18, textAlign: 'center' }}
              color={active ? (o.activeFg ?? colors.textPrimary) : colors.textSecondary}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal filter pill. Selected is filled text-primary with white text. */
export function FilterPill({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.pill, selected ? styles.pillOn : styles.pillOff]}
    >
      <AppText
        variant={selected ? 'button' : 'label'}
        style={{ fontSize: 13, lineHeight: 18 }}
        color={selected ? colors.white : colors.textSecondary}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/* --------------------------------------------------------------- Photos */

/** Stable tint for a placeholder, from any id. */
export function tintFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return placeholderTints[Math.abs(h) % placeholderTints.length];
}

/**
 * A photo, or a tinted placeholder tile with an image glyph until one exists.
 */
export function Photo({
  path,
  tintKey,
  size = 'thumb',
  glyph = 22,
  style,
  label,
}: {
  path?: string;
  tintKey: string;
  size?: 'thumb' | 'full';
  glyph?: number;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const tint = tintFor(tintKey);
  const uri = photoUri(path, size);
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[styles.photo, { backgroundColor: tint.bg }, style]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          recyclingKey={uri}
          accessible={false}
        />
      ) : (
        <ImageIcon size={glyph} color={tint.fg} strokeWidth={1.5} />
      )}
    </View>
  );
}

/* --------------------------------------------------------------- Layout */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Docked bottom action over a translucent canvas-coloured bar; content scrolls under it. */
export function DockedBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.docked, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

/** Height to pad scroll content so the docked bar never hides the last row. */
export function useDockedPadding() {
  const insets = useSafeAreaInsets();
  return 12 + 52 + Math.max(insets.bottom, 12) + 10 + 24;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <AppText variant="cardTitle" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function Grabber() {
  return (
    <View style={styles.grabberWrap} accessible={false}>
      <View style={styles.grabber} />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  primary: {
    minHeight: 52,
    borderRadius: radii.button,
    backgroundColor: colors.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    boxShadow: shadows.primaryButton,
  },
  primaryDisabled: { backgroundColor: '#7FA9A5', boxShadow: undefined },
  secondary: {
    minHeight: 52,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  textButton: { minWidth: 64, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.full, alignSelf: 'flex-start' },
  chipMd: { paddingHorizontal: 10, paddingVertical: 4 },
  chipSm: { paddingHorizontal: 9, paddingVertical: 3 },
  originTag: { paddingHorizontal: 7, paddingVertical: 1, flexShrink: 0 },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  segment: {
    flex: 1,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: radii.full, justifyContent: 'center' },
  pillOn: { backgroundColor: colors.textPrimary },
  pillOff: { backgroundColor: colors.surfaceCard, boxShadow: shadows.ambient },
  photo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
    boxShadow: shadows.ambient,
  },
  docked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: spacing.gutter,
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  grabberWrap: { alignItems: 'center', paddingTop: 8 },
  grabber: { width: 36, height: 5, borderRadius: radii.full, backgroundColor: colors.divider },
});
