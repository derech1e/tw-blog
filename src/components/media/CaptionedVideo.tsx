import { useEffect, useRef } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
    src: string;
}

export default function CaptionedVideo({ src }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                debug: true, // 👈 enable logs
            });
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log("HLS manifest loaded ✅");
                video.play().catch((err) => {
                    console.warn("Autoplay prevented:", err);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error("HLS error:", data);
            });

            return () => {
                hls.destroy();
            };
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari/iOS
            video.src = src;
        }
    }, [src]);

    return (
        <video
            ref={videoRef}
            controls
            autoPlay
            muted // 👈 helps autoplay in Chrome
            style={{ width: "100%", borderRadius: "12px" }}
        />
    );
}
