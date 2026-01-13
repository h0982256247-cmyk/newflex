import React, { useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";

import FlexPreview from "@/components/FlexPreview";
import { resolveDocIdToToken, resolveShareToken } from "@/lib/db";
import { isLineInApp } from "@/lib/lineEnv";

type FullUrlParams = {
  token: string | null;
  id: string | null;
  autoshare: boolean;
  fromLogin: boolean;
};

function parseUrlParams(): FullUrlParams {
  const sp = new URLSearchParams(window.location.search);
  let token = sp.get("token");
  let id = sp.get("id");
  let autoshare = sp.get("autoshare") === "1";
  let fromLogin = sp.get("fromLogin") === "1";

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
          queryPart = "";
        }

        const inner = new URLSearchParams(queryPart);
        token = inner.get("token") || token;
        id = inner.get("id") || id;
        autoshare = inner.get("autoshare") === "1" || autoshare;
        fromLogin = inner.get("fromLogin") === "1" || fromLogin;
      } catch (e) {
        console.error("[parseUrlParams] Failed to parse liff.state:", e);
      }
    }
  }

  // 某些情境會用 hash
  if (!token && !id && window.location.hash) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      token = hashParams.get("token") || token;
      id = hashParams.get("id") || id;
      autoshare = hashParams.get("autoshare") === "1" || autoshare;
      fromLogin = hashParams.get("fromLogin") === "1" || fromLogin;
    } catch (e) {
      console.error("[parseUrlParams] Failed to parse hash:", e);
    }
  }

  console.log("[parseUrlParams] Resolved:", { token, id, autoshare, fromLogin });
  return { token, id, autoshare, fromLogin };
}

type Toast = { type: "ok" | "err"; msg: string } | null;

