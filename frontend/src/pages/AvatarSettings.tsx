// frontend/src/pages/AvatarSettings.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function AvatarSettings() {
    const nav = useNavigate();
    const [username, setUsername] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // Load current user + current avatar
    useEffect(() => {
        (async () => {
            try {
                const me = await api.get("/auth/whoami/");
                const u = me.data.user as string;
                setUsername(u);
                const prof = await api.get(`/users/${encodeURIComponent(u)}/`);
                setPreview(prof.data?.user?.avatar_url || null);
            } catch {
                setUsername(null);
            }
        })();
    }, []);

    async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setMsg("Image is too large (max 2MB).");
            return;
        }

        setMsg(null);
        setBusy(true);

        // Instant local preview
        setPreview(URL.createObjectURL(file));

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const { data } = await api.post("/account/avatar/", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setPreview(data.avatar_url); // use final URL (Cloudinary etc.)
            setMsg("Saved!");
        } catch (err: any) {
            setMsg(err?.response?.data?.detail || "Upload failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="container-page">
            <div className="flex items-center justify-between mb-4">
                <h2 className="m-0 text-2xl font-bold">Edit profile</h2>
                <button className="btn-outline" onClick={() => nav(-1)}>Back</button>
            </div>

            <div className="card p-6">
                <div className="flex flex-col items-center">
                    <div className="w-[256px] h-[256px] rounded-xl border border-zinc-300 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        {preview ? (
                            <img
                                src={preview}
                                alt="avatar"
                                className="w-full h-full object-cover"
                                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                            />
                        ) : (
                            <div className="w-full h-full grid place-items-center text-sm opacity-60">
                                No avatar yet
                            </div>
                        )}
                    </div>

                    <label className="btn-outline mt-4 cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={onPick} />
                        {busy ? "Uploading…" : "Choose image"}
                    </label>

                    {msg && <div className="mt-2 text-sm opacity-80">{msg}</div>}

                    {username && (
                        <Link className="nav-link mt-4" to={`/u/${encodeURIComponent(username)}`} target="_blank" rel="noreferrer">
                            View my public profile
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
