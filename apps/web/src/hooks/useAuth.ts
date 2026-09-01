import { useMutation } from "@tanstack/react-query";
import type { AuthUser, LoginInput, RegisterInput } from "@vestara/shared";
import { api } from "../lib/apiClient";
import { useAuthStore } from "../lib/authStore";

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthResponse>("/auth/login", input),
    onSuccess: (data) => setSession(data.accessToken, data.user),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<AuthResponse>("/auth/register", input),
    onSuccess: (data) => setSession(data.accessToken, data.user),
  });
}
