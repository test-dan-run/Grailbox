import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, type as typeScale } from '@/theme';

import { CheckIcon, SearchIcon } from './Icons';
import { AppText, Grabber } from './ui';

/**
 * A bottom sheet over a dimmed backdrop. Reanimated's layout animations
 * follow the system Reduce Motion setting.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  fill,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fill?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(240)}
            exiting={SlideOutDown.duration(180)}
            style={[styles.sheet, fill && { top: insets.top + 40 }, { paddingBottom: Math.max(insets.bottom, 16) }]}
            accessibilityViewIsModal
          >
            <Grabber />
            {title ? (
              <AppText variant="cardTitle" style={styles.title} accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {children}
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}

/** A menu of actions in a bottom sheet (••• menus, photo source). */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              // Let the sheet close before the next modal or alert opens.
              setTimeout(a.onPress, 250);
            }}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceSubtle }]}
          >
            {a.icon}
            <AppText variant="cardTitleSmall" color={a.destructive ? colors.danger : colors.textPrimary}>
              {a.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.action, styles.cancel, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="button" color={colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export interface PickerOption {
  value: string;
  label: string;
  detail?: string;
}

/** A searchable single-choice list in a bottom sheet (collections, currencies). */
export function PickerSheet({
  visible,
  onClose,
  title,
  options,
  value,
  onChange,
  searchable,
  searchPlaceholder = 'Search',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  value?: string;
  onChange: (v: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.detail?.toLowerCase().includes(q))
    : options;
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={title}
      fill={searchable}
    >
      {searchable && (
        <View style={styles.search}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={searchPlaceholder}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
      )}
      <FlatList
        data={shown}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        style={searchable ? { flex: 1 } : { maxHeight: 420 }}
        renderItem={({ item }) => {
          const selected = item.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(item.value);
                setQuery('');
                onClose();
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceSubtle }]}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="cardTitleSmall">{item.label}</AppText>
                {item.detail ? (
                  <AppText variant="meta" color={colors.textSecondary}>
                    {item.detail}
                  </AppText>
                ) : null}
              </View>
              {selected && <CheckIcon size={20} color={colors.brandPrimary} />}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.sheetBackdrop },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    boxShadow: '0px -4px 20px -2px rgba(15, 23, 42, 0.08)',
  },
  title: { textAlign: 'center', paddingVertical: 12, paddingHorizontal: spacing.gutter, fontFamily: typeScale.button.fontFamily },
  actions: { paddingHorizontal: 12, paddingTop: 4, gap: 2 },
  action: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: radii.input,
  },
  cancel: { justifyContent: 'center', marginTop: 6, backgroundColor: colors.surfaceSubtle },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 8,
  },
  search: {
    marginHorizontal: spacing.gutter,
    marginBottom: 8,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
  },
  searchInput: { flex: 1, ...typeScale.body, color: colors.textPrimary, paddingVertical: 12 },
});
