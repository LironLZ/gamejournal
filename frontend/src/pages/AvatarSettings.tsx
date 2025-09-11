import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AvatarSettings() {
    const nav = useNavigate();
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/auth/whoami/");
                setAvatarUrl(data.avatar_url || null);
            } catch (e: any) {
                setMsg(e?.response?.data?.detail || "Failed to load your avatar.");
            }
        })();
    }, []);

    async function upload(file: File) {
        setBusy(true);
        setMsg(null);
        try {
            const fd = new FormData();
            fd.append("avatar", file); // <- field name matches backend
            const { data } = await api.post("/account/avatar/", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setAvatarUrl(data.avatar_url);
            setMsg("Avatar updated.");
        } catch (e: any) {
            setMsg(e?.response?.data?.detail || "Failed to upload avatar.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="container-page max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold m-0">Edit avatar</h2>
                <button className="btn-outline" onClick={() => nav(-1)}>Back</button>
            </div>

            <div className="card p-6 flex flex-col items-center gap-3">
                {/* BIG avatar preview */}
                <div className="w-56 h-56 rounded-xl overflow-hidden border dark:border-zinc-700 bg-neutral-900/10">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full grid place-items-center text-6xl opacity-40">👤</div>
                    )}
                </div>

                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(f);
                    }}
                />
                <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                    {busy ? "Uploading..." : "Choose image"}
                </button>

                {msg && <div className="text-sm mt-1 opacity-80">{msg}</div>}
            </div>
        </div>
    );
}
