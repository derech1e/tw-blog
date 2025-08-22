"use client";
import { useState, useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectCoverflow, Pagination, Navigation } from "swiper/modules";
import { type FancyboxOptions, Fancybox } from "@fancyapps/ui/dist/fancybox/";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface CarouselImageData {
    src: string;
    thumb: string;
    alt: string;
    title?: string;
}

interface FancyboxAdvancedCarouselProps {
    images: CarouselImageData[];
    autoplayDelay?: number;
    galleryName?: string;
    height?: string;
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

export default function FancyboxAdvancedCarousel({
                                                     images,
                                                     autoplayDelay = 10000,
                                                     galleryName = "advanced-carousel",
                                                     height = "400px",
                                                     options = {},
                                                     className = "",
                                                 }: FancyboxAdvancedCarouselProps) {
    const [fancyboxRef] = useFancybox(options);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [progress, setProgress] = useState(0);
    const swiperRef = useRef<any>(null);

    const handleSlideChange = (swiper: any) => {
        setCurrentSlide(swiper.realIndex); // realIndex avoids loop duplicates
    };

    return (
        <div ref={fancyboxRef} className={`advanced-carousel-container ${className}`}>
            <div className="carousel-wrapper" style={{ height }}>
                <Swiper
                    onSwiper={(swiper: any) => (swiperRef.current = swiper)}
                    effect="coverflow"
                    grabCursor
                    centeredSlides
                    slidesPerView="auto"
                    coverflowEffect={{
                        rotate: 15,
                        stretch: 0,
                        depth: 100,
                        modifier: 2.5,
                        slideShadows: true,
                    }}
                    autoplay={{
                        delay: autoplayDelay,
                        disableOnInteraction: false,
                    }}
                    loop={images.length > 2} // 🔑 disable loop if only 2 slides
                    modules={[EffectCoverflow, Autoplay, Pagination, Navigation]}
                    onSlideChange={handleSlideChange}
                    onAutoplayTimeLeft={(_, time, progress) => {
                        setProgress(progress * 100); // 🔑 native Swiper progress
                    }}
                    className="advanced-swiper"
                >
                    {images.map((image, index) => (
                        <SwiperSlide key={index} className="advanced-slide">
                            <div className="slide-content">
                                <a
                                    data-fancybox={galleryName}
                                    href={image.src}
                                    className="slide-link"
                                >
                                    <img
                                        src={image.thumb}
                                        alt={image.alt}
                                        className="slide-image"
                                    />
                                    <div className="slide-overlay">
                                        <div className="slide-info">
                                            {image.title && <h3 className="text-white">{image.title}</h3>}
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>

                {/* Navigation Arrows */}
                <button
                    className="nav-arrow nav-prev"
                    onClick={() => swiperRef.current?.slidePrev()}
                    aria-label="Previous image"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                </button>
                <button
                    className="nav-arrow nav-next"
                    onClick={() => swiperRef.current?.slideNext()}
                    aria-label="Next image"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                </button>
            </div>

            {/* Pagination with progress */}
            <div className="carousel-pagination">
                {images.map((_, index) => (
                    <button
                        key={index}
                        className={`pagination-dot ${
                            index === currentSlide ? "active" : ""
                        }`}
                        onClick={() => swiperRef.current?.slideToLoop(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    >
                        {index === currentSlide && (
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
