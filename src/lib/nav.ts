import type { useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/** Back always returns to the previous screen; a deep-linked screen falls back to the Dashboard. */
export function goBack(router: AppRouter) {
  if (router.canGoBack()) router.back();
  else router.replace('/dashboard');
}
