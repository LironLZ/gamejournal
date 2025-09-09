// frontend/src/App.tsx
import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "./api";

import Entries from "./pages/Entries";
import Games from "./pages/Games";
import PublicProfile from "./pages/PublicProfile";

/* ---------- theme hook (local) ---------- */
type Theme = "light" | "dark";
function useTheme(): [Theme, () => void] {
  const getInitial = (): Theme => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    // default: respect system
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return [theme, toggle];
}

/* ---------- Protected route ---------- */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const authed = !!localStorage.getItem("access");
  return authed ? children : <Navigate to="/login" replace />;
}

/* ---------- Register ---------- */
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
    <div className="container-page">
      <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm p-6 space-y-3">
        <h2 className="text-2xl font-bold">Register</h2>
        <input
          className="input w-full"
          placeholder="Username"
          value={username}
          onChange={(e) => setU(e.target.value)}
        />
        <input
          className="input w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setP(e.target.value)}
        />
        <button className="btn btn-primary w-full">Sign up</button>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</div>
      </form>
    </div>
  );
}

/* ---------- Login ---------- */
function Login() {
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login/", { username, password });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      nav("/entries");
    } catch {
      setMsg("Invalid credentials");
    }
  }

  return (
    <div className="container-page">
      <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm p-6 space-y-3">
        <h2 className="text-2xl font-bold">Login</h2>
        <input
          className="input w-full"
          placeholder="Username"
          value={username}
          onChange={(e) => setU(e.target.value)}
        />
        <input
          className="input w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setP(e.target.value)}
        />
        <button className="btn btn-primary w-full">Sign in</button>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</div>
      </form>
    </div>
  );
}

/* ---------- Me (protected) ---------- */
function Me() {
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/whoami/");
        setUser(data.user);
      } catch {
        setUser(null);
      }
    })();
  }, []);
  return (
    <div className="container-page">
      <div className="card mx-auto mt-10 max-w-md p-6 space-y-4">
        <h2 className="text-2xl font-bold">Me</h2>
        {user ? (
          <p>
            Logged in as <b>{user}</b>
          </p>
        ) : (
          <p>Loading…</p>
        )}
        <button
          className="btn btn-subtle text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

/* ---------- App shell + routes ---------- */
export default function App() {
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const authed = !!localStorage.getItem("access");
  const [theme, toggleTheme] = useTheme();

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Top nav */}
      <nav className="border-b bg-white dark:bg-zinc-950 dark:border-zinc-800">
        <div className="container-page flex items-center gap-3 py-3">
          <Link to="/games" className="nav-link">Games</Link>
          <Link to="/entries" className="nav-link">Entries</Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <button
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              onClick={toggleTheme}
              className="btn btn-subtle"
            >
              {theme === "dark" ? (
                // Sun
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm10 7h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2ZM3 12H2a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm15.657 7.071-0.707-0.707a1 1 0 0 1 1.414-1.414l0.707 0.707a1 1 0 0 1-1.414 1.414ZM5.636 6.343 4.93 5.636A1 1 0 1 1 6.343 4.222l0.707 0.707A1 1 0 0 1 5.636 6.343Zm12.021-2.121 0.707 0.707A1 1 0 1 1 16.95 6.343l-0.707-0.707A1 1 0 1 1 17.657 4.222ZM6.343 19.778l-0.707-0.707A1 1 0 0 1 7.05 17.657l0.707 0.707A1 1 0 0 1 6.343 19.778Z" />
                </svg>
              ) : (
                // Moon
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" />
                </svg>
              )}
              <span className="sr-only">Toggle theme</span>
            </button>

            {authed ? (
              <>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Hello{username ? <>, <b>{username}</b></> : ""}
                </span>
                {username && (
                  <Link
                    to={`/u/${encodeURIComponent(username)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="nav-link"
                  >
                    Public profile
                  </Link>
                )}
                <button onClick={logout} className="btn btn-subtle">Logout</button>
              </>
            ) : (
              <>
                <Link to="/register" className="nav-link">Register</Link>
                <Link to="/login" className="nav-link">Login</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        {/* public profile FIRST */}
        <Route path="/u/:username" element={<PublicProfile />} />

        {/* default: authed -> entries, guests -> login */}
        <Route path="/"
          element={authed ? <Navigate to="/entries" replace /> : <Login />}
        />

        {/* auth */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* protected */}
        <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
        <Route path="/entries" element={<ProtectedRoute><Entries /></ProtectedRoute>} />
        <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />

        {/* fallback */}
        <Route path="*" element={<div className="container-page py-6">Not found</div>} />
      </Routes>
    </div>
  );
}
