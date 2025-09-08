import Entries from "./pages/Entries";
import Games from "./pages/Games";
import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

// --- Protected route wrapper ---
function ProtectedRoute({ element }: { element: JSX.Element }) {
  const authed = !!localStorage.getItem("access");
  return authed ? element : <Navigate to="/login" replace />;
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
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "40px auto" }}>
      <h2>Register</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setU(e.target.value)}
        style={{ display: "block", width: "100%", margin: "8px 0", padding: 8 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setP(e.target.value)}
        style={{ display: "block", width: "100%", margin: "8px 0", padding: 8 }}
      />
      <button>Sign up</button>
      <div style={{ marginTop: 8, color: "#555" }}>{msg}</div>
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
    <form onSubmit={submit} style={{ maxWidth: 360, margin: "40px auto" }}>
      <h2>Login</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setU(e.target.value)}
        style={{ display: "block", width: "100%", margin: "8px 0", padding: 8 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setP(e.target.value)}
        style={{ display: "block", width: "100%", margin: "8px 0", padding: 8 }}
      />
      <button>Sign in</button>
      <div style={{ marginTop: 8, color: "#555" }}>{msg}</div>
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
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>Me</h2>
      {user ? <p>Logged in as <b>{user}</b></p> : <p>Loading…</p>}
      <button onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>
        Logout
      </button>
    </div>
  );
}

// --- App shell with nav & routes + username in nav ---
export default function App() {
  const nav = useNavigate();
  const [username, setUsername] = useState<string | null>(null);

  // fetch username for nav if authed
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) { setUsername(null); return; }
    (async () => {
      try {
        const { data } = await api.get("/auth/whoami/");
        setUsername(data.user);
      } catch {
        setUsername(null);
      }
    })();
  }, []);

  function logout() {
    localStorage.clear();
    setUsername(null);
    nav("/login");
  }

  const authed = !!localStorage.getItem("access");

  return (
    <div>
      <nav style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd", alignItems: "center" }}>
        <Link to="/games">Games</Link>
        <Link to="/entries">Entries</Link>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {authed ? (
            <>
              <span style={{ opacity: 0.8 }}>Hello{username ? `, ${username}` : ""}</span>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/register">Register</Link>
              <Link to="/login">Login</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={authed ? <Navigate to="/entries" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/games" element={<ProtectedRoute element={<Games />} />} />
        <Route path="/entries" element={<ProtectedRoute element={<Entries />} />} />
        <Route path="/me" element={<ProtectedRoute element={<Me />} />} />
      </Routes>
    </div>
  );
}
