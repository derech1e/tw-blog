import React, {useEffect, useRef, useState} from "react";

// Lightweight, native-looking HLS video player for Astro (React island)
// ---------------------------------------------------------------
// • Uses the browser's native <video controls> UI (closest to native)
// • Falls back to hls.js only when needed (most Chromium/Firefox)
// • Safe for Astro SSR: HLS is only loaded on the client
// • TypeScript + Tailwind-friendly
//
// Install peer dependency:
//   npm i hls.js
//
// Astro usage example (in an .astro file):
// ---------------------------------------------------------------
// ---
// import HlsVideoPlayer from "../components/HlsVideoPlayer";
// const src = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
// ---
// <HlsVideoPlayer
//   client:visible
//   src={src}
//   poster="/poster.jpg"
//   autoPlay
//   muted
//   playsInline
//   className="w-full max-w-3xl rounded-2xl shadow"
// />
//
// Notes:
// • Use client:visible / client:load / client:idle so the code runs in the browser.
// • On Safari/iOS, HLS plays natively and hls.js is skipped.
// • Add <track> children for captions if you have them.

export type HlsVideoPlayerProps = React.VideoHTMLAttributes<HTMLVideoElement> & {
    /** .m3u8 URL */
    src: string;
    /** Optional callback when hls.js emits a fatal error */
    onHlsError?: (data: unknown) => void;
    /** Optional: pass true to force using hls.js even if the browser reports native support. Typically false. */
    forceHlsJs?: boolean;
};

const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
                                                           src,
                                                           className,
                                                           onHlsError,
                                                           forceHlsJs = false,
                                                           controls = true,
                                                           preload = "metadata",
                                                           children,
                                                           ...videoProps
                                                       }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<any>(null);
    const [canPlayNatively, setCanPlayNatively] = useState<boolean>(false);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Check native support for HLS
        const native = videoEl.canPlayType("application/vnd.apple.mpegurl");
        setCanPlayNatively(Boolean(native) && !forceHlsJs);
    }, [forceHlsJs]);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Clean up any previous hls.js instance before (re)initializing
        if (hlsRef.current) {
            try {
                hlsRef.current.destroy?.();
            } catch {
            }
            hlsRef.current = null;
        }

        // Always set a src upfront to prevent grayed-out controls
        videoEl.src = src;

        // If native HLS is available (e.g., Safari/iOS), let the browser handle it
        if (canPlayNatively) {
            return;
        }


        let cancelled = false;

        // Dynamically import hls.js on the client only
        (async () => {
            try {
                const mod = await import("hls.js");
                const Hls = mod.default || (mod as any);

                if (cancelled) return;

                if (Hls?.isSupported?.()) {
                    const hls = new Hls({
                        // Sensible defaults for typical blog playback
                        enableWorker: true,
                        lowLatencyMode: true,
                        backBufferLength: 60,
                    });

                    hlsRef.current = hls;
                    hls.attachMedia(videoEl);
                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        hls.loadSource(src);
                    });

                    hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
                        // Forward fatal errors to the host app if provided
                        if (data?.fatal) {
                            onHlsError?.(data);
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    try {
                                        hls.destroy();
                                    } catch {
                                    }
                            }
                        }
                    });
                } else {
                    // Fallback: last resort, try setting src directly (some edge browsers)
                    videoEl.src = src;
                }
            } catch (err) {
                // If hls.js fails to load for any reason, attempt native/fallback
                onHlsError?.(err);
                try {
                    videoEl.src = src;
                } catch {
                }
            }
        })();

        return () => {
            cancelled = true;
            try {
                if (hlsRef.current) hlsRef.current.destroy?.();
            } catch {
            }
            hlsRef.current = null;
        };
    }, [src, canPlayNatively, onHlsError]);

    return (
        <div className={"relative w-full " + (className ?? "")}>
            <video
                ref={videoRef}
                // Keep the native look & feel
                controls={controls}
                preload={preload}
                // Useful defaults for inline playback on mobile
                playsInline={true}
                // Spread additional <video> props (poster, muted, autoPlay, etc.)
                {...videoProps}
                className={[
                    "block h-auto w-full",
                    // Slightly rounded with soft shadow while keeping native UI
                    "rounded-2xl shadow",
                ].join(" ")}
            >
                {/* Optional: allow passing <track> elements as children for captions */}
                {children}
            </video>
        </div>
    );
};

export default HlsVideoPlayer;
