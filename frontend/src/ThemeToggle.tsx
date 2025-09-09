import { useEffect, useState } from "react";

export default function ThemeToggle() {
    const [dark, setDark] = useState(
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
    );

    useEffect(() => {
        const obs = new MutationObserver(() =>
            setDark(document.documentElement.classList.contains("dark"))
        );
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);

    function toggle() {
        const html = document.documentElement;
        const on = html.classList.toggle("dark");
        try { localStorage.setItem("theme", on ? "dark" : "light"); } catch { }
        setDark(on);
    }

    return (
        <button className="btn-ghost" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            <span style={{ width: 16, height: 16, lineHeight: "16px" }}>{dark ? "🌙" : "☀️"}</span>
            <span className="muted">Toggle theme</span>
        </button>
    );
}
