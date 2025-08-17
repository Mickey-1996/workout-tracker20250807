"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { defaultExercises } from "@/lib/exercises-default"; // 既存の初期データ
import type { ExerciseItem, ExercisesState, InputMode } from "@/lib/types";

/** ★いまの保存キー（これからも使うキー） */
const KEY_SETTINGS_V2 = "wt:settings.v2";
/** ★過去に使っていた/ありえるキー名の候補（自動移行でスキャン） */
const LEGACY_KEYS = [
  "exercises",
  "settings",
  "wt:settings",
  "exercisesState",
  "EXERCISES",
] as const;

/** localStorage ヘルパ */
const ls = {
  get: (k: string) => {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(k, v);
    } catch {}
  },
};

/** 何かしらの JSON を安全に parse */
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 旧キー群を上から順に探して最初に見つかった設定を返す */
function readFromAnyLegacy(): ExercisesState | null {
  for (const k of LEGACY_KEYS) {
    const hit = safeParse<ExercisesState>(ls.get(k));
    if (hit && typeof hit === "object") return hit;
  }
  return null;
}

/** v2（正式キー）を読む。無ければ旧キーを返す */
function loadSettings(): { state: ExercisesState; migratedFrom?: string } {
  const v2 = safeParse<ExercisesState>(ls.get(KEY_SETTINGS_V2));
  if (v2) return { state: v2 };

  const legacy = LEGACY_KEYS.find((k) => safeParse<ExercisesState>(ls.get(k)));
  if (legacy) {
    return {
      state:
        safeParse<ExercisesState>(ls.get(legacy)) ??
        // 念のため
        makeDefaultState(),
      migratedFrom: legacy,
    };
  }
  // 何も無い場合はデフォルト
  return { state: makeDefaultState() };
}

/** デフォルト状態を生成（既存 defaultExercises から） */
function makeDefaultState(): ExercisesState {
  return {
    items: defaultExercises,
    order: defaultExercises.map((it) => it.id),
    // ほか必要なフィールドがあればここで初期化
  } as ExercisesState;
}

/** 1回だけ v2 へ書き込む（マイグレーション用） */
function writeOnceIfNeeded(state: ExercisesState) {
  if (!ls.get(KEY_SETTINGS_V2)) {
    ls.set(KEY_SETTINGS_V2, JSON.stringify(state));
  }
}

/** 手動保存（ボタン） */
function saveV2(state: ExercisesState) {
  ls.set(KEY_SETTINGS_V2, JSON.stringify(state));
}

/** JSON のインポート/エクスポート */
async function pickFileAsText(): Promise<string | null> {
  try {
    // iOS Safari 対応：<input type="file">を動的に生成
    return await new Promise<string | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const text = await file.text();
        resolve(text);
      };
      input.click();
    });
  } catch {
    return null;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** ▼ ここから画面本体 */
export default function SettingsTab() {
  // 1) 読み込み（v2→無ければ旧キー群）
  const init = useMemo(loadSettings, []);
  const [state, setState] = useState<ExercisesState>(init.state);
  const migratedRef = useRef(init.migratedFrom);

  // 2) 初回だけ：旧キーから来たなら v2 に“1回だけ”書く（空上書きを防止）
  useEffect(() => {
    if (migratedRef.current) {
      writeOnceIfNeeded(state);
      migratedRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== ここからは既存 UI のロジック ======
  // 既存の state.items を編集したり、順序変更、入力方式の切替など…
  // （このセクションはあなたが使っている実装のままでOK。
  //   setState を呼ぶ場所はそのままにしてください）

  // --- 見本レベルの最低限UI（ヘッダーの保存/復元だけは載せておきます） ---
  async function onExport() {
    saveV2(state); // まず v2 に確実に書く
    downloadText(`settings-backup-${new Date().toISOString()}.json`, JSON.stringify(state));
    alert("JSON をダウンロードしました。ファイルAppに保存しておいてください。");
  }

  async function onImport() {
    const text = await pickFileAsText();
    if (!text) return;
    const next = safeParse<ExercisesState>(text);
    if (!next) {
      alert("読み込めませんでした。JSON を確認してください。");
      return;
    }
    setState(next);
    saveV2(next);
    alert("設定を読み込みました。");
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      {/* ヘッダー：保存/復元（文言は要望どおり） */}
      <div className="flex gap-2 justify-end mb-4">
        <button
          className="px-4 py-2 rounded bg-neutral-900 text-white"
          onClick={onExport}
        >
          保存
        </button>
        <button
          className="px-4 py-2 rounded border"
          onClick={onImport}
        >
          復元
        </button>
      </div>

      {/* ↓↓↓ ここに既存の設定編集UI（項目追加、順序、入力方式、セット数/ノルマ回数…）をそのまま置いてください ↓↓↓ */}
      {/* 例：
      <ExerciseEditor state={state} onChange={setState} />
      */}
      <div className="text-sm text-slate-500">
        （この下は既存の設定編集UIをそのまま貼り戻してください。ロジックは変更不要です）
      </div>
    </div>
  );
}
