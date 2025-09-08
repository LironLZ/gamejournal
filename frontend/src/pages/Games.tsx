import { useEffect, useState } from "react";
import api from "../api";

type Game = { id: number; title: string; release_year?: number | null };

export default function Games() {
    const [games, setGames] = useState<Game[]>([]);
    const [title, setTitle] = useState("");
    const [year, setYear] = useState<number | "">("");
    const [msg, setMsg] = useState("");

    async function load() {
        const { data } = await api.get("/games/");
        setGames(data);
    }
    useEffect(() => { load(); }, []);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        try {
            await api.post("/games/", { title, release_year: year || null });
            setTitle(""); setYear(""); setMsg("Added!");
            load();
        } catch (err: any) {
            setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
        }
    }

    async function remove(id: number) {
        await api.delete(`/games/${id}/`);
        load();
    }

    return (
        <div style={{ maxWidth: 800, margin: "30px auto" }}>
            <h2>Games</h2>

            <form onSubmit={add} style={{ display: "flex", gap: 8, margin: "12px 0" }}>
                <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
                <input type="number" placeholder="Year" value={year} onChange={e => setYear(e.target.value ? Number(e.target.value) : "")} />
                <button>Add</button>
            </form>
            <div style={{ color: "#555" }}>{msg}</div>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {games.map(g => (
                    <li key={g.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>{g.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {g.id} {g.release_year ? `• ${g.release_year}` : ""}</div>
                        </div>
                        <button onClick={() => remove(g.id)}>Delete</button>
                    </li>
                ))}
            </ul>

            {games.length === 0 && <p>No games yet.</p>}
        </div>
    );
}
