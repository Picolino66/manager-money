import { createDefaultContext, UseCaseContext } from '@manager-money/core/application/state';

import { AuthGateway, SupabaseAuthGateway } from '../infrastructure/auth';
import { RemoteGateway, SupabaseGateway } from '../infrastructure/remote';
import { getSupabaseClient } from '../infrastructure/supabase/client';

/** Portas usadas pelos stores. Em teste, substituídas por implementações em memória. */
export type Dependencies = {
  auth: AuthGateway;
  remote: RemoteGateway;
  context: () => UseCaseContext;
};

let override: Dependencies | null = null;
let defaults: Dependencies | null = null;

export function setDependencies(next: Dependencies | null) {
  override = next;
}

/** `null` quando faltam as variáveis públicas do Supabase (tela de configuração). */
export function getDependencies(): Dependencies | null {
  if (override) return override;
  if (defaults) return defaults;

  const client = getSupabaseClient();
  if (!client) return null;

  defaults = {
    auth: new SupabaseAuthGateway(client),
    remote: new SupabaseGateway(client),
    context: createDefaultContext,
  };

  return defaults;
}
