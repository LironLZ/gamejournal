import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type Entry = {
    id: number;
    status: Status;
    score?: number | null;
    notes?: string;
    started_at?: string | null;
    finished_at?: string | null;
    updated_at: string;
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

/* ---------- Tailwind StatusBadge + Tiles ---------- */
function StatusBadge({ s }: { s: Status }) {
    const base = "inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border";
    switch (s) {
        case "PLAYING": return <span className={`${base} bg-sky-50     text-sky-700     border-sky-200`}>PLAYING</span>;
        case "PLANNING": return <span className={`${base} bg-indigo-50  text-indigo-700  border-indigo-200`}>PLANNING</span>;
        case "PAUSED": return <span className={`${base} bg-amber-50   text-amber-700   border-amber-200`}>PAUSED</span>;
        case "DROPPED": return <span className={`${base} bg-red-50     text-red-700     border-red-200`}>DROPPED</span>;
        case "COMPLETED": return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>COMPLETED</span>;
        default: return <span className={base}>{s}</span>;
    }
}

const baseTile = "tile";

const STATUS_CLASSES: Record<Status, { border: string; activeBg: string; text: string }> = {
    PLANNING: { border: "border-indigo-200", activeBg: "bg-indigo-50", text: "text-indigo-700" },
    PLAYING: { border: "border-sky-200", activeBg: "bg-sky-50", text: "text-sky-700" },
    PAUSED: { border: "border-amber-200", activeBg: "bg-amber-50", text: "text-amber-700" },
    DROPPED: { border: "border-red-200", activeBg: "bg-red-50", text: "text-red-700" },
    COMPLETED: { border: "border-emerald-200", activeBg: "bg-emerald-50", text: "text-emerald-700" },
};

function Tile({
    label, value, active = false, onClick,
}: { label: string; value: number; active?: boolean; onClick?: () => void; }) {
    return (
        <button type="button" onClick={onClick} className={`${baseTile} ${active ? "bg-zinc-100" : ""}`}>
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
        <button type="button" onClick={onClick} className={`${baseTile} border ${c.border} ${active ? c.activeBg : ""} ${active ? c.text : ""}`}>
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-lg font-bold">{value}</div>
        </button>
    );
}

/* ---------- sorting config ---------- */
type SortKey = "UPDATED" | "TITLE" | "RELEASE" | "SCORE" | "STATUS";
type Dir = "ASC" | "DESC";
const SORT_LABEL: Record<SortKey, string> = {
    UPDATED: "Updated", TITLE: "Title", RELEASE: "Release year", SCORE: "Score", STATUS: "Status",
};
const URL_SORT_MAP: Record<string, SortKey> = {
    updated: "UPDATED", title: "TITLE", release: "RELEASE", score: "SCORE", status: "STATUS",
};
const toUrlSort = (s: SortKey) => ({ UPDATED: "updated", TITLE: "title", RELEASE: "release", SCORE: "score", STATUS: "status" }[s]);

export default function Entries() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    const [search, setSearch] = useSearchParams();
    const initialFilter = (search.get("status") as "ALL" | Status) || "ALL";
    const [filter, setFilter] = useState<"ALL" | Status>(initialFilter);

    const sortFromUrl = URL_SORT_MAP[search.get("sort") || ""] || "UPDATED";
    const dirFromUrl = (search.get("dir")?.toUpperCase() === "ASC" ? "ASC" : "DESC") as Dir;
    const [sort, setSort] = useState<SortKey>(sortFromUrl);
    const [dir, setDir] = useState<Dir>(dirFromUrl);

    useEffect(() => {
        const next = new URLSearchParams(search);
        if (filter === "ALL") next.delete("status"); else next.set("status", filter);
        next.set("sort", toUrlSort(sort));
        next.set("dir", dir.toLowerCase());
        setSearch(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, sort, dir]);

    useEffect(() => {
        const s = search.get("sort") || "";
        const d = (search.get("dir") || "").toLowerCase();
        const f = search.get("status");
        if (f && ["PLANNING", "PLAYING", "PAUSED", "DROPPED", "COMPLETED"].includes(f) && f !== filter) {
            setFilter(f as Status);
        }
        const sk = URL_SORT_MAP[s] || "UPDATED";
        if (sk !== sort) setSort(sk);
        const dd = (d === "asc" ? "ASC" : "DESC") as Dir;
        if (dd !== dir) setDir(dd);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameLite[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const [selected, setSelected] = useState<GameLite | null>(null);
    const [status, setStatus] = useState<Status>("PLAYING");
    const [msg, setMsg] = useState("");
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);

    type EditState = { score: string; notes: string; started_at: string; finished_at: string };
    const [entryEdits, setEntryEdits] = useState<Record<number, EditState>>({});

    async function loadEntries() {
        const { data } = await api.get("/entries/");
        setEntries(data);
        const seeded: Record<number, EditState> = {};
        for (const en of data as Entry[]) {
            seeded[en.id] = {
                score: en.score == null ? "" : String(en.score),
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
    async function refresh() { await Promise.all([loadEntries(), loadStats()]); }
    useEffect(() => { refresh(); }, []);

    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 2) { setResults([]); return; }
        debounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await api.get<GameLite[]>("/search/games/", { params: { q: query.trim() } });
                setResults(data.slice(0, 8)); setShowDrop(true);
            } catch { setResults([]); }
        }, 250);
        return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    }, [query]);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!dropdownRef.current) return;
            if (!dropdownRef.current.contains(e.target as Node)) setShowDrop(false);
        }
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, []);

    function pickGame(g: GameLite) {
        setSelected(g); setQuery(g.title); setResults([]); setShowDrop(false);
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (!selected) { setMsg("Pick a game from search first"); return; }
            let gameId = selected.id;
            if (!gameId && selected.source === "rawg" && selected.rawg_id) {
                const { data } = await api.post("/import/game/", { rawg_id: selected.rawg_id });
                gameId = data.id;
            }
            if (!gameId) { setMsg("Could not resolve a local game id"); return; }
            await api.post("/entries/", { game_id: gameId, status });
            setSelected(null); setQuery(""); setStatus("PLAYING"); setMsg("Added!"); refresh();
        } catch (err: any) {
            setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
        }
    }

    async function updateStatus(id: number, s: Status) {
        await api.patch(`/entries/${id}/`, { status: s }); refresh();
    }

    function updateEdit(id: number, patch: Partial<EditState>) {
        setEntryEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { score: "", notes: "", started_at: "", finished_at: "" }), ...patch } }));
    }

    function resetEdit(id: number) {
        const en = entries.find((e) => e.id === id); if (!en) return;
        setEntryEdits((prev) => ({
            ...prev,
            [id]: {
                score: en.score == null ? "" : String(en.score),
                notes: en.notes ?? "",
                started_at: en.started_at ?? "",
                finished_at: en.finished_at ?? "",
            },
        }));
    }

    async function saveAll(id: number) {
        const edit = entryEdits[id]; if (!edit) return;
        let score: number | null = null;
        if (edit.score.trim() !== "") {
            const n = Number(edit.score);
            if (!Number.isFinite(n)) { setMsg("Score must be a number between 0 and 10."); return; }
            score = Math.min(10, Math.max(0, Math.round(n)));
        }
        const started_at = edit.started_at.trim() === "" ? null : edit.started_at.trim();
        const finished_at = edit.finished_at.trim() === "" ? null : edit.finished_at.trim();
        if (started_at && finished_at && finished_at < started_at) { setMsg("Finish date cannot be before start date."); return; }

        try {
            await api.patch(`/entries/${id}/`, { score, notes: edit.notes, started_at, finished_at });
            setMsg("Saved!"); refresh();
        } catch (err: any) {
            setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
        }
    }

    async function remove(id: number) { await api.delete(`/entries/${id}/`); refresh(); }

    const statusWeight: Record<Status, number> = { PLANNING: 0, PLAYING: 1, PAUSED: 2, DROPPED: 3, COMPLETED: 4 };

    const filtered = filter === "ALL" ? entries : entries.filter((e) => e.status === filter);
    const sorted = [...filtered].sort((a, b) => {
        const m = dir === "ASC" ? 1 : -1;
        switch (sort) {
            case "UPDATED": { return m * ((Date.parse(a.updated_at) || 0) - (Date.parse(b.updated_at) || 0)); }
            case "TITLE": { const ta = a.game.title.toLowerCase(), tb = b.game.title.toLowerCase(); return ta < tb ? -1 * m : ta > tb ? 1 * m : 0; }
            case "RELEASE": { return m * ((a.game.release_year ?? -Infinity) - (b.game.release_year ?? -Infinity)); }
            case "SCORE": { return m * ((a.score ?? -Infinity) - (b.score ?? -Infinity)); }
            case "STATUS": { return m * (statusWeight[a.status] - statusWeight[b.status]); }
            default: return 0;
        }
    });

    const scored = entries.map((e) => e.score).filter((s): s is number => typeof s === "number");
    const avgScore = scored.length ? scored.reduce((x, y) => x + y, 0) / scored.length : null;
    const avgScoreText = avgScore === null ? "—" : (Math.round(avgScore * 10) / 10).toFixed(1);

    return (
        <div className="container-page">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-2xl font-bold">My Entries</h2>
                <div className="flex gap-2 items-center">
                    <label className="text-xs text-zinc-500">Sort by</label>
                    <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="select">
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                            <option key={k} value={k}>{SORT_LABEL[k]}</option>
                        ))}
                    </select>
                    <button type="button" onClick={() => setDir((d) => (d === "ASC" ? "DESC" : "ASC"))} className="btn btn-outline">
                        {dir === "ASC" ? "Asc ↑" : "Desc ↓"}
                    </button>
                    <button onClick={refresh} className="btn btn-outline">Refresh</button>
                </div>
            </div>

            {/* Tiles */}
            {stats ? (
                <div className="flex gap-4 flex-wrap my-3">
                    <Tile label="Total" value={stats.total} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
                    <StatusTile status="PLANNING" label="Planning" value={stats.planning} active={filter === "PLANNING"} onClick={() => setFilter("PLANNING")} />
                    <StatusTile status="PLAYING" label="Playing" value={stats.playing} active={filter === "PLAYING"} onClick={() => setFilter("PLAYING")} />
                    <StatusTile status="PAUSED" label="Paused" value={stats.paused} active={filter === "PAUSED"} onClick={() => setFilter("PAUSED")} />
                    <StatusTile status="DROPPED" label="Dropped" value={stats.dropped} active={filter === "DROPPED"} onClick={() => setFilter("DROPPED")} />
                    <StatusTile status="COMPLETED" label="Completed" value={stats.completed} active={filter === "COMPLETED"} onClick={() => setFilter("COMPLETED")} />
                    <div className="tile cursor-default">
                        <div className="text-xs text-zinc-500">Avg score</div>
                        <div className="text-lg font-bold">{avgScoreText}</div>
                    </div>
                </div>
            ) : (
                <div className="my-2 text-xs text-zinc-500">Stats not loaded (log in?).</div>
            )}

            {/* Add entry with search */}
            <form onSubmit={add} className="flex gap-2 my-3 items-center">
                <div className="relative" ref={dropdownRef}>
                    <input
                        className="input w-72"
                        placeholder="Search games by title"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                        onFocus={() => { if (results.length > 0) setShowDrop(true); }}
                    />
                    {showDrop && results.length > 0 && (
                        <div className="absolute top-full left-0 mt-2 w-[360px] border border-gray-200 bg-white rounded-xl shadow-lg z-10 max-h-80 overflow-y-auto">
                            {results.map((g) => (
                                <div
                                    key={(g.rawg_id ?? g.id) as number}
                                    onClick={() => pickGame(g)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="p-2 cursor-pointer flex gap-2 items-center hover:bg-gray-50"
                                >
                                    {g.background_image ? (
                                        <img
                                            src={g.background_image}
                                            alt={g.title}
                                            width={44}
                                            height={26}
                                            className="object-cover rounded border border-gray-200"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        />
                                    ) : null}
                                    <div>
                                        <div className="font-semibold">{g.title}</div>
                                        <div className="text-xs text-zinc-500">
                                            {(g.id ? `ID: ${g.id} • ` : "")}{g.release_year ? g.release_year : ""}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="select">
                    {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>

                <button className="btn btn-primary">Add</button>
            </form>

            {selected && (
                <div className="text-xs text-zinc-700 -mt-1 mb-2">
                    Selected: <b>{selected.title}</b>{" "}
                    {selected.id ? `(local ID ${selected.id})` : selected.rawg_id ? `(RAWG ${selected.rawg_id})` : ""}
                    <button className="btn btn-ghost text-xs ml-2"
                        onClick={() => { setSelected(null); setQuery(""); }}>
                        Clear
                    </button>
                </div>
            )}

            <div className="text-zinc-600">{msg}</div>

            {/* List */}
            <ul className="list-none p-0 mt-3">
                {sorted.map((en) => {
                    const edit = entryEdits[en.id] ?? { score: "", notes: "", started_at: "", finished_at: "" };
                    return (
                        <li key={en.id} className="card p-3 mb-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {en.game.cover_url ? (
                                        <img
                                            src={en.game.cover_url}
                                            alt={en.game.title}
                                            width={80}
                                            height={45}
                                            className="object-cover rounded-md border border-gray-200"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        />
                                    ) : null}
                                    <div>
                                        <div className="font-semibold">{en.game.title}</div>
                                        <div className="text-xs flex items-center gap-2">
                                            <span className="opacity-70">Status:</span> <StatusBadge s={en.status} />
                                            {typeof en.score === "number" && (
                                                <span className="opacity-70">&nbsp;•&nbsp;Score: <b>{en.score}</b></span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <select value={en.status} onChange={(e) => updateStatus(en.id, e.target.value as Status)} className="select">
                                        {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                                    </select>
                                    <button className="btn btn-danger" onClick={() => remove(en.id)}>Delete</button>
                                </div>
                            </div>

                            {/* Editor */}
                            <div className="mt-3 grid grid-cols-[110px_1fr_140px_140px_auto] gap-2 items-start">
                                <div>
                                    <label className="text-xs text-zinc-500">Score (0–10)</label>
                                    <input
                                        type="number" min={0} max={10} step={1}
                                        value={edit.score} placeholder="0–10"
                                        onChange={(e) => updateEdit(en.id, { score: e.target.value })}
                                        className="input w-[100px] mt-1"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500">Notes</label>
                                    <textarea
                                        rows={2} value={edit.notes}
                                        onChange={(e) => updateEdit(en.id, { notes: e.target.value })}
                                        placeholder="What did you think?"
                                        className="input w-full mt-1 min-h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500">Started</label>
                                    <input
                                        type="date" value={edit.started_at}
                                        onChange={(e) => updateEdit(en.id, { started_at: e.target.value })}
                                        className="input w-[130px] mt-1"
                                    />
                                    {edit.started_at && (
                                        <button type="button" className="btn btn-ghost text-xs mt-1"
                                            onClick={() => updateEdit(en.id, { started_at: "" })}>
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500">Finished</label>
                                    <input
                                        type="date" value={edit.finished_at}
                                        onChange={(e) => updateEdit(en.id, { finished_at: e.target.value })}
                                        className="input w-[130px] mt-1"
                                    />
                                    {edit.finished_at && (
                                        <button type="button" className="btn btn-ghost text-xs mt-1"
                                            onClick={() => updateEdit(en.id, { finished_at: "" })}>
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-2 items-end justify-end">
                                    <button className="btn btn-primary" onClick={() => saveAll(en.id)}>Save</button>
                                    <button type="button" className="btn btn-outline" onClick={() => resetEdit(en.id)}>Reset</button>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {sorted.length === 0 && <p>No entries match this view.</p>}
        </div>
    );
}
