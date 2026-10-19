import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { sql } from 'drizzle-orm';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeftIcon, DownloadIcon } from '@/components/Icons';
import { AppText, Card, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui';
import { getDb } from '@/db/database';
import { listCollections } from '@/db/repositories/collections';
import { items } from '@/db/schema';
import { seedDatabase } from '@/db/seed';
import { DEMO, seedDemo } from '@/features/demo/demo';
import { embedImage, getEmbeddingModel, loadEmbeddingModel, prepareImage } from '@/features/scanner/embedder';
import { l2Normalize } from '@/features/scanner/preprocess';
import { cosine } from '@/features/scanner/similarity';
import { writeExportZip } from '@/lib/exportData';
import { goBack } from '@/lib/nav';
import { photoUri } from '@/lib/photos';
import { colors, spacing } from '@/theme';

// Development only: checks that the embedding model loads and runs on this device, and times the
// accelerated delegate against the CPU (results for the S24+ are in the README). Read the results with
// `adb logcat | grep -i -E "tflite|litert|delegate|ReactNativeJS"`.
async function runEmbeddingCheck(): Promise<string> {
  const rows = await getDb()
    .select({ title: items.title, photos: items.photos })
    .from(items)
    .orderBy(sql`${items.updated_at} desc`);
  const withPhotos = rows.filter((r) => r.photos.length > 0);
  if (withPhotos.length < 2) throw new Error('Add a photo to at least two different items first.');
  const [a, b] = withPhotos;
  const uriA = photoUri(a.photos[0])!;
  const uriB = photoUri(b.photos[0])!;
  const ms = (t: number) => Math.round(performance.now() - t);

  let t = performance.now();
  const model = await getEmbeddingModel();
  const loadMs = ms(t);
  t = performance.now();
  const a1 = await embedImage(uriA);
  const firstMs = ms(t);
  t = performance.now();
  const a2 = await embedImage(uriA);
  const secondMs = ms(t);
  const vb = await embedImage(uriB);

  t = performance.now();
  const { input } = await prepareImage(uriA);
  const prepMs = ms(t);
  const runs = async (m: typeof model) => {
    const out: number[] = [];
    let vec: Float32Array = new Float32Array();
    for (let i = 0; i < 5; i++) {
      t = performance.now();
      const [o] = await m.run([input.buffer as ArrayBuffer]);
      out.push(ms(t));
      vec = l2Normalize(new Float32Array(o));
    }
    return { times: out, median: [...out].sort((x, y) => x - y)[2], vec };
  };
  const accel = await runs(model);

  t = performance.now();
  const cpuModel = await loadEmbeddingModel([]);
  const cpuLoadMs = ms(t);
  const cpu = await runs(cpuModel);
  cpuModel.dispose();

  const report = [
    `delegates: [${model.delegates.join(', ')}]`,
    `model load: ${loadMs} ms`,
    `embedImage "${a.title}": 1st ${firstMs} ms, 2nd ${secondMs} ms`,
    `prepareImage: ${prepMs} ms`,
    `run only (accel): ${accel.times.join('/')} ms, median ${accel.median}`,
    `CPU load: ${cpuLoadMs} ms`,
    `run only (CPU): ${cpu.times.join('/')} ms, median ${cpu.median}`,
    `cosine same photo: ${cosine(a1, a2).toFixed(4)}`,
    `cosine vs "${b.title}": ${cosine(a1, vb).toFixed(4)}`,
    `cosine accel vs CPU: ${cosine(accel.vec, cpu.vec).toFixed(4)}`,
  ].join('\n');
  console.log(`[EmbeddingCheck]\n${report}`);
  return report;
}

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkEmbedder = async () => {
    setChecking(true);
    try {
      Alert.alert('Embedding check', await runEmbeddingCheck());
    } catch (e) {
      console.error('[EmbeddingCheck] failed', e);
      Alert.alert('Embedding check failed', String((e as Error).message ?? e));
    } finally {
      setChecking(false);
    }
  };

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
      try {
        await (DEMO ? seedDemo() : seedDatabase());
      } catch (e) {
        Alert.alert('Could not load sample data', String((e as Error).message ?? e));
        return;
      }
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

        {/* Development and the demo build only: the demo video's capture step loads the sample data. */}
        {(__DEV__ || DEMO) && (
          <Card style={styles.card}>
            <AppText variant="sectionHeading" accessibilityRole="header">
              Sample data
            </AppText>
            <AppText variant="body" color={colors.textBody}>
              Adds the three sample collections from the design, with eight Rowlet items and three journal entries.
            </AppText>
            <SecondaryButton label="Load sample data" onPress={loadSample} testID="settings-seed" />
          </Card>
        )}

        {__DEV__ && (
          <Card style={styles.card}>
            <AppText variant="sectionHeading" accessibilityRole="header">
              Embedding check (dev)
            </AppText>
            <SecondaryButton
              label={checking ? 'Running…' : 'Run embedding check'}
              onPress={checking ? undefined : checkEmbedder}
            />
          </Card>
        )}

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
