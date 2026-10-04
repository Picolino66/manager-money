import { Link } from 'react-router';

import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_UPDATED_AT,
} from '@manager-money/core/legal/privacy-policy';

/** Mesmo texto do app (núcleo compartilhado), renderizado como texto puro (sem HTML dinâmico). */
export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-sm text-primary underline">
        Voltar
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-ink">Política de privacidade</h1>
      <p className="mt-1 text-sm text-muted">Atualizada em {PRIVACY_POLICY_UPDATED_AT}.</p>
      <p className="mt-4 rounded-md bg-info-soft px-3 py-2 text-sm text-ink">
        Na versão web, nenhum dado financeiro fica salvo no navegador: os dados são lidos do
        servidor a cada acesso. A sessão de login fica no armazenamento do navegador até você sair.
      </p>
      {PRIVACY_POLICY_SECTIONS.map((section) => (
        <section key={section.title} className="mt-6">
          <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">
            {section.body}
          </p>
        </section>
      ))}
    </main>
  );
}
