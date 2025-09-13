// src/pages/GameDetails.tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import QuickAdd from "../components/QuickAdd";
import FavoriteButton from "../components/FavoriteButton";

// Local status type matches backend (supports both old PLANNING and new WISHLIST for safety)
type Status = "WISHLIST" | "PLANNING" | "PLAYING" | "PLAYED" | "DROPPED" | "COMPLETED";

type GameDetail = {
    game: {
        id: number;
        title: string;
        release_year?: number | null;
        cover_url?: string | null;
        // optional from backend:
        description?: string | null;
        genres?: string[]; // names
    };
    stats: {
        ratings_count: number | null;
        avg_score: number | null;
        last_entry_at: string | null;
        // backend may send either (new) wishlisted or (legacy) planning; we accept both
        wishlisted?: number;
        planning?: number;
        playing: number;
        played: number;
        dropped: number;
        // may still exist in old data; we won’t render it
        completed?: number;
    };
    entries: Array<{
        username: string;
        avatar_url?: string | null;
        status: Status;
        score: number | null;
        notes: string;
        started_at: string | null;
        finished_at: string | null;
        updated_at: string;
    }>;
};

type MyEntry = {
    id: number;
    status: Status;
    score: number | null;
    game: { id: number; title?: string; release_year?: number | null };
};

const BADGE: Record<Exclude<Status, "COMPLETED">, string> = {
    // Use the same style for WISHLIST and legacy PLANNING
    WISHLIST:
        "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PLANNING:
        "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PLAYING:
        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    PLAYED:
        "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
    DROPPED:
        "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
};

function StatusBadge({ s }: { s: Status }) {
    // Normalize legacy PLANNING to display as Wishlisted
    const label = s === "PLANNING" ? "WISHLIST" : s;
    const keyForStyle = (s === "PLANNING" ? "WISHLIST" : s) as keyof typeof BADGE;
    // COMPLETED isn’t shown in recent entries anymore, but guard just in case
    const cls = BADGE[keyForStyle] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
    return (
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}>
            {label}
        </span>
    );
}

function fmtAvg(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return (Math.round(n * 10) / 10).toFixed(1);
}

