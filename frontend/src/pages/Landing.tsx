// src/pages/Landing.tsx
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";

// --- Simple inline carousel (auto + arrows + dots) ---------------------------
type Slide = { src: string; alt?: string };
function Carousel({ slides, intervalMs = 3000 }: { slides: Slide[]; intervalMs?: number }) {
    const [i, setI] = useState(0);
    const [paused, setPaused] = useState(false);
    const count = slides.length;

    const go = useCallback(
        (delta: number) => setI((prev) => (prev + delta + count) % count),
        [count]
    );
    const goTo = (n: number) => setI(((n % count) + count) % count);

    useEffect(() => {
        if (paused || count <= 1) return;
        const id = setInterval(() => setI((prev) => (prev + 1) % count), intervalMs);
        return () => clearInterval(id);
    }, [paused, count, intervalMs]);

    return (
        <div
            className="relative w-full h-[260px] sm:h-[340px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(1);
                if (e.key === "ArrowLeft") go(-1);
            }}
            aria-roledescription="carousel"
            aria-label="Featured screenshots"
        >
            {slides.map((s, idx) => (
                <img
                    key={idx}
                    src={s.src}
                    alt={s.alt ?? `Slide ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${idx === i ? "opacity-100" : "opacity-0"
                        }`}
                    loading={idx === 0 ? "eager" : "lazy"}
                />
            ))}

            {/* Arrows */}
            <button
                aria-label="Previous slide"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-10 h-10 grid place-items-center"
                onClick={() => go(-1)}
            >
                ‹
            </button>
            <button
                aria-label="Next slide"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-10 h-10 grid place-items-center"
                onClick={() => go(1)}
            >
                ›
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`w-2.5 h-2.5 rounded-full ${idx === i ? "bg-white" : "bg-white/50 hover:bg-white/80"
                            }`}
                        onClick={() => goTo(idx)}
                    />
                ))}
            </div>
        </div>
    );
}

// --- Page --------------------------------------------------------------------
export default function Landing() {
    // Put these images in: public/landing/slide1.jpg ... slide4.jpg
    const slides: Slide[] = [
        { src: "/landing/slide1.webp", alt: "Discover games without logging in" },
        { src: "/landing/slide2.png", alt: "Game details page" },
        { src: "/landing/slide3.jpg", alt: "Public profile with stats" },
        { src: "/landing/slide4.jpg", alt: "Discover page" },
    ];

    return (
        <main className="min-h-[70vh]">
            <section className="max-w-[960px] mx-auto px-4 py-10 text-center">
                <h1 className="text-4xl font-extrabold">GameJournal</h1>
                <p className="mt-3 text-lg opacity-80">
                    Track what you play, see friends’ activity, and decide what to play next.
                </p>

                {/* Big wide image carousel */}
                <div className="mt-8">
                    <Carousel slides={slides} intervalMs={3000} />
                </div>

                <div className="mt-8 flex items-center justify-center gap-3">
                    <Link to="/discover" className="btn">Explore games</Link>
                    <Link to="/login" className="btn-primary">Login</Link>
                </div>
            </section>

            <section className="max-w-[960px] mx-auto px-4 grid gap-4 md:grid-cols-3">
                <div className="card p-4">
                    <h3 className="font-semibold mb-2">Discover</h3>
                    <p className="opacity-80 text-sm">Browse games and view public stats without an account.</p>
                </div>
                <div className="card p-4">
                    <h3 className="font-semibold mb-2">Journal</h3>
                    <p className="opacity-80 text-sm">Log status, score, notes, and dates for each game.</p>
                </div>
                <div className="card p-4">
                    <h3 className="font-semibold mb-2">Friends</h3>
                    <p className="opacity-80 text-sm">Send requests, see a feed, and view public profiles.</p>
                </div>
            </section>
        </main>
    );
}
