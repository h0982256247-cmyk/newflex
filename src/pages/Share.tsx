import React, { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

import FlexPreview from "@/components/FlexPreview";
import { resolveDocIdToToken, resolveShareToken } from "@/lib/db";
import { isLineInApp } from "@/lib/lineEnv";

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
      try {
        const decoded = decodeURIComponent(liffState);
        // liff.state 可能是 "?token=xxx" 或 "token=xxx" 或 "/share?token=xxx"
        let queryPart = decoded;
        if (decoded.includes("?")) {
          queryPart = decoded.split("?").pop() || "";
        } else if (decoded.startsWith("/")) {
          // 路徑格式，沒有參數
          queryPart = "";
        }

        const inner = new URLSearchParams(queryPart);
        token = inner.get("token") || token;
        id = inner.get("id") || id;
        autoshare = inner.get("autoshare") === "1" || autoshare;
      } catch (e) {
        console.error("[parseUrlParams] Failed to parse liff.state:", e);
      }
    }
  }

  // 額外嘗試從 hash 解析（某些 LIFF 版本會用 hash）
  if (!token && !id && window.location.hash) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      token = hashParams.get("token") || token;
      id = hashParams.get("id") || id;
    } catch (e) {
      console.error("[parseUrlParams] Failed to parse hash:", e);
    }
  }

  console.log("[parseUrlParams] Resolved:", { token, id, autoshare });
  return { token, id, autoshare };
}

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function Share() {
  const [urlParams, setUrlParams] = useState<FullUrlParams>({ token: null, id: null, autoshare: false });
  const [loading, setLoading] = useState(true);
  const [docModel, setDocModel] = useState<any>(null);
  const [flexJson, setFlexJson] = useState<any>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sharing, setSharing] = useState(false);

  const [liffReady, setLiffReady] = useState(false);
  const [paramsReady, setParamsReady] = useState(false);
  const autoShareTriggered = useRef(false);

  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;

  const tokenParam = urlParams.token;
  const idParam = urlParams.id;
  const autoshare = urlParams.autoshare;

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (tokenParam) return `${base}?token=${encodeURIComponent(tokenParam)}`;
    if (idParam) return `${base}?id=${encodeURIComponent(idParam)}`;
    return window.location.href;
  }, [tokenParam, idParam]);

  const liffUrl = useMemo(() => {
    if (!liffId) return null;
    const q = tokenParam
      ? `token=${encodeURIComponent(tokenParam)}`
      : idParam
        ? `id=${encodeURIComponent(idParam)}`
        : "";
    return `https://liff.line.me/${liffId}${q ? "?" + q : ""}`;
  }, [liffId, tokenParam, idParam]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // 初始化 LIFF 並解析 URL 參數
  useEffect(() => {
    (async () => {
      // 先嘗試解析 URL 參數（非 LIFF 環境可能直接有參數）
      const initialParams = parseUrlParams();

      if (!liffId) {
        console.warn("[Share] VITE_LIFF_ID not set");
        setUrlParams(initialParams);
        setParamsReady(true);
        return;
      }

      try {
        await liff.init({ liffId });
        setLiffReady(true);
        console.log("[Share] LIFF initialized, isInClient:", liff.isInClient());

        // LIFF 初始化後重新解析參數（可能從 liff.state 取得）
        const params = parseUrlParams();
        console.log("[Share] After LIFF init, params:", params);
        setUrlParams(params);
        setParamsReady(true);
      } catch (e: any) {
        console.error("[Share] LIFF init error:", e);
        // 即使 LIFF 初始化失敗，也嘗試使用初始參數
        setUrlParams(initialParams);
        setParamsReady(true);
      }
    })();
  }, [liffId]);

  // 載入分享資料（等待參數解析完成）
  useEffect(() => {
    if (!paramsReady) return;

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
  }, [paramsReady, tokenParam, idParam]);

  const contents = flexJson?.contents ?? null;
  const altText = flexJson?.altText ?? (docModel?.title || "Flex Message");

  // autoshare: 自動觸發分享（⚠️ 建議正式上線可關掉，只保留點擊觸發更穩）
  useEffect(() => {
    if (
      autoshare &&
      liffReady &&
      !loading &&
      !!contents &&
      !autoShareTriggered.current
    ) {
      autoShareTriggered.current = true;
      setTimeout(() => {
        triggerShare();
      }, 300);
    }
  }, [autoshare, liffReady, loading, contents]);

  function validateBeforeShare(c: any) {
    if (!c) throw new Error("此內容尚未準備好（沒有 flex contents）");

    const ctype = c?.type;
    if (!ctype || !["bubble", "carousel"].includes(ctype)) {
      throw new Error(`contents.type 不正確：${ctype}（必須是 bubble 或 carousel）`);
    }

    if (ctype === "carousel") {
      const arr = c?.contents;
      if (!Array.isArray(arr)) {
        throw new Error("carousel.contents 必須是 array");
      }
      const n = arr.length;
      // 保守上限 <= 10（最穩）
      if (n > 10) {
        throw new Error(`多頁（carousel bubble）超過上限：${n}（建議 <= 10）`);
      }
    }
  }

  async function triggerShare() {
    try {
      setSharing(true);
      setToast(null);

      // 不在 LINE in-app
      if (!liff.isInClient()) {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        // 已登入則繼續執行 shareTargetPicker
      }

      // 確保 LIFF 已初始化
      if (!liffReady) {
        if (!liffId) throw new Error("缺少 VITE_LIFF_ID");
        await liff.init({ liffId });
        setLiffReady(true);
      }

      // 檢查 API 可用性
      if (!liff.isApiAvailable("shareTargetPicker")) {
        // 在外部瀏覽器中，如果 Login 後仍不可用，可能是 Console 沒開權限
        throw new Error("此環境不支援分享好友，或未開啟 ShareTargetPicker 權限（請檢查 LINE Developers Console）。");
      }

      // ✅ 送出前硬檢查，避免你「看似分享成功但好友收不到」
      validateBeforeShare(contents);

      // ✅ 明確建立 payload（這就是你要抓問題的「結構」）
      const payload = {
        type: "flex" as const,
        altText,
        contents,
      };
      const messages = [payload];

      console.log("===== SHARE PAYLOAD START =====");
      console.log("[Share] messages.length =", messages.length);
      console.log("[Share] contents.type =", contents?.type);
      if (contents?.type === "carousel") {
        console.log("[Share] carousel bubbles =", Array.isArray(contents?.contents) ? contents.contents.length : -1);
      }
      console.log("[Share] payload JSON =", JSON.stringify(payload, null, 2));
      console.log("===== SHARE PAYLOAD END =====");

      // ✅ 呼叫 shareTargetPicker
      const res = await liff.shareTargetPicker(messages);

      // ✅ 正確判斷：取消是 null，成功是非 null
      if (res === null) {
        setToast({ type: "err", msg: "已取消分享" });
      } else {
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
                className={`mt-4 rounded-xl p-3 text-sm whitespace-pre-wrap ${toast.type === "ok"
                    ? "bg-green-50 text-green-700 border border-green-100"
                    : "bg-red-50 text-red-700 border border-red-100"
                  }`}
              >
                {toast.msg}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button className="glass-btn flex-1" disabled={loading || sharing} onClick={onPrimaryClick}>
                {sharing ? "處理中…" : "分享給好友"}
              </button>

              <button
                className="glass-btn glass-btn--secondary"
                onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                看預覽
              </button>
            </div>

            {!isLineInApp() && liffReady && !liff.isLoggedIn() ? (
              <div className="mt-3 text-xs text-gray-500">
                提示：電腦版需先登入 LINE 帳號才能使用分享功能。點擊按鈕將導向登入頁面。
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
