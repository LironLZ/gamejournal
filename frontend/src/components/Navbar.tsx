// src/components/Navbar.tsx
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";

type Me = { username: string; avatar_url?: string | null };

export default function Navbar() {
    const authed = !!localStorage.getItem("access");
    const [me, setMe] = useState<Me | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!authed) {
                setMe(null);
                return;
            }
            try {
                // Use the canonical endpoint
                const { data } = await api.get<{ user?: string; username?: string; avatar_url?: string | null }>(
                    "/auth/whoami/"
                );
                if (!alive) return;
                const username = (data.username || data.user || "").trim();
                if (username) setMe({ username, avatar_url: data.avatar_url ?? null });
                else setMe(null);
            } catch {
                if (alive) setMe(null);
            }
        })();
        return () => {
            alive = false;
        };
    }, [authed]);

    function logout() {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setMe(null);
        navigate("/discover");
    }

    function toggleTheme() {
        document.documentElement.classList.toggle("dark");
    }

    const linkCls = ({ isActive }: { isActive: boolean }) =>
        isActive ? "link font-semibold" : "link";

    return (
        <header className="border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40 bg-[var(--bg)]">
            <div className="container flex items-center gap-4 py-2">
                <Link to="/discover" className="text-lg font-bold">
                    gamejournal
                </Link>

                <nav className="flex items-center gap-4">
                    {/* Hide Home when logged in (it just redirects to Entries) */}
                    {!authed && (
                        <NavLink to="/" className={linkCls}>
                            Home
                        </NavLink>
                    )}
                    <NavLink to="/discover" className={linkCls}>
                        Discover
                    </NavLink>
                    {authed && (
                        <>
                            <NavLink to="/entries" className={linkCls}>
                                Entries
                            </NavLink>
                            <NavLink to="/feed" className={linkCls}>
                                Feed
                            </NavLink>
                            <NavLink to="/wishlist" className={linkCls}>
                                Wishlist
                            </NavLink>
                        </>
                    )}
                </nav>

                <div className="ml-auto flex items-center gap-3">
                    <button onClick={toggleTheme} className="btn-outline">
                        Toggle theme
                    </button>

                    {authed ? (
                        <>
                            {me && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={
                                                me.avatar_url ||
                                                `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(
                                                    me.username
                                                )}`
                                            }
                                            alt="avatar"
                                            className="w-6 h-6 rounded-full border dark:border-zinc-700"
                                        />
                                        {/* Greet with the canonical username (nickname) */}
                                        <span className="text-sm">Hello, {me.username}</span>
                                    </div>
                                    <Link
                                        to={`/u/${encodeURIComponent(me.username)}`}
                                        className="btn-outline"
                                    >
                                        Public profile
                                    </Link>
                                </>
                            )}
                            <button onClick={logout} className="btn-outline">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login" className={linkCls}>
                                Login
                            </NavLink>
                            <NavLink to="/register" className={linkCls}>
                                Sign up
                            </NavLink>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
