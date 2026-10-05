import { useState } from 'react';
import { ChevronRight, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import {
  deleteCreditCard,
  setCreditCardActive,
} from '@manager-money/core/application/card.use-cases';
import {
  buildCardStatementsView,
  formatDayMonth,
  hasCardPurchases,
} from '@manager-money/core/application/card-view';
import {
  CARD_LIMIT_DISCLAIMER,
  STATEMENT_STATUS_LABEL,
} from '@manager-money/core/application/card-text';
import {
  selectActiveCycle,
  selectCardLimitUsage,
  selectCardStatements,
  selectCreditCards,
} from '@manager-money/core/application/selectors';
import { CreditCardRecord } from '@manager-money/core/application/state';
import { isActive } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { LimitBar } from '@/components/LimitBar';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/states';
import { useDataStore } from '@/store/data.store';

import { CardFormDialog } from './CardFormDialog';

/** Lista de cartões com limite comprometido, fatura atual e ações (mesma visão do app). */
export function CardsPage() {
  const doc = useDataStore((state) => state.doc);
  const run = useDataStore((state) => state.run);
  const saving = useDataStore((state) => state.saving);
  const [form, setForm] = useState<'new' | CreditCardRecord | null>(null);
  const [deleting, setDeleting] = useState<CreditCardRecord | null>(null);
  const [created, setCreated] = useState<CreditCardRecord | null>(null);

  if (!doc) return null;

  const today = new Date();
  const cards = selectCreditCards(doc);
  const activeCycleId = selectActiveCycle(doc)?.id ?? null;

  async function toggleActive(card: CreditCardRecord) {
    try {
      await run((state, ctx) => setCreditCardActive(state, card.id, !isActive(card), ctx));
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível atualizar.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await run((state, ctx) => deleteCreditCard(state, deleting.id, ctx));
      toast.success('Cartão excluído.');
      setDeleting(null);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Não foi possível excluir.');
    }
  }

  return (
    <>
      <PageHeader
        title="Cartões de crédito"
        description={CARD_LIMIT_DISCLAIMER}
        actions={
          <Button onClick={() => setForm('new')}>
            <Plus aria-hidden className="h-4 w-4" /> Novo cartão
          </Button>
        }
      />

      {created ? (
        <Card className="mb-4 flex flex-col items-start gap-2 bg-primary-soft">
          <p className="text-sm font-semibold text-ink">Cartão {created.name} cadastrado</p>
          <p className="text-sm text-text">
            Ele já tem fatura em aberto ou parcelamentos de antes do app? Cadastre agora para o
            limite e os próximos ciclos ficarem certos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/cartoes/${created.id}/compras-anteriores`}>
                Cadastrar compras anteriores
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => setCreated(null)}>
              Agora não
            </Button>
          </div>
        </Card>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="Nenhum cartão"
          message="Cadastre o cartão com os dias de fechamento e vencimento para acompanhar limite e faturas."
          action={<Button onClick={() => setForm('new')}>Adicionar cartão</Button>}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => {
            const usage = selectCardLimitUsage(doc, card.id);
            const { current } = buildCardStatementsView(
              card,
              selectCardStatements(doc, card.id, today),
              today,
              activeCycleId,
            );
            const active = isActive(card);
            const withPurchases = hasCardPurchases(doc, card.id);

            return (
              <li key={card.id}>
                <Card className="flex h-full flex-col gap-3">
                  <Link
                    to={`/cartoes/${card.id}`}
                    aria-label={`Abrir cartão ${card.name}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>
                      <span className="flex items-center gap-2 text-base font-semibold text-ink">
                        {card.name}
                        {!active ? <Badge>Inativo</Badge> : null}
                      </span>
                      <span className="text-sm text-muted">
                        Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 text-muted" />
                  </Link>

                  {usage && usage.available !== null ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Limite disponível do cartão</span>
                        <span
                          className={
                            usage.available < 0
                              ? 'font-semibold text-negative'
                              : 'font-semibold text-ink'
                          }
                        >
                          {formatCurrency(usage.available)}
                        </span>
                      </div>
                      <LimitBar committed={usage.committed} creditLimit={usage.creditLimit} />
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Limite disponível do cartão</span>
                      <span className="text-ink">Limite não informado</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-muted">
                      Fatura atual ({STATEMENT_STATUS_LABEL[current.status].toLowerCase()}
                      {current.status === 'partial' ? ', restante' : ''}) · vence{' '}
                      {formatDayMonth(current.dueDate)}
                    </span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(
                        current.status === 'open' ? current.amount : current.remaining,
                      )}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Editar cartão ${card.name}`}
                      onClick={() => setForm(card)}
                    >
                      <Pencil aria-hidden className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`${active ? 'Desativar' : 'Ativar'} cartão ${card.name}`}
                      onClick={() => void toggleActive(card)}
                    >
                      <Power aria-hidden className="h-4 w-4" /> {active ? 'Desativar' : 'Ativar'}
                    </Button>
                    {!withPurchases ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir cartão ${card.name}`}
                        onClick={() => setDeleting(card)}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" /> Excluir
                      </Button>
                    ) : null}
                  </div>
                  {withPurchases ? (
                    <p className="text-xs text-muted">
                      Cartão com compras não pode ser excluído. Desative para tirá-lo das novas
                      compras; as parcelas continuam valendo.
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <CardFormDialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        card={form && form !== 'new' ? form : undefined}
        onCreated={setCreated}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir cartão?"
        description={deleting ? `O cartão ${deleting.name} será removido.` : ''}
        confirmLabel="Excluir"
        busy={saving}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
