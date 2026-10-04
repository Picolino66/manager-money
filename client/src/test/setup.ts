import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';

// As telas são carregadas sob demanda (lazy); com os workers em paralelo o 1º import é lento.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

// jsdom não implementa matchMedia; o tema segue "claro" como sistema por padrão.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Recharts usa ResizeObserver.
if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
}
