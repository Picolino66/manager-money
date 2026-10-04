import { DropdownMenu } from 'radix-ui';
import { Check, CircleUser, LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session.store';
import { useThemeStore } from '@/store/theme.store';

const themeOptions = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
] as const;

const item =
  'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-muted';

/** Menu da conta: tema (Sistema/Claro/Escuro, ADR-021), privacidade e sair. */
export function AccountMenu() {
  const navigate = useNavigate();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const signOut = useSessionStore((state) => state.signOut);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu da conta">
          <CircleUser aria-hidden className="h-5 w-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold text-muted">
            Tema
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) =>
              setPreference(value as (typeof themeOptions)[number]['value'])
            }
          >
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={item}>
                <Icon aria-hidden className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="h-4 w-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={item} onSelect={() => navigate('/privacidade')}>
            <ShieldCheck aria-hidden className="h-4 w-4" />
            Política de privacidade
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={item}
            onSelect={() => {
              void signOut().then(() => navigate('/login', { replace: true }));
            }}
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
