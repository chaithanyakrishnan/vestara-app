import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { ApiClientError } from "../lib/apiClient";

/**
 * Persists one wizard step to the server (validated there against the same
 * Zod schema the form uses locally) and refreshes the plan draft so the
 * rail / progress state and Review screen stay in sync.
 */
export function useUpdateStep(planId: string | undefined, stepKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => {
      if (!planId) throw new Error("No active plan");
      return api.put(`/plans/${planId}/steps/${stepKey}`, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", planId] }),
  });
}

export function isApiValidationError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError && err.status === 400 && !!err.issues;
}
