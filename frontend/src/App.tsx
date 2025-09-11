import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

import Entries from "./pages/Entries";
import PublicProfile from "./pages/PublicProfile";
import Discover from "./pages/Discover";
import GameDetails from "./pages/GameDetails";
import ThemeToggle from "./ThemeToggle";
import LoginPage from "./pages/Login";
import ChooseUsername from "./pages/ChooseUsername";

// toggle Register link/page from env
const enableRegister = import.meta.env.VITE_ENABLE_REGISTER === "true";

// --- Protected route wrapper ---
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const authed = !!localStorage.getItem("access");
  return authed ? children : <Navigate to="/login" replace />;
}

// --- Register (keep simple local form; can be hidden with env) ---
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
      <button className="btn-primary mt-2" type="submit">Sign up</button>
      <div className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm">{msg}</div>
    </form>
  );
}

// --- Me (protected) with avatar upload ---
function Me() {
  const [user, setUser] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [upMsg, setUpMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/whoami/");
        setUser(data.user);
        if (data.user) {
          const prof = await api.get(`/users/${encodeURIComponent(data.user)}/`);
          setAvatarUrl((prof.data as any)?.user?.avatar_url || null);
        }
      } catch {
        setUser(null);
      }
    })();
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUpMsg("Max 2MB"); return; }

    const fd = new FormData();
    fd.append("avatar", file);
    try {
      setUpMsg("Uploading…");
      const { data } = await api.post("/account/avatar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAvatarUrl(data.avatar_url);
      setUpMsg("Saved!");
    } catch (err: any) {
      setUpMsg(err?.response?.data?.detail || "Upload failed");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 card p-4 space-y-3">
      <h2 className="text-xl font-semibold">Me</h2>
      {user ? (
        <>
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl || "https://api.dicebear.com/8.x/identicon/svg?seed=" + encodeURIComponent(user)}
              alt="avatar"
              className="w-16 h-16 rounded-full border"
            />
            <div className="text-sm opacity-80">Logged in as <b>{user}</b></div>
          </div>

          <label className="btn-outline inline-flex items-center gap-2 w-fit mt-2 cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
            Upload new photo
          </label>

          {upMsg && <div className="text-sm opacity-70">{upMsg}</div>}

          <button
            className="btn-outline mt-4"
            onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
          >
            Logout
          </button>
        </>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}

// --- App shell with nav & routes ---
export default function App() {
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const authed = !!localStorage.getItem("access");

  useEffect(() => {
    if (!authed) { setUsername(null); return; }
    (async () => {
      try {
        const { data } = await api.get("/auth/whoami/");
        setUsername(data.user);
      } catch {
        setUsername(null);
      }
    })();
  }, [authed]);

  function logout() {
    localStorage.clear();
    setUsername(null);
    nav("/login");
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur dark:bg-zinc-900/70 dark:border-zinc-800">
        <div className="max-w-[960px] mx-auto px-3 h-12 flex items-center gap-4">
          <Link className="nav-link" to="/discover">Discover</Link>
          <Link className="nav-link" to="/entries">Entries</Link>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {authed ? (
              <>
                <span className="text-sm opacity-80">
                  Hello{username ? <>,&nbsp;<b>{username}</b></> : ""}
                </span>
                {username && (
                  <Link
                    className="nav-link"
                    to={`/u/${encodeURIComponent(username)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Public profile
                  </Link>
                )}
                <button className="btn-outline" onClick={logout}>Logout</button>
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
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/game/:gameId" element={<GameDetails />} />
        <Route path="/games" element={<Navigate to="/discover" replace />} />
        <Route path="/" element={authed ? <Navigate to="/entries" replace /> : <Discover />} />

        {/* guard register route by env */}
        <Route path="/register" element={enableRegister ? <Register /> : <Navigate to="/login" replace />} />
        {/* login with Google */}
        <Route path="/login" element={<LoginPage />} />
        {/* first-login username picker */}
        <Route path="/setup/username" element={<ProtectedRoute><ChooseUsername /></ProtectedRoute>} />

        <Route path="/entries" element={<ProtectedRoute><Entries /></ProtectedRoute>} />
        <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />
        <Route path="*" element={<div className="p-6">Not found</div>} />
      </Routes>
    </div>
  );
}
