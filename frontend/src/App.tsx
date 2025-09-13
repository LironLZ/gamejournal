import { Routes, Route, Link, useNavigate, Navigate, useMatch } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

import Entries from "./pages/Entries";
import PublicProfile from "./pages/PublicProfile";
import Discover from "./pages/Discover";
import GameDetails from "./pages/GameDetails";
import ThemeToggle from "./ThemeToggle";
import LoginPage from "./pages/Login";
import ChooseUsername from "./pages/ChooseUsername";
import AvatarSettings from "./pages/AvatarSettings";
import Feed from "./pages/Feed";
import Landing from "./pages/Landing";
import Friends from "./pages/Friends";
import Wishlist from "./pages/Wishlist"; // NEW

const enableRegister = import.meta.env.VITE_ENABLE_REGISTER === "true";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const authed = !!localStorage.getItem("access");
  return authed ? children : <Navigate to="/login" replace />;
}

function Register() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/auth/register/", { username, password });
      setMsg("Registered! Redirecting to login…");
      setTimeout(() => nav("/login"), 700);
    } catch (err: any) {
      setMsg(err?.response?.data ? JSON.stringify(err.response.data) : "Error");
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-10 card p-4">
      <h2 className="text-xl font-semibold mb-2">Register</h2>
      <input
        type="text"
        className="input w-full my-2"
        placeholder="Username"
        value={username}
        onChange={(e) => setU(e.target.value)}
      />
      <input
        type="password"
        className="input w-full my-2"
        placeholder="Password"
        value={password}
        onChange={(e) => setP(e.target.value)}
      />
      <button className="btn-primary mt-2" type="submit">
        Sign up
      </button>
      <div className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm">{msg}</div>
    </form>
  );
}

export default function App() {
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const authed = !!localStorage.getItem("access");

  useEffect(() => {
    if (!authed) {
      setUsername(null);
      setAvatar(null);
      return;
    }
    (async () => {
      try {
        const who = await api.get("/auth/whoami/");
        const u = who.data?.user as string | undefined;
        if (!u) {
          setUsername(null);
          setAvatar(null);
          return;
        }
        setUsername(u);

        try {
          const prof = await api.get(`/users/${encodeURIComponent(u)}/`);
          const url = (prof.data?.user?.avatar_url as string | null) || null;
          setAvatar(url);
        } catch {
          setAvatar(null);
        }
      } catch {
        setUsername(null);
        setAvatar(null);
      }
    })();
  }, [authed]);

  function logout() {
    localStorage.clear();
    setUsername(null);
    setAvatar(null);
    nav("/login");
  }

  const match = useMatch("/u/:username");
  const onOwnProfile =
    !!(authed && username && match?.params?.username?.toLowerCase() === username.toLowerCase());

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:bg-zinc-900/70 dark:border-zinc-800">
        <div className="max-w-[960px] mx-auto px-3 h-12 flex items-center gap-4">
          <Link className="nav-link" to="/">
            Home
          </Link>
          <Link className="nav-link" to="/discover">
            Discover
          </Link>
          <Link className="nav-link" to="/entries">
            Entries
          </Link>

          {authed && (
            <>
              <Link className="nav-link" to="/feed">
                Feed
              </Link>
              <Link className="nav-link" to="/friends">
                Friends
              </Link>
              <Link className="nav-link" to="/wishlist">
                Wishlist
              </Link>
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {authed ? (
              <>
                {avatar ? (
                  <img
                    src={avatar}
                    alt="me"
                    className="w-7 h-7 rounded-full border dark:border-zinc-700"
                  />
                ) : null}
                <span className="text-sm opacity-80">
                  Hello{username ? (
                    <>
                      ,&nbsp;<b>{username}</b>
                    </>
                  ) : null}
                </span>

                {username && (
                  <Link className="nav-link" to={`/u/${encodeURIComponent(username)}`}>
                    Public profile
                  </Link>
                )}

                {onOwnProfile && (
                  <Link className="nav-link" to="/settings/profile">
                    Edit profile
                  </Link>
                )}

                <button className="btn-outline" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                {enableRegister && <Link className="nav-link" to="/register">Register</Link>}
                <Link className="nav-link" to="/login">Login</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        {/* Public pages */}
        <Route path="/" element={authed ? <Navigate to="/entries" replace /> : <Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/game/:gameId" element={<GameDetails />} />
        <Route path="/games" element={<Navigate to="/discover" replace />} />
        <Route path="/u/:username" element={<PublicProfile />} />

        {/* Auth pages */}
        <Route
          path="/register"
          element={enableRegister ? <Register /> : <Navigate to="/login" replace />}
        />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected pages */}
        <Route path="/setup/username" element={<ProtectedRoute><ChooseUsername /></ProtectedRoute>} />
        <Route path="/entries" element={<ProtectedRoute><Entries /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
        <Route path="/settings/profile" element={<ProtectedRoute><AvatarSettings /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
        <Route path="/friends/:username" element={<ProtectedRoute><Friends /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<div className="p-6">Not found</div>} />
      </Routes>
    </div>
  );
}
