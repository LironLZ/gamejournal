import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import type React from "react";

type Status = "WISHLIST" | "PLAYING" | "PLAYED" | "DROPPED";

type Mini = { id: number; username: string; avatar_url?: string | null };

type Entry = {
    id: number;
    status: Status;
    game: {
        id: number;
        title: string;
        release_year?: number | null;
        cover_url?: string | null;
    };
};

type PublicGame = {
    id: number;
    title: string;
    cover_url?: string | null;
    release_year?: number | null;
};

type ProfilePayload =
    | {
        user: { id: number; username: string; joined: string; avatar_url?: string | null };
        // Backend maps wishlisted -> wishlist
        stats: { total: number; wishlist: number; playing: number; played: number };
        friends: { count: number; preview: Mini[] };
        entries: Entry[];
        favorites?: PublicGame[];
    }
    | { detail: string };

type FriendshipStatus = "SELF" | "FRIENDS" | "NONE" | "OUTGOING" | "INCOMING";
type RelShape = { status: FriendshipStatus; request_id: number | null };

const BADGE: Record<Status, string> = {
    PLAYING:
        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    WISHLIST:
        "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PLAYED:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    DROPPED:
        "bg-crimson-100 text-crimson-700 border-crimson-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
};

function StatusBadge({ s }: { s: Status }) {
    return (
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${BADGE[s]}`}>
            {s}
        </span>
    );
}

const TILE_ACTIVE: Record<Exclude<Status, "DROPPED"> | "ALL", string> = {
    ALL: "tile-active",
    WISHLIST: "tile-active border-indigo-200 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20",
    PLAYING: "tile-active border-sky-200 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20",
    PLAYED: "tile-active border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
};

export default function PublicProfile() {
    const { username = "" } = useParams<{ username: string }>();
    const [data, setData] = useState<ProfilePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [filter, setFilter] = useState<"ALL" | Exclude<Status, "DROPPED">>("ALL");

    // friendship state for header actions
    const [rel, setRel] = useState<RelShape | null>(null);
    const [relLoading, setRelLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const authed = !!localStorage.getItem("access");

    // Load profile payload
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const resp = await api.get<ProfilePayload>(`/users/${encodeURIComponent(username)}/`);
                if (!mounted) return;
                setData(resp.data);
            } catch (e: any) {
                if (!mounted) return;
                const msg = e?.response?.data?.detail || e?.message || "Failed to load profile.";
                setErr(msg);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [username]);

    // Load friendship status (only if authed)
    async function fetchRel() {
        if (!authed || !username) return;
        try {
            setRelLoading(true);
            const r = await api.get<RelShape>(`/friends/status/${encodeURIComponent(username)}/`);
            setRel(r.data);
        } catch {
            setRel(null); // keep UI usable
        } finally {
            setRelLoading(false);
        }
    }

    useEffect(() => {
        fetchRel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, authed]);

    if (loading) {
        return (
            <div className="container-page">
                <div className="flex justify-between items-baseline my-2 mb-4">
                    <div>
                        <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                </div>
                <div className="flex gap-4 flex-wrap my-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="tile">
                            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                            <div className="h-5 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                    ))}
                </div>
                <ul className="list-none p-0 m-0">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="card p-3 mb-3">
                            <div className="flex gap-3">
                                <div className="w-[72px] h-[72px] rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                                <div className="flex-1 min-w-0">
                                    <div className="h-4 w-44 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                                    <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (err) return <div className="container-page p-6 text-crimson-600">Error: {err}</div>;
    if (!data) return <div className="container-page p-6">No data.</div>;
    if ("detail" in data) return <div className="container-page p-6 text-crimson-600">{(data as any).detail}</div>;

    const { user, stats, entries, friends } = data;
    const favorites = (data as any).favorites as PublicGame[] | undefined;
    const joinedPretty = new Date(user.joined).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    const visible = filter === "ALL" ? entries : entries.filter((e) => e.status === filter);

    const avatar =
        user.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.username)}`;

    // --- Friend actions ---
    async function sendRequest() {
        if (!authed || busy) return;
        // Optimistic UI: flip immediately
        setRel({ status: "OUTGOING", request_id: null });
        try {
            setBusy(true);
            const resp = await api.post(`/friends/requests/`, { to_user: user.id });
            const reqId = resp?.data?.id ?? null;
            setRel({ status: "OUTGOING", request_id: reqId });
        } catch (e: any) {
            // If server says a pending request already exists, adopt that request_id
            const msg = e?.response?.data;
            if (msg?.request_id) {
                setRel({ status: "OUTGOING", request_id: msg.request_id });
            } else {
                // rollback on hard error
                setRel({ status: "NONE", request_id: null });
                alert("Could not send friend request.");
            }
        } finally {
            setBusy(false);
        }
    }

    async function cancelRequest() {
        if (!rel?.request_id || busy) return;
        try {
            setBusy(true);
            await api.post(`/friends/requests/${rel.request_id}/cancel/`);
            setRel({ status: "NONE", request_id: null });
        } catch {
            alert("Failed to cancel request.");
        } finally {
            setBusy(false);
        }
    }

    async function acceptRequest() {
        if (!rel?.request_id || busy) return;
        try {
            setBusy(true);
            await api.post(`/friends/requests/${rel.request_id}/accept/`);
            setRel({ status: "FRIENDS", request_id: null });
            // optimistic bump
            setData((prev) => {
                if (!prev || "detail" in prev) return prev;
                return { ...prev, friends: { ...prev.friends, count: (prev.friends?.count || 0) + 1 } };
            });
        } catch {
            alert("Failed to accept request.");
        } finally {
            setBusy(false);
        }
    }

    async function declineRequest() {
        if (!rel?.request_id || busy) return;
        try {
            setBusy(true);
            await api.post(`/friends/requests/${rel.request_id}/decline/`);
            setRel({ status: "NONE", request_id: null });
        } catch {
            alert("Failed to decline request.");
        } finally {
            setBusy(false);
        }
    }

    async function unfriend() {
        if (busy) return;
        const ok = confirm(`Remove ${user.username} from your friends?`);
        if (!ok) return;
        try {
            setBusy(true);
            await api.delete(`/friends/${encodeURIComponent(user.username)}/`);
            setRel({ status: "NONE", request_id: null });
            setData((prev) => {
                if (!prev || "detail" in prev) return prev;
                const nextCnt = Math.max(0, (prev.friends?.count || 1) - 1);
                return { ...prev, friends: { ...prev.friends, count: nextCnt } };
            });
        } catch {
            alert("Failed to unfriend.");
        } finally {
            setBusy(false);
        }
    }

    function FriendAction() {
        if (!authed) {
            return (
                <Link
                    to="/login"
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                    Log in to add friend
                </Link>
            );
        }

        // If status is still loading or unknown, default to showing an actionable "Add friend"
        const status: FriendshipStatus = rel?.status ?? "NONE";

        if (relLoading && !rel) {
            return (
                <button
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm opacity-60"
                    disabled
                >
                    …
                </button>
            );
        }

        switch (status) {
            case "SELF":
                return null;
            case "FRIENDS":
                return (
                    <button
                        onClick={unfriend}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg border text-sm bg-emerald-600 text-white border-emerald-700 hover:opacity-90 disabled:opacity-60"
                        title="Click to unfriend"
                    >
                        Friends ✓
                    </button>
                );
            case "NONE":
                return (
                    <button
                        onClick={sendRequest}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg border text-sm bg-indigo-600 text-white border-indigo-700 hover:opacity-90 disabled:opacity-60"
                    >
                        Add friend
                    </button>
                );
            case "OUTGOING":
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-80">Request sent</span>
                        <button
                            onClick={cancelRequest}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                    </div>
                );
            case "INCOMING":
                return (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={acceptRequest}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border text-sm bg-emerald-600 text-white border-emerald-700 hover:opacity-90 disabled:opacity-60"
                        >
                            Accept
                        </button>
                        <button
                            onClick={declineRequest}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                        >
                            Decline
                        </button>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div className="container-page">
            {/* Header */}
            <div className="flex items-start justify-between my-2 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-40 h-40 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                        <img src={avatar} alt={`${user.username} avatar`} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="m-0 text-2xl font-bold">{user.username} · Public Profile</h2>
                        <div className="text-sm muted mt-1">
                            Joined <b>{joinedPretty}</b>
                        </div>
                    </div>
                </div>

                {/* Friend action(s) */}
                <div className="mt-1">
                    <FriendAction />
                </div>
            </div>

            {/* Favorite Games */}
            <div className="card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Favorite Games</h3>
                    <div className="opacity-60 text-sm">{(favorites?.length || 0)}/9</div>
                </div>
                {favorites && favorites.length ? (
                    <div className="grid grid-cols-3 gap-3">
                        {favorites.slice(0, 9).map((g) => (
                            <Link key={g.id} to={`/game/${g.id}`} className="block group">
                                <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                                    <div className="aspect-[4/5] w-full overflow-hidden">
                                        {g.cover_url ? (
                                            <img
                                                src={g.cover_url}
                                                alt={g.title}
                                                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                                            />
                                        ) : (
                                            <div className="w-full h-full grid place-items-center text-sm opacity-60">No cover</div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-1 text-sm truncate">{g.title}</div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="muted">No favorites yet.</div>
                )}
            </div>

            {/* Stats tiles */}
            <div className="flex gap-4 flex-wrap my-4">
                <button
                    type="button"
                    onClick={() => setFilter("ALL")}
                    className={`tile ${filter === "ALL" ? TILE_ACTIVE.ALL : ""}`}
                >
                    <div className="stat-label">Total</div>
                    <div className="stat-value">{stats.total}</div>
                </button>
                {([
                    ["Wishlist", "WISHLIST", stats.wishlist],
                    ["Playing", "PLAYING", stats.playing],
                    ["Played", "PLAYED", stats.played],
                ] as const).map(([label, key, val]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key as Exclude<Status, "DROPPED">)}
                        className={`tile ${filter === key ? TILE_ACTIVE[key as Exclude<Status, "DROPPED">] : ""}`}
                        title={`Show ${label.toLowerCase()} entries`}
                    >
                        <div className="stat-label">{label}</div>
                        <div className="stat-value">{val}</div>
                    </button>
                ))}
            </div>

            {/* Friends preview */}
            <div className="card p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Friends {friends ? `(${friends.count})` : ""}</div>
                    {friends && friends.count > 0 && (
                        <Link className="link text-sm" to={`/friends/${encodeURIComponent(user.username)}`}>
                            See all
                        </Link>
                    )}
                </div>
                {!friends || friends.count === 0 ? (
                    <div className="text-sm muted">No friends to show.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {friends.preview.map((f) => (
                            <Link key={f.id} className="flex items-center gap-3" to={`/u/${encodeURIComponent(f.username)}`}>
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700">
                                    {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : null}
                                </div>
                                <span className="link">{f.username}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Entries */}
            {visible.length === 0 ? (
                <div className="card p-4 mt-4 text-center">
                    <h3 className="text-lg font-semibold mb-1">No entries in this view</h3>
                    <p className="muted">Try a different filter.</p>
                </div>
            ) : (
                <ul className="list-none p-0 m-0">
                    {visible.map((en) => (
                        <li key={en.id} className="card p-3 mb-3">
                            <Link to={`/game/${en.game.id}`} className="flex gap-3 items-start group">
                                {en.game.cover_url ? (
                                    <img
                                        src={en.game.cover_url}
                                        alt={en.game.title}
                                        className="w-[72px] h-[72px] object-cover rounded-lg border border-gray-200 dark:border-zinc-700"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                ) : null}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-base leading-tight group-hover:underline">
                                        {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                                        <span className="muted text-xs">Status:</span>
                                        <StatusBadge s={en.status} />
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
