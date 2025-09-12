import { useEffect, useState } from "react";
import api from "../api";

type Entry = {
    id: number;
    status: "WISHLIST";
    game: { id: number; title: string; release_year?: number | null; cover_url?: string | null };
};

export default function Wishlist() {
    const [items, setItems] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const { data } = await api.get<Entry[]>("/entries/", { params: { status: "WISHLIST" } });
            setItems(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="container-page">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">My Wishlist</h2>
                <button onClick={load}>Refresh</button>
            </div>

            {loading ? (
                <ul className="list-none p-0 m-0">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="card p-3 mb-3">
                            <div className="flex gap-3">
                                <div className="w-[72px] h-[72px] rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                                <div className="flex-1 min-w-0">
                                    <div className="h-4 w-44 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                                    <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : items.length === 0 ? (
                <div className="card p-6 mt-4 text-center">
                    <h3 className="text-lg font-semibold mb-1">Your wishlist is empty</h3>
                    <p className="muted">Find games on the Discover page and add them to your wishlist.</p>
                </div>
            ) : (
                <ul className="list-none p-0 m-0">
                    {items.map((en) => (
                        <li key={en.id} className="card p-3 mb-3 flex gap-3 items-start">
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
                                <div className="text-xs muted mt-1">Status: Wishlist</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
