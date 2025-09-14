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

/* =========================================================
   People search & friends API
   ========================================================= */

export type MiniUser = { id: number; username: string; avatar_url?: string | null };

export const searchUsers = (q: string) =>
    api.get<MiniUser[]>(`/users/`, { params: { q } }).then((r) => r.data);

/** Friends list for a given username (public list) -> MiniUser[] */
export const getFriendsOf = (username: string) =>
    api.get<{ results: MiniUser[] }>(`/friends/${encodeURIComponent(username)}/`)
        .then((r) => r.data?.results ?? []);

/** Relationship status to drive the profile button */
export type FriendStatus = "SELF" | "FRIENDS" | "NONE" | "OUTGOING" | "INCOMING";
export const getFriendshipStatus = (username: string) =>
    api.get<{ status: FriendStatus; request_id: number | null }>(`/friends/status/${encodeURIComponent(username)}/`)
        .then((r) => r.data);

/** Pending requests -> { incoming: FriendRequest[], outgoing: FriendRequest[] } */
export type FriendRequest = {
    id: number;
    from_user: MiniUser;
    to_user: MiniUser;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED";
    created_at: string;
    responded_at: string | null;
};
export const getFriendRequests = () =>
    api.get<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>(`/friends/requests/`)
        .then((r) => r.data);

/** Send friend request */
export const sendFriendRequest = (to_user_id: number) =>
    api.post(`/friends/requests/`, { to_user_id }).then((r) => r.data);

/** Accept/Decline/Cancel specific request id */
export const acceptFriendRequest = (id: number) =>
    api.post(`/friends/requests/${id}/accept/`).then((r) => r.data);
export const declineFriendRequest = (id: number) =>
    api.post(`/friends/requests/${id}/decline/`).then((r) => r.data);
export const cancelFriendRequest = (id: number) =>
    api.post(`/friends/requests/${id}/cancel/`).then((r) => r.data);

/** Unfriend a user by username */
export const unfriend = (username: string) =>
    api.delete(`/friends/${encodeURIComponent(username)}/`).then((r) => r.data);
