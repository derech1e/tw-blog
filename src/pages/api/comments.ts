export const prerender = false;

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    import.meta.env.SUPABASE_URL!,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sanitizeText(input: unknown, max = 2000) {
    const s = String(input ?? "").trim();
    if (!s) return "";
    return s.slice(0, max);
}

export const GET: APIRoute = async ({ url }) => {
    const postId = url.searchParams.get("postId");
    if (!postId) return new Response(JSON.stringify([]), { status: 200 });

    const { data, error } = await supabase
        .from("comments")
        .select(
            "id, post_id, parent_id, name, message, device_token, hidden, created_at"
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }

    return new Response(JSON.stringify(data ?? []), { status: 200 });
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();

        const postId = sanitizeText(body.postId, 200);
        const parentId =
            body.parentId === null || body.parentId === undefined
                ? null
                : Number(body.parentId);
        const name = sanitizeText(body.name, 80);
        const message = sanitizeText(body.message, 2000);
        const deviceToken = sanitizeText(body.deviceToken, 128);

        if (!postId || !name || !message || !deviceToken) {
            return new Response(JSON.stringify({ error: "Missing fields" }), {
                status: 400
            });
        }
        if (parentId !== null && Number.isNaN(parentId)) {
            return new Response(JSON.stringify({ error: "Bad parentId" }), {
                status: 400
            });
        }

        const { error } = await supabase.from("comments").insert([
            {
                post_id: postId,
                parent_id: parentId,
                name,
                message,
                device_token: deviceToken
            }
        ]);

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500
            });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400
        });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const commentId = Number(body.commentId);
        const deviceToken = sanitizeText(body.deviceToken, 128);

        if (!commentId || !deviceToken) {
            return new Response(JSON.stringify({ error: "Missing fields" }), {
                status: 400
            });
        }

        const { data, error } = await supabase
            .from("comments")
            .update({ hidden: true })
            .eq("id", commentId)
            .eq("device_token", deviceToken)
            .select("id");

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500
            });
        }
        if (!data || data.length === 0) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403
            });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400
        });
    }
};