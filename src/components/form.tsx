import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { CURRENCIES } from '@/lib/currencies';
import { formatMonthYear, fromIsoDate, toIsoDate } from '@/lib/dates';
import { currencySymbol, formatPriceInput } from '@/lib/money';
import { PhotoPermissionError, pickPhotos, type PhotoSource } from '@/lib/photos';
import { colors, radii, spacing, type as typeScale } from '@/theme';

import { CameraIcon, ChevronDownIcon, CloseIcon, ImageIcon, MinusIcon, PlusIcon, StarFilledIcon } from './Icons';
import { ActionSheet, PickerSheet, type PickerOption } from './Sheet';
import { AppText, Grabber, IconButton, Photo, TextButton } from './ui';

/* ------------------------------------------------------------ Structure */

/** Sheet top bar: Cancel, centred title, Save. */
export function SheetHeader({
  title,
  onCancel,
  onSave,
  saveDisabled,
  saveLabel = 'Save',
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
}) {
  return (
    <View>
      <Grabber />
      <View style={styles.sheetBar}>
        <TextButton label="Cancel" color={colors.textSecondary} onPress={onCancel} testID="sheet-cancel" />
        <AppText variant="cardTitle" style={styles.sheetTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        <TextButton label={saveLabel} bold align="flex-end" onPress={onSave} disabled={saveDisabled} testID="sheet-save" />
      </View>
    </View>
  );
}

export function Field({
  label,
  children,
  hint,
  nativeID,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  nativeID?: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color={colors.textSecondary} nativeID={nativeID}>
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText variant="meta" color={colors.textSecondary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="sectionHeading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/* --------------------------------------------------------------- Inputs */

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  multiline,
  ...rest
}: TextInputProps & { label: string; value: string; onChangeText: (t: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...rest}
        style={[styles.input, multiline && styles.multiline, rest.style]}
      />
    </Field>
  );
}

/** Price with a per-item currency picker, formatted as typed. */
export function PriceField({
  label,
  value,
  onChangeText,
  currency,
  onCurrencyChange,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  testID?: string;
}) {
  const [picking, setPicking] = useState(false);
  const symbol = currencySymbol(currency);
  return (
    <Field label={label}>
      <View style={styles.priceRow}>
        {symbol !== currency && (
          <AppText variant="label" style={{ fontSize: 14 }} color={colors.textSecondary}>
            {symbol}
          </AppText>
        )}
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(formatPriceInput(t, currency))}
          keyboardType="decimal-pad"
          placeholder={formatPriceInput('0.00', currency) || '0'}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${label}, in ${currency}`}
          testID={testID}
          style={styles.priceInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Currency: ${currency}. Change currency`}
          onPress={() => setPicking(true)}
          style={styles.currencyButton}
          hitSlop={6}
        >
          <AppText variant="metaMedium" color={colors.textSecondary}>
            {currency}
          </AppText>
          <ChevronDownIcon size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
      <PickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title="Currency"
        searchable
        searchPlaceholder="Search currencies"
        value={currency}
        onChange={(c) => {
          onCurrencyChange(c);
          // Re-cap fraction digits for the new currency.
          onChangeText(formatPriceInput(value, c));
        }}
        options={CURRENCIES.map((c) => ({ value: c.code, label: c.code, detail: c.name }))}
      />
    </Field>
  );
}

