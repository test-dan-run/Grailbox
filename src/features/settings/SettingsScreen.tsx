import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, DownloadIcon } from '@/components/Icons';
import { AppText, Card, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui';
import { listCollections } from '@/db/repositories/collections';
import { seedDatabase } from '@/db/seed';
import { writeExportZip } from '@/lib/exportData';
import { goBack } from '@/lib/nav';
import { colors, spacing } from '@/theme';

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    setExporting(true);
    try {
      const { file, photos, data } = await writeExportZip();
      const summary = `${data.items.length} items, ${data.journal_entries.length} journal entries, ${photos} photos`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/zip',
          UTI: 'public.zip-archive',
          dialogTitle: `Grailbox backup (${summary})`,
        });
      } else {
        Alert.alert('Export saved', `${summary}\n${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', String((e as Error).message ?? e));
    } finally {
      setExporting(false);
    }
  };

  const loadSample = async () => {
    const existing = await listCollections();
    const go = async () => {
      await seedDatabase();
      goBack(router);
    };
    if (existing.length) {
      Alert.alert('Add sample data?', 'Sample collections are added next to your own. Nothing is replaced.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: go },
      ]);
    } else {
      await go();
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}>
        <View style={{ marginLeft: -8 }}>
          <IconButton label="Back to collections" variant="plain" onPress={() => goBack(router)}>
            <ChevronLeftIcon size={22} />
          </IconButton>
        </View>
        <AppText variant="largeTitle" accessibilityRole="header">
          Settings
        </AppText>

        <Card style={styles.card}>
          <AppText variant="sectionHeading" accessibilityRole="header">
            Backup
          </AppText>
          <AppText variant="body" color={colors.textBody}>
            Grailbox keeps everything on this phone. Export makes one zip file with your data (grailbox.json) and every
            photo. Save it to Files, a drive or your computer. It is your only backup.
          </AppText>
          <PrimaryButton
            label={exporting ? 'Preparing export…' : 'Export'}
            icon={<DownloadIcon size={18} color={colors.white} />}
            onPress={runExport}
            loading={exporting}
            testID="settings-export"
          />
        </Card>

        <Card style={styles.card}>
          <AppText variant="sectionHeading" accessibilityRole="header">
            Sample data
          </AppText>
          <AppText variant="body" color={colors.textBody}>
            Adds the three sample collections from the design, with eight Rowlet items and three journal entries.
          </AppText>
          <SecondaryButton label="Load sample data" onPress={loadSample} testID="settings-seed" />
        </Card>

        <AppText variant="meta" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          Grailbox {Constants.expoConfig?.version ?? ''}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceCanvas },
  body: { gap: 16, paddingHorizontal: spacing.gutter },
  card: { gap: 12, padding: 18 },
});
