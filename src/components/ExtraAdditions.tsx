import React, { useMemo, useState } from "react";
import { QAPFormData } from "@/types/qap";
import {
  shouldCaptureAdditions,
  canEditAdditions,
} from "@/utils/workflowUtils";

type Props = {
  qap: QAPFormData;
  level: 3 | 4 | 5;
  user: { username: string; role: string };
  onSaved?: () => void; // re-fetch QAP after save
};

export default function ExtraAdditions({ qap, level, user, onSaved }: Props) {
  const visible = shouldCaptureAdditions(qap.plant, level);
  if (!visible) return null;

  const lr = (qap.levelResponses as any)?.[level] || {};
  // flatten per-role entries to display
  const entries = Object.keys(lr).map((role) => ({
    role,
    username: lr[role]?.username,
    respondedAt: lr[role]?.respondedAt,
    text: lr[role]?.comments?.extraAdditions ?? lr[role]?.comments?.note ?? "",
  }));

  const editable = canEditAdditions(user.role, level);
  const myKey = user.role;
  const myPrev = lr?.[myKey]?.comments?.extraAdditions ?? "";
  const [text, setText] = useState<string>(myPrev);

  const submit = async () => {
    const res = await fetch(`/api/qaps/${qap.id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        level,
        comments: { extraAdditions: text },
      }),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Save failed: ${msg}`);
      return;
    }
    onSaved?.();
  };

  return (
    <div className="rounded-xl border p-4 mt-4">
      <div className="font-semibold mb-2">Extra Additions — Level {level}</div>

      {entries.length === 0 && (
        <div className="text-sm opacity-70">No notes yet</div>
      )}

      {entries.map((e, i) => (
        <div key={i} className="text-sm mb-2">
          <div className="opacity-70">
            [{e.role}] {e.username ?? "—"} •{" "}
            {e.respondedAt ? new Date(e.respondedAt).toLocaleString() : "—"}
          </div>
          {e.text ? (
            <div className="whitespace-pre-wrap">{e.text}</div>
          ) : (
            <div className="opacity-50">—</div>
          )}
        </div>
      ))}

      {editable && (
        <div className="mt-3">
          <textarea
            className="w-full rounded-md border p-2"
            rows={3}
            placeholder="Add/update your note for this level…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button className="rounded-md border px-3 py-1" onClick={submit}>
              Save
            </button>
            <div className="text-xs opacity-60 self-center">
              Saved notes are timestamped and shown to everyone.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
