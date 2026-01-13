import React, { useEffect, useState } from "react";
import { listDocs, deleteDoc } from "@/lib/db";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Drafts() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);

  useEffect(() => {
    load();
  }, [nav]);

  async function load() {
    try {
      const u = await supabase.auth.getUser();
      if (!u.data.user) return nav("/login");
      setRows(await listDocs());
    } catch (e: any) {
      setErr(e.message || "讀取失敗");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`確定要刪除「${title}」嗎？此操作無法復原。`)) return;
    setDeleting(id);
    setErr(null);
    try {
      await deleteDoc(id);
      await load();
    } catch (e: any) {
      setErr(e.message || "刪除失敗");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreateFolder() {
    const name = prompt("請輸入資料夾名稱：");
    if (!name?.trim()) return;
    try {
      const folderDoc = { type: "folder", id: crypto.randomUUID(), name };
      await import("@/lib/db").then(m => m.createDoc(folderDoc as any));
      await load();
    } catch (e: any) {
      alert(e.message || "建立資料夾失敗");
    }
  }

  async function handleDrop(e: React.DragEvent, targetFolderId?: string) {
    e.preventDefault();
    const docId = e.dataTransfer.getData("text/plain");
    if (!docId) return;

    // Don't drop into itself or same folder
    const doc = rows.find(r => r.id === docId);
    if (!doc) return;
    if (doc.id === targetFolderId) return; // Can't drop folder into self
    if (doc.content.folderId === targetFolderId) return; // Already in folder

    try {
      const newContent = { ...doc.content, folderId: targetFolderId };
      await import("@/lib/db").then(m => m.saveDoc(docId, newContent));
      await load();
    } catch (e: any) {
      console.error(e);
      alert("移動失敗");
    }
  }

  // Filter rows
  const currentRows = rows.filter(r => {
    // If it's the current folder itself, don't show it inside itself?
    // No, we are listing children.
    const fId = r.content.folderId;
    return fId === currentFolderId || (!fId && !currentFolderId);
  });

  const currentFolder = rows.find(r => r.id === currentFolderId);

  return (
    <div className="glass-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="glass-panel p-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <div className="text-xl font-semibold flex items-center gap-2">
              <span
                className={`cursor-pointer hover:text-blue-600 ${currentFolderId ? "" : "text-black"}`}
                onClick={() => setCurrentFolderId(undefined)}
              >
                草稿
              </span>
              {currentFolder && (
                <>
                  <span className="text-gray-400">/</span>
                  <span>{currentFolder.content.name || currentFolder.title}</span>
                </>
              )}
            </div>
            <div className="text-sm opacity-70">
              {currentFolderId ? "拖曳檔案至上方「草稿」可移出資料夾" : "建立資料夾以分類整理"}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="glass-btn glass-btn--secondary" onClick={handleCreateFolder}>+ 資料夾</button>
            <button className="glass-btn" onClick={() => nav("/drafts/new")}>新增草稿</button>
            <button className="glass-btn glass-btn--secondary" onClick={async () => { await supabase.auth.signOut(); nav("/"); }}>登出</button>
          </div>
        </div>

        {currentFolderId && (
          <div
            className="mt-4 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 hover:bg-white/50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, undefined)}
            onClick={() => setCurrentFolderId(undefined)}
          >
            ⬆️ 返回上一層 (拖曳至此移出資料夾)
          </div>
        )}

        {err ? <div className="mt-4 text-red-600">{err}</div> : null}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentRows.map((r) => {
            const isFolder = r.content.type === "folder";
            return (
              <div
                key={r.id}
                className={`glass-panel p-4 transition-all ${isFolder ? "bg-amber-50/50 hover:bg-amber-100/50" : ""}`}
                draggable={true}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                onDragOver={(e) => {
                  if (isFolder) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (isFolder) handleDrop(e, r.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="font-semibold flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => {
                      if (isFolder) setCurrentFolderId(r.id);
                      else nav(`/drafts/${r.id}/edit`);
                    }}
                  >
                    {isFolder ? "📁" : "📄"} {r.content.name || r.title || "未命名"}
                  </div>
                  <span className="glass-badge">
                    {isFolder ? "資料夾" : r.status === "publishable" ? "✅ 可發布" : r.status === "previewable" ? "⚠️ 可預覽" : "📝 草稿"}
                  </span>
                </div>

                {!isFolder && (
                  <div className="text-sm opacity-70 mt-1">{String(r.content.type).toUpperCase()} · 更新：{new Date(r.updated_at).toLocaleString()}</div>
                )}

                <div className="mt-3 flex gap-2">
                  {isFolder ? (
                    <button className="glass-btn" onClick={() => setCurrentFolderId(r.id)}>進入</button>
                  ) : (
                    <>
                      <button className="glass-btn" onClick={() => nav(`/drafts/${r.id}/edit`)}>編輯</button>
                      <button className="glass-btn glass-btn--secondary" onClick={() => nav(`/drafts/${r.id}/preview`)}>預覽</button>
                    </>
                  )}

                  <button
                    className="glass-btn glass-btn--secondary"
                    style={{ color: "#ff3b30" }}
                    disabled={deleting === r.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(r.id, r.title || r.content.name);
                    }}
                  >
                    {deleting === r.id ? "刪除中…" : "刪除"}
                  </button>
                </div>
              </div>
            );
          })}

          {currentRows.length === 0 && (
            <div className="col-span-1 md:col-span-2 text-center text-gray-400 py-12">
              這裡空空的
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
