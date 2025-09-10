// src/components/StatusBadge.tsx
type Status = "PLANNING" | "PLAYING" | "PAUSED" | "DROPPED" | "COMPLETED";

const CLASS_BY_STATUS: Record<Status, string> = {
    PLAYING: "badge-playing",
    PLANNING: "badge-planning",
    PAUSED: "badge-paused",
    DROPPED: "badge-dropped",
    COMPLETED: "badge-completed",
};

export default function StatusBadge({ s }: { s: Status }) {
    return <span className={CLASS_BY_STATUS[s]}>{s}</span>;
}
