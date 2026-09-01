import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";

export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["plan", planId],
    queryFn: () => api.get<any>(`/plans/${planId}`),
    enabled: !!planId,
  });
}
