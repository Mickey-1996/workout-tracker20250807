"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** 既存のユーティリティがある前提 */
import { loadJSON, saveJSON } from "@/lib/local-storage";

/** 既存 types があってもなくても動くよう any ベースで扱います */
type AnyItem = any;

// ====== 定数・ユーティリティ ======
const KEY_EXERCISES = "exercises";                // 設定本体（種目リスト）
const KEY_BACKUP_LAST = "backup-last-device";     // 端末バックアップ時刻

// モードのラベル
const MODE_LABEL: Record<string, string> = {
  check: "チェック",
  count: "回数入力",
};

// セレクト用選択肢（1..5 / 1..99）
const SET_OPTIONS = Array.from({ length: 5 }, (_, i) => i + 1);
const REP_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

// カテゴリの並びとラベル
const CATEGORIES: { key: "upper" | "lower" | "etc"; label: string }[] = [
  { key: "upper", label: "上半身" },
  { key: "lower", label: "下半身" },
  { key: "etc",   label: "その他" },
];

// ID を作る簡易関数
const rid = () => Math.random().toString(36).slice(2, 10);

// ====== 端末バックアップ（全量） ======
function exportAllLocalStorageToDevice() {
  try {
    const dump: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      dump[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workout-backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(KEY_BACKUP_LAST, new Date().toISOString());
  } catch (e) {
    alert("端末への保存（バックアップ）に失敗しました。");
    // eslint-disable-next-line no-console
    console.error(e);
  }
}
function importAllLocalStorageFromFile(file?: File | null) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result ?? "");
      const obj = JSON.parse(text) as Record<string, string | null>;
      Object.entries(obj).forEach(([k, v]) => {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      });
      localStorage.setItem(KEY_BACKUP_LAST, new Date().toISOString());
      alert("復元が完了しました。必要に応じてページを再読込してください。");
    } catch (e) {
      alert("JSON の読み込み/復元に失敗しました。");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };
  reader.readAsText(file);
}

