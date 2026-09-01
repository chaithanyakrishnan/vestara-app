import { useAuthStore } from "./authStore";

const BASE_URL = "/api";

export class ApiClientError extends Error {
  constructor(public status: number, message: string, public issues?: Array<{ path: string; message: string }>) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().clearSession();
  }

  const body = res.status !== 204 ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiClientError(res.status, body?.error ?? "Request failed", body?.issues);
  }
  return body as T;
}

/**
 * Uploads a file with real byte-level progress.
 *
 * `fetch` exposes no upload-progress events, so this drops to XMLHttpRequest —
 * the one place in the client that does. Errors are normalized to the same
 * ApiClientError the fetch path throws so callers can treat them identically.
 */
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const token = useAuthStore.getState().token;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Content-Type is deliberately unset: the browser must add the multipart
    // boundary itself.

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };

    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response — handled below */
      }
      if (xhr.status === 401) useAuthStore.getState().clearSession();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(body as T);
      } else {
        reject(new ApiClientError(xhr.status, body?.error ?? "Upload failed", body?.issues));
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiClientError(0, "Upload cancelled"));

    xhr.send(formData);
  });
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data instanceof FormData ? data : JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  // 204-safe: request() skips the JSON parse on No Content.
  del: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
