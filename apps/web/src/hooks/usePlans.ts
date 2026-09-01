import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContactGateInput } from "@vestara/shared";
import { api } from "../lib/apiClient";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any[]>("/plans"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contact: ContactGateInput) => api.post<any>("/plans", contact),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

/**
 * Deletes a draft plan. The API refuses anything already submitted (409), so
 * the dashboard's draft-only button is a convenience, not the guard.
 */
export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => api.del(`/plans/${planId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}
