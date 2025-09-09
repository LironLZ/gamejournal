import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";
type SortKey = "updated" | "title" | "release" | "score";
type Dir = "asc" | "desc";

type Entry = {
    id: number;
    status: Status;
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
    score?: number | null;
    updated_at?: string;
};

type ProfilePayload =
    | {
        user: { username: string; joined: string };
        stats: {
            total: number;
            planning: number;
            playing: number;
            paused: number;
            dropped: number;
            completed: number;
            avg_score?: number | null;
        };
        entries: Entry[];
    }
    | { detail: string };

/* ---------- Tailwind StatusBadge with dark variants ---------- */
function StatusBadge({ s }: { s: Status }) {
    const base = "inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border";
    switch (s) {
        case "PLAYING":
            return <span className={`${base} bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800`}>PLAYING</span>;
        case "PLANNING":
            return <span className={`${base} bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800`}>PLANNING</span>;
        case "PAUSED":
            return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800`}>PAUSED</span>;
        case "DROPPED":
            return <span className={`${base} bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800`}>DROPPED</span>;
        case "COMPLETED":
            return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800`}>COMPLETED</span>;
        default:
            return <span className={base}>{s}</span>;
    }
}

/* ---------- Tiles ---------- */
const baseTile = "tile"; // from index.css theme

const STATUS_CLASSES: Record<Status, { border: string; activeBg: string; text: string }> = {
    PLANNING: { border: "border-indigo-200", activeBg: "bg-indigo-50", text: "text-indigo-700" },
    PLAYING: { border: "border-sky-200", activeBg: "bg-sky-50", text: "text-sky-700" },
    PAUSED: { border: "border-amber-200", activeBg: "bg-amber-50", text: "text-amber-700" },
    DROPPED: { border: "border-red-200", activeBg: "bg-red-50", text: "text-red-700" },
    COMPLETED: { border: "border-emerald-200", activeBg: "bg-emerald-50", text: "text-emerald-700" },
};

function Tile({
    label, value, active = false, onClick, className = "",
}: { label: string; value: number; active?: boolean; onClick?: () => void; className?: string; }) {
    return (
        <button type="button" onClick={onClick}
            className={`${baseTile} ${active ? "bg-zinc-100" : ""} ${className}`} title={`Show ${label.toLowerCase()} entries`}>
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </button>
    );
}

function StatusTile({
    status, label, value, active = false, onClick,
}: { status: Status; label: string; value: number; active?: boolean; onClick?: () => void; }) {
    const c = STATUS_CLASSES[status];
    return (
        <button type="button" onClick={onClick}
            className={`${baseTile} border ${c.border} ${active ? c.activeBg : ""} ${active ? c.text : ""}`}
            title={`Show ${label.toLowerCase()} entries`}>
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </button>
    );
}

/* ---------- URL helpers ---------- */
const isStatus = (v: any): v is Status => ["PLANNING", "PLAYING", "PAUSED", "DROPPED", "COMPLETED"].includes(v);
const isSortKey = (v: any): v is SortKey => ["updated", "title", "release", "score"].includes(v);
const isDir = (v: any): v is Dir => v === "asc" || v === "desc";

function getInitialFromURL(): { filter: "ALL" | Status; sort: SortKey; dir: Dir } {
    try {
        const sp = new URLSearchParams(window.location.search);
        const s = sp.get("status"), k = sp.get("sort"), d = sp.get("dir");
        return {
            filter: isStatus(s) ? (s as Status) : "ALL",
            sort: isSortKey(k) ? (k as SortKey) : "updated",
            dir: isDir(d) ? (d as Dir) : "desc",
        };
    } catch { return { filter: "ALL", sort: "updated", dir: "desc" }; }
}

