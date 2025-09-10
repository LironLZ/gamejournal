import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

type SortKey = "trending" | "top" | "new" | "popular";

type DiscoverGame = {
    id: number;
    title: string;
    release_year: number | null;
    cover_url: string | null;
    avg_score: number | null;
    ratings_count: number;
    last_entry_at: string | null;
};

const SORTS: { key: SortKey; label: string }[] = [
    { key: "trending", label: "Trending" },
    { key: "top", label: "Top rated" },
    { key: "popular", label: "Popular" },
    { key: "new", label: "New" },
];

export default function Discover() {
    const nav = useNavigate();
    const [sort, setSort] = useState<SortKey>("trending");
    const [q, setQ] = useState("");
    const [offset, setOffset] = useState(0);
    const [limit] = useState(24);

    const [items, setItems] = useState<DiscoverGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setErr("");

        (async () => {
            try {
                const { data } = await api.get<DiscoverGame[]>("/public/games/", {
                    params: { sort, q: q.trim() || undefined, limit, offset },
                });
                if (!alive) return;
                setItems(data);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || "Failed to load games.");
                setItems([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [sort, q, limit, offset]);

    const page = Math.floor(offset / limit) + 1;
    const canPrev = offset > 0;
    const skeletonCount = useMemo(() => Math.min(12, limit), [limit]);

    return (
        <div className="container-page">
            <div className="card p-4 mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold mb-1">Discover games</h2>
                    <p className="muted text-sm">
                        Browse community activity. Sign up to create your own journal and add ratings.
                    </p>
                </div>
                <div className="flex gap-2">
                    <a href="/register" className="btn-primary">Get started</a>
                    <a href="/login" className="btn-outline">Login</a>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex gap-1">
                    {SORTS.map(s => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => { setSort(s.key); setOffset(0); }}
                            className={`tile px-3 py-2 min-w-0 ${sort === s.key ? "tile-active" : ""}`}
                            title={s.label}
                        >
                            <span className="text-sm font-semibold">{s.label}</span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <input
                        className="w-[260px]"
                        placeholder="Search title…"
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                    />
                    <button
                        type="button"
                        className="btn-outline"
                        onClick={() => { setQ(""); setOffset(0); }}
                        disabled={!q}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {err && <div className="card p-3 mb-3 text-crimson-600">{err}</div>}

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                        <div className="card p-3" key={i}>
                            <div className="w-full h-40 rounded bg-zinc-200 dark:bg-zinc-700 mb-3" />
                            <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                            <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="card p-6 text-center">
                    <h3 className="text-lg font-semibold mb-1">No results</h3>
                    <p className="muted">Try a different sort or search term.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {items.map(g => (
                        <div
                            key={g.id}
                            role="button"
                            onClick={() => nav(`/game/${g.id}`)}
                            className="card p-3 cursor-pointer hover:no-underline"
                            title="View details"
                        >
                            {g.cover_url ? (
                                <img
                                    src={g.cover_url}
                                    alt={g.title}
                                    className="w-full h-40 object-cover rounded border border-gray-200 dark:border-zinc-700 mb-3"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                            ) : null}

                            <div className="flex items-baseline justify-between gap-2">
                                <div className="font-semibold leading-tight">
                                    {g.title}{g.release_year ? ` (${g.release_year})` : ""}
                                </div>
                                {g.avg_score !== null && (
                                    <span className="pill-indigo">{(Math.round(g.avg_score * 10) / 10).toFixed(1)}</span>
                                )}
                            </div>

                            <div className="mt-1 text-xs muted">
                                {g.ratings_count} {g.ratings_count === 1 ? "rating" : "ratings"}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-4">
                <button
                    className="btn-outline"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={!canPrev || loading}
                >
                    ← Previous
                </button>
                <div className="muted text-sm">Page {page}</div>
                <button
                    className="btn-outline"
                    onClick={() => setOffset(offset + limit)}
                    disabled={loading || items.length < limit}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
