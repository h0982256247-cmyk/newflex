import React, { useMemo } from "react";
import { DocModel } from "@/lib/types";
import { buildFlex } from "@/lib/buildFlex";

export default function FlexPreview({ doc, flex }: { doc?: DocModel; flex?: any }) {
  const content = useMemo(() => {
    if (flex) return flex;
    if (doc) return buildFlex(doc);
    return null;
  }, [doc, flex]);

  if (!content) return null;

  // Handle Flex Message Wrapper
  const root = content.type === "flex" ? content.contents : content;

  if (root.type === "carousel") {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
        {root.contents.map((bubble: any, i: number) => (
          <div key={i} className="min-w-[280px] max-w-[280px] snap-center flex-shrink-0">
            <FlexBubble bubble={bubble} />
          </div>
        ))}
      </div>
    );
  }

  if (root.type === "bubble") {
    return <FlexBubble bubble={root} />;
  }

  return <div>Unsupported Flex Type</div>;
}

function FlexBubble({ bubble }: { bubble: any }) {
  return (
    <div className="bg-white rounded-[16px] overflow-hidden border border-gray-200 shadow-md font-sans">
      {/* Hero */}
      {bubble.hero && <FlexImage node={bubble.hero} className="w-full" />}

      {/* Body */}
      {bubble.body && (
        <div className="px-5 py-4">
          <FlexBox box={bubble.body} />
        </div>
      )}

      {/* Footer */}
      {bubble.footer && (
        <div className="px-5 pb-4">
          <FlexBox box={bubble.footer} />
        </div>
      )}
    </div>
  );
}

function FlexBox({ box }: { box: any }) {
  if (!box.contents || !Array.isArray(box.contents)) return null;

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: box.layout === "vertical" ? "column" : "row",
    gap: getSize(box.spacing) || "8px",
    alignItems: box.layout === "baseline" ? "baseline" : box.layout === "horizontal" ? "center" : "stretch",
  };

  return (
    <div style={style}>
      {box.contents.map((node: any, i: number) => (
        <FlexNode key={i} node={node} />
      ))}
    </div>
  );
}

function FlexNode({ node }: { node: any }) {
  if (node.type === "box") return <FlexBox box={node} />;
  if (node.type === "text") return <FlexText node={node} />;
  if (node.type === "button") return <FlexButton node={node} />;
  if (node.type === "image") return <FlexImage node={node} />;
  if (node.type === "separator") return <div className="h-px bg-gray-200 my-2" />;
  if (node.type === "spacer") return <div style={{ height: getSize(node.size) || "16px" }} />;
  return null;
}

function FlexText({ node }: { node: any }) {
  const style: React.CSSProperties = {
    flex: node.flex,
    fontSize: getFontSize(node.size) || "15px",
    fontWeight: node.weight === "bold" ? 700 : 400,
    color: node.color || "#111111",
    textAlign: node.align || "left",
    whiteSpace: node.wrap ? "pre-wrap" : "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.5,
  };
  return <div style={style}>{node.text}</div>;
}

function FlexButton({ node }: { node: any }) {
  const handleClick = () => {
    if (node.action) {
      if (node.action.type === "uri") window.open(node.action.uri, "_blank");
      if (node.action.type === "message") alert(`[模擬訊息] ${node.action.text}`);
    }
  };

  const isPrimary = node.style === "primary";
  const bgColor = node.color || "#06C755";

  const style: React.CSSProperties = {
    width: "100%",
    height: node.height === "sm" ? "42px" : "52px",
    backgroundColor: isPrimary ? bgColor : "transparent",
    color: isPrimary ? "#FFFFFF" : (node.color || "#06C755"),
    border: isPrimary ? "none" : `1px solid ${node.color || "#06C755"}`,
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "opacity 0.15s",
  };

  return (
    <button
      style={style}
      onClick={handleClick}
      onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
      onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
    >
      {node.action?.label || node.action?.text || "按鈕"}
    </button>
  );
}

function FlexImage({ node, className }: { node: any; className?: string }) {
  const style: React.CSSProperties = {
    width: "100%",
    aspectRatio: node.aspectRatio?.replace(":", "/") || "auto",
    objectFit: node.aspectMode || "cover",
  };
  return <img src={node.url} style={style} className={className} alt="" />;
}

function getFontSize(token: string) {
  // LINE Flex Message 標準文字大小
  const fontMap: Record<string, string> = {
    xxs: "11px",
    xs: "13px",
    sm: "14px",
    md: "16px",
    lg: "19px",
    xl: "22px",
    xxl: "26px",
    "3xl": "32px",
    "4xl": "40px",
    "5xl": "48px",
  };
  return fontMap[token] || token;
}

function getSize(token: string) {
  // Spacing 大小
  const spaceMap: Record<string, string> = {
    none: "0px",
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    xxl: "24px",
  };
  return spaceMap[token] || token;
}
