import { useState, useEffect, type ReactNode } from "react";
import { type FancyboxOptions, Fancybox } from "@fancyapps/ui/dist/fancybox/";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

interface FancyboxSimpleProps {
    children: ReactNode;
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

export default function FancyboxSimple({
                                           children,
                                           options = {}
                                       }: FancyboxSimpleProps) {
    const [fancyboxRef] = useFancybox(options);

    return <div ref={fancyboxRef}>{children}</div>;
}