// ====== 本体コンポーネント ======
export default function SettingsTab() {
  // 設定本体（種目リスト）
  const [items, setItems] = useState<AnyItem[]>([]);
  // 端末復元用の隠し input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 起動時ロード
  useEffect(() => {
    const ex = loadJSON<AnyItem[]>(KEY_EXERCISES) ?? [];
    // 最低限のフィールドが欠けてたら補正
    const normalized = ex.map((it: AnyItem, idx: number) => ({
      id: it.id ?? rid(),
      name: it.name ?? "",
      category: it.category ?? ("etc" as const),
      enabled: it.enabled ?? true,
      mode: it.mode ?? "check",
      sets: typeof it.sets === "number" ? it.sets : 3,
      repTarget:
        it.mode === "count"
          ? typeof it.repTarget === "number"
            ? it.repTarget
            : 10
          : undefined,
      order: typeof it.order === "number" ? it.order : idx + 1,
    }));
    setItems(normalized);
  }, []);

  // 変更があれば即保存（ローカル設定の保存）
  useEffect(() => {
    saveJSON(KEY_EXERCISES, items);
  }, [items]);

  // 表示用：カテゴリ別にまとめる
  const byCategory = useMemo(() => {
    const g: Record<string, AnyItem[]> = { upper: [], lower: [], etc: [] };
    for (const it of items) {
      (g[it.category ?? "etc"] ?? g.etc).push(it);
    }
    // order → id の安定ソート
    (Object.keys(g) as (keyof typeof g)[]).forEach((k) =>
      g[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    );
    return g;
  }, [items]);

  // アイテム更新ヘルパ
  const updateItem = (id: string, patch: Partial<AnyItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const addItem = (category: "upper" | "lower" | "etc") => {
    // そのカテゴリの末尾 order + 1
    const maxOrder =
      items
        .filter((i) => i.category === category)
        .reduce((m, i) => Math.max(m, i.order ?? 0), 0) || 0;
    const ni: AnyItem = {
      id: rid(),
      name: "",
      category,
      enabled: true,
      mode: "check",
      sets: 3,
      order: maxOrder + 1,
    };
    setItems((prev) => [...prev, ni]);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // 順序変更（セレクトで 1..N を付け替え）
  const changeOrder = (id: string, category: string, nextOrder: number) => {
    setItems((prev) => {
      const same = prev.filter((i) => i.category === category);
      const others = prev.filter((i) => i.category !== category);

      // 目標 id の現在順序
      const target = same.find((i) => i.id === id);
      if (!target) return prev;
      const current = target.order ?? 1;
      if (current === nextOrder) return prev;

      // 目標順序に空きを作る：上げ下げに応じてずらす
      const newer = same.map((i) => {
        if (i.id === id) return i;
        const o = i.order ?? 1;
        if (current < nextOrder) {
          // 下げる：current<o<=nextOrder を 1 つ上へ
          if (o > current && o <= nextOrder) return { ...i, order: o - 1 };
        } else {
          // 上げる：nextOrder<=o<current を 1 つ下へ
          if (o >= nextOrder && o < current) return { ...i, order: o + 1 };
        }
        return i;
      });

      const placed = newer.map((i) => (i.id === id ? { ...i, order: nextOrder } : i));
      return [...others, ...placed];
    });
  };

  // ヘッダー（アイコン/タイトルは表示しない。右肩に保存/復元）
  const Header = (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap mb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => importAllLocalStorageFromFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={exportAllLocalStorageToDevice}
        className="px-4 py-2 rounded-md bg-slate-900 text-white hover:opacity-90"
      >
        保存
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
      >
        復元
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      {Header}

      {CATEGORIES.map(({ key, label }) => {
        const list = byCategory[key] ?? [];
        const maxOrder = list.length || 1;

        return (
          <section key={key} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{label}</h2>
              <button
                type="button"
                onClick={() => addItem(key)}
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-sm"
              >
                ＋ 追加
              </button>
            </div>

            <div className="space-y-3">
              {list.map((it: AnyItem) => (
                <div
                  key={it.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* 有効/無効 */}
                    <label className="inline-flex items-center gap-2 min-w-[96px]">
                      <input
                        type="checkbox"
                        className="h-[18px] w-[18px]"
                        checked={!!it.enabled}
                        onChange={(e) => updateItem(it.id, { enabled: e.target.checked })}
                      />
                      <span className="text-sm text-slate-700">記録対象</span>
                    </label>

                    {/* 種目名 */}
                    <input
                      type="text"
                      value={it.name ?? ""}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      placeholder="種目名"
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                    />

                    {/* 入力モード */}
                    <select
                      value={it.mode ?? "check"}
                      onChange={(e) => {
                        const mode = e.target.value;
                        updateItem(it.id, {
                          mode,
                          repTarget:
                            mode === "count"
                              ? typeof it.repTarget === "number"
                                ? it.repTarget
                                : 10
                              : undefined,
                        });
                      }}
                      className="rounded-md border border-slate-300 px-2 py-2"
                    >
                      <option value="check">{MODE_LABEL.check}</option>
                      <option value="count">{MODE_LABEL.count}</option>
                    </select>

                    {/* セット数 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">セット数</span>
                      <select
                        value={Number(it.sets ?? 3)}
                        onChange={(e) =>
                          updateItem(it.id, { sets: Number(e.target.value) || 1 })
                        }
                        className="rounded-md border border-slate-300 px-2 py-2"
                      >
                        {SET_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ノルマ（回数入力時のみ） */}
                    {it.mode === "count" && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">ノルマ回数</span>
                        <select
                          value={Number(it.repTarget ?? 10)}
                          onChange={(e) =>
                            updateItem(it.id, { repTarget: Number(e.target.value) || 1 })
                          }
                          className="rounded-md border border-slate-300 px-2 py-2"
                        >
                          {REP_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 順序（数値で指定） */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">順序</span>
                      <select
                        value={Number(it.order ?? 1)}
                        onChange={(e) =>
                          changeOrder(it.id, it.category ?? "etc", Number(e.target.value) || 1)
                        }
                        className="rounded-md border border-slate-300 px-2 py-2"
                      >
                        {Array.from({ length: maxOrder }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 削除 */}
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="px-3 py-2 rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}

              {list.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  まだ種目がありません。「＋ 追加」から作成してください。
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
