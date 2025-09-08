import { useState, useEffect } from "react";
import { type FancyboxOptions, Fancybox } from "@fancyapps/ui/dist/fancybox/";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

interface ImageData {
    src: string;
    thumb: string | undefined;
    alt: string;
}

interface FancyboxGalleryProps {
    images: ImageData[];
    galleryName?: string;
    options?: Partial<FancyboxOptions>;
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

export default function FancyboxGallery({
                                            images,
                                            galleryName = "gallery",
                                            options = {},
                                        }: FancyboxGalleryProps) {
    const [fancyboxRef] = useFancybox(options);

    return (
        <div ref={fancyboxRef} className="fancybox-gallery">
            <div className="gallery-grid">
                {images.map((image, index) => (
                    <a
                        key={index}
                        data-fancybox={galleryName}
                        href={image.src}
                        className="gallery-item"
                    >
                        <img src={image.src} alt={image.alt} />
                    </a>
                ))}
            </div>
        </div>
    );
}