/** A field that opens a picker sheet. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  testID,
}: {
  label: string;
  value?: string;
  options: PickerOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Field label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'none'}`}
        accessibilityHint="Opens a list to choose from"
        onPress={() => setOpen(true)}
        style={[styles.input, styles.select]}
        testID={testID}
      >
        <AppText variant="body" color={current ? colors.textPrimary : colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ?? placeholder}
        </AppText>
        <ChevronDownIcon size={18} color={colors.textSecondary} />
      </Pressable>
      <PickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        options={options}
        value={value}
        onChange={onChange}
        searchable={options.length > 8}
      />
    </Field>
  );
}

/** Date field. The UI shows month + year; the full date is stored. */
export function DateField({
  label,
  value,
  onChange,
  clearable,
}: {
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  clearable?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const date = value ? fromIsoDate(value) : new Date();
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        maximumDate: new Date(2100, 0, 1),
        onValueChange: (_e, d) => d && onChange(toIsoDate(d)),
      });
    } else {
      setIosOpen((o) => !o);
    }
  };
  return (
    <Field label={label}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatMonthYear(value) : 'not set'}`}
          accessibilityHint="Opens a date picker"
          onPress={open}
          style={[styles.input, styles.select, { flex: 1 }]}
        >
          <AppText variant="body" color={value ? colors.textPrimary : colors.textMuted} style={{ flex: 1 }}>
            {value ? formatMonthYear(value) : 'Not set'}
          </AppText>
          <ChevronDownIcon size={18} color={colors.textSecondary} />
        </Pressable>
        {clearable && value ? (
          <IconButton label={`Clear ${label}`} onPress={() => onChange(undefined)} size={48}>
            <CloseIcon size={16} color={colors.textSecondary} />
          </IconButton>
        ) : null}
      </View>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          accentColor={colors.brandPrimary}
          onValueChange={(_e, d) => {
            onChange(toIsoDate(d));
            setIosOpen(false);
          }}
        />
      )}
    </Field>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label}>
      <View
        style={styles.stepper}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
        }}
      >
        <IconButton label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} variant="card">
          <MinusIcon size={18} color={value <= min ? colors.textMuted : colors.textPrimary} />
        </IconButton>
        <AppText variant="cardTitle" style={{ minWidth: 40, textAlign: 'center' }}>
          {value}
        </AppText>
        <IconButton label={`Increase ${label}`} onPress={() => onChange(Math.min(max, value + 1))} variant="card">
          <PlusIcon size={18} />
        </IconButton>
      </View>
    </Field>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="cardTitleSmall">{label}</AppText>
        {description ? (
          <AppText variant="meta" color={colors.textSecondary}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brandPrimary, false: colors.divider }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** Free-form tags typed as a comma-separated list. */
export function TagsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value.join(', '));
  return (
    <TextField
      label={label}
      value={text}
      placeholder={placeholder}
      hint="Separate with commas"
      onChangeText={(t) => {
        setText(t);
        onChange(
          t
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

/** Choice pills, e.g. a collection's categories. */
export function ChoicePills({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  if (options.length === 0) return null;
  return (
    <Field label={label}>
      <View style={styles.choiceWrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on ? undefined : o)}
              hitSlop={{ top: 2, bottom: 2 }}
              style={[styles.choice, on && styles.choiceOn]}
            >
              <AppText variant={on ? 'button' : 'label'} style={{ fontSize: 13 }} color={on ? colors.white : colors.textSecondary}>
                {o}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/* --------------------------------------------------------------- Photos */

function usePhotoSource(onAdd: (paths: string[]) => void, multiple: boolean) {
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (source: PhotoSource) => {
    try {
      setBusy(true);
      const paths = await pickPhotos(source, { multiple });
      if (paths.length) onAdd(paths);
    } catch (e) {
      if (e instanceof PhotoPermissionError) {
        Alert.alert('Camera access is off', 'Allow camera access in Settings to snap photos.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert('Could not add the photo', String((e as Error).message ?? e));
      }
    } finally {
      setBusy(false);
    }
  };
  const sheet = (
    <ActionSheet
      visible={choosing}
      onClose={() => setChoosing(false)}
      title="Add a photo"
      actions={[
        { label: 'Take photo', icon: <CameraIcon size={20} />, onPress: () => run('camera') },
        { label: multiple ? 'Choose from library' : 'Choose from library', icon: <ImageIcon size={20} />, onPress: () => run('library') },
      ]}
    />
  );
  return { open: () => setChoosing(true), sheet, busy };
}

/** The dashed drop zone from the wishlist sheet, then a row of thumbnails once photos exist. */
export function PhotoField({
  photos,
  onChange,
  title = 'Add or snap a reference photo',
  subtitle = 'Shelf tag, listing screenshot or the item itself',
  multiple = true,
  tintKey,
}: {
  photos: string[];
  onChange: (paths: string[]) => void;
  title?: string;
  subtitle?: string;
  multiple?: boolean;
  tintKey: string;
}) {
  const src = usePhotoSource((paths) => onChange(multiple ? [...photos, ...paths] : paths.slice(0, 1)), multiple);

  if (photos.length === 0) {
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint="Opens the camera or your photo library"
          onPress={src.open}
          style={({ pressed }) => [styles.dropZone, pressed && { opacity: 0.8 }]}
          testID="photo-drop-zone"
        >
          <View style={styles.dropIcon}>
            <CameraIcon size={24} />
          </View>
          <AppText variant="body" style={{ fontFamily: typeScale.label.fontFamily }}>
            {src.busy ? 'Adding photo…' : title}
          </AppText>
          <AppText variant="meta" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        </Pressable>
        {src.sheet}
      </>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
        {photos.map((p, i) => (
          <View key={p} style={styles.thumbWrap}>
            <Photo path={p} tintKey={tintKey} style={styles.thumb} label={`Photo ${i + 1} of ${photos.length}${i === 0 ? ', cover' : ''}`} />
            {i === 0 && (
              <View style={styles.coverBadge}>
                <AppText variant="chip" color={colors.white}>
                  Cover
                </AppText>
              </View>
            )}
            <View style={styles.thumbActions}>
              {i > 0 && (
                <IconButton
                  label={`Make photo ${i + 1} the cover`}
                  variant="floating"
                  round
                  size={32}
                  onPress={() => onChange([p, ...photos.filter((x) => x !== p)])}
                >
                  <StarFilledIcon size={14} color={colors.textPrimary} />
                </IconButton>
              )}
              <IconButton
                label={`Remove photo ${i + 1}`}
                variant="floating"
                round
                size={32}
                onPress={() => onChange(photos.filter((x) => x !== p))}
              >
                <CloseIcon size={14} />
              </IconButton>
            </View>
          </View>
        ))}
        {multiple && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add another photo"
            onPress={src.open}
            style={[styles.thumb, styles.addThumb]}
          >
            <PlusIcon size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </ScrollView>
      {src.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetTitle: { flex: 1, textAlign: 'center', fontFamily: typeScale.button.fontFamily },
  field: { gap: 6 },
  section: { gap: 16 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
    ...typeScale.body,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
  },
  priceInput: { flex: 1, minWidth: 0, ...typeScale.body, color: colors.textPrimary, paddingVertical: 12 },
  currencyButton: {
    minHeight: 44,
    minWidth: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceSubtle,
  },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  choiceOn: { backgroundColor: colors.textPrimary },
  dropZone: {
    minHeight: 150,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.divider,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  dropIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceCard,
    boxShadow: '0px 4px 20px -2px rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRow: { gap: 10, paddingRight: spacing.gutter },
  thumbWrap: { position: 'relative' },
  thumb: { width: 104, height: 104, borderRadius: radii.thumb },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  thumbActions: { position: 'absolute', right: 4, top: 4, gap: 4 },
  addThumb: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
