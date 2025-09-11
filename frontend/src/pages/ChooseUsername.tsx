import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ChooseUsername() {
    const nav = useNavigate();
    const [name, setName] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            const { data } = await api.patch("/account/username/", { username: name });
            setOk(true);
            setTimeout(() => nav("/entries", { replace: true }), 700);
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Could not set username");
        }
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <form onSubmit={submit} className="w-full max-w-md rounded-2xl border bg-neutral-900/20 p-6 space-y-4">
                <h1 className="text-2xl font-semibold text-center">Choose your username</h1>
                <p className="text-sm text-gray-400 text-center">
                    3–20 characters: letters, numbers, and underscore.
                </p>
                <input
                    className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring"
                    placeholder="your_nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <button className="rounded-md px-4 py-2 border hover:bg-neutral-800 w-full" type="submit">
                    Save
                </button>
                {err && <div className="text-red-500 text-sm">{err}</div>}
                {ok && <div className="text-green-500 text-sm">Saved! Redirecting…</div>}
            </form>
        </div>
    );
}
