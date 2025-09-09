// frontend/src/pages/PublicProfile.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

type Entry = {
    id: number;
    status: "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
};

// Matches your backend now:
// 200 OK -> { user: { username, joined }, stats: {...}, entries: [...] }
// 404 -> { detail: "User not found." }
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
        };
        entries: Entry[];
    }
    | { detail: string };

export default function PublicProfile() {
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

    // Error payload
    if ("detail" in data) {
        return <div style={{ padding: 24, color: "#c00" }}>{data.detail}</div>;
    }

    // Success payload
    const { user, stats, entries } = data;

    // Pretty “Joined” date
    const joinedPretty = new Date(user.joined).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });

    return (
        <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                    <h2 style={{ margin: 0 }}>
                        {user.username} · Public Profile
                    </h2>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                        Joined: <b>{joinedPretty}</b>
                    </div>
                </div>
                <Link to="/entries">Back to app</Link>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0 24px" }}>
                <Stat label="Total" value={stats.total} />
                <Stat label="Planning" value={stats.planning} />
                <Stat label="Playing" value={stats.playing} />
                <Stat label="Paused" value={stats.paused} />
                <Stat label="Dropped" value={stats.dropped} />
                <Stat label="Completed" value={stats.completed} />
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
                                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                />
                            ) : null}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>
                                    {en.game.title} {en.game.release_year ? `(${en.game.release_year})` : ""}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>Status: {en.status}</div>
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
