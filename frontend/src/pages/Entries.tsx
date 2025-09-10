import { useEffect, useRef, useState } from "react";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type Entry = {
    id: number;
    status: Status;
    score?: number | null;
    notes?: string;
    started_at?: string | null;
    finished_at?: string | null;
    game: {
        id: number;
        title: string;
        release_year?: number | null;
        cover_url?: string | null;
    };
};

type Stats = {
    total: number;
    planning: number;
    playing: number;
    paused: number;
    dropped: number;
    completed: number;
};

type GameLite = {
    id?: number;
    title: string;
    release_year?: number | null;
    source?: "rawg";
    rawg_id?: number;
    background_image?: string | null;
};

const STATUSES: Status[] = ["PLANNING", "PLAYING", "PAUSED", "DROPPED", "COMPLETED"];

/* Status badges (good contrast in dark) */
const BADGE: Record<Status, string> = {
    PLAYING: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
    PLANNING: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    PAUSED: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    DROPPED: "bg-crimson-100 text-crimson-700 border-crimson-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
};

function StatusBadge({ s }: { s: Status }) {
    return (
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${BADGE[s]}`}>
            {s}
        </span>
    );
}

/* Active tile tints per status */
const TILE_ACTIVE: Record<Status | "ALL", string> = {
    ALL: "tile-active",
    PLANNING: "tile-active border-indigo-200 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20",
    PLAYING: "tile-active border-sky-200 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20",
    PAUSED: "tile-active border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
    DROPPED: "tile-active border-crimson-200 bg-crimson-50 dark:border-rose-700 dark:bg-rose-900/20",
    COMPLETED: "tile-active border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20",
};

export default function Entries() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    // status filter (driven by tiles too)
    const [filter, setFilter] = useState<"ALL" | Status>("ALL");

    // search state (RAWG via backend)
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameLite[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const [selected, setSelected] = useState<GameLite | null>(null);
    const [status, setStatus] = useState<Status>("PLAYING");
    const [msg, setMsg] = useState("");
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // per-entry edit state (includes dates)
    type EditState = { score: string; notes: string; started_at: string; finished_at: string };
    const [entryEdits, setEntryEdits] = useState<Record<number, EditState>>({});

    async function loadEntries() {
        const { data } = await api.get("/entries/");
        setEntries(data);
        // seed edits
        const seeded: Record<number, EditState> = {};
        for (const en of data as Entry[]) {
            seeded[en.id] = {
                score: en.score === null || en.score === undefined ? "" : String(en.score),
                notes: en.notes ?? "",
                started_at: en.started_at ?? "",
                finished_at: en.finished_at ?? "",
            };
        }
        setEntryEdits(seeded);
    }

    async function loadStats() {
        try {
            const { data } = await api.get("/stats/");
            setStats(data);
        } catch {
            setStats(null);
        }
    }

    async function refresh() {
        setLoading(true);
        try {
            await Promise.all([loadEntries(), loadStats()]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { refresh(); }, []);

    // debounced RAWG search via backend proxy
    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }
        debounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await api.get<GameLite[]>("/search/games/", { params: { q: query.trim() } });
                setResults(data.slice(0, 8));
                setShowDrop(true);
            } catch {
                setResults([]);
            }
        }, 250);
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [query]);

    // close dropdown on outside click
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!dropdownRef.current) return;
            if (!dropdownRef.current.contains(e.target as Node)) setShowDrop(false);
        }
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    function pickGame(g: GameLite) {
        setSelected(g);
        setQuery(g.title);
        setResults([]);
        setShowDrop(false);
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (!selected) {
                setMsg("Pick a game from search first");
                return;
            }
            // If RAWG item, import first
            let gameId = selected.id;
            if (!gameId && selected.source === "rawg" && selected.rawg_id) {
                const { data } = await api.post("/import/game/", { rawg_id: selected.rawg_id });
                gameId = data.id;
            }
            if (!gameId) {
                setMsg("Could not resolve a local game id");
                return;
            }
            await api.post("/entries/", { game_id: gameId, status });
            setSelected(null);
            setQuery("");
            setStatus("PLAYING");
            setMsg("Added!");
            refresh();
        } catch (err: any) {
            setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
        }
    }

    async function updateStatus(id: number, s: Status) {
        await api.patch(`/entries/${id}/`, { status: s });
        refresh();
    }

    function updateEdit(id: number, patch: Partial<EditState>) {
        setEntryEdits((prev) => ({
            ...prev,
            [id]: { ...(prev[id] ?? { score: "", notes: "", started_at: "", finished_at: "" }), ...patch },
        }));
    }

    function resetEdit(id: number) {
        const en = entries.find((e) => e.id === id);
        if (!en) return;
        setEntryEdits((prev) => ({
            ...prev,
            [id]: {
                score: en.score === null || en.score === undefined ? "" : String(en.score),
                notes: en.notes ?? "",
                started_at: en.started_at ?? "",
                finished_at: en.finished_at ?? "",
            },
        }));
    }

    async function saveAll(id: number) {
        const edit = entryEdits[id];
        if (!edit) return;

        // score: string -> number|null (clamp 0..10)
        let score: number | null = null;
        if (edit.score.trim() !== "") {
            const n = Number(edit.score);
            if (!Number.isFinite(n)) {
                setMsg("Score must be a number between 0 and 10.");
                return;
            }
            score = Math.min(10, Math.max(0, Math.round(n)));
        }

        // dates: empty string => null
        const started_at = edit.started_at.trim() === "" ? null : edit.started_at.trim();
        const finished_at = edit.finished_at.trim() === "" ? null : edit.finished_at.trim();
        if (started_at && finished_at && finished_at < started_at) {
            setMsg("Finish date cannot be before start date.");
            return;
        }

        try {
            await api.patch(`/entries/${id}/`, { score, notes: edit.notes, started_at, finished_at });
            setMsg("Saved!");
            refresh();
        } catch (err: any) {
            setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
        }
    }

    async function remove(id: number) {
        await api.delete(`/entries/${id}/`);
        refresh();
    }

    // filtered list & average score
    const filteredEntries = filter === "ALL" ? entries : entries.filter((e) => e.status === filter);
    const scored = entries.map((e) => e.score).filter((s): s is number => typeof s === "number");
    const avgScore = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    const avgScoreText = avgScore === null ? "—" : (Math.round(avgScore * 10) / 10).toFixed(1);

    return (
        <div className="container-page">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">My Entries</h2>
                <button onClick={refresh}>Refresh</button>
            </div>

            {/* Tiles */}
            {loading ? (
                <div className="flex gap-4 flex-wrap my-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="tile">
                            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                            <div className="h-5 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                    ))}
                </div>
            ) : stats ? (
                <div className="flex gap-4 flex-wrap my-4">
                    <button
                        type="button"
                        onClick={() => setFilter("ALL")}
                        className={`tile ${filter === "ALL" ? TILE_ACTIVE.ALL : ""}`}
                        title="Show all entries"
                    >
                        <div className="stat-label">Total</div>
                        <div className="stat-value">{stats.total}</div>
                    </button>

                    {([
                        ["Planning", "PLANNING"],
                        ["Playing", "PLAYING"],
                        ["Paused", "PAUSED"],
                        ["Dropped", "DROPPED"],
                        ["Completed", "COMPLETED"],
                    ] as const).map(([label, key]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setFilter(key)}
                            className={`tile ${filter === key ? TILE_ACTIVE[key] : ""}`}
                            title={`Show ${label.toLowerCase()} entries`}
                        >
                            <div className="stat-label">{label}</div>
                            <div className="stat-value">
                                {key === "PLANNING" && stats.planning}
                                {key === "PLAYING" && stats.playing}
                                {key === "PAUSED" && stats.paused}
                                {key === "DROPPED" && stats.dropped}
                                {key === "COMPLETED" && stats.completed}
                            </div>
                        </button>
                    ))}

                    <div className="tile cursor-default" title="Average of non-empty scores">
                        <div className="stat-label">Avg score</div>
                        <div className="stat-value">{avgScoreText}</div>
                    </div>
                </div>
            ) : (
                <div className="my-2 text-sm muted">Stats not loaded.</div>
            )}

            {/* Add entry (with RAWG search) */}
            <form onSubmit={add} className="flex gap-2 items-center my-3">
                <div className="relative" ref={dropdownRef}>
                    <input
                        ref={searchInputRef}
                        placeholder="Search games by title"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelected(null);
                        }}
                        onFocus={() => { if (results.length > 0) setShowDrop(true); }}
                        className="w-[300px]"
                    />
                    {showDrop && results.length > 0 && (
                        <div className="absolute top-[110%] left-0 w-[360px] card rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                            {results.map((g) => (
                                <div
                                    key={(g.rawg_id ?? g.id) as number}
                                    onClick={() => pickGame(g)}
                                    className="px-2 py-2 cursor-pointer flex gap-2 items-center hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    {g.background_image ? (
                                        <img
                                            src={g.background_image}
                                            alt={g.title}
                                            width={44}
                                            height={26}
                                            className="object-cover rounded border border-gray-200 dark:border-zinc-700"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        />
                                    ) : null}
                                    <div>
                                        <div className="font-semibold">{g.title}</div>
                                        <div className="text-xs muted">
                                            {(g.id ? `ID: ${g.id} • ` : "")}
                                            {g.release_year ? g.release_year : ""}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-[160px]">
                    {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>

                <button type="submit" className="btn-primary">Add</button>
            </form>

            {selected && (
                <div className="text-xs muted -mt-2 mb-2">
                    Selected: <b>{selected.title}</b>{" "}
                    {selected.id ? `(local ID ${selected.id})` : selected.rawg_id ? `(RAWG ${selected.rawg_id})` : ""}
                    <button className="ml-2" onClick={() => { setSelected(null); setQuery(""); }}>
                        Clear
                    </button>
                </div>
            )}

            <div className="muted">{msg}</div>

            {/* List / skeleton / empty */}
            {loading ? (
                <ul className="list-none p-0 mt-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="card p-3 mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-20 h-12 rounded bg-zinc-200 dark:bg-zinc-700" />
                                <div className="flex-1">
                                    <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                                    <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : filteredEntries.length === 0 ? (
                <div className="card p-6 mt-4 text-center">
                    <h3 className="text-lg font-semibold mb-1">No entries match this view</h3>
                    <p className="muted mb-3">Add your first game or change the filter.</p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            className="btn-primary"
                            onClick={() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                                setTimeout(() => searchInputRef.current?.focus(), 250);
                            }}
                        >
                            Search games
                        </button>
                        {filter !== "ALL" && (
                            <button className="btn-outline" onClick={() => setFilter("ALL")}>Clear filter</button>
                        )}
                    </div>
                </div>
            ) : (
                <ul className="list-none p-0 mt-3">
                    {filteredEntries.map((en) => {
                        const edit = entryEdits[en.id] ?? { score: "", notes: "", started_at: "", finished_at: "" };
                        return (
                            <li key={en.id} className="card p-3 mb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {en.game.cover_url ? (
                                            <img
                                                src={en.game.cover_url}
                                                alt={en.game.title}
                                                width={80}
                                                height={45}
                                                className="object-cover rounded border border-gray-200 dark:border-zinc-700"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                            />
                                        ) : null}
                                        <div>
                                            <div className="font-semibold">{en.game.title}</div>
                                            <div className="text-xs flex items-center gap-2">
                                                <span className="muted">Status:</span> <StatusBadge s={en.status} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <select value={en.status} onChange={(e) => updateStatus(en.id, e.target.value as Status)} className="w-[160px]">
                                            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                                        </select>
                                        <button className="btn-danger" onClick={() => remove(en.id)}>Delete</button>
                                    </div>
                                </div>

                                {/* Editor */}
                                <div className="mt-3 grid grid-cols-[110px_1fr_140px_140px_auto] gap-2 items-start">
                                    <div>
                                        <label className="text-xs muted">Score (0–10)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={10}
                                            step={1}
                                            value={edit.score}
                                            placeholder="0–10"
                                            onChange={(e) => updateEdit(en.id, { score: e.target.value })}
                                            className="w-[100px]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs muted">Notes</label>
                                        <textarea
                                            rows={2}
                                            value={edit.notes}
                                            onChange={(e) => updateEdit(en.id, { notes: e.target.value })}
                                            placeholder="What did you think?"
                                            className="w-full resize-y"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs muted">Started</label>
                                        <input
                                            type="date"
                                            value={edit.started_at}
                                            onChange={(e) => updateEdit(en.id, { started_at: e.target.value })}
                                            className="w-[130px]"
                                        />
                                        {edit.started_at && (
                                            <button type="button" className="mt-1" onClick={() => updateEdit(en.id, { started_at: "" })}>
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs muted">Finished</label>
                                        <input
                                            type="date"
                                            value={edit.finished_at}
                                            onChange={(e) => updateEdit(en.id, { finished_at: e.target.value })}
                                            className="w-[130px]"
                                        />
                                        {edit.finished_at && (
                                            <button type="button" className="mt-1" onClick={() => updateEdit(en.id, { finished_at: "" })}>
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-2 items-end justify-end">
                                        <button onClick={() => saveAll(en.id)} className="btn-primary">Save</button>
                                        <button type="button" onClick={() => resetEdit(en.id)} className="btn-outline">
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
