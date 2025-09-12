import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export type Status = "WISHLIST" | "PLAYING" | "PLAYED" | "DROPPED";

const STATUS_LABEL: Record<Status, string> = {
    WISHLIST: "Wishlist",
    PLAYING: "Playing",
    PLAYED: "Played",
    DROPPED: "Dropped",
};

type EntryListItem = {
    id: number;
    status: Status;
    score: number | null;
    game: { id: number; title?: string; release_year?: number | null };
};

type Props = {
    gameId: number;
    initial?: { status?: Status | null; score?: number | null };
    compact?: boolean;
    onSaved?: (entry: { id?: number; status: Status; score: number | null }) => void;
};

export default function QuickAdd({ gameId, initial, compact, onSaved }: Props) {
    const nav = useNavigate();
    const authed = !!localStorage.getItem("access");

    const [open, setOpen] = useState(false);

    const [existing, setExisting] = useState<Pick<EntryListItem, "id" | "status" | "score"> | null>(
        initial?.status !== undefined || initial?.score !== undefined
            ? { id: 0, status: (initial?.status as Status) || "WISHLIST", score: initial?.score ?? null }
            : null
    );
    const loadedRef = useRef<boolean>(!!existing);

    const [status, setStatus] = useState<Status | "">((initial?.status as Status) || "WISHLIST");
    const [score, setScore] = useState<string>(
        initial?.score === null || initial?.score === undefined ? "" : String(initial?.score)
    );

    const [saving, setSaving] = useState(false);
    const [ok, setOk] = useState<null | "saved" | "err">(null);

    const uid = useId();

    useEffect(() => {
        if (initial && (initial.status !== existing?.status || initial.score !== existing?.score)) {
            setExisting({ id: 0, status: (initial.status as Status) || "WISHLIST", score: initial.score ?? null });
            setStatus((initial.status as Status) || "WISHLIST");
            setScore(initial.score == null ? "" : String(initial.score));
            loadedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial?.status, initial?.score]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const showLabel = useMemo(() => {
        if (existing?.status) return STATUS_LABEL[existing.status];
        return compact ? "＋" : "Add to journal";
    }, [existing, compact]);

    function normalizeScore(raw: string): number | null {
        if (raw === "" || raw == null) return null;
        const n = Math.round(Number(raw));
        if (Number.isNaN(n)) return null;
        return Math.max(0, Math.min(10, n));
    }

    async function postCreate(s: Status, sc: number | null) {
        return api.post("/entries/", { game_id: gameId, status: s, score: sc });
    }
    async function listMine(): Promise<EntryListItem[]> {
        const { data } = await api.get<EntryListItem[]>("/entries/", {
            params: { game_id: gameId },
        });
        return Array.isArray(data) ? data : (data as any)?.results || [];
    }
    async function findMineByGame(): Promise<EntryListItem | null> {
        const arr = await listMine();
        return arr.find((e) => e?.game?.id === gameId) || null;
    }
    async function patchUpdate(id: number, s: Status, sc: number | null) {
        return api.patch(`/entries/${id}/`, { status: s, score: sc });
    }

    async function openAndPrefill() {
        if (!authed) {
            nav("/login");
            return;
        }
        setOpen(true);
        setOk(null);

        if (loadedRef.current) return;
        try {
            const mine = await findMineByGame();
            if (mine) {
                setExisting({ id: mine.id, status: mine.status, score: mine.score });
                setStatus(mine.status);
                setScore(mine.score == null ? "" : String(mine.score));
            }
        } catch {
            /* noop */
        } finally {
            loadedRef.current = true;
        }
    }

    async function save() {
        if (!authed) {
            nav("/login");
            return;
        }
        if (!status) return;

        setSaving(true);
        setOk(null);

        const nScore = normalizeScore(score);

        try {
            if (existing?.id) {
                await patchUpdate(existing.id, status as Status, nScore);
            } else {
                await postCreate(status as Status, nScore);
            }
        } catch (err: any) {
            try {
                const mine = await findMineByGame();
                if (!mine?.id) throw err;
                await patchUpdate(mine.id, status as Status, nScore);
                setExisting({ id: mine.id, status: status as Status, score: nScore });
            } catch {
                setSaving(false);
                setOk("err");
                return;
            }
        }

        setSaving(false);
        setOk("saved");
        setOpen(false);
        const final = { status: status as Status, score: nScore };
        setExisting((prev) => ({ id: prev?.id || 0, ...final }));
        onSaved?.(final);
    }

    return (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                className={compact ? "btn-outline h-8 px-2 text-xs" : "btn-outline"}
                onClick={openAndPrefill}
                aria-expanded={open}
                aria-controls={`${uid}-popover`}
                title={authed ? "Add / update your journal" : "Login to add"}
            >
                {showLabel}
            </button>

            {open && (
                <div
                    id={`${uid}-popover`}
                    className="absolute right-0 mt-2 w-56 z-20 card p-3 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-2">
                        <label className="block text-xs muted mb-1">Status</label>
                        <select
                            className="input w-full"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as Status | "")}
                        >
                            {(Object.keys(STATUS_LABEL) as Status[]).map((k) => (
                                <option key={k} value={k}>
                                    {STATUS_LABEL[k]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs muted mb-1">Score (optional, 0–10)</label>
                        <input
                            className="input w-full"
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder="e.g., 8"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <button className="btn-outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                        <button className="btn-primary" type="button" disabled={!status || saving} onClick={save}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>

                    {ok === "saved" && <div className="mt-2 text-emerald-600 text-sm">Saved ✓</div>}
                    {ok === "err" && <div className="mt-2 text-crimson-600 text-sm">Couldn’t save. Try again.</div>}
                </div>
            )}
        </div>
    );
}
