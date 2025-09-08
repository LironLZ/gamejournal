import Entries from "./pages/Entries";
import Games from "./pages/Games";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

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
      nav("/me");
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
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/whoami/");
        setUser(data.user);
      } catch {
        setErr("Unauthorized. Please login again.");
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2>Me</h2>
      {user ? <p>Logged in as <b>{user}</b></p> : <p>{err || "Loading..."}</p>}
      <button
        onClick={() => {
          localStorage.clear();
          window.location.href = "/login";
        }}
      >
        Logout
      </button>
    </div>
  );
}

// --- App shell with nav & routes ---
export default function App() {
  return (
    <div>
      <nav style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
        <Link to="/register">Register</Link>
        <Link to="/login">Login</Link>
        <Link to="/me">Me</Link>
        <Link to="/entries">Entries</Link>
        <Link to="/games">Games</Link> {/* new */}
      </nav>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/me" element={<Me />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="/games" element={<Games />} /> {/* new */}
      </Routes>
    </div>
  );
}
