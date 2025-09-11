// frontend/src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

declare global {
    interface Window { google?: any }
}

export default function Login() {
    const nav = useNavigate();
    const [u, setU] = useState("");
    const [p, setP] = useState("");
    const [err, setErr] = useState<string | null>(null);

    // ⬇️ toggle password form via env (prod = false)
    const enablePw = import.meta.env.VITE_ENABLE_PASSWORD_LOGIN === "true";

    // --- Google Identity Services ---
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (!window.google) return;
            const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
            if (!clientId) {
                console.warn("VITE_GOOGLE_OAUTH_CLIENT_ID missing");
                return;
            }
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (resp: any) => {
                    try {
                        const { data } = await api.post("/auth/google/", {
                            credential: resp.credential,
                        });
                        localStorage.setItem("access", data.access);
                        localStorage.setItem("refresh", data.refresh);
                        if (data.created) {
                            nav("/setup/username", { replace: true });
                        } else {
                            nav("/entries", { replace: true });
                        }
                    } catch (e: any) {
                        console.error(e);
                        setErr(e?.response?.data?.detail || "Google sign-in failed");
                    }
                },
            });
            const mount = document.getElementById("googleBtn");
            if (mount) {
                window.google.accounts.id.renderButton(mount, {
                    theme: "outline",
                    size: "large",
                    shape: "pill",
                    width: 280,
                });
            }
        };
        document.body.appendChild(script);
        return () => document.body.removeChild(script);
    }, [nav]);

    // optional password login (dev only)
    async function pwLogin(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            const { data } = await api.post("/auth/login/", { username: u, password: p });
            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);
            nav("/entries", { replace: true });
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Login failed");
        }
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border bg-neutral-900/20 p-6 space-y-4">
                <h1 className="text-2xl font-semibold text-center">Login</h1>

                {/* Google SSO */}
                <div className="flex justify-center">
                    <div id="googleBtn" />
                </div>

                {/* Divider + password form shown only when enabled (dev) */}
                {enablePw && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="h-px bg-gray-700 flex-1" />
                            <span className="text-xs text-gray-400">or</span>
                            <div className="h-px bg-gray-700 flex-1" />
                        </div>

                        <form onSubmit={pwLogin} className="space-y-3">
                            <input
                                className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring"
                                placeholder="Username"
                                value={u}
                                onChange={(e) => setU(e.target.value)}
                            />
                            <input
                                type="password"
                                className="w-full rounded-md bg-neutral-800 px-3 py-2 outline-none focus:ring"
                                placeholder="Password"
                                value={p}
                                onChange={(e) => setP(e.target.value)}
                            />
                            <button className="rounded-md px-4 py-2 border hover:bg-neutral-800" type="submit">
                                Sign in
                            </button>
                        </form>
                    </>
                )}

                {err && <div className="text-red-500 text-sm">{err}</div>}
            </div>
        </div>
    );
}
