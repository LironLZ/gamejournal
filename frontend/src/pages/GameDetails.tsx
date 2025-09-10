import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type GameDetail = {
    id: number;
    title: string;
    release_year: number | null;
    cover_url: string | null;
    avg_score: number | null;
    ratings_count: number;
    last_entry_at: string | null;
    planning_count: number;
    playing_count: number;
    paused_count: number;
    dropped_count: number;
    completed_count: number;
};

type RecentEntry = {
    id: number;
    user__username: string;
    status: Status;
    score: number | null;
    finished_at: string | null;
    updated_at: string;
};

type Payload = { game: GameDetail; recent_entries: RecentEntry[] };

const BADGE: Record<Status, string> = {
    PLAYING: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    PLANNING: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PAUSED: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    DROPPED: "bg-crimson-100 text-crimson-700 border-crimson-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
};

function StatPill({ label, value }: { label: string; value: number | null }) {
    return (
        <div className="px-3 py-1 rounded-xl border bg-white dark:bg-zinc-800 dark:border-zinc-700">
            <span className="text-sm font-semibold">{value ?? "—"}</span>{" "}
            <span className="text-xs muted">{label}</span>
        </div>
    );
}

export default function GameDetails() {
    const { id = "" } = useParams();
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setErr("");
        (async () => {
            try {
                const { data } = await api.get<Payload>(`/public/games/${id}/`);
                if (!alive) return;
                setData(data);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || "Failed to load game.");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [id]);

    if (loading) {
        return (
            <div className="container-page">
                <div className="card p-4 mb-4">
                    <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
                    <div className="w-full h-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
                </div>
            </div>
        );
    }
    if (err) return <div className="container-page card p-4 text-crimson-600">{err}</div>;
    if (!data) return <div className="container-page card p-4">No data.</div>;

    const g = data.game;
    const recent = data.recent_entries;

    return (
        <div className="container-page">
            <div className="card p-4 mb-4">
                <div className="flex items-start gap-4">
                    {g.cover_url ? (
                        <img
                            src={g.cover_url}
                            alt={g.title}
                            className="w-40 h-40 object-cover rounded border border-gray-200 dark:border-zinc-700"
                            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                        />
                    ) : null}
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold leading-tight">
                            {g.title} {g.release_year ? `(${g.release_year})` : ""}
                        </h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <StatPill label="avg" value={g.avg_score !== null ? Math.round(g.avg_score * 10) / 10 : null} />
                            <StatPill label="ratings" value={g.ratings_count} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3">
                            <div className="px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700">
                                Planning: <b>{g.planning_count}</b>
                            </div>
                            <div className="px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700">
                                Playing: <b>{g.playing_count}</b>
                            </div>
                            <div className="px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700">
                                Paused: <b>{g.paused_count}</b>
                            </div>
                            <div className="px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700">
                                Dropped: <b>{g.dropped_count}</b>
                            </div>
                            <div className="px-2 py-1 rounded border text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700">
                                Completed: <b>{g.completed_count}</b>
                            </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                            <Link to="/register" className="btn-primary">Start a journal</Link>
                            <Link to="/entries" className="btn-outline">Go to my entries</Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent activity */}
            <div className="card p-4">
                <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
                {recent.length === 0 ? (
                    <div className="muted">No recent public activity.</div>
                ) : (
                    <ul className="list-none p-0 m-0">
                        {recent.map((r) => (
                            <li key={r.id} className="flex items-center justify-between border-b last:border-b-0 border-gray-200 dark:border-zinc-700 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{r.user__username}</span>
                                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${BADGE[r.status]}`}>
                                        {r.status}
                                    </span>
                                    {typeof r.score === "number" && (
                                        <span className="pill-indigo">{r.score}</span>
                                    )}
                                </div>
                                <div className="text-xs muted">
                                    {new Date(r.updated_at).toLocaleDateString()}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
