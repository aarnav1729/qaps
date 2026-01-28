import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquarePlus, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SuggestionRow = {
  id: string;
  message: string;
  createdBy: string | null;
  createdAt: string; // ISO
};

const API_BASE = ""; // same-origin; keep empty for your current setup

function fmtWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  // Simple friendly format without extra deps
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  // fallback full-ish date
  return d.toLocaleString();
}

export default function Suggestions() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  async function fetchSuggestions(silent = false) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/suggestions`, {
        method: "GET",
        credentials: "include",
        signal: ac.signal,
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        setRows([]);
        throw new Error("Unauthorized. Please login again.");
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Failed to load suggestions");
      }

      const data = (await res.json()) as SuggestionRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast({
        title: "Could not load suggestions",
        description: e?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function submitSuggestion() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast({
        title: "Suggestion is empty",
        description: "Please type a short comment before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // Optimistic UI entry
    const optimistic: SuggestionRow = {
      id: `temp-${Date.now()}`,
      message: trimmed,
      createdBy: "you",
      createdAt: new Date().toISOString(),
    };

    setRows((prev) => [optimistic, ...prev]);
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/suggestions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (res.status === 401) {
        throw new Error("Unauthorized. Please login again.");
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Failed to save suggestion");
      }

      const saved = (await res.json()) as SuggestionRow;

      // Replace optimistic with real row
      setRows((prev) => {
        const withoutTemp = prev.filter((r) => r.id !== optimistic.id);
        return [saved, ...withoutTemp].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      toast({
        title: "Suggestion submitted",
        description: "Thanks for sharing your feedback.",
      });
    } catch (e: any) {
      // Remove optimistic on failure
      setRows((prev) => prev.filter((r) => r.id !== optimistic.id));

      toast({
        title: "Submission failed",
        description: e?.message || "Server error",
        variant: "destructive",
      });

      // Put the text back for convenience
      setMessage(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    fetchSuggestions();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const msg = (r.message || "").toLowerCase();
      const by = (r.createdBy || "").toLowerCase();
      return msg.includes(q) || by.includes(q);
    });
  }, [rows, query]);

  const totalCount = rows.length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Suggestions
            </h1>
            <p className="text-sm text-muted-foreground">
              Share ideas, improvements, or issues. Everyone’s suggestions are
              visible here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {totalCount} total
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSuggestions()}
              disabled={loading}
              className="gap-2"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Compose card */}
        <Card className="border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Add a suggestion
            </CardTitle>
            <CardDescription>
              Keep it clear and actionable. Your name will be recorded from your
              login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your suggestion..."
              className="min-h-[120px]"
              maxLength={2000}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {message.trim().length}/2000
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setMessage("")}
                  disabled={submitting || !message.length}
                >
                  Clear
                </Button>
                <Button
                  onClick={submitSuggestion}
                  disabled={submitting || !message.trim().length}
                  className="gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List card */}
        <Card className="border-muted/60">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>All suggestions</CardTitle>
              <div className="relative w-full sm:w-[320px]">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by text or user..."
                  className="pl-8"
                />
              </div>
            </div>
            <CardDescription>
              Newest first. Use search to quickly find patterns.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading suggestions...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {query.trim()
                  ? "No suggestions match your search."
                  : "No suggestions yet. Be the first to add one."}
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-4">
                  {filtered.map((s, idx) => (
                    <div
                      key={s.id}
                      className="rounded-lg border bg-card/50 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full">
                            {s.createdBy || "anonymous"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {fmtWhen(s.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                        {s.message}
                      </div>

                      {/* subtle separator between items */}
                      {idx < filtered.length - 1 && (
                        <Separator className="mt-4 opacity-40" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
