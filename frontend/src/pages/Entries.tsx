// frontend/src/pages/Entries.tsx
import { useEffect, useRef, useState } from "react";
import api from "../api";

type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

type Entry = {
    id: number;
    status: Status;
    total_minutes: number;
    game: { id: number; title: string; release_year?: number | null };
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

type GameLite = { id: number; title: string; release_year?: number | null };

const STATUSES: Status[] = ["PLANNING", "PLAYING", "PAUSED", "DROPPED", "COMPLETED"];

export default function Entries() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    // --- search state ---
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameLite[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const [selected, setSelected] = useState<GameLite | null>(null);
    const [status, setStatus] = useState<Status>("PLAYING");
    const [msg, setMsg] = useState("");
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const debounceRef = useRef<number | null>(null);

    async function loadEntries() {
        const { data } = await api.get("/entries/");
        setEntries(data);
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

    // --- debounced search ---
    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }
        debounceRef.current = window.setTimeout(async () => {
            try {
                const { data } = await api.get<GameLite[]>("/games/", { params: { q: query.trim() } });
                setResults(data.slice(0, 8));
                setShowDrop(true);
            } catch {
                setResults([]);
            }
        }, 250);
        // cleanup
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
            await api.post("/entries/", { game_id: selected.id, status });
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

            {/* Add entry (with search) */}
            <form onSubmit={add} style={{ display: "flex", gap: 8, margin: "12px 0", alignItems: "center" }}>
                <div style={{ position: "relative" }} ref={dropdownRef}>
                    <input
                        placeholder="Search games by title"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                        onFocus={() => { if (results.length > 0) setShowDrop(true); }}
                        style={{ width: 300 }}
                    />
                    {showDrop && results.length > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                top: "110%",
                                left: 0,
                                width: 320,
                                border: "1px solid #ddd",
                                background: "#fff",
                                borderRadius: 8,
                                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                                zIndex: 10,
                                maxHeight: 280,
                                overflowY: "auto",
                            }}
                        >
                            {results.map((g) => (
                                <div
                                    key={g.id}
                                    onClick={() => pickGame(g)}
                                    style={{ padding: 8, cursor: "pointer" }}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div style={{ fontWeight: 600 }}>{g.title}</div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                                        ID: {g.id}{g.release_year ? ` • ${g.release_year}` : ""}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <button>Add</button>
            </form>

            {selected && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: -6, marginBottom: 8 }}>
                    Selected: <b>{selected.title}</b> (ID {selected.id})
                    <button style={{ marginLeft: 8 }} onClick={() => { setSelected(null); setQuery(""); }}>
                        Clear
                    </button>
                </div>
            )}

            <div style={{ color: "#555" }}>{msg}</div>

            {/* List */}
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {entries.map((en) => (
                    <li key={en.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{en.game.title}</div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    Status: {en.status} • Minutes: {en.total_minutes}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <select value={en.status} onChange={(e) => updateStatus(en.id, e.target.value as Status)}>
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <button onClick={() => remove(en.id)}>Delete</button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {entries.length === 0 && <p>No entries yet.</p>}
        </div>
    );
}
