import React, { useEffect, useState } from "react";
import { listDocs, deleteDoc } from "@/lib/db";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Drafts() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await supabase.auth.getUser();
        if (!u.data.user) return nav("/login");
        setRows(await listDocs());
      } catch (e: any) {
        setErr(e.message || "讀取失敗");
      }
    })();
  }, [nav]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`確定要刪除「${title}」嗎？此操作無法復原。`)) return;
    setDeleting(id);
    setErr(null);
    try {
      await deleteDoc(id);
      setRows(await listDocs());
    } catch (e: any) {
      setErr(e.message || "刪除失敗");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="glass-bg">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">草稿</div>
            <div className="text-sm opacity-70">草稿 → 編輯 → 預覽</div>
          </div>
          <div className="flex gap-2">
            <button className="glass-btn" onClick={() => nav("/drafts/new")}>新增草稿</button>
            <button className="glass-btn glass-btn--secondary" onClick={async () => { await supabase.auth.signOut(); nav("/"); }}>登出</button>
          </div>
        </div>

        {err ? <div className="mt-4 text-red-600">{err}</div> : null}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <div key={r.id} className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.title}</div>
                <span className="glass-badge">
                  {r.status === "publishable" ? "✅ 可發布" : r.status === "previewable" ? "⚠️ 可預覽" : "📝 草稿"}
                </span>
              </div>
              <div className="text-sm opacity-70 mt-1">{String(r.type).toUpperCase()} · 更新：{new Date(r.updated_at).toLocaleString()}</div>
              <div className="mt-3 flex gap-2">
                <button className="glass-btn" onClick={() => nav(`/drafts/${r.id}/edit`)}>編輯</button>
                <button className="glass-btn glass-btn--secondary" onClick={() => nav(`/drafts/${r.id}/preview`)}>預覽</button>
                <button
                  className="glass-btn glass-btn--secondary"
                  style={{ color: "#ff3b30" }}
                  disabled={deleting === r.id}
                  onClick={() => handleDelete(r.id, r.title)}
                >
                  {deleting === r.id ? "刪除中…" : "刪除"}
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="glass-panel p-6 opacity-80">目前沒有草稿，點右上角「新增草稿」開始。</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
