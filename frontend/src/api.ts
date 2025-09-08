// frontend/src/api.ts
import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// attach JWT
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// on 401 -> kick to /login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) {
            localStorage.clear();
            if (location.pathname !== "/login") location.href = "/login";
        }
        return Promise.reject(err);
    }
);

export default api;