export default function PublicProfile() {
    const { username = "" } = useParams<{ username: string }>();

    const initial = getInitialFromURL();
    const [filter, setFilter] = useState<"ALL" | Status>(initial.filter);
    const [sortKey, setSortKey] = useState<SortKey>(initial.sort);
    const [dir, setDir] = useState<Dir>(initial.dir);

    const [data, setData] = useState<ProfilePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        const url = new URL(window.location.href);
        if (filter === "ALL") url.searchParams.delete("status"); else url.searchParams.set("status", filter);
        url.searchParams.set("sort", sortKey);
        url.searchParams.set("dir", dir);
        window.history.replaceState(null, "", url.toString());
    }, [filter, sortKey, dir]);

    useEffect(() => {
        function onPop() {
            const { filter: f, sort: s, dir: d } = getInitialFromURL();
            setFilter(f); setSortKey(s); setDir(d);
        }
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true); setErr("");
                const resp = await api.get<ProfilePayload>(`/users/${encodeURIComponent(username)}/`);
                if (mounted) setData(resp.data);
            } catch (e: any) {
                if (mounted) setErr(e?.response?.data?.detail || e?.message || "Failed to load profile.");
            } finally { if (mounted) setLoading(false); }
        })();
        return () => { mounted = false; };
    }, [username]);

    const payload = data && !("detail" in data) ? data : null;
    const entries = payload?.entries ?? [];
    const filtered = filter === "ALL" ? entries : entries.filter((e) => e.status === filter);

    const sorted = useMemo(() => {
        const arr = [...filtered];
        const mul = dir === "asc" ? 1 : -1;
        arr.sort((a, b) => {
            switch (sortKey) {
                case "title": return ((a.game.title || "").toLowerCase() < (b.game.title || "").toLowerCase() ? -1 : 1) * mul;
                case "release": return ((a.game.release_year ?? -Infinity) - (b.game.release_year ?? -Infinity)) * mul;
                case "score": return ((a.score ?? -Infinity) - (b.score ?? -Infinity)) * mul;
                case "updated":
                default: {
                    const au = a.updated_at ? Date.parse(a.updated_at) : -Infinity;
                    const bu = b.updated_at ? Date.parse(b.updated_at) : -Infinity;
                    return (au - bu) * mul;
                }
            }
        });
        return arr;
    }, [filtered, sortKey, dir]);

    if (loading) return <div className="p-6">Loading…</div>;
    if (err) return <div className="p-6 text-red-700">Error: {err}</div>;
    if (!payload) {
        const msg = data && "detail" in data ? data.detail : "No data.";
        return <div className={`p-6 ${data && "detail" in data ? "text-red-700" : ""}`}>{msg}</div>;
    }

    const { user, stats } = payload;
    const joinedPretty = new Date(user.joined).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

    return (
        <div className="container-page">
            {/* Header */}
            <div className="flex justify-between items-baseline my-2 mb-4">
                <div>
                    <h2 className="m-0 text-3xl font-bold">{user.username}</h2>
                    <div className="text-sm text-zinc-500 mt-1">Joined <b>{joinedPretty}</b></div>
                    <div className="pill-indigo mt-2">
                        Avg score: {typeof stats.avg_score === "number" ? stats.avg_score.toFixed(1) : "—"}
                    </div>
                </div>
                <Link to="/entries" className="nav-link">Back to app</Link>
            </div>

            {/* Tiles */}
            <div className="flex gap-4 flex-wrap my-4">
                <Tile label="Total" value={stats.total} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
                <StatusTile status="PLANNING" label="Planning" value={stats.planning} active={filter === "PLANNING"} onClick={() => setFilter("PLANNING")} />
                <StatusTile status="PLAYING" label="Playing" value={stats.playing} active={filter === "PLAYING"} onClick={() => setFilter("PLAYING")} />
                <StatusTile status="PAUSED" label="Paused" value={stats.paused} active={filter === "PAUSED"} onClick={() => setFilter("PAUSED")} />
                <StatusTile status="DROPPED" label="Dropped" value={stats.dropped} active={filter === "DROPPED"} onClick={() => setFilter("DROPPED")} />
                <StatusTile status="COMPLETED" label="Completed" value={stats.completed} active={filter === "COMPLETED"} onClick={() => setFilter("COMPLETED")} />
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                <label className="text-xs text-zinc-500">Sort by</label>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="select">
                    <option value="updated">Last updated</option>
                    <option value="title">Title</option>
                    <option value="release">Release year</option>
                    <option value="score">Score</option>
                </select>
                <button type="button" onClick={() => setDir(dir === "asc" ? "desc" : "asc")} className="btn btn-outline ml-2">
                    {dir === "asc" ? "Asc ↑" : "Desc ↓"}
                </button>
            </div>

            {/* List */}
            <ul className="list-none p-0 m-0">
                {sorted.map((en) => (
                    <li key={en.id} className="card p-4 mb-3 transition-colors hover:bg-gray-100">
                        <div className="flex gap-3">
                            {en.game.cover_url ? (
                                <img
                                    src={en.game.cover_url}
                                    alt={en.game.title}
                                    className="w-[72px] h-[72px] object-cover rounded-lg border border-gray-200"
                                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                />
                            ) : null}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-base leading-tight">
                                    {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                                    <span className="opacity-70 text-xs">Status:</span>
                                    <StatusBadge s={en.status} />
                                    {typeof en.score === "number" && (
                                        <span className="pill-score ml-1">{en.score}/10</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {sorted.length === 0 && <p>No entries yet.</p>}
        </div>
    );
}
