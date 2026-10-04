import { Toaster } from 'sonner';

import { useThemeStore } from '@/store/theme.store';

/** Avisos de sucesso/erro no tema ativo. */
export function AppToaster() {
  const scheme = useThemeStore((state) => state.scheme);
  return <Toaster theme={scheme} position="bottom-right" richColors closeButton />;
}
