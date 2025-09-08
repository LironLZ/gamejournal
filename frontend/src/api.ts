// frontend/src/api.ts
import axios, { AxiosError } from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL + "/api",
});

// attach access token on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let waiters: Array<(t: string) => void> = [];

function notifyWaiters(token: string) {
    waiters.forEach((cb) => cb(token));
    waiters = [];
}

// refresh on 401 once, then retry the original request
api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const status = error.response?.status;
        const original = error.config as any;

        if (status === 401 && !original?._retry) {
            original._retry = true;

            const refresh = localStorage.getItem("refresh");
            if (!refresh) {
                localStorage.clear();
                window.location.href = "/login";
                return Promise.reject(error);
            }

            try {
                if (isRefreshing) {
                    // queue callers while a refresh is in flight
                    return new Promise((resolve) => {
                        waiters.push((newToken: string) => {
                            original.headers = original.headers ?? {};
                            original.headers.Authorization = `Bearer ${newToken}`;
                            resolve(api(original));
                        });
                    });
                }

                isRefreshing = true;
                const { data } = await axios.post(
                    import.meta.env.VITE_API_URL + "/api/auth/refresh/",
                    { refresh }
                );
                const newAccess = (data as any).access;
                localStorage.setItem("access", newAccess);
                isRefreshing = false;
                notifyWaiters(newAccess);

                original.headers = original.headers ?? {};
                original.headers.Authorization = `Bearer ${newAccess}`;
                return api(original);
            } catch (e) {
                isRefreshing = false;
                localStorage.clear();
                window.location.href = "/login";
                return Promise.reject(e);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
