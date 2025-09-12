import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";

type Mini = { id: number; username: string; avatar_url?: string | null };
type Friendship = { id: number; friend: Mini; created_at: string };
type RequestItem = { id: number; from_user: Mini; to_user: Mini; created_at: string };
type RequestsPayload = { incoming: RequestItem[]; outgoing: RequestItem[] };

export default function Friends() {
    const { username } = useParams(); // optional: viewing someone else's friends
    const [mine, setMine] = useState<Friendship[]>([]);
    const [reqs, setReqs] = useState<RequestsPayload | null>(null);
    const [others, setOthers] = useState<Mini[]>([]);

    // --- Discover people (moved from DiscoverPeople.tsx) ---
    const [q, setQ] = useState("");
    const [people, setPeople] = useState<Mini[]>([]);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState("");

    async function loadAll() {
        const [f, r] = await Promise.all([api.get(`/friends/`), api.get(`/friends/requests/`)]);
        setMine(f.data.results || []);
        setReqs(r.data);
    }

    async function loadOthersFriends(user?: string) {
        if (!user) { setOthers([]); return; }
        const res = await api.get(`/friends/${user}/`);
        setOthers(res.data.results || []);
    }

    useEffect(() => { loadAll(); }, []);
    useEffect(() => { if (username) loadOthersFriends(username); }, [username]);

    // --- Discover search ---
    async function searchPeople() {
        if (q.trim().length < 2) {
            setPeople([]);
            return;
        }
        setBusy(true);
        try {
            const res = await api.get(`/users/`, { params: { q } });
            setPeople(res.data || []);
        } catch {
            setPeople([]);
        } finally {
            setBusy(false);
        }
    }
    // NOTE: no initial auto-search; privacy: require user to type first.

    // --- Actions ---
    async function accept(id: number) { await api.post(`/friends/requests/${id}/accept/`); loadAll(); }
    async function decline(id: number) { await api.post(`/friends/requests/${id}/decline/`); loadAll(); }
    async function cancel(id: number) { await api.post(`/friends/requests/${id}/cancel/`); loadAll(); }
    async function unfriend(user: string) { await api.delete(`/friends/${user}/`); loadAll(); }
    async function addFriend(id: number) {
        try {
            await api.post(`/friends/requests/`, { to_user_id: id });
            setToast("Request sent");
            loadAll();
        } catch (e: any) {
            setToast(e?.response?.data?.detail || "Could not send request");
        }
    }

    return (
        <div className="container mx-auto max-w-3xl mt-6 space-y-6">
            <h1 className="text-2xl font-semibold">Friends</h1>

            {/* Discover people (now inside Friends) */}
            <section className="card p-3">
                <div className="font-medium mb-2">Discover people</div>
                <div className="flex gap-2 mb-2">
                    <input
                        className="input flex-1"
                        placeholder="Search username…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && q.trim().length >= 2 && searchPeople()}
                    />
                    <button className="btn" disabled={busy || q.trim().length < 2} onClick={searchPeople}>
                        Search
                    </button>
                </div>
                {q.trim().length < 2 && (
                    <div className="text-xs text-gray-500 mb-2">
                        Type at least 2 characters.
                    </div>
                )}
                {toast && <div className="text-sm mb-2">{toast}</div>}
                <div className="space-y-2">
                    {people.map((u) => (
                        <div key={u.id} className="card p-2 flex items-center gap-3">
                            <Avatar url={u.avatar_url} />
                            <Link className="link" to={`/u/${u.username}`}>{u.username}</Link>
                            <button className="btn btn-xs ml-auto" onClick={() => addFriend(u.id)}>
                                Add friend
                            </button>
                        </div>
                    ))}
                    {people.length === 0 && q.trim().length >= 2 && (
                        <div className="text-sm text-gray-500">No users found.</div>
                    )}
                </div>
            </section>

            {/* My friends */}
            <section className="card p-3">
                <div className="font-medium mb-2">My friends ({mine.length})</div>
                {mine.length === 0 ? (
                    <div className="text-sm text-gray-500">No friends yet.</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {mine.map((f) => (
                            <div key={f.id} className="flex items-center gap-3">
                                <Avatar url={f.friend.avatar_url} />
                                <Link className="link" to={`/u/${f.friend.username}`}>{f.friend.username}</Link>
                                <button className="btn btn-xs ml-auto" onClick={() => unfriend(f.friend.username)}>
                                    Unfriend
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Requests */}
            <section className="card p-3">
                <div className="font-medium mb-2">Requests</div>
                {!reqs ? null : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="text-sm font-medium mb-1">Incoming</div>
                            {reqs.incoming.length === 0 ? (
                                <div className="text-xs text-gray-500">None</div>
                            ) : (
                                reqs.incoming.map((r) => (
                                    <div key={r.id} className="flex items-center gap-2 py-1">
                                        <Avatar url={r.from_user.avatar_url} />
                                        <Link className="link" to={`/u/${r.from_user.username}`}>{r.from_user.username}</Link>
                                        <div className="ml-auto flex gap-2">
                                            <button className="btn btn-xs" onClick={() => accept(r.id)}>Accept</button>
                                            <button className="btn btn-xs" onClick={() => decline(r.id)}>Decline</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div>
                            <div className="text-sm font-medium mb-1">Outgoing</div>
                            {reqs.outgoing.length === 0 ? (
                                <div className="text-xs text-gray-500">None</div>
                            ) : (
                                reqs.outgoing.map((r) => (
                                    <div key={r.id} className="flex items-center gap-2 py-1">
                                        <Avatar url={r.to_user.avatar_url} />
                                        <Link className="link" to={`/u/${r.to_user.username}`}>{r.to_user.username}</Link>
                                        <button className="btn btn-xs ml-auto" onClick={() => cancel(r.id)}>Cancel</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Someone else's friends (when routed as /friends/:username) */}
            {username ? (
                <section className="card p-3">
                    <div className="font-medium mb-2">{username}'s friends ({others.length})</div>
                    {others.length === 0 ? (
                        <div className="text-sm text-gray-500">No friends yet.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {others.map((u) => (
                                <div key={u.id} className="flex items-center gap-3">
                                    <Avatar url={u.avatar_url} />
                                    <Link className="link" to={`/u/${u.username}`}>{u.username}</Link>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            ) : null}
        </div>
    );
}

function Avatar({ url }: { url?: string | null }) {
    return (
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
            {url ? <img src={url} /> : null}
        </div>
    );
}
