"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/types";

/**
 * Structural signature accepted by `useFormAction()`. Every catalogue server
 * action in `src/server/actions/catalog.ts` satisfies it.
 */
type CatalogActionRunner = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * `useFormAction()` types the payload slot as `ActionResult` (data: undefined),
 * so the concrete payload generic is restored here — one narrow cast that keeps
 * every caller strongly typed instead of spreading `any` through the forms.
 */
export function useCatalogAction<Data>(
  action: CatalogActionRunner,
  options: { onSuccess?: (data: Data) => void; successTitle?: string } = {},
) {
  const bridge = useFormAction(action);
  const onSuccess = useRef(options.onSuccess);
  onSuccess.current = options.onSuccess;

  const result = bridge.state as unknown as ActionResult<Data> | null;
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!bridge.state || bridge.state === handled.current) return;
    handled.current = bridge.state;

    if (result?.ok) {
      toast.success(result.message ?? options.successTitle ?? "Saved.");
      if (result.data !== undefined) onSuccess.current?.(result.data);
    } else {
      toast.error(result?.message ?? "That action could not be completed. Please try again.");
    }
  }, [bridge.state, result, options.successTitle]);

  const fieldError = useCallback(
    (name: string) => result?.errors?.[name]?.[0],
    [result],
  );

  return {
    state: result,
    data: result?.ok ? result.data : undefined,
    errors: result?.errors ?? {},
    message: result?.message,
    fieldError,
    submit: bridge.submit,
    pending: bridge.pending,
    reset: bridge.reset,
  };
}
