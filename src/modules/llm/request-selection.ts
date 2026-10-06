import { AsyncLocalStorage } from "node:async_hooks";

export type RequestLlmSelection = {
  provider?: string | null;
  model?: string | null;
};

const store = new AsyncLocalStorage<RequestLlmSelection>();

export function runWithLlmSelection<T>(
  selection: RequestLlmSelection,
  fn: () => Promise<T>,
): Promise<T> {
  return store.run(
    {
      provider: selection.provider?.trim() || null,
      model: selection.model?.trim() || null,
    },
    fn,
  );
}

export function getRequestLlmSelection(): RequestLlmSelection {
  return store.getStore() ?? {};
}

export function resolveActiveLlmProvider(
  fallback: string = "mock",
): string {
  const selection = getRequestLlmSelection();
  return selection.provider?.trim() || fallback;
}
