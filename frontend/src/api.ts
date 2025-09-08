// frontend/src/api.ts
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL, // e.g. https://<railway>.up.railway.app/api
    withCredentials: false,
});

// Attach access token to every request
api.interceptors.request.use((cfg) => {
    const access = localStorage.getItem("access");
    if (access) cfg.headers.Authorization = `Bearer ${access}`;
    return cfg;
});

// --- Silent refresh on 401 ---
let isRefreshing = false;
let waiters: ((t: string | null) => void)[] = [];

api.interceptors.response.use(
    (r) => r,
    async (error) => {
        const original = error.config;
        const status = error?.response?.status;

        if (status === 401 && !original._retry) {
            original._retry = true;

            const refresh = localStorage.getItem("refresh");
            if (!refresh) {
                // No refresh token → real logout
                localStorage.clear();
                throw error;
            }

            // If a refresh is already in flight, wait for it
            if (isRefreshing) {
                const newToken = await new Promise<string | null>((resolve) => waiters.push(resolve));
                if (newToken) original.headers.Authorization = `Bearer ${newToken}`;
                return api(original);
            }

            // Do the refresh
            isRefreshing = true;
            try {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL}/auth/refresh/`,
                    { refresh }
                );
                localStorage.setItem("access", data.access);

                // Wake waiters
                waiters.forEach((fn) => fn(data.access));
                waiters = [];

                // Retry the original call with fresh token
                original.headers.Authorization = `Bearer ${data.access}`;
                return api(original);
            } catch (e) {
                // Refresh failed → log out
                localStorage.clear();
                waiters.forEach((fn) => fn(null));
                waiters = [];
                throw e;
            } finally {
                isRefreshing = false;
            }
        }

        throw error;
    }
);

export default api;
