import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

type Activity = {
    id: number;
    actor: string; // username
    actor_avatar_url?: string | null;
    verb: "RATED" | "STATUS" | "SESSION";
    status?: "PLANNING" | "PLAYING" | "PLAYED" | "DROPPED" | "COMPLETED" | null;
    score?: number | null;
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
    created_at: string;
};

type MiniUser = { id: number; username: string; avatar_url?: string | null };

function timeAgo(iso: string) {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (Number.isNaN(s)) return "";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const dys = Math.floor(h / 24);
    if (dys < 7) return `${dys}d ago`;
    return d.toLocaleDateString();
}

function avatarUrl(username: string, actorAvatar?: string | null) {
    if (actorAvatar) return actorAvatar;
    return `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(username)}`;
}

function ActivityRow({ a }: { a: Activity }) {
    let text: JSX.Element | string = "";
    if (a.verb === "RATED" && a.score != null) {
        text = (
            <>
                rated <Link className="link" to={`/game/${a.game.id}`}>{a.game.title}</Link> {a.score}/10
            </>
        );
    } else if (a.verb === "STATUS" && a.status) {
        text = (
            <>
                set <Link className="link" to={`/game/${a.game.id}`}>{a.game.title}</Link> to <b>{a.status}</b>
            </>
        );
    } else {
        text = (
            <>
                updated <Link className="link" to={`/game/${a.game.id}`}>{a.game.title}</Link>
            </>
        );
    }

    return (
        <li className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 py-2">
            <div className="flex items-start gap-3">
                <Link to={`/u/${encodeURIComponent(a.actor)}`} className="shrink-0">
                    <img
                        src={avatarUrl(a.actor, a.actor_avatar_url)}
                        alt={`${a.actor} avatar`}
                        className="w-8 h-8 rounded-full border dark:border-zinc-700"
                    />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="truncate">
                        <Link className="font-semibold link" to={`/u/${encodeURIComponent(a.actor)}`}>{a.actor}</Link>{" "}
                        {text}
                    </div>
                    <div className="text-xs muted mt-0.5">{timeAgo(a.created_at)}</div>
                </div>
            </div>
        </li>
    );
}

export default function Feed() {
    const [items, setItems] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [offset, setOffset] = useState(0);
    const limit = 30;

    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // friends + search (merged Friends page)
    const [me, setMe] = useState<string>("");
    const [friends, setFriends] = useState<MiniUser[]>([]);
    const [q, setQ] = useState("");
    const [searchResults, setSearchResults] = useState<MiniUser[]>([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get<{ user: string }>("/whoami/");
                if (!alive) return;
                setMe(data.user);
                // public friends list of self -> minis
                const fr = await api.get<{ results: MiniUser[] }>(`/friends/${encodeURIComponent(data.user)}/`);
                if (!alive) return;
                setFriends(Array.isArray(fr.data.results) ? fr.data.results : []);
            } catch {
                // ignore
            }
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setErr("");
            try {
                const { data } = await api.get<Activity[]>("/feed/", { params: { limit, offset } });
                if (!alive) return;
                setItems((prev) => (offset === 0 ? data : [...prev, ...data]));
                setHasMore(data.length === limit);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || "Failed to load feed.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [offset]);

    useEffect(() => {
        if (!hasMore || loading) return;
        const el = loadMoreRef.current;
        if (!el) return;

        const io = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first?.isIntersecting) setOffset((o) => o + limit);
        }, { rootMargin: "200px" });

        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loading]);

    async function doSearch() {
        const term = q.trim();
        if (term.length < 2) { setSearchResults([]); return; }
        try {
            const { data } = await api.get<MiniUser[]>("/users/", { params: { q: term } });
            setSearchResults(Array.isArray(data) ? data : []);
        } catch {
            setSearchResults([]);
        }
    }

    return (
        <div className="container-page">
            <div className="grid md:grid-cols-3 gap-4">
                {/* Left column: Friends + Search */}
                <div className="md:col-span-1">
                    <div className="card p-3 mb-3">
                        <div className="font-semibold mb-2">Find users</div>
                        <div className="flex gap-2">
                            <input
                                className="input flex-1"
                                placeholder="Search by username…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                            <button className="btn" onClick={doSearch}>Search</button>
                        </div>
                        {searchResults.length > 0 && (
                            <ul className="list-none p-0 m-0 mt-2">
                                {searchResults.map((u) => (
                                    <li key={u.id} className="py-1 flex items-center gap-2">
                                        <img className="w-6 h-6 rounded-full border"
                                            src={u.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(u.username)}`} />
                                        <Link className="link" to={`/u/${encodeURIComponent(u.username)}`}>{u.username}</Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="card p-3">
                        <div className="font-semibold mb-2">Friends {friends.length ? `(${friends.length})` : ""}</div>
                        {friends.length === 0 ? (
                            <div className="muted text-sm">No friends yet.</div>
                        ) : (
                            <ul className="list-none p-0 m-0">
                                {friends.map((f) => (
                                    <li key={f.id} className="py-1 flex items-center gap-2">
                                        <img className="w-6 h-6 rounded-full border"
                                            src={f.avatar_url || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(f.username)}`} />
                                        <Link className="link" to={`/u/${encodeURIComponent(f.username)}`}>{f.username}</Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right column: Activity */}
                <div className="md:col-span-2">
                    <div className="card p-4 mb-3">
                        <h2 className="text-xl font-bold">Activity</h2>
                        <div className="text-sm muted">People you follow + your own updates</div>
                    </div>

                    {err && <div className="card p-3 mb-3 text-crimson-600">{err}</div>}

                    <div className="card p-0 overflow-hidden">
                        {loading && items.length === 0 ? (
                            <div className="p-4 muted">Loading…</div>
                        ) : items.length === 0 ? (
                            <div className="p-4 muted">No activity yet.</div>
                        ) : (
                            <ul className="list-none m-0 p-0">
                                {items.map((a) => <ActivityRow key={a.id} a={a} />)}
                            </ul>
                        )}
                    </div>

                    {hasMore && <div ref={loadMoreRef} className="h-8" />}
                    {!hasMore && items.length > 0 && <div className="muted text-center text-sm mt-3">You’re all caught up.</div>}
                </div>
            </div>
        </div>
    );
}