function fmtDate(s: string | null | undefined) {
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function avatarOrFallback(username: string, avatar?: string | null) {
    return avatar || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(username)}`;
}

function truncateAtWord(s: string, max = 220) {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export default function GameDetails() {
    const { gameId = "" } = useParams<{ gameId: string }>();
    const [data, setData] = useState<GameDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const authed = !!localStorage.getItem("access");
    const [myEntry, setMyEntry] = useState<MyEntry | null>(null);

    // description toggle
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const resp = await api.get<GameDetail>(`/public/games/${encodeURIComponent(gameId)}/`);
                if (!mounted) return;
                const payload = resp.data;
                payload.entries = Array.isArray(payload.entries) ? payload.entries : [];
                setData(payload);
                setExpanded(false); // reset when switching games
            } catch (e: any) {
                setErr(e?.response?.data?.detail || e?.message || "Failed to load.");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [gameId]);

    useEffect(() => {
        if (!authed || !gameId) {
            setMyEntry(null);
            return;
        }
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get<MyEntry[]>("/entries/", { params: { game_id: gameId } });
                const arr = Array.isArray(data) ? data : (data as any)?.results || [];
                const mine = arr.find((e) => e?.game?.id === Number(gameId)) || null;
                if (alive) setMyEntry(mine);
            } catch {
                if (alive) setMyEntry(null);
            }
        })();
        return () => {
            alive = false;
        };
    }, [authed, gameId]);

    if (loading) {
        return (
            <div className="container-page">
                <div className="card p-4">
                    <div className="h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-700 mb-3" />
                    <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <div className="grid md:grid-cols-3 gap-3 my-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="card p-3">
                            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                            <div className="h-6 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (err) return <div className="container-page"><div className="text-crimson-600">{err}</div></div>;
    if (!data) return <div className="container-page">No data.</div>;

    const { game, stats, entries } = data;
    // Prefer new backend key; fall back to legacy planning
    const wishlistedCount = (stats as any).wishlisted ?? (stats as any).planning ?? 0;

    const desc = (game.description || "").trim();
    const hasGenres = Array.isArray(game.genres) && game.genres.length > 0;

    // Reviews derived from entries (score or notes)
    const reviews = entries.filter((e) => (e.notes && e.notes.trim().length > 0) || e.score !== null);

    return (
        <div className="container-page">
            {/* Header */}
            <div className="card p-4 flex gap-4 items-center">
                {game.cover_url ? (
                    <img
                        src={game.cover_url}
                        alt={game.title}
                        className="w-[96px] h-[96px] object-cover rounded-lg border border-gray-200 dark:border-zinc-700"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                    />
                ) : null}
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold leading-tight">{game.title}</h2>
                    <div className="text-sm muted">{game.release_year ?? "—"}</div>
                </div>

                <div className="flex items-center gap-2">
                    <QuickAdd
                        key={`${game.id}-${myEntry?.status ?? "none"}-${myEntry?.score ?? "null"}`}
                        gameId={game.id}
                        // QuickAdd's exported Status currently doesn't include WISHLIST;
                        // cast to keep TS happy while backend uses WISHLIST.
                        initial={myEntry ? ({ status: myEntry.status as any, score: myEntry.score } as any) : undefined}
                        onSaved={({ status, score }) => {
                            setMyEntry((prev) =>
                                prev
                                    ? ({ ...prev, status: status as any, score } as MyEntry)
                                    : ({ id: 0, status: status as any, score, game: { id: game.id } } as MyEntry)
                            );
                        }}
                    />
                    <FavoriteButton gameId={game.id} /> {/* Favorite button */}
                    <Link to="/discover" className="btn-outline">← Back</Link>
                </div>
            </div>

            {/* About + Genres */}
            <div className="grid md:grid-cols-3 gap-3 my-4">
                <div className="card p-4 md:col-span-2">
                    <h3 className="text-lg font-semibold mb-2">About</h3>
                    {desc ? (
                        <p className="text-sm opacity-90">
                            {expanded || desc.length <= 220 ? desc : truncateAtWord(desc, 220)}
                            {desc.length > 220 && (
                                <button
                                    className="ml-2 text-blue-500 hover:underline"
                                    onClick={() => setExpanded((v) => !v)}
                                >
                                    {expanded ? "Show less" : "Read more"}
                                </button>
                            )}
                        </p>
                    ) : (
                        <p className="text-sm opacity-60">No description yet.</p>
                    )}
                </div>

                <div className="card p-4">
                    <h3 className="text-lg font-semibold mb-2">Genres</h3>
                    {hasGenres ? (
                        <div className="flex flex-wrap gap-2">
                            {game.genres!.map((g) => (
                                <span
                                    key={g}
                                    className="inline-block px-2 py-1 rounded border text-xs
                             border-zinc-300 dark:border-zinc-700
                             bg-zinc-100 dark:bg-zinc-800"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm opacity-60">—</p>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-3 my-4">
                <div className="card p-3">
                    <div className="stat-label">Average score</div>
                    <div className="stat-value">{fmtAvg(stats.avg_score)}</div>
                </div>
                <div className="card p-3">
                    <div className="stat-label">Ratings</div>
                    <div className="stat-value">{stats.ratings_count ?? 0}</div>
                </div>
                <div className="card p-3">
                    <div className="stat-label">Last activity</div>
                    <div className="stat-value">{fmtDate(stats.last_entry_at)}</div>
                </div>

                <div className="card p-3">
                    <div className="stat-label mb-1">Wishlisted</div>
                    <div className="stat-value">{wishlistedCount}</div>
                </div>

                <div className="card p-3">
                    <div className="stat-label mb-1">Playing</div>
                    <div className="stat-value">{stats.playing ?? 0}</div>
                </div>
                <div className="card p-3">
                    <div className="stat-label mb-1">Played</div>
                    <div className="stat-value">{stats.played ?? 0}</div>
                </div>
                <div className="card p-3">
                    <div className="stat-label mb-1">Dropped</div>
                    <div className="stat-value">{stats.dropped ?? 0}</div>
                </div>
            </div>

            {/* Recent entries */}
            <div className="card p-4">
                <h3 className="text-lg font-semibold mb-2">Recent community entries</h3>
                {entries.length === 0 ? (
                    <div className="muted">No entries yet.</div>
                ) : (
                    <ul className="list-none p-0 m-0">
                        {entries.map((en, i) => (
                            <li key={i} className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 py-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Link to={`/u/${encodeURIComponent(en.username)}`} className="shrink-0">
                                            <img
                                                src={avatarOrFallback(en.username, en.avatar_url)}
                                                alt={`${en.username} avatar`}
                                                className="w-6 h-6 rounded-full border dark:border-zinc-700"
                                            />
                                        </Link>
                                        <Link to={`/u/${encodeURIComponent(en.username)}`} className="font-medium truncate link">
                                            {en.username}
                                        </Link>
                                        <StatusBadge s={en.status} />
                                        <div className="text-xs muted">{fmtDate(en.updated_at)}</div>
                                    </div>
                                    <div className="pill-score">{en.score ?? "—"}</div>
                                </div>
                                {en.notes && <div className="text-sm mt-1 whitespace-pre-wrap">{en.notes}</div>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Reviews */}
            <div className="card p-4 mt-4" id="reviews">
                <h3 className="text-lg font-semibold mb-2">
                    Reviews <span className="opacity-60">({reviews.length})</span>
                </h3>

                {reviews.length === 0 ? (
                    <div className="muted">No reviews yet.</div>
                ) : (
                    <ul className="list-none p-0 m-0">
                        {reviews.map((r, i) => (
                            <li key={i} className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Link to={`/u/${encodeURIComponent(r.username)}`} className="shrink-0">
                                            <img
                                                src={avatarOrFallback(r.username, r.avatar_url)}
                                                alt={`${r.username} avatar`}
                                                className="w-7 h-7 rounded-full border dark:border-zinc-700"
                                            />
                                        </Link>
                                        <div className="min-w-0">
                                            <Link to={`/u/${encodeURIComponent(r.username)}`} className="font-medium truncate link">
                                                {r.username}
                                            </Link>
                                            <div className="text-xs muted">{fmtDate(r.updated_at)}</div>
                                        </div>
                                    </div>
                                    <div className="pill-score">{r.score ?? "—"}</div>
                                </div>
                                {r.notes && <div className="text-sm mt-2 whitespace-pre-wrap">{r.notes}</div>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
