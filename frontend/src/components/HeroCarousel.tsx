import { useEffect, useState, useCallback } from "react";

type Slide = { src: string; alt?: string };
type Props = { slides: Slide[]; intervalMs?: number };

export default function HeroCarousel({ slides, intervalMs = 3000 }: Props) {
    const [i, setI] = useState(0);
    const [paused, setPaused] = useState(false);
    const count = slides.length;

    const go = useCallback((delta: number) => {
        setI((prev) => (prev + delta + count) % count);
    }, [count]);

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
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${idx === i ? "opacity-100" : "opacity-0"}`}
                    loading={idx === 0 ? "eager" : "lazy"}
                />
            ))}

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

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`w-2.5 h-2.5 rounded-full ${idx === i ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
                        onClick={() => goTo(idx)}
                    />
                ))}
            </div>
        </div>
    );
}
