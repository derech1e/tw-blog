import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { marked } from "marked";

// --- Type Definitions ---
interface Comment {
    id: string;
    parent_id: string | null;
    name: string;
    message: string;
    device_token: string;
    created_at: string; // ISO 8601 string date
    hidden: boolean;
}

interface CommentNode extends Comment {
    replies: CommentNode[]; // Recursive definition for tree structure
}

interface CommentCardProps {
    node: CommentNode;
    depth?: number;
}
// --- End Type Definitions ---

marked.setOptions({
    gfm: true,
    breaks: true,
});

export default function Comments({ postId }: { postId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [name, setName] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [parentId, setParentId] = useState<string | null>(null);
    const [deviceToken, setDeviceToken] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Replies: only show 3 by default
    const [areRepliesCollapsed, setAreRepliesCollapsed] = useState<
        Record<string, boolean>
    >({});
    // Collapse long content per comment
    const [isContentExpanded, setIsContentExpanded] = useState<
        Record<string, boolean>
    >({});

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Stable device token (local, no login)
    useEffect(() => {
        let token = localStorage.getItem("deviceToken");
        if (!token) {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            token = Array.from(bytes, (b) =>
                b.toString(16).padStart(2, "0"),
            ).join("");
            localStorage.setItem("deviceToken", token);
        }
        setDeviceToken(token);
    }, []);

    const loadComments = useCallback(async () => {
        if (!postId) {
            // Handle case where postId might be empty, although typed as string.
            // If postId could be null/undefined, add check here.
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/comments?postId=${encodeURIComponent(postId)}`,
            );
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const initialComments: Comment[] = await res.json();
            setComments(Array.isArray(initialComments) ? initialComments : []);
        } catch (error) {
            console.error("Failed to load comments:", error);
            setComments([]);
        } finally {
            setIsLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    async function submitComment(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !message.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId,
                    parentId,
                    name: name.trim(),
                    message: message.trim(),
                    deviceToken,
                }),
            });

            if (!res.ok) {
                throw new Error(`Failed to submit comment: ${res.statusText}`);
            }

            setMessage("");
            setParentId(null);
            textareaRef.current?.focus(); // Focus immediately
            await loadComments(); // Automatic refresh after submission
        } catch (error) {
            console.error("Failed to submit comment:", error);
            // Optionally show an error message to the user
            alert("Fehler beim Senden des Kommentars."); // Example user feedback
        } finally {
            setIsSubmitting(false);
        }
    }

    async function deleteComment(id: string) {
        try {
            const res = await fetch("/api/comments", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commentId: id, deviceToken }),
            });

            if (!res.ok) {
                throw new Error(`Failed to delete comment: ${res.statusText}`);
            }
            await loadComments(); // Automatic refresh after deletion
        } catch (error) {
            console.error("Failed to delete comment:", error);
            // Optionally show an error message to the user
            alert("Fehler beim Löschen des Kommentars."); // Example user feedback
        }
    }

    // Build a tree for replies
    const commentTree = useMemo<CommentNode[]>(() => {
        const map = new Map<string, CommentNode>();
        comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
        const roots: CommentNode[] = [];
        comments.forEach((c) => {
            const node = map.get(c.id);
            if (node) {
                // Ensure node exists in map
                if (c.parent_id) {
                    const p = map.get(c.parent_id);
                    if (p) p.replies.push(node);
                    else roots.push(node); // If parent not found, treat as root
                } else {
                    roots.push(node);
                }
            }
        });
        return roots;
    }, [comments]);

    // Safely render Markdown
    const renderMarkdown = useCallback((text: string | null | undefined) => {
        const raw = marked.parse(String(text ?? ""));
        return { __html: raw };
    }, []);

    // Detect long content (characters > 450 or >= 8 lines)
    const isLongContent = useCallback((msg: string | null | undefined): boolean => {
        const s = String(msg ?? "");
        if (s.length > 450) return true;
        const lines = s.split(/\r?\n/);
        return lines.length >= 8;
    }, []);

    const initials = useCallback((nameString: string | null | undefined): string => {
        const parts = String(nameString || "?").trim().split(/\s+/);
        const first = parts[0]?.[0] ?? "?";
        const second = parts[1]?.[0] ?? "";
        return (first + second).toUpperCase();
    }, []);

    // Markdown Toolbar (currently not used in JSX)
    const wrapSelection = useCallback(
        (prefix: string, suffix: string = prefix) => {
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
            const pos = before.length + insert.length;
            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(pos, pos);
            });
        },
        [message],
    );

    const CommentCard: React.FC<CommentCardProps> = React.memo(
        ({ node, depth = 0 }) => {
            const isOwner = node.device_token === deviceToken;
            const timestamp = new Date(node.created_at).toLocaleString("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
            });

            const replies = node.replies || [];
            const replyCount = replies.length;
            const areCurrentRepliesCollapsed =
                areRepliesCollapsed[node.id] ?? (replyCount > 3);

            const longContent = isLongContent(node.message);
            const contentIsExpanded = isContentExpanded[node.id] === true;

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
                                <span className="text-sm text-gray-500">{timestamp}</span>
                            </div>

                            <div
                                className={`relative mt-1 text-gray-800 break-words ${
                                    longContent && !contentIsExpanded
                                        ? "max-h-40 overflow-hidden"
                                        : ""
                                }`}
                            >
                                {node.hidden ? (
                                    <p>Dieser Kommentar wurde gelöscht.</p>
                                ) : (
                                    <div
                                        className="comment-content"
                                        dangerouslySetInnerHTML={renderMarkdown(node.message)}
                                    />
                                )}
                                {longContent && !contentIsExpanded && (
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
                                            textareaRef.current?.focus();
                                            setAreRepliesCollapsed((s) => ({
                                                ...s,
                                                [node.id]: false,
                                            }));
                                        }}
                                        className="text-sm font-medium text-[#2337ff]
                             transition-colors hover:text-[#000d8a]"
                                    >
                                        Antworten
                                    </button>
                                )}

                                {longContent && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsContentExpanded((s) => ({
                                                ...s,
                                                [node.id]: !contentIsExpanded,
                                            }))
                                        }
                                        className="text-sm font-medium text-gray-700
                             hover:text-gray-900"
                                    >
                                        {contentIsExpanded ? "Weniger anzeigen" : "Mehr anzeigen"}
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
                                    {(areCurrentRepliesCollapsed
                                            ? replies.slice(0, 3)
                                            : replies
                                    ).map((r) => (
                                        <CommentCard key={r.id} node={r} depth={depth + 1} />
                                    ))}

                                    {replyCount > 3 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAreRepliesCollapsed((s) => ({
                                                    ...s,
                                                    [node.id]: !areCurrentRepliesCollapsed,
                                                }))
                                            }
                                            className="text-sm font-medium text-gray-700
                               hover:text-gray-900"
                                        >
                                            {areCurrentRepliesCollapsed
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
        },
    );

    CommentCard.displayName = "CommentCard";

    return (
        <section
            className="mx-auto my-10 w-full max-w-3xl rounded-2xl border
                 border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur"
        >
            <div className="mb-6 flex items-center justify-between">
                <h2
                    className="flex items-center gap-2 text-xl font-semibold
                       text-gray-900"
                >
                    Kommentare
                </h2>
                {/* The "Aktualisieren" button is removed, refreshing happens automatically */}
            </div>

            {/* Form */}
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setName(e.target.value)
                            }
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
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setMessage(e.target.value)
                            }
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
              <span>
                Tip: **fett**, *kursiv*, `code`, &gt; Zitat, - Liste, [Text](Url){" "}
                  - Link
              </span>
                            <span>{message.length}/2000</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center rounded-lg bg-[#2337ff]
                       px-4 py-2 font-semibold text-white shadow transition
                       hover:bg-[#000d8a] disabled:opacity-60"
                    >
                        {isSubmitting
                            ? "Senden…"
                            : parentId
                                ? "Antwort senden"
                                : "Senden"}
                    </button>
                </div>
            </form>

            {/* List */}
            <div className="mt-8">
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                        <div className="h-24 animate-pulse rounded bg-gray-200" />
                        <div className="h-16 animate-pulse rounded bg-gray-200" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-gray-600">Sei der Erste, der kommentiert.</p>
                ) : (
                    <div className="space-y-8">
                        {commentTree.map((n) => (
                            <CommentCard key={n.id} node={n} depth={0} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}