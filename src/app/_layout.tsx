import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { openAppDatabase, type ClientDb } from '@/db/client';
import { setFullTextSearch } from '@/db/database';
import { colors } from '@/theme';

import bundledMigrations from '../../drizzle/migrations';

// The web preview's wasm SQLite has no FTS5: skip the search migration there.
const WEB = Platform.OS === 'web';
if (WEB) setFullTextSearch(false);
const migrations = WEB
  ? {
      journal: {
        ...bundledMigrations.journal,
        entries: bundledMigrations.journal.entries.filter((e) => !e.tag.endsWith('_search')),
      },
      migrations: bundledMigrations.migrations,
    }
  : bundledMigrations;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [db, setDb] = useState<ClientDb | null>(null);
  const [openError, setOpenError] = useState<Error | null>(null);

  useEffect(() => {
    openAppDatabase().then(setDb, setOpenError);
  }, []);

  if (openError) return <DatabaseError error={openError} />;
  if (!db || !(fontsLoaded || fontError)) return null;
  return <Migrated db={db} />;
}

/** Runs migrations, then shows the app; the native splash stays up until then. */
function Migrated({ db }: { db: ClientDb }) {
  const migration = useMigrations(db, migrations);

  useEffect(() => {
    if (migration.success || migration.error) SplashScreen.hideAsync().catch(() => {});
  }, [migration.success, migration.error]);

  if (migration.error) return <DatabaseError error={migration.error} />;
  if (!migration.success) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceCanvas },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="wishlist/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item/form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="collection/form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="journal/form" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="scanner"
          options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.cameraGround } }}
        />
        <Stack.Screen name="collection/[id]/journal" options={{ animation: 'none' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

function DatabaseError({ error }: { error: Error }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Grailbox could not open its database</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 8, backgroundColor: colors.surfaceCanvas },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  errorBody: { fontSize: 14, color: colors.textSecondary },
});
