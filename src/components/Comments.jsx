import React, {useEffect, useMemo, useRef, useState} from "react";

export default function Comments({postId}) {
    const [comments, setComments] = useState([]);
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [parentId, setParentId] = useState(null);
    const [deviceToken, setDeviceToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        // stabiler deviceToken (lokal, kein Login)
        let token = localStorage.getItem("deviceToken");
        if (!token) {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            localStorage.setItem("deviceToken", token);
        }
        setDeviceToken(token);
    }, []);

    useEffect(() => {
        if (!postId) return;
        loadComments();
    }, [postId]);

    async function loadComments() {
        setLoading(true);
        const res = await fetch(`/api/comments?postId=${encodeURIComponent(
            postId
        )}`);
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
        setLoading(false);
    }

    async function submitComment(e) {
        e.preventDefault();
        if (!name.trim() || !message.trim()) return;
        setSubmitting(true);
        await fetch("/api/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                postId,
                parentId,
                name: name.trim(),
                message: message.trim(),
                deviceToken
            })
        });
        setSubmitting(false);
        setMessage("");
        setParentId(null);
        await loadComments();
        textareaRef.current?.focus();
    }

    async function deleteComment(id) {
        await fetch("/api/comments", {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({commentId: id, deviceToken})
        });
        await loadComments();
    }

    const tree = useMemo(() => {
        const map = new Map();
        comments.forEach((c) => map.set(c.id, {...c, replies: []}));
        const roots = [];
        comments.forEach((c) => {
            const node = map.get(c.id);
            if (c.parent_id) {
                const p = map.get(c.parent_id);
                if (p) p.replies.push(node);
                else roots.push(node);
            } else {
                roots.push(node);
            }
        });
        return roots;
    }, [comments]);

    function initials(n) {
        const parts = String(n || "?").trim().split(/\s+/);
        const first = parts[0]?.[0] ?? "?";
        const second = parts[1]?.[0] ?? "";
        return (first + second).toUpperCase();
    }

    function CommentCard({node, depth = 0}) {
        const isOwner = node.device_token === deviceToken;
        const ts = new Date(node.created_at).toLocaleString("de-DE", {
            dateStyle: "medium",
            timeStyle: "short"
        });

        return (
            <div className="relative">
                {depth > 0 && (
                    <div
                        className="absolute -left-4 top-0 bottom-0 border-l-2
                       border-gray-200"
                        aria-hidden
                    />
                )}

                <div className="flex gap-4">
                    <div
                        className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br
                       from-indigo-500 to-purple-500 text-white
                       grid place-items-center font-semibold"
                        title={node.name}
                    >
                        {initials(node.name)}
                    </div>

                    <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-semibold text-gray-900">
                {node.name}
              </span>
                            <span className="text-sm text-gray-500">{ts}</span>
                        </div>

                        <p className="mt-1 text-gray-800 whitespace-pre-wrap">
                            {node.hidden ? "Dieser Kommentar wurde gelöscht." : node.message}
                        </p>


                        {!node.hidden && (
                            <div className="mt-2 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setParentId(node.id);
                                        setTimeout(() => textareaRef.current?.focus(), 0);
                                    }}
                                    className="text-sm font-medium text-[#2337ff]
                             hover:text-[#000d8a] transition-colors"
                                >
                                    Antworten
                                </button>

                                {isOwner && (
                                    <button
                                        type="button"
                                        onClick={() => deleteComment(node.id)}
                                        className="text-sm text-red-600 hover:text-red-700
                               font-medium transition-colors"
                                        title="Eigenen Kommentar verbergen"
                                    >
                                        Löschen
                                    </button>
                                )}
                            </div>
                        )}

                        {node.replies?.length > 0 && (
                            <div className="mt-4 space-y-6 ml-6">
                                {node.replies.map((r) => (
                                    <CommentCard key={r.id} node={r} depth={depth + 1}/>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section
            className="mx-auto my-10 w-full max-w-4xl rounded-2xl border
                 border-gray-200 bg-white/80 p-6 shadow-xl
                 backdrop-blur"
        >
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold
                     text-gray-900">
                Kommentare
                <span
                    className="h-1 w-16 rounded bg-[#2337ff] opacity-70"
                    aria-hidden
                />
            </h2>

            {/* Formular */}
            <form onSubmit={submitComment} className="space-y-4">
                {parentId && (
                    <div
                        className="flex items-center justify-between rounded-lg
                       border border-amber-200 bg-amber-50 px-3 py-2
                       text-sm text-amber-900"
                    >
                        <span>Antwort auf Kommentar #{parentId}</span>
                        <button
                            type="button"
                            onClick={() => setParentId(null)}
                            className="text-amber-900/80 underline-offset-2
                         hover:underline"
                        >
                            Abbrechen
                        </button>
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                        <label
                            htmlFor="c-name"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Name
                        </label>
                        <input
                            id="c-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={80}
                            required
                            className="block w-full rounded-lg border border-gray-300
                         bg-white px-3 py-2 text-gray-900 shadow-sm
                         outline-none ring-0 transition
                         focus:border-[#2337ff] focus:ring-2
                         focus:ring-[#2337ff]/30"
                            placeholder="Dein Name"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="c-message"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Kommentar
                        </label>
                        <textarea
                            id="c-message"
                            ref={textareaRef}
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={2000}
                            required
                            className="block w-full resize-y rounded-lg border border-gray-300
                         bg-white px-3 py-2 text-gray-900 shadow-sm
                         outline-none ring-0 transition
                         focus:border-[#2337ff] focus:ring-2
                         focus:ring-[#2337ff]/30"
                            placeholder={
                                parentId ? "Antwort schreiben…" : "Dein Kommentar…"
                            }
                        />
                        <div className="mt-1 text-right text-xs text-gray-500">
                            {message.length}/2000
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center rounded-lg bg-[#2337ff]
                       px-4 py-2 font-semibold text-white shadow
                       transition hover:bg-[#000d8a] disabled:opacity-60"
                    >
                        {submitting ? "Senden…" : parentId ? "Antwort senden" : "Senden"}
                    </button>
                </div>
            </form>

            {/* Liste */}
            <div className="mt-8">
                {loading ? (
                    <div className="space-y-4">
                        <div className="h-6 w-48 animate-pulse rounded bg-gray-200"/>
                        <div className="h-24 animate-pulse rounded bg-gray-200"/>
                        <div className="h-16 animate-pulse rounded bg-gray-200"/>
                    </div>
                ) : tree.length === 0 ? (
                    <p className="text-gray-600">Sei der Erste, der kommentiert.</p>
                ) : (
                    <div className="space-y-8">
                        {tree.map((n) => (
                            <CommentCard key={n.id} node={n} depth={0}/>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}