import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback
} from "react";
import { marked } from "marked";

marked.setOptions({
    gfm: true,
    breaks: true
});

export default function Comments({ postId }) {
    const [comments, setComments] = useState([]);
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [parentId, setParentId] = useState(null);
    const [deviceToken, setDeviceToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Replies: standardmäßig nur 3 anzeigen
    const [collapsedReplies, setCollapsedReplies] = useState({});
    // Lange Inhalte pro Kommentar einklappen
    const [expandedLong, setExpandedLong] = useState({});

    const textareaRef = useRef(null);

    // stabiler Geräte-Token (lokal, kein Login)
    useEffect(() => {
        let token = localStorage.getItem("deviceToken");
        if (!token) {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            token = Array.from(bytes, (b) =>
                b.toString(16).padStart(2, "0")
            ).join("");
            localStorage.setItem("deviceToken", token);
        }
        setDeviceToken(token);
    }, []);

    const loadComments = useCallback(async () => {
        if (!postId) return;
        setLoading(true);
        const res = await fetch(
            `/api/comments?postId=${encodeURIComponent(postId)}`
        );
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
        setLoading(false);
    }, [postId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    async function submitComment(e) {
        e.preventDefault();
        if (!name.trim() || !message.trim()) return;
        setSubmitting(true);
        await fetch("/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        textareaRef.current?.focus();
        await loadComments();
    }

    async function deleteComment(id) {
        await fetch("/api/comments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commentId: id, deviceToken })
        });
        await loadComments();
    }

    // Baum für Antworten aufbauen
    const tree = useMemo(() => {
        const map = new Map();
        comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
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

    // Markdown sicher rendern
    function renderMd(text) {
        const raw = marked.parse(String(text ?? ""));
        return { __html: raw };
    }

    // Lange Inhalte erkennen (Zeichen > 450 oder >= 8 Zeilen)
    function isLongContent(msg) {
        const s = String(msg ?? "");
        if (s.length > 450) return true;
        const lines = s.split(/\r?\n/);
        return lines.length >= 8;
    }

    function initials(n) {
        const parts = String(n || "?").trim().split(/\s+/);
        const first = parts[0]?.[0] ?? "?";
        const second = parts[1]?.[0] ?? "";
        return (first + second).toUpperCase();
    }

    // Markdown-Toolbar
    function wrapSelection(prefix, suffix = prefix) {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const before = message.slice(0, start);
        const selected = message.slice(start, end);
        const after = message.slice(end);
        const insert = `${prefix}${selected || "Text"}${suffix}`;
        const next = `${before}${insert}${after}`;
        setMessage(next);
        // Cursor/Selection neu setzen
        const pos = before.length + insert.length;
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    }

    function prefixLines(marker) {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const before = message.slice(0, start);
        const selected = message.slice(start, end) || "Listeneintrag";
        const after = message.slice(end);
        const lines = selected.split(/\r?\n/);
        const withMarks = lines
            .map((l, i) =>
                marker === "ol" ? `${i + 1}. ${l || "Eintrag"}` : `- ${l || "Eintrag"}`
            )
            .join("\n");
        const next = `${before}${withMarks}${after}`;
        setMessage(next);
        requestAnimationFrame(() => el.focus());
    }

    function quoteSelection() {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const before = message.slice(0, start);
        const selected = message.slice(start, end) || "Zitat";
        const after = message.slice(end);
        const withQuote = selected
            .split(/\r?\n/)
            .map((l) => `> ${l}`)
            .join("\n");
        const next = `${before}${withQuote}${after}`;
        setMessage(next);
        requestAnimationFrame(() => el.focus());
    }

    async function insertLink() {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const selected = message.slice(start, end) || "Linktext";
        const href = window.prompt("URL eingeben (https://…):", "https://");
        if (!href) return;
        wrapSelection(`[${selected}](`, `${href})`);
    }

    function insertCodeBlock() {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const before = message.slice(0, start);
        const selected = message.slice(start, end) || "code";
        const after = message.slice(end);
        const block = "```\n" + selected + "\n```\n";
        setMessage(before + block + after);
        requestAnimationFrame(() => el.focus());
    }

    function ToolbarButton({ onClick, label, children }) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-label={label}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1
                   text-sm font-medium text-gray-700 shadow-sm
                   hover:bg-gray-50"
            >
                {children}
            </button>
        );
    }

    function CommentCard({ node, depth = 0 }) {
        const isOwner = node.device_token === deviceToken;
        const ts = new Date(node.created_at).toLocaleString("de-DE", {
            dateStyle: "medium",
            timeStyle: "short"
        });

        const replies = node.replies || [];
        const replyCount = replies.length;
        const repliesCollapsed =
            collapsedReplies[node.id] ?? (replyCount > 3);

        const long = isLongContent(node.message);
        const expanded = expandedLong[node.id] === true;

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
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full
                       bg-gradient-to-br from-indigo-500 to-purple-500
                       font-semibold text-white"
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

                        <div
                            className={`relative mt-1 text-gray-800 break-words ${
                                long && !expanded ? "max-h-40 overflow-hidden" : ""
                            }`}
                        >
                            {node.hidden ? (
                                <p>Dieser Kommentar wurde gelöscht.</p>
                            ) : (
                                <div
                                    className="comment-content"
                                    dangerouslySetInnerHTML={renderMd(node.message)}
                                />
                            )}
                            {long && !expanded && (
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-0
                             h-12 bg-gradient-to-t from-white to-transparent"
                                />
                            )}
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                            {!node.hidden && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setParentId(node.id);
                                        setTimeout(() => textareaRef.current?.focus(), 0);
                                        setCollapsedReplies((s) => ({
                                            ...s,
                                            [node.id]: false
                                        }));
                                    }}
                                    className="text-sm font-medium text-[#2337ff]
                             transition-colors hover:text-[#000d8a]"
                                >
                                    Antworten
                                </button>
                            )}

                            {long && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedLong((s) => ({
                                            ...s,
                                            [node.id]: !expanded
                                        }))
                                    }
                                    className="text-sm font-medium text-gray-700
                             hover:text-gray-900"
                                >
                                    {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
                                </button>
                            )}

                            {isOwner && !node.hidden && (
                                <button
                                    type="button"
                                    onClick={() => deleteComment(node.id)}
                                    className="text-sm font-medium text-red-600
                             transition-colors hover:text-red-700"
                                    title="Eigenen Kommentar verbergen"
                                >
                                    Löschen
                                </button>
                            )}
                        </div>

                        {replyCount > 0 && (
                            <div className="ml-6 mt-4 space-y-6">
                                {(repliesCollapsed ? replies.slice(0, 3) : replies).map(
                                    (r) => (
                                        <CommentCard
                                            key={r.id}
                                            node={r}
                                            depth={depth + 1}
                                        />
                                    )
                                )}

                                {replyCount > 3 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCollapsedReplies((s) => ({
                                                ...s,
                                                [node.id]: !repliesCollapsed
                                            }))
                                        }
                                        className="text-sm font-medium text-gray-700
                               hover:text-gray-900"
                                    >
                                        {repliesCollapsed
                                            ? `Weitere ${replyCount - 3} Antworten anzeigen`
                                            : "Weniger Antworten anzeigen"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section
            className="mx-auto my-10 w-full max-w-3xl rounded-2xl border
                 border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur"
        >
            <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold
                       text-gray-900">
                    Kommentare
                    <span
                        className="h-1 w-16 rounded bg-[#2337ff] opacity-70"
                        aria-hidden
                    />
                </h2>
                <button
                    type="button"
                    onClick={loadComments}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5
                     text-sm font-medium text-gray-700 shadow-sm transition
                     hover:bg-gray-50"
                >
                    Aktualisieren
                </button>
            </div>

            {/* Formular */}
            <form onSubmit={submitComment} className="space-y-4">
                {parentId && (
                    <div
                        className="flex items-center justify-between rounded-lg border
                       border-amber-200 bg-amber-50 px-3 py-2 text-sm
                       text-amber-900"
                    >
                        <span>Antwort auf Kommentar #{parentId}</span>
                        <button
                            type="button"
                            onClick={() => setParentId(null)}
                            className="underline-offset-2 hover:underline"
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
                         outline-none transition focus:border-[#2337ff]
                         focus:ring-2 focus:ring-[#2337ff]/30"
                            placeholder="Dein Name"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="c-message"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Kommentar (Markdown unterstützt)
                        </label>

                        <textarea
                            id="c-message"
                            ref={textareaRef}
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={2000}
                            required
                            className="block w-full resize-y rounded-lg border border-gray-300
                         bg-white px-3 py-2 text-gray-900 shadow-sm outline-none
                         transition focus:border-[#2337ff] focus:ring-2
                         focus:ring-[#2337ff]/30"
                            placeholder={
                                parentId ? "Antwort schreiben…" : "Dein Kommentar…"
                            }
                        />
                        <div className="mt-1 flex justify-between text-xs text-gray-500">
                            <span>Tip: **fett**, *kursiv*, `code`, &gt; Zitat, - Liste, [Text](Url) - Link</span>
                            <span>{message.length}/2000</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center rounded-lg bg-[#2337ff]
                       px-4 py-2 font-semibold text-white shadow transition
                       hover:bg-[#000d8a] disabled:opacity-60"
                    >
                        {submitting ? "Senden…" : parentId ? "Antwort senden" : "Senden"}
                    </button>
                </div>
            </form>

            {/* Liste */}
            <div className="mt-8">
                {loading ? (
                    <div className="space-y-4">
                        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                        <div className="h-24 animate-pulse rounded bg-gray-200" />
                        <div className="h-16 animate-pulse rounded bg-gray-200" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-gray-600">Sei der Erste, der kommentiert.</p>
                ) : (
                    <div className="space-y-8">
                        {tree.map((n) => (
                            <CommentCard key={n.id} node={n} depth={0} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}