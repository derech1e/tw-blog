import { useState, useEffect } from "react";
import { type FancyboxOptions, Fancybox } from "@fancyapps/ui/dist/fancybox/";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

interface GridImageData {
    src: string;
    thumb: string;
    alt: string;
    row: number; // 1-based grid row position
    col: number; // 1-based grid column position
    rowSpan?: number; // How many rows to span (default: 1)
    colSpan?: number; // How many columns to span (default: 1)
}

interface FancyboxGridGalleryProps {
    images: GridImageData[];
    rows: number;
    cols: number;
    galleryName?: string;
    gap?: string;
    minItemHeight?: string;
    options?: Partial<FancyboxOptions>;
    className?: string;
}

function useFancybox(options: Partial<FancyboxOptions> = {}) {
    const [root, setRoot] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (root) {
            Fancybox.bind(root, "[data-fancybox]", options);
            return () => Fancybox.unbind(root);
        }
    }, [root, options]);

    return [setRoot];
}

export default function FancyboxGridGallery({
                                                images,
                                                rows,
                                                cols,
                                                galleryName = "grid-gallery",
                                                gap = "1rem",
                                                minItemHeight = "200px",
                                                options = {},
                                                className = "",
                                            }: FancyboxGridGalleryProps) {
    const [fancyboxRef] = useFancybox(options);
    const gridStyle = {
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: "1fr", // base row height flexible
        gap: gap,
    };

    return (
        <div
            ref={fancyboxRef}
            className={`fancybox-grid-gallery ${className}`}
            style={gridStyle}
        >
            {images.map((image, index) => (
                <a
                    key={index}
                    data-fancybox={galleryName}
                    href={image.src}
                    className="grid-gallery-item"
                    style={{
                        gridRow: image.rowSpan
                            ? `${image.row} / span ${image.rowSpan}`
                            : image.row,
                        gridColumn: image.colSpan
                            ? `${image.col} / span ${image.colSpan}`
                            : image.col,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            aspectRatio: "2 / 1", // keeps image near square
                            overflow: "hidden",
                        }}
                    >
                        <img
                            src={image.thumb}
                            alt={image.alt}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    </div>
                </a>
            ))}
        </div>
    );
}