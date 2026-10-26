import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/types";

type StateAction = Parameters<typeof useFormAction>[0];

/**
 * `useFormAction()` types its payload slot as the bare `ActionResult`, so the
 * generic carried by the catalogue server actions is restored here. One narrow
 * cast per caller keeps every form strongly typed instead of spreading `any`.
 * The `never` slot pins payload inference to the action’s return type only.
 */
export function useCatalogFormAction<Data>(
  action: (prev: never, form: FormData) => Promise<ActionResult<Data>>,
) {
  return useFormAction(action as unknown as StateAction);
}
