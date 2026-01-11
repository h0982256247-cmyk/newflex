import React, { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

import FlexPreview from "@/components/FlexPreview";
import { resolveDocIdToToken, resolveShareToken } from "@/lib/db";
import { isLineInApp } from "@/lib/lineEnv";

type UrlParams = { token: string | null; id: string | null };

type FullUrlParams = { token: string | null; id: string | null; autoshare: boolean };

function parseUrlParams(): FullUrlParams {
  const sp = new URLSearchParams(window.location.search);
  let token = sp.get("token");
  let id = sp.get("id");
  let autoshare = sp.get("autoshare") === "1";

  // LIFF 可能會把參數包在 liff.state
  if (!token && !id) {
    const liffState = sp.get("liff.state");
    if (liffState) {
      const decoded = decodeURIComponent(liffState);
      const q = decoded.includes("?") ? decoded.split("?")[1] : decoded.startsWith("?") ? decoded.slice(1) : decoded;
      const inner = new URLSearchParams(q);
      token = inner.get("token");
      id = inner.get("id");
      autoshare = inner.get("autoshare") === "1";
    }
  }
  return { token, id, autoshare };
}

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function Share() {
  const { token: tokenParam, id: idParam, autoshare } = useMemo(() => parseUrlParams(), []);
  const [loading, setLoading] = useState(true);
  const [docModel, setDocModel] = useState<any>(null);
  const [flexJson, setFlexJson] = useState<any>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sharing, setSharing] = useState(false);
  const [liffReady, setLiffReady] = useState(false);
  const autoShareTriggered = useRef(false);

  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (tokenParam) return `${base}?token=${encodeURIComponent(tokenParam)}`;
    if (idParam) return `${base}?id=${encodeURIComponent(idParam)}`;
    return window.location.href;
  }, [tokenParam, idParam]);

  const liffUrl = useMemo(() => {
    if (!liffId) return null;
    const q = tokenParam ? `token=${encodeURIComponent(tokenParam)}` : idParam ? `id=${encodeURIComponent(idParam)}` : "";
    return `https://liff.line.me/${liffId}${q ? "?" + q : ""}`;
  }, [liffId, tokenParam, idParam]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // 初始化 LIFF
  useEffect(() => {
    (async () => {
      if (!liffId) {
        console.warn("[Share] VITE_LIFF_ID not set");
        return;
      }
      try {
        await liff.init({ liffId });
        setLiffReady(true);
        console.log("[Share] LIFF initialized, isInClient:", liff.isInClient());
      } catch (e: any) {
        console.error("[Share] LIFF init error:", e);
      }
    })();
  }, [liffId]);

  // 載入分享資料
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // resolve share token if only have id
        let token = tokenParam;
        if (!token && idParam) {
          token = (await resolveDocIdToToken(idParam)) || null;
        }
        if (!token) throw new Error("找不到分享內容（缺少 token 或 id）");

        const data = await resolveShareToken(token);
        if (!data) throw new Error("找不到分享內容（token 無效或未發佈）");

        setDocModel(data.doc_model || null);
        setFlexJson(data.flex_json || null);
      } catch (e: any) {
        setToast({ type: "err", msg: e?.message || String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [tokenParam, idParam]);

  // autoshare: 自動觸發分享
  useEffect(() => {
    if (autoshare && liffReady && flexJson?.contents && !autoShareTriggered.current && !loading) {
      autoShareTriggered.current = true;
      // 延遲一點確保 UI 渲染完成
      setTimeout(() => {
        triggerShare();
      }, 500);
    }
  }, [autoshare, liffReady, flexJson, loading]);

  const contents = flexJson?.contents ?? null;
  const altText = flexJson?.altText ?? (docModel?.title || "Flex Message");

  async function triggerShare() {
    if (!contents) {
      setToast({ type: "err", msg: "此內容尚未準備好（沒有 flex contents）" });
      return;
    }

    try {
      setSharing(true);
      setToast(null);

      // 檢查是否在 LIFF 環境
      if (!liff.isInClient()) {
        // 不在 LINE 內，導向 LIFF URL
        if (liffUrl) {
          window.location.href = liffUrl;
        } else {
          setToast({ type: "err", msg: "尚未設定 LIFF（缺少 VITE_LIFF_ID）" });
        }
        return;
      }

      // 確保 LIFF 已初始化
      if (!liffReady) {
        if (!liffId) throw new Error("缺少 VITE_LIFF_ID");
        await liff.init({ liffId });
      }

      // 檢查 API 可用性
      if (!liff.isApiAvailable("shareTargetPicker")) {
        throw new Error("目前 LINE 版本不支援分享好友（shareTargetPicker）。請更新 LINE App 後再試。");
      }

      console.log("[Share] Calling shareTargetPicker with:", { altText, contents });

      const res = await liff.shareTargetPicker([{ type: "flex", altText, contents }]);

      if (res === undefined) {
        // 使用者取消或關閉
        setToast({ type: "err", msg: "已取消分享" });
      } else if (res) {
        setToast({ type: "ok", msg: "已傳送成功！" });
      }
    } catch (e: any) {
      console.error("[Share] Error:", e);
      setToast({ type: "err", msg: e?.message || String(e) });
    } finally {
      setSharing(false);
    }
  }

  async function onPrimaryClick() {
    await triggerShare();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="text-xl font-semibold text-gray-900">分享 Flex Message</div>
            <div className="mt-2 text-sm text-gray-500">
              這頁面的預覽即為實際分享給好友的內容（published 版本）。
            </div>

            {toast ? (
              <div
                className={`mt-4 rounded-xl p-3 text-sm whitespace-pre-wrap ${
                  toast.type === "ok" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                }`}
              >
                {toast.msg}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                className="glass-btn flex-1"
                disabled={loading || sharing}
                onClick={onPrimaryClick}
              >
                {sharing ? "處理中…" : "分享給好友"}
              </button>

              <button
                className="glass-btn glass-btn--secondary"
                onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                看預覽
              </button>
            </div>

            {!isLineInApp() ? (
              <div className="mt-3 text-xs text-gray-500">
                提示：若你是從瀏覽器開啟，點「分享給好友」會帶你到 LINE 內開啟（LIFF），再點一次即可分享。
              </div>
            ) : null}
          </div>

          <div ref={previewRef} className="border-t border-gray-100 bg-gray-50 p-6">
            <div className="font-semibold text-gray-900">預覽</div>
            <div className="mt-4">
              {loading ? (
                <div className="text-sm text-gray-500">載入中…</div>
              ) : contents ? (
                <FlexPreview doc={docModel} flex={flexJson} />
              ) : (
                <div className="text-sm text-gray-500">沒有可預覽的內容</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          分享連結：<span className="select-all">{shareUrl}</span>
        </div>
      </div>
    </div>
  );
}