export default function Share() {
  const [urlParams, setUrlParams] = useState<FullUrlParams>({
    token: null,
    id: null,
    autoshare: false,
    fromLogin: false,
  });

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
  const fromLogin = urlParams.fromLogin;

  const shareUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    if (tokenParam) return `${base}?token=${encodeURIComponent(tokenParam)}`;
    if (idParam) return `${base}?id=${encodeURIComponent(idParam)}`;
    return window.location.href;
  }, [tokenParam, idParam]);

  // LIFF HTTPS URL（備援用）
  const liffUrl = useMemo(() => {
    if (!liffId) return null;
    const sp = new URLSearchParams();
    if (tokenParam) sp.set("token", tokenParam);
    else if (idParam) sp.set("id", idParam);
    return `https://liff.line.me/${liffId}${sp.toString() ? `?${sp.toString()}` : ""}`;
  }, [liffId, tokenParam, idParam]);

  // ✅ Deep link：line://app/{LIFF_ID}?token=...&autoshare=1
  const deepLinkUrl = useMemo(() => {
    if (!liffId) return null;
    const sp = new URLSearchParams();
    if (tokenParam) sp.set("token", tokenParam);
    else if (idParam) sp.set("id", idParam);
    sp.set("autoshare", "1");
    // fromLogin 這裡不需要，因為 deep link 是為了進 LINE
    return `line://app/${liffId}${sp.toString() ? `?${sp.toString()}` : ""}`;
  }, [liffId, tokenParam, idParam]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  // 初始化 LIFF 並解析 URL 參數
  useEffect(() => {
    (async () => {
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

        const params = parseUrlParams();
        setUrlParams(params);
        setParamsReady(true);
      } catch (e: any) {
        console.error("[Share] LIFF init error:", e);
        setUrlParams(initialParams);
        setParamsReady(true);
      }
    })();
  }, [liffId]);

  // 載入分享資料
  useEffect(() => {
    if (!paramsReady) return;

    (async () => {
      try {
        setLoading(true);

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

  // ✅ autoshare：登入回來（或 deep link 回來）後，自動觸發一次
  useEffect(() => {
    if (!autoshare) return;
    if (!liffReady || loading || !contents) return;
    if (autoShareTriggered.current) return;

    autoShareTriggered.current = true;

    // ✅ 清掉 autoshare/fromLogin，避免 refresh 又重來
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("autoshare");
      u.searchParams.delete("fromLogin");
      window.history.replaceState({}, "", u.toString());
    } catch {}

    setTimeout(() => {
      triggerShare();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoshare, fromLogin, liffReady, loading, contents]);

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
      if (n > 10) throw new Error(`多頁（carousel bubble）超過上限：${n}（建議 <= 10）`);
    }
  }

  async function triggerShare() {
    try {
      setSharing(true);
      setToast(null);

      if (!liffId) throw new Error("缺少 VITE_LIFF_ID");

      // 確保 liff.init
      if (!liffReady) {
        await liff.init({ liffId });
        setLiffReady(true);
      }

      // ✅ 你要求：in-client=false 時，改成「自動用 deep link 在 LINE 開啟」
      if (!liff.isInClient()) {
        if (!deepLinkUrl) throw new Error("尚未設定 LIFF（缺少 VITE_LIFF_ID）");

        console.log("[Share] not in-client -> deep link open LINE:", deepLinkUrl);

        // 先嘗試 deep link 喚起 LINE
        window.location.href = deepLinkUrl;

        // 備援：若環境不支援 deep link（例如某些瀏覽器/限制），延遲後改用 https liffUrl
        if (liffUrl) {
          setTimeout(() => {
            // 若使用者已離開頁面就不會執行；若還在，就給備援
            try {
              window.location.href = `${liffUrl}${liffUrl.includes("?") ? "&" : "?"}autoshare=1`;
            } catch {}
          }, 1200);
        }

        return;
      }

      // B) in-client + shareApi=false：先 login，回來 autoshare=1 再試一次
      if (!liff.isApiAvailable("shareTargetPicker")) {
        if (!liff.isLoggedIn()) {
          const u = new URL(window.location.href);
          u.searchParams.set("autoshare", "1");
          u.searchParams.set("fromLogin", "1");
          const redirectUri = u.toString();
          console.log("[Share] shareApi=false, do liff.login ->", redirectUri);
          liff.login({ redirectUri });
          return;
        }

        setToast({
          type: "err",
          msg:
            "已登入 LINE，但此環境仍不支援 shareTargetPicker。\n" +
            "可能原因：LINE 版本過舊、桌機環境限制，或 LIFF 後台未開 ShareTargetPicker。\n" +
            "請更新 LINE App，或改用手機 LINE 開啟此連結再分享。",
        });
        return;
      }

      // A) in-client + shareApi=true：直接分享
      validateBeforeShare(contents);

      const payload = { type: "flex" as const, altText, contents };
      const messages = [payload];

      console.log("===== SHARE PAYLOAD START =====");
      console.log("[Share] payload JSON =", JSON.stringify(payload, null, 2));
      console.log("===== SHARE PAYLOAD END =====");

      const res = await liff.shareTargetPicker(messages);

      if (res === null) setToast({ type: "err", msg: "已取消分享" });
      else setToast({ type: "ok", msg: "已傳送成功！" });
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
                  toast.type === "ok"
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

            {/* 非 in-client 時提示 + 提供手動 deep link（避免某些瀏覽器阻擋自動跳轉） */}
            {!liff.isInClient() && deepLinkUrl ? (
              <div className="mt-3 text-xs text-gray-500">
                提示：目前不在 LINE 內，已嘗試自動喚起 LINE。若未成功，請點這裡：
                <a className="underline ml-1" href={deepLinkUrl}>
                  用 LINE 開啟
                </a>
              </div>
            ) : null}

            {!isLineInApp() ? (
              <div className="mt-2 text-xs text-gray-400">
                分享連結：<span className="select-all">{shareUrl}</span>
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
          目前環境：{liffReady ? (liff.isInClient() ? "LINE in-client" : "Browser") : "初始化中…"}
        </div>
      </div>
    </div>
  );
}
