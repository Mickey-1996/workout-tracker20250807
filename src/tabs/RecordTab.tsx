// src/tabs/RecordTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";

/* ========== 画面内限定の軽量型（他ファイルは変更不要） ========== */
type DayRecord = {
  date: string;
  notesUpper?: string;
  notesLower?: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
};

type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;

type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";
type Settings = {
  items: Array<{
    id: string;
    name: string;
    category: Category;
    inputMode?: InputMode;
    checkCount?: number;
    sets?: number;
    enabled?: boolean;
    order?: number;
    repTarget?: number; // ノルマ回数（回数入力時）
  }>;
};

type MetaMap = Record<
  string,
  {
    mode: InputMode;
    setCount: number;
    repTarget?: number;
  }
>;

/* ========== 日付ユーティリティ ========== */
const todayStr = new Date().toISOString().split("T")[0];
const fmtDateJP = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

/* 経過時間（時間）を計算 */
const hoursSince = (iso?: string): number | null => {
  if (!iso) return null;
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return null;
  const now = Date.now();
  return Math.max(0, Math.floor((now - last) / 3600000));
};

/* ========== 最終実施記録（UI側で管理：localStorage） ========== */
const LAST_DONE_KEY = "last-done-v1";
type LastDoneMap = Record<string, string>; // exerciseId => ISO

