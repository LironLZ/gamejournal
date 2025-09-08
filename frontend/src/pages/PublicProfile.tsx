// frontend/src/pages/PublicProfile.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

type Entry = {
    id: number;
    status: "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";
    total_minutes: number;
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
};

type ProfilePayload =
    | { ok: true; username: string; stats: { total: number; completed: number; playing: number; minutes: number }; entries: Entry[] }
    | { ok: false; detail: string };

export default function PublicProfile() {
    // ✅ type the params so TS knows the key exists
    const { username = "" } = useParams<{ username: string }>();

    const [data, setData] = useState<ProfilePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                // ✅ avoid shadowing "data" state
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

    if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
    if (err) return <div style={{ padding: 24, color: "#c00" }}>Error: {err}</div>;
    if (!data) return <div style={{ padding: 24 }}>No data.</div>;
    if (!data.ok) return <div style={{ padding: 24, color: "#c00" }}>{data.detail}</div>;

    const { stats, entries } = data;

    return (
        <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0 }}>{data.username}&nbsp;·&nbsp;Public Profile</h2>
                <Link to="/entries">Back to app</Link>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0 24px" }}>
                <Stat label="Total" value={stats.total} />
                <Stat label="Playing" value={stats.playing} />
                <Stat label="Completed" value={stats.completed} />
                <Stat label="Minutes" value={stats.minutes} />
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {entries.map((en) => (
                    <li key={en.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 12 }}>
                            {en.game.cover_url ? (
                                <img
                                    src={en.game.cover_url}
                                    alt={en.game.title}
                                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }}
                                    onError={(e) => {
                                        // keep it simple to avoid TS noise
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                />
                            ) : null}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>
                                    {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    Status: {en.status} • Minutes: {en.total_minutes}
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {entries.length === 0 && <p>No entries yet.</p>}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, minWidth: 110 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{value}</div>
        </div>
    );
}
