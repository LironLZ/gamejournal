// frontend/src/pages/Entries.tsx
import { useEffect, useRef, useState } from "react";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type Entry = {
    id: number;
    status: Status;
    total_minutes: number;
    score?: number | null;
    notes?: string;
    started_at?: string | null;   // <-- add
    finished_at?: string | null;  // <-- add
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
    total_minutes: number;
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

export default function Entries() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    // --- search state (RAWG via backend) ---
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameLite[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const [selected, setSelected] = useState<GameLite | null>(null);
    const [status, setStatus] = useState<Status>("PLAYING");
    const [msg, setMsg] = useState("");
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);

    // --- per-entry edit state (now includes dates) ---
    type EditState = { score: string; notes: string; started_at: string; finished_at: string };
    const [entryEdits, setEntryEdits] = useState<Record<number, EditState>>({});

    async function loadEntries() {
        const { data } = await api.get("/entries/");
        setEntries(data);
        // seed edit map with server values (as strings for inputs)
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
        await Promise.all([loadEntries(), loadStats()]);
    }

    useEffect(() => {
        refresh();
    }, []);

    // --- debounced RAWG search via backend proxy ---
    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }
        debounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await api.get<GameLite[]>("/search/games/", {
                    params: { q: query.trim() },
                });
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

            // If the item came from RAWG, import it first to get a local game id
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
        setEntryEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { score: "", notes: "", started_at: "", finished_at: "" }), ...patch } }));
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

        // dates: empty string => null; otherwise YYYY-MM-DD
        const started_at = edit.started_at.trim() === "" ? null : edit.started_at.trim();
        const finished_at = edit.finished_at.trim() === "" ? null : edit.finished_at.trim();

        // simple client check (server also validates if you added the validator)
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

    return (
        <div style={{ maxWidth: 900, margin: "30px auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>My Entries</h2>
                <button onClick={refresh}>Refresh</button>
            </div>

            {/* Stats bar */}
            {stats ? (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0" }}>
                    {[
                        ["Total", stats.total],
                        ["Planning", stats.planning],
                        ["Playing", stats.playing],
                        ["Paused", stats.paused],
                        ["Dropped", stats.dropped],
                        ["Completed", stats.completed],
                        ["Minutes", stats.total_minutes],
                    ].map(([label, val]) => (
                        <div key={label as string} style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, minWidth: 110 }}>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{val as number}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ margin: "8px 0", fontSize: 12, opacity: 0.7 }}>Stats not loaded (log in?).</div>
            )}

            {/* Add entry (with RAWG search) */}
            <form onSubmit={add} style={{ display: "flex", gap: 8, margin: "12px 0", alignItems: "center" }}>
                <div style={{ position: "relative" }} ref={dropdownRef}>
                    <input
                        placeholder="Search games by title"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelected(null);
                        }}
                        onFocus={() => {
                            if (results.length > 0) setShowDrop(true);
                        }}
                        style={{ width: 300 }}
                    />
                    {showDrop && results.length > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                top: "110%",
                                left: 0,
                                width: 360,
                                border: "1px solid #ddd",
                                background: "#fff",
                                borderRadius: 8,
                                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                                zIndex: 10,
                                maxHeight: 320,
                                overflowY: "auto",
                            }}
                        >
                            {results.map((g) => (
                                <div
                                    key={(g.rawg_id ?? g.id) as number}
                                    onClick={() => pickGame(g)}
                                    style={{ padding: 8, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    {g.background_image ? (
                                        <img
                                            src={g.background_image}
                                            alt={g.title}
                                            width={44}
                                            height={26}
                                            style={{ objectFit: "cover", borderRadius: 4, border: "1px solid #eee" }}
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    ) : null}
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{g.title}</div>
                                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                                            {(g.id ? `ID: ${g.id} • ` : "")}
                                            {g.release_year ? g.release_year : ""}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>

                <button>Add</button>
            </form>

            {selected && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: -6, marginBottom: 8 }}>
                    Selected: <b>{selected.title}</b>{" "}
                    {selected.id ? `(local ID ${selected.id})` : selected.rawg_id ? `(RAWG ${selected.rawg_id})` : ""}
                    <button
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                            setSelected(null);
                            setQuery("");
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}

            <div style={{ color: "#555" }}>{msg}</div>

            {/* List */}
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {entries.map((en) => {
                    const edit = entryEdits[en.id] ?? { score: "", notes: "", started_at: "", finished_at: "" };
                    return (
                        <li key={en.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {en.game.cover_url ? (
                                        <img
                                            src={en.game.cover_url}
                                            alt={en.game.title}
                                            width={80}
                                            height={45}
                                            style={{ objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }}
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    ) : null}
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{en.game.title}</div>
                                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                                            Status: {en.status} • Minutes: {en.total_minutes}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 8 }}>
                                    <select value={en.status} onChange={(e) => updateStatus(en.id, e.target.value as Status)}>
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                    <button onClick={() => remove(en.id)}>Delete</button>
                                </div>
                            </div>

                            {/* Score + Notes + Dates editor */}
                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "110px 1fr 140px 140px auto", gap: 8, alignItems: "start" }}>
                                <div>
                                    <label style={{ fontSize: 12, opacity: 0.7 }}>Score (0–10)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        step={1}
                                        value={edit.score}
                                        placeholder="0–10"
                                        onChange={(e) => updateEdit(en.id, { score: e.target.value })}
                                        style={{ width: 100 }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 12, opacity: 0.7 }}>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={edit.notes}
                                        onChange={(e) => updateEdit(en.id, { notes: e.target.value })}
                                        placeholder="What did you think?"
                                        style={{ width: "100%", resize: "vertical" }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 12, opacity: 0.7 }}>Started</label>
                                    <input
                                        type="date"
                                        value={edit.started_at}
                                        onChange={(e) => updateEdit(en.id, { started_at: e.target.value })}
                                        style={{ width: 130 }}
                                    />
                                    {edit.started_at && (
                                        <button type="button" style={{ marginTop: 4 }} onClick={() => updateEdit(en.id, { started_at: "" })}>
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontSize: 12, opacity: 0.7 }}>Finished</label>
                                    <input
                                        type="date"
                                        value={edit.finished_at}
                                        onChange={(e) => updateEdit(en.id, { finished_at: e.target.value })}
                                        style={{ width: 130 }}
                                    />
                                    {edit.finished_at && (
                                        <button type="button" style={{ marginTop: 4 }} onClick={() => updateEdit(en.id, { finished_at: "" })}>
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "end", justifyContent: "flex-end" }}>
                                    <button onClick={() => saveAll(en.id)}>Save</button>
                                    <button type="button" onClick={() => resetEdit(en.id)}>Reset</button>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {entries.length === 0 && <p>No entries yet.</p>}
        </div>
    );
}
