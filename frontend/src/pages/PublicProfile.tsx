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

function statusStyles(s: Status): React.CSSProperties {
    const base: React.CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1px solid transparent" };
    switch (s) {
        case "PLAYING": return { ...base, background: "#eef7ff", color: "#0b6bcb", borderColor: "#cfe6ff" };
        case "PLANNING": return { ...base, background: "#f7f7ff", color: "#5b5bd6", borderColor: "#e3e3ff" };
        case "PAUSED": return { ...base, background: "#fff7e6", color: "#aa6a00", borderColor: "#ffe7bf" };
        case "DROPPED": return { ...base, background: "#fff0f0", color: "#b01e1e", borderColor: "#ffd7d7" };
        case "COMPLETED": return { ...base, background: "#ecfbf1", color: "#1d7a45", borderColor: "#c9f0d7" };
        default: return base;
    }
}
function StatusBadge({ s }: { s: Status }) { return <span style={statusStyles(s)}>{s}</span>; }
function tileStyle(kind: "ALL" | Status, active = false): React.CSSProperties {
    if (kind === "ALL") return { padding: 10, borderRadius: 8, minWidth: 110, border: "1px solid #e5e7eb", background: active ? "#f4f4f5" : "#fff", cursor: "pointer" };
    const s = statusStyles(kind);
    return { padding: 10, borderRadius: 8, minWidth: 110, border: `1px solid ${s.borderColor as string}`, background: active ? (s.background as string) : "#fff", color: active ? (s.color as string) : "inherit", cursor: "pointer" };
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
        return () => { mounted = false; };
    }, [username]);

    if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
    if (err) return <div style={{ padding: 24, color: "#c00" }}>Error: {err}</div>;
    if (!data) return <div style={{ padding: 24 }}>No data.</div>;
    if ("detail" in data) return <div style={{ padding: 24, color: "#c00" }}>{data.detail}</div>;

    const { user, stats, entries } = data;
    const joinedPretty = new Date(user.joined).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    const visible = filter === "ALL" ? entries : entries.filter(e => e.status === filter);

    return (
        <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                    <h2 style={{ margin: 0 }}>{user.username} · Public Profile</h2>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Joined: <b>{joinedPretty}</b></div>
                </div>
                <Link to="/entries">Back to app</Link>
            </div>

            {/* CLICKABLE, COLORED TILES */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0 24px" }}>
                <div role="button" onClick={() => setFilter("ALL")} style={tileStyle("ALL", filter === "ALL")}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Total</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.total}</div>
                </div>

                {([
                    ["Planning", "PLANNING", stats.planning],
                    ["Playing", "PLAYING", stats.playing],
                    ["Paused", "PAUSED", stats.paused],
                    ["Dropped", "DROPPED", stats.dropped],
                    ["Completed", "COMPLETED", stats.completed],
                ] as const).map(([label, key, val]) => (
                    <div key={key} role="button" onClick={() => setFilter(key)} style={tileStyle(key, filter === key)}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{val}</div>
                    </div>
                ))}
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visible.map((en) => (
                    <li key={en.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 10, boxShadow: "0 1px 0 rgba(17,24,39,.03)" }}>
                        <div style={{ display: "flex", gap: 12 }}>
                            {en.game.cover_url ? (
                                <img
                                    src={en.game.cover_url}
                                    alt={en.game.title}
                                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }}
                                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                />
                            ) : null}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>
                                    {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                </div>
                                <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ opacity: 0.7 }}>Status:</span> <StatusBadge s={en.status} />
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {visible.length === 0 && <p>No entries yet.</p>}
        </div>
    );
}
