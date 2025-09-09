import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

import Entries from "./pages/Entries";
import Games from "./pages/Games";
import PublicProfile from "./pages/PublicProfile";
import ThemeToggle from "./ThemeToggle";

// --- Protected route wrapper ---
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const authed = !!localStorage.getItem("access");
  return authed ? children : <Navigate to="/login" replace />;
}

// --- Register ---
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

// --- Login ---
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
    <form onSubmit={submit} className="max-w-sm mx-auto mt-10 card p-4">
      <h2 className="text-xl font-semibold mb-2">Login</h2>
      <input
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
      <button className="btn-primary mt-2" type="submit">Sign in</button>
      <div className="mt-2 text-zinc-600 dark:text-zinc-300 text-sm">{msg}</div>
    </form>
  );
}

// --- Me (protected) ---
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
    <div className="max-w-md mx-auto mt-10 card p-4">
      <h2 className="text-xl font-semibold mb-2">Me</h2>
      {user ? <p>Logged in as <b>{user}</b></p> : <p>Loading…</p>}
      <button
        className="btn-outline mt-2"
        onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
      >
        Logout
      </button>
    </div>
  );
}

// --- App shell with nav & routes ---
export default function App() {
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const authed = !!localStorage.getItem("access");

  // fetch username for nav if authed
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
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <Link className="nav-link" to="/games">Games</Link>
          <Link className="nav-link" to="/entries">Entries</Link>

          <div className="nav-sp">
            <ThemeToggle />
            {authed ? (
              <>
                <span className="muted">
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
                <Link className="nav-link" to="/register">Register</Link>
                <Link className="nav-link" to="/login">Login</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        {/* public profile FIRST */}
        <Route path="/u/:username" element={<PublicProfile />} />

        {/* default: send authed users to entries, others to login */}
        <Route path="/" element={authed ? <Navigate to="/entries" replace /> : <Login />} />

        {/* auth */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* protected */}
        <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
        <Route path="/entries" element={<ProtectedRoute><Entries /></ProtectedRoute>} />
        <Route path="/me" element={<ProtectedRoute><Me /></ProtectedRoute>} />

        {/* fallback LAST */}
        <Route path="*" element={<div className="p-6">Not found</div>} />
      </Routes>
    </div>
  );
}
