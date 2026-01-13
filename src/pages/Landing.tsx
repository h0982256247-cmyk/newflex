import React from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="glass-bg min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[100px] absolute -top-20 -left-20 animate-pulse" />
        <div className="w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px] absolute -bottom-20 -right-20 animate-pulse delay-700" />
      </div>

      <div className="max-w-3xl w-full z-10 relative">
        <div className="glass-panel p-12 flex flex-col items-center text-center shadow-2xl backdrop-blur-xl border border-white/40">
          <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
            柔兒數位
          </div>
          <div className="text-2xl font-medium text-gray-700 mb-8 tracking-wide">
            Flex Message Editor
          </div>

          <div className="flex justify-center w-full mb-12">
            <button
              className="glass-btn text-lg px-8 py-3 rounded-full hover:scale-105 transition-transform duration-200 shadow-lg"
              onClick={() => nav("/login")}
            >
              前往系統
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
            <div className="glass-panel p-6 hover:bg-white/60 transition-colors">
              <div className="font-semibold text-lg mb-2 text-blue-900">內建範本</div>
              <div className="text-sm text-gray-600 leading-relaxed">提供多種預設版型，建立後立即可預覽效果，快速上手。</div>
            </div>
            <div className="glass-panel p-6 hover:bg-white/60 transition-colors">
              <div className="font-semibold text-lg mb-2 text-purple-900">防呆驗證</div>
              <div className="text-sm text-gray-600 leading-relaxed">自動檢查 JSON 格式與限制，錯誤發生時不會產生無效連結。</div>
            </div>
            <div className="glass-panel p-6 hover:bg-white/60 transition-colors">
              <div className="font-semibold text-lg mb-2 text-indigo-900">固定版本</div>
              <div className="text-sm text-gray-600 leading-relaxed">每次發布皆產生唯一版本號與連結，確保舊訊息不受影響。</div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 opacity-60">
          © 2024 Gentler Digit. All rights reserved.
        </div>
      </div>
    </div>
  );
}
