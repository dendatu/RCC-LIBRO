"use client";

import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/types";

type StateAction<T> = (
  prev: ActionResult<T> | null,
  form: FormData,
) => Promise<ActionResult<T>>;

/**
 * Bridges React Hook Form values to a `useActionState`-style server action:
 * values are serialised into FormData, posted, and the returned
 * {@link ActionResult} drives field errors and toasts. `T` is the action's
 * payload type, so actions may return created ids for redirects.
 */
export function useFormAction<T = undefined>(action: StateAction<T>) {
  const [state, setState] = useState<ActionResult<T> | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (values: Record<string, unknown>, extra: Record<string, string> = {}) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          value.forEach((item) => form.append(key, String(item)));
        } else if (typeof value === "boolean") {
          form.append(key, value ? "true" : "false");
        } else if (value === "") {
          form.append(key, "");
        } else {
          form.append(key, String(value));
        }
      }
      for (const [key, value] of Object.entries(extra)) form.append(key, value);

      startTransition(async () => {
        setState(await action(state, form));
      });
    },
    [action, state],
  );

  const reset = useCallback(() => setState(null), []);

  return { state, submit, pending, reset, setState };
}