export default function RecordTab() {
  /* 設定の読み込み（モード／セット数／ノルマ） */
  const [meta, setMeta] = useState<MetaMap>({});
  useEffect(() => {
    const settings = loadJSON<Settings>("settings-v1");
    const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];
    const m: MetaMap = {};
    for (const it of items) {
      const mode: InputMode = it.inputMode ?? "check";
      const setCount = Math.max(1, it.checkCount ?? it.sets ?? 3);
      m[it.id] = { mode, setCount, repTarget: it.repTarget };
    }
    setMeta(m);
  }, []);

  /* 種目（従来の loadExercises 出力） */
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  useEffect(() => {
    // 既存ラッパーが無い環境もあるため、settings から合成（フォールバック）
    if (Object.keys(meta).length) {
      // meta からカテゴリ別配列を再構成（名前は settings から取れない場合もあるので既存保存を尊重）
      const settings = loadJSON<Settings>("settings-v1");
      const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];
      const grouped: ExercisesState = { upper: [], lower: [], other: [] } as any;
      for (const it of items) {
        const setCount = meta[it.id]?.setCount ?? it.sets ?? 3;
        (grouped[it.category] as any).push({
          id: it.id,
          name: it.name,
          sets: setCount,
        });
      }
      setExercises(grouped);
      return;
    }
    // meta 未構築の一瞬だけ、空のまま
  }, [meta]);

  /* 当日レコード */
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: todayStr,
    notesUpper: "",
    notesLower: "",
    sets: {},
    counts: {},
  });

  useEffect(() => {
    const loaded = loadDayRecord(todayStr) as DayRecord | null;
    if (loaded) {
      setDayRecord({
        date: todayStr,
        notesUpper: loaded.notesUpper ?? "",
        notesLower: loaded.notesLower ?? "",
        sets: loaded.sets ?? {},
        counts: loaded.counts ?? {},
      });
    }
  }, []);

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    saveDayRecord(todayStr, rec);
  };

  /* 最終実施（前回）マップ */
  const [lastDone, setLastDone] = useState<LastDoneMap>({});
  useEffect(() => {
    const map = loadJSON<LastDoneMap>(LAST_DONE_KEY) ?? {};
    setLastDone(map);
  }, []);
  const updateLastDone = (exerciseId: string) => {
    const nowIso = new Date().toISOString();
    setLastDone((prev) => {
      const next = { ...prev, [exerciseId]: nowIso };
      try {
        window.localStorage.setItem(LAST_DONE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* チェック切り替え */
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const sets = { ...(dayRecord.sets || {}) };
    const arr = [...(sets[exerciseId] ?? [])];
    arr[setIndex] = !arr[setIndex];
    sets[exerciseId] = arr;

    const next: DayRecord = { ...dayRecord, sets };
    persist(next);

    if (arr[setIndex]) updateLastDone(exerciseId);
  };

  /* 回数入力（セットごと） */
  const changeCount = (exerciseId: string, setIndex: number, value: string) => {
    let n = Math.floor(Number(value || "0"));
    if (!Number.isFinite(n) || n < 0) n = 0;

    const counts = { ...(dayRecord.counts || {}) };
    const arr = [...(counts[exerciseId] ?? [])];
    // 配列長を埋める
    const needLen = Math.max(setIndex + 1, arr.length);
    for (let i = 0; i < needLen; i++) if (arr[i] == null) arr[i] = 0;
    arr[setIndex] = n;
    counts[exerciseId] = arr;

    const next: DayRecord = { ...dayRecord, counts };
    persist(next);

    if (n > 0) updateLastDone(exerciseId);
  };

  /* メモ */
  const handleNotesChange = (field: "notesUpper" | "notesLower", value: string) => {
    persist({ ...dayRecord, [field]: value });
  };

  /* 経過時間表示テキスト */
  const lastText = (exerciseId: string) => {
    const h = hoursSince(lastDone[exerciseId]);
    if (h == null) return "—";
    if (h < 1) return "<1時間";
    return `${h}時間`;
  };

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  return (
    <div className="space-y-4">
      {/* 右上に本日日付 */}
      <div className="flex items-center justify-end">
        <div className="text-sm text-muted-foreground">📅 {fmtDateJP(todayStr)}</div>
      </div>

      {Object.entries(exercises).map(([category, categoryExercises]) => (
        <Card key={category} className="p-4">
          <h2 className="text-base font-bold mb-3">
            {category === "upper" ? "上半身" : category === "lower" ? "下半身" : "その他"}
          </h2>

          {categoryExercises.map((ex) => {
            const m = meta[ex.id] ?? { mode: "check" as InputMode, setCount: ex.sets ?? 3 };
            const setCount = Math.max(1, m.setCount ?? ex.sets ?? 3);
            const mode = m.mode ?? "check";

            return (
              <div key={ex.id} className="mb-4">
                {/* 1行目：種目名 + 前回からの時間 */}
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="font-medium text-sm">{ex.name}</div>
                  <div className="text-xs text-muted-foreground ml-auto">
                    前回から {lastText(ex.id)}
                  </div>
                </div>

                {/* 2行目：入力行（小さめ＆改行で崩れにくい） */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {mode === "count"
                    ? Array.from({ length: setCount }).map((_, idx) => {
                        const cur = dayRecord.counts?.[ex.id]?.[idx] ?? "";
                        // ノルマ（repTarget）はプレースホルダで淡く表示
                        const ph = m.repTarget ? String(m.repTarget) : "";
                        return (
                          <Input
                            key={idx}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder={ph}
                            className="h-9 w-16 text-sm"
                            value={cur === 0 ? "" : String(cur)}
                            onChange={(e) => changeCount(ex.id, idx, e.target.value)}
                          />
                        );
                      })
                    : Array.from({ length: setCount }).map((_, idx) => (
                        <Checkbox
                          key={idx}
                          checked={dayRecord.sets?.[ex.id]?.[idx] || false}
                          onCheckedChange={() => toggleSet(ex.id, idx)}
                          className="h-4 w-4"
                        />
                      ))}
                </div>
              </div>
            );
          })}
        </Card>
      ))}

      {/* メモ（小さめ） */}
      <Card className="p-4">
        <h3 className="text-base font-bold mb-2">上半身メモ</h3>
        <Textarea
          className="text-sm"
          value={dayRecord.notesUpper ?? ""}
          onChange={(e) => handleNotesChange("notesUpper", e.target.value)}
          placeholder="上半身トレーニングに関するメモ"
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-base font-bold mb-2">下半身メモ</h3>
        <Textarea
          className="text-sm"
          value={dayRecord.notesLower ?? ""}
          onChange={(e) => handleNotesChange("notesLower", e.target.value)}
          placeholder="下半身トレーニングに関するメモ"
        />
      </Card>
    </div>
  );
}
