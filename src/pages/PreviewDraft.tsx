import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ProgressBar from "@/components/ProgressBar";
import FlexPreview from "@/components/FlexPreview";
import { getDoc, getActiveShareForDoc, publishDoc } from "@/lib/db";
import { DocModel } from "@/lib/types";
import { isPublishable, validateDoc } from "@/lib/validate";

export default function PreviewDraft() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<DocModel | null>(null);
  const [active, setActive] = useState<{ token: string; version_no: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const row = await getDoc(id);
      setDoc(row.content);
      setActive(await getActiveShareForDoc(id));
    })();
  }, [id]);

  if (!doc || !id) return <div className="glass-bg"><div className="mx-auto max-w-5xl px-4 py-10"><div className="glass-panel p-6">載入中…</div></div></div>;

  const rep = validateDoc(doc);
  const gate = isPublishable(doc);
  const shareUrl = active ? `https://mgm.gentlerdigit.com/share?token=${active.token}` : null;
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;
  const liffUrl = active && liffId ? `https://liff.line.me/${liffId}?token=${active.token}` : null;

  return (
    <div className="glass-bg">
      <ProgressBar docId={id} />
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">預覽與發布</div>
            <div className="text-sm opacity-70">{rep.status === "publishable" ? "✅ 可發布" : rep.status === "previewable" ? "⚠️ 可預覽不可發布（外部圖）" : "📝 草稿（有錯誤）"}</div>
          </div>
          <div className="flex gap-2">
            <button className="glass-btn glass-btn--secondary" onClick={() => nav(`/drafts/${id}/edit`)}>返回編輯</button>
            <button className="glass-btn glass-btn--secondary" onClick={() => nav("/drafts")}>草稿列表</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel p-4">
          <div className="font-semibold">預覽</div>
          <div className="mt-4"><FlexPreview doc={doc} /></div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4">
            <div className="font-semibold">驗證結果</div>
            <div className="mt-2 text-sm space-y-2">
              {rep.errors.map((e, i) => <div key={i} className="text-red-600">❌ {e.message}</div>)}
              {rep.warnings.map((w, i) => <div key={i} className="text-amber-700">⚠️ {w.message}</div>)}
              {rep.errors.length === 0 && rep.warnings.length === 0 ? <div className="opacity-70">沒有問題。</div> : null}
            </div>
          </div>

          <div className="glass-panel p-4">
            <div className="font-semibold">發布（固定版本）</div>
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(139,0,0,0.18)' }}>
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                如有任何修改，請點選下方按鈕「<strong style={{ color: '#8B0000' }}>重發</strong>」。重發會產生新版本，舊版本連結會自動失效。
              </span>
            </div>
            {msg ? <div className="mt-2 text-sm text-red-600">{msg}</div> : null}
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: (!gate.ok || busy) ? '#aaa' : '#8B0000' }}
                disabled={!gate.ok || busy}
                onMouseEnter={e => { if (gate.ok && !busy) (e.currentTarget.style.background = '#a00000'); }}
                onMouseLeave={e => { if (gate.ok && !busy) (e.currentTarget.style.background = '#8B0000'); }}
                onClick={async () => {
                  setMsg(null); setBusy(true);
                  try { await publishDoc(id); setActive(await getActiveShareForDoc(id)); }
                  catch (e: any) { setMsg(e.message === "NOT_PUBLISHABLE" ? "目前不可發布：請修正錯誤或改用上傳圖片。" : "發布失敗"); }
                  finally { setBusy(false); }
                }}
              >{active ? "重發（新版本）" : "產生分享連結"}</button>
            </div>

            {active ? (
              <div className="mt-4 space-y-2">
                <div className="glass-badge">目前版本：v{active.version_no}</div>
                {shareUrl || liffUrl ? (
                  <div className="p-3 bg-white/50 rounded-xl border border-white/40 space-y-2">
                    <div className="text-xs font-medium opacity-70">分享連結</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/50 px-2 py-1.5 rounded text-xs break-all border border-white/20">
                        {shareUrl || liffUrl}
                      </code>
                      <button
                        className="glass-btn glass-btn--secondary px-4 py-1.5 text-xs whitespace-nowrap"
                        onClick={() => navigator.clipboard.writeText((shareUrl || liffUrl)!)}
                      >
                        複製網址
                      </button>
                    </div>
                    {liffUrl && (
                      <a
                        href={liffUrl}
                        className="block w-full py-3 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold text-center rounded-xl shadow-lg shadow-green-200 transition-all duration-200"
                      >
                        LINE 分享好友
                      </a>
                    )}
                    {!shareUrl && <div className="text-[10px] text-red-500">⚠️ 未生成 Web 連結。</div>}

                    {/* QR Code */}
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <QRCodeSVG value={liffUrl || shareUrl || ""} size={160} />
                      </div>
                      <div className="text-xs text-gray-500">請用手機掃描分享</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
