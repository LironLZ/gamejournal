// src/components/FavoriteButton.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

function extractIdsFromArray(arr: any[]): number[] {
    return arr
        .map((x) => (typeof x === "number" ? x : x?.game?.id ?? x?.id))
        .filter((v) => typeof v === "number") as number[];
}

function extractIds(payload: any): { ids: number[]; hasListShape: boolean } {
    // Recognize array, {results: []}, {items: []}
    if (Array.isArray(payload)) return { ids: extractIdsFromArray(payload), hasListShape: true };
    if (payload && Array.isArray(payload.results))
        return { ids: extractIdsFromArray(payload.results), hasListShape: true };
    if (payload && Array.isArray(payload.items))
        return { ids: extractIdsFromArray(payload.items), hasListShape: true };
    return { ids: [], hasListShape: false }; // e.g., { ok: true }
}

export default function FavoriteButton({ gameId }: { gameId: number }) {
    const authed = !!localStorage.getItem("access");

    const [favIds, setFavIds] = useState<number[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    // Initial fetch
    useEffect(() => {
        if (!authed) return;
        let alive = true;
        (async () => {
            try {
                setErr("");
                const { data } = await api.get("/me/favorites/");
                if (!alive) return;
                const { ids } = extractIds(data);
                setFavIds(ids);
            } catch (e: any) {
                if (!alive) return;
                setFavIds([]);
                setErr(e?.response?.data?.detail || e?.message || "Failed to load favorites.");
            }
        })();
        return () => {
            alive = false;
        };
    }, [authed]);

    const inFavs = useMemo(() => !!favIds?.includes(gameId), [favIds, gameId]);
    const count = favIds?.length ?? 0;

    async function persist(nextIds: number[], before: number[]) {
        try {
            const { data } = await api.put("/me/favorites/", { items: nextIds });
            const { ids, hasListShape } = extractIds(data);
            // Only overwrite if server gave us a list shape.
            // If it's just an ack (e.g., {ok:true}), keep optimistic `nextIds`.
            setFavIds(hasListShape ? ids : nextIds);
            setErr("");
        } catch (e: any) {
            // Revert on failure
            setFavIds(before);
            setErr(e?.response?.data?.detail || e?.message || "Failed to save favorites.");
        }
    }

    async function add() {
        if (!favIds || busy) return;
        if (inFavs) return;
        if (count >= 9) {
            alert("Favorites are limited to 9. Remove one first.");
            return;
        }
        setBusy(true);
        const before = favIds.slice();
        const next = [...favIds, gameId];
        // Optimistic
        setFavIds(next);
        await persist(next, before);
        setBusy(false);
    }

    async function remove() {
        if (!favIds || busy) return;
        if (!inFavs) return;
        setBusy(true);
        const before = favIds.slice();
        const next = favIds.filter((id) => id !== gameId);
        // Optimistic
        setFavIds(next);
        await persist(next, before);
        setBusy(false);
    }

    if (!authed) return null;

    if (favIds === null) {
        return (
            <div className="flex items-center gap-2">
                <button className="btn-outline" disabled>
                    ☆ Add to favorites
                </button>
                <span className="text-xs opacity-70">…/9</span>
            </div>
        );
    }

    const label = inFavs ? "★ Remove favorite" : "☆ Add to favorites";
    const title = inFavs ? "Remove from favorites" : "Add to favorites";
    const canClick = !busy && (inFavs || count < 9);

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={!canClick}
                onClick={inFavs ? remove : add}
                className={inFavs ? "btn-primary" : "btn-outline"}
                title={title}
                aria-pressed={inFavs}
            >
                {label}
            </button>
            <span className="text-xs opacity-70">{count}/9</span>
            {err && <span className="text-xs text-crimson-600">{err}</span>}
        </div>
    );
}
