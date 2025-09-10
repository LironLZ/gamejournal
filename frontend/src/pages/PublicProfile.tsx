import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type Entry = {
    id: number;
    status: Status;
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
};

type ProfilePayload =
    | {
        user: { username: string; joined: string };
        stats: { total: number; planning: number; playing: number; paused: number; dropped: number; completed: number };
        entries: Entry[];
    }
    | { detail: string };

/* Tailwind status badge (with dark variants) */
const BADGE: Record<Status, string> = {
    PLAYING:
        "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    PLANNING:
        "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PAUSED:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    DROPPED:
        "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
    COMPLETED:
        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
};

function StatusBadge({ s }: { s: Status }) {
    return (
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${BADGE[s]}`}>
            {s}
        </span>
    );
}

export default function PublicProfile() {
    const { username = "" } = useParams<{ username: string }>();
    const [data, setData] = useState<ProfilePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [filter, setFilter] = useState<"ALL" | Status>("ALL");

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

    if (loading) return <div className="p-6">Loading…</div>;
    if (err) return <div className="p-6 text-crimson-600">Error: {err}</div>;
    if (!data) return <div className="p-6">No data.</div>;
    if ("detail" in data) return <div className="p-6 text-crimson-600">{(data as any).detail}</div>;

    const { user, stats, entries } = data;
    const joinedPretty = new Date(user.joined).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });

    const visible = filter === "ALL" ? entries : entries.filter((e) => e.status === filter);

    return (
        <div className="container-page">
            {/* Header */}
            <div className="flex justify-between items-baseline my-2 mb-4">
                <div>
                    <h2 className="m-0 text-2xl font-bold">{user.username} · Public Profile</h2>
                    <div className="text-sm muted mt-1">
                        Joined <b>{joinedPretty}</b>
                    </div>
                </div>
                <Link to="/entries" className="nav-link">Back to app</Link>
            </div>

            {/* Stat tiles (readable in dark) */}
            <div className="flex gap-4 flex-wrap my-4">
                <button
                    type="button"
                    onClick={() => setFilter("ALL")}
                    className={`tile ${filter === "ALL" ? "ring-1 ring-indigo-400" : ""}`}
                    title="Show all entries"
                >
                    <div className="stat-label">Total</div>
                    <div className="stat-value">{stats.total}</div>
                </button>

                {([
                    ["Planning", "PLANNING", stats.planning],
                    ["Playing", "PLAYING", stats.playing],
                    ["Paused", "PAUSED", stats.paused],
                    ["Dropped", "DROPPED", stats.dropped],
                    ["Completed", "COMPLETED", stats.completed],
                ] as const).map(([label, key, val]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        className={`tile ${filter === key ? "ring-1 ring-indigo-400" : ""}`}
                        title={`Show ${label.toLowerCase()} entries`}
                    >
                        <div className="stat-label">{label}</div>
                        <div className="stat-value">{val}</div>
                    </button>
                ))}
            </div>

            {/* List */}
            <ul className="list-none p-0 m-0">
                {visible.map((en) => (
                    <li key={en.id} className="card p-3 mb-3">
                        <div className="flex gap-3">
                            {en.game.cover_url ? (
                                <img
                                    src={en.game.cover_url}
                                    alt={en.game.title}
                                    className="w-[72px] h-[72px] object-cover rounded-lg border border-gray-200 dark:border-zinc-700"
                                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                />
                            ) : null}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-base leading-tight">
                                    {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                                    <span className="muted text-xs">Status:</span>
                                    <StatusBadge s={en.status} />
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {visible.length === 0 && <p className="mt-4">No entries yet.</p>}
        </div>
    );
}
