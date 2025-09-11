// frontend/src/api.ts
import axios, {
    AxiosError,
    AxiosHeaders,
    AxiosRequestConfig,
} from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL, // e.g. https://<railway>.up.railway.app/api
    withCredentials: false,
});

/** Safely set Authorization header regardless of Axios v1 header shape */
function setAuthHeader(cfg: AxiosRequestConfig, token: string) {
    if (!cfg.headers) {
        // create headers container if missing
        cfg.headers = new AxiosHeaders();
    }
    // If it's AxiosHeaders, use .set(); otherwise mutate as a plain object
    const h = cfg.headers as any;
    if (typeof h.set === "function") {
        (h as AxiosHeaders).set("Authorization", `Bearer ${token}`);
    } else {
        (cfg.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
}

/* ---------- Attach access token to every request ---------- */
api.interceptors.request.use((cfg) => {
    const access = localStorage.getItem("access");
    if (access) setAuthHeader(cfg, access);
    return cfg;
});

/* ---------- Silent refresh on 401 ---------- */
let isRefreshing = false;
let waiters: Array<(t: string | null) => void> = [];

api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
        const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
        const status = error.response?.status;

        if (status === 401 && original && !original._retry) {
            original._retry = true;

            const refresh = localStorage.getItem("refresh");
            if (!refresh) {
                localStorage.clear();
                return Promise.reject(error);
            }

            // If a refresh is in flight, wait for it to finish
            if (isRefreshing) {
                const newToken = await new Promise<string | null>((resolve) => waiters.push(resolve));
                if (newToken) {
                    setAuthHeader(original, newToken);
                    return api(original);
                }
                return Promise.reject(error);
            }

            isRefreshing = true;
            try {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL}/auth/refresh/`,
                    { refresh }
                );
                const newAccess = (data as any).access as string;
                localStorage.setItem("access", newAccess);

                // Wake waiters
                waiters.forEach((fn) => fn(newAccess));
                waiters = [];

                // Retry the original request with the fresh token
                setAuthHeader(original, newAccess);
                return api(original);
            } catch (e) {
                // Refresh failed → logout
                localStorage.clear();
                waiters.forEach((fn) => fn(null));
                waiters = [];
                return Promise.reject(e);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
