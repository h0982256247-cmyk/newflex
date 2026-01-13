import { DocModel, Section, FooterButton, Action, SizeToken } from "./types";
import { isHexColor } from "./utils";

function sizeMap(s: SizeToken): string {
  return s;
}

function buildShareUrl(token?: string, docId?: string, liffId?: string) {
  // 有 token 且有 liffId 時使用 LIFF URL 格式（自動觸發分享）
  if (token && liffId) {
    return `https://liff.line.me/${liffId}?token=${token}&autoshare=1`;
  }
  // 有 token 時使用正式分享連結格式
  if (token) {
    return `https://newcard.zeabur.app/share?token=${token}`;
  }
  // 預覽模式：使用 docId
  if (docId) {
    return `https://newcard.zeabur.app/share?id=${docId}`;
  }
  return "https://newcard.zeabur.app/share";
}

function actionToFlex(a: Action, label?: string, docId?: string, token?: string, liffId?: string) {
  const common = label ? { label } : {};
  if (a.type === "uri") return { type: "uri", uri: a.uri, ...common };
  if (a.type === "message") return { type: "message", text: a.text, ...common };
  if (a.type === "share") {
    return { type: "uri", uri: buildShareUrl(token, docId, liffId), ...common };
  }
  return { type: "uri", uri: "https://example.com", ...common };
}

function safeHttpsUrl(url?: string) {
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (!url.startsWith("https://")) return null;
  return url;
}

function sectionToBubble(section: Section, docId?: string, token?: string, liffId?: string) {
  const heroImg = section.hero.find((x: any) => x.enabled && x.kind === "hero_image") as any | undefined;

  const heroUrl = heroImg ? safeHttpsUrl(heroImg?.image?.url) : null;
  const hero = heroUrl
    ? {
      type: "image",
      url: heroUrl,
      size: "full",
      aspectRatio: heroImg.ratio,
      aspectMode: heroImg.mode,
    }
    : undefined;

  const bodyContents: any[] = [];
  for (const c of section.body) {
    if (!c.enabled) continue;

    if (c.kind === "title")
      bodyContents.push({
        type: "text",
        text: c.text,
        weight: c.weight === "bold" ? "bold" : "regular",
        size: sizeMap(c.size),
        color: c.color,
        align: c.align,
        wrap: true,
      });

    if (c.kind === "paragraph")
      bodyContents.push({
        type: "text",
        text: c.text,
        size: sizeMap(c.size),
        color: c.color,
        wrap: true,
      });

    if (c.kind === "key_value") {
      const row: any = {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: c.label, size: "sm", color: "#8E8E93", flex: 2, wrap: true },
          { type: "text", text: c.value, size: "sm", color: "#111111", flex: 5, wrap: true },
        ],
      };
      if (c.action) row.action = actionToFlex(c.action, undefined, docId, token, liffId);
      bodyContents.push(row);
    }

    if (c.kind === "list")
      bodyContents.push({
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: c.items.map((it: any) => ({
          type: "text",
          text: "• " + it.text,
          size: "sm",
          color: "#111111",
          wrap: true,
        })),
      });

    if (c.kind === "divider") bodyContents.push({ type: "separator", margin: "md" });
    if (c.kind === "spacer") bodyContents.push({ type: "spacer", size: c.size });
  }

  const footerButtons = section.footer.filter((b) => b.enabled).slice(0, 3);
  const footer = footerButtons.length
    ? {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons.map((b: FooterButton) => {
        // 統一使用 box 結構，可同時自訂文字色與背景色
        return {
          type: "box",
          layout: "vertical",
          contents: [{
            type: "text",
            text: b.label,
            color: isHexColor(b.textColor) ? b.textColor : "#FFFFFF",
            align: "center",
            weight: "bold",
          }],
          backgroundColor: isHexColor(b.bgColor) ? b.bgColor : "#0A84FF",
          cornerRadius: "md",
          justifyContent: "center",
          alignItems: "center",
          paddingAll: "10px",
          action: actionToFlex(b.action, undefined, docId, token, liffId),
        };
      }),
    }
    : undefined;

  const bubble: any = {
    type: "bubble",
  };

  if (bodyContents.length > 0) {
    bubble.body = {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents,
    };
  }

  if (hero) bubble.hero = hero;
  if (footer) bubble.footer = footer;

  return bubble;
}

export function buildFlex(doc: DocModel, docId?: string, token?: string, liffId?: string) {
  if (doc.type === "folder") {
    return { type: "flex", altText: "Folder", contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [] } } };
  }

  if (doc.type === "bubble") {
    return {
      type: "flex",
      altText: doc.title || "Flex Message",
      contents: sectionToBubble(doc.section, docId, token, liffId),
    };
  }

  // ✅ 保守：最多 10 頁，避免投遞失敗
  const cards = (doc.type === "carousel" && Array.isArray(doc.cards)) ? doc.cards.slice(0, 10) : [];

  return {
    type: "flex",
    altText: doc.title || "Flex Message",
    contents: {
      type: "carousel",
      contents: cards.map((c) => sectionToBubble(c.section, docId, token, liffId)),
    },
  };
}
