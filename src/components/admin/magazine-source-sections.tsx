"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { updateMagazineSourceSections } from "@/actions/magazine-actions";
import {
  newSectionId,
  pageLabel,
  validateSections,
  hasBlockingError,
  type SourceSection,
  type SectionIssue,
} from "@/types/magazine-source";
import {
  toDraftSections,
  sectionsFromToc,
  type SplitMode,
} from "@/lib/magazine-source-text";

type TocEntry = { title: string; pageNumber: number };

// 한국어 .txt는 Windows에서 CP949(EUC-KR)로 저장되는 일이 많아 UTF-8로만 읽으면 깨진다.
async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return new TextDecoder().decode(buf);
    }
  }
}

const SPLIT_LABELS: Record<SplitMode, string> = {
  marker: "페이지 표기 줄 (p.12 · 12페이지)",
  number: "숫자만 있는 줄 (12)",
  blank: "빈 줄 2개 이상",
  none: "나누지 않고 한 구간으로",
};

// 매거진 원문 구간 편집기.
// 페이지 귀속을 본문에서 파싱하지 않고 **구조(숫자 입력 필드)**로 관리한다.
// 붙여넣기/파일 임포트는 초안을 만들어줄 뿐이고, 확정은 사람이 미리보기로 확인한 뒤 한다.
export function MagazineSourceSections({
  magazineId,
  initialSections,
  tocEntries,
  pageCount,
  updatedAt,
  status,
}: {
  magazineId: string;
  initialSections: SourceSection[];
  tocEntries: TocEntry[];
  pageCount: number;
  updatedAt: string | null;
  status: string;
}) {
  const [sections, setSections] = useState<SourceSection[]>(initialSections);
  const [saved, setSaved] = useState<string>(() => JSON.stringify(initialSections));
  const [pending, start] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  const issues = useMemo(
    () => validateSections(sections, pageCount),
    [sections, pageCount],
  );
  const issuesBySection = useMemo(() => {
    const m: Record<string, SectionIssue[]> = {};
    for (const i of issues) (m[i.sectionId] ??= []).push(i);
    return m;
  }, [issues]);
  const blocked = hasBlockingError(issues);
  const dirty = JSON.stringify(sections) !== saved;
  const totalChars = sections.reduce((n, s) => n + s.text.length, 0);

  function patch(id: string, next: Partial<SourceSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)));
  }
  function remove(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setSections((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function addSection(afterIndex?: number) {
    const blank: SourceSection = {
      id: newSectionId(),
      pageFrom: null,
      pageTo: null,
      title: null,
      text: "",
    };
    setSections((prev) => {
      if (afterIndex === undefined) return [...prev, blank];
      const next = [...prev];
      next.splice(afterIndex + 1, 0, blank);
      return next;
    });
  }

  function applyToc() {
    const skeleton = sectionsFromToc(tocEntries, pageCount);
    if (skeleton.length === 0) {
      toast.error("이 매거진에는 목차가 없습니다");
      return;
    }
    if (
      sections.length > 0 &&
      !confirm(
        `목차 ${skeleton.length}개로 빈 구간을 만듭니다.\n\n확인 = 기존 구간 뒤에 추가\n취소 = 그만두기`,
      )
    )
      return;
    setSections((prev) => [...prev, ...skeleton]);
    toast.success(`목차에서 ${skeleton.length}개 구간을 만들었습니다`);
  }

  function save() {
    start(async () => {
      const r = await updateMagazineSourceSections(magazineId, sections);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setSaved(JSON.stringify(sections));
      if ("warning" in r) toast.warning(r.warning);
      else if (r.indexed) toast.success("저장하고 AI 색인을 갱신했습니다");
      else toast.success("저장했습니다 — 발행 시 AI 색인에 반영됩니다");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          매거진 원문
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
            AI 마에스트로 · 검색용
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed text-gray-500">
          이미지 페이지는 그림이라 AI가 내용을 읽을 수 없습니다. 꼭지별로 내용을 넣고 실린
          페이지를 지정해두면, 챗봇이 이 매거진에 대해 답하고 출처를 누르면 <b>그 페이지가
          바로 열립니다.</b>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={applyToc}
            disabled={pending || tocEntries.length === 0}
            title={
              tocEntries.length
                ? "목차 항목의 제목·페이지로 빈 구간을 만듭니다"
                : "목차가 없습니다"
            }
          >
            목차에서 구간 만들기
            {tocEntries.length > 0 && (
              <span className="ml-1 text-muted-foreground">({tocEntries.length})</span>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setImportOpen((v) => !v)}
            disabled={pending}
          >
            원문 붙여넣기 · 파일 불러오기
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => addSection()}
            disabled={pending}
          >
            <Plus size={14} className="mr-1" /> 빈 구간
          </Button>
        </div>

        {importOpen && (
          <ImportPanel
            pageCount={pageCount}
            onCancel={() => setImportOpen(false)}
            onApply={(drafts, replace) => {
              setSections((prev) => (replace ? drafts : [...prev, ...drafts]));
              setImportOpen(false);
              toast.success(`${drafts.length}개 구간을 만들었습니다 — 확인 후 저장하세요`);
            }}
          />
        )}

        {sections.length === 0 ? (
          <p className="rounded-md border border-dashed py-8 text-center text-sm text-gray-400">
            구간이 없습니다. 위에서 목차로 만들거나 원문을 불러오세요.
          </p>
        ) : (
          <div className="space-y-2">
            {sections.map((s, i) => (
              <SectionRow
                key={s.id}
                section={s}
                index={i}
                total={sections.length}
                pageCount={pageCount}
                tocEntries={tocEntries}
                issues={issuesBySection[s.id] ?? []}
                disabled={pending}
                onPatch={(next) => patch(s.id, next)}
                onRemove={() => remove(s.id)}
                onMove={(dir) => move(i, dir)}
                onAddAfter={() => addSection(i)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span>구간 {sections.length}개</span>
          <span>·</span>
          <span>{totalChars.toLocaleString()}자</span>
          {status !== "published" && (
            <>
              <span>·</span>
              <span className="text-amber-600">발행 시 색인됩니다</span>
            </>
          )}
          {updatedAt && !dirty && (
            <>
              <span>·</span>
              <span>최종 저장 {new Date(updatedAt).toLocaleString("ko-KR")}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={pending || !dirty || blocked}>
            {pending ? "저장 중..." : dirty ? "저장" : "저장됨"}
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSections(JSON.parse(saved))}
              disabled={pending}
            >
              되돌리기
            </Button>
          )}
          {blocked && (
            <span className="text-xs text-red-600">
              빨간 표시된 구간을 고쳐야 저장할 수 있습니다
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 구간 한 줄 ───────────────────────────────────────────────────────────────
function SectionRow({
  section: s,
  index,
  total,
  pageCount,
  tocEntries,
  issues,
  disabled,
  onPatch,
  onRemove,
  onMove,
  onAddAfter,
}: {
  section: SourceSection;
  index: number;
  total: number;
  pageCount: number;
  tocEntries: TocEntry[];
  issues: SectionIssue[];
  disabled: boolean;
  onPatch: (next: Partial<SourceSection>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddAfter: () => void;
}) {
  const hasError = issues.some((i) => i.level === "error");
  const num = (v: string): number | null => {
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  // 시작 페이지에 해당하는 목차 항목 — 제목 자동 채우기 제안
  const tocSuggestion =
    s.pageFrom !== null && !s.title
      ? tocEntries.find((t) => t.pageNumber === s.pageFrom)
      : undefined;

  return (
    <div
      className={`rounded-lg border p-2.5 ${hasError ? "border-red-400 bg-red-50/40" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">#{index + 1}</span>
        <span className="text-[11px] text-gray-400">P.</span>
        <Input
          type="number"
          min={1}
          max={pageCount || undefined}
          value={s.pageFrom ?? ""}
          onChange={(e) => {
            const from = num(e.target.value);
            // 끝 페이지가 비어 있으면 한 쪽짜리로 맞춰준다(대부분의 경우).
            onPatch({ pageFrom: from, pageTo: s.pageTo ?? from });
          }}
          placeholder="시작"
          className="h-7 w-16 text-xs"
          disabled={disabled}
        />
        <span className="text-[11px] text-gray-400">~</span>
        <Input
          type="number"
          min={1}
          max={pageCount || undefined}
          value={s.pageTo ?? ""}
          onChange={(e) => onPatch({ pageTo: num(e.target.value) })}
          placeholder="끝"
          className="h-7 w-16 text-xs"
          disabled={disabled}
        />
        <Input
          value={s.title ?? ""}
          onChange={(e) => onPatch({ title: e.target.value || null })}
          placeholder="꼭지 제목 (선택 — 출처에 표시됩니다)"
          className="h-7 min-w-[160px] flex-1 text-xs"
          disabled={disabled}
        />
        <div className="ml-auto flex flex-none items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            title="위로"
            className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            title="아래로"
            className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onAddAfter}
            disabled={disabled}
            title="아래에 구간 추가"
            className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            title="구간 삭제"
            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {tocSuggestion && (
        <button
          type="button"
          onClick={() => onPatch({ title: tocSuggestion.title })}
          className="mt-1 text-[11px] text-blue-600 hover:underline"
        >
          목차 제목 쓰기: “{tocSuggestion.title}”
        </button>
      )}

      <textarea
        value={s.text}
        onChange={(e) => onPatch({ text: e.target.value })}
        rows={5}
        spellCheck={false}
        placeholder="이 꼭지의 내용을 넣으세요"
        disabled={disabled}
        className="mt-1.5 block w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs leading-relaxed"
      />

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
        <span className="text-gray-400">
          {pageLabel(s) ?? "페이지 미지정"} · {s.text.length.toLocaleString()}자
        </span>
        {issues.map((it, k) => (
          <span
            key={k}
            className={it.level === "error" ? "text-red-600" : "text-amber-600"}
          >
            {it.level === "error" ? "✕" : "⚠"} {it.message}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 임포트 패널 ──────────────────────────────────────────────────────────────
// 나누는 기준을 **어드민이 고르고**, 결과를 미리 보고 확정한다.
// 어떤 기준도 완벽하지 않으므로(본문에도 "p.45"·"12"가 나올 수 있음) 확인 단계를 강제한다.
function ImportPanel({
  pageCount,
  onApply,
  onCancel,
}: {
  pageCount: number;
  onApply: (drafts: SourceSection[], replace: boolean) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<SplitMode>("marker");
  const fileRef = useRef<HTMLInputElement>(null);

  const drafts = useMemo(
    () => toDraftSections(raw, { mode, maxPage: pageCount || undefined }),
    [raw, mode, pageCount],
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const loaded = await readTextFile(file);
    if (!loaded.trim()) {
      toast.error("파일에 텍스트가 없습니다");
      return;
    }
    setRaw((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${loaded.trim()}` : loaded.trim()));
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-700">원문 불러오기</span>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          .txt / .md 파일
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={handleFile}
          className="hidden"
        />
        <span className="ml-auto text-[11px] text-gray-500">
          {raw.length.toLocaleString()}자
        </span>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder="여기에 원문을 붙여넣으세요"
        className="block w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-600">나누는 기준</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SplitMode)}
          className="h-7 rounded-md border bg-background px-2 text-xs"
        >
          {(Object.keys(SPLIT_LABELS) as SplitMode[]).map((m) => (
            <option key={m} value={m}>
              {SPLIT_LABELS[m]}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-gray-500">
          {mode === "marker" &&
            "본문에도 “p.45”(인용)·“3쪽”(캡션)이 나올 수 있으니 아래 미리보기를 꼭 확인하세요."}
          {mode === "number" &&
            "연도·수량처럼 숫자만 있는 줄도 함께 잡힐 수 있습니다. 미리보기를 확인하세요."}
          {mode === "blank" && "페이지는 미지정으로 만들어집니다 — 이후 직접 채우세요."}
          {mode === "none" && "전체를 한 구간으로 만듭니다."}
        </span>
      </div>

      {raw.trim() && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
          <p className="text-[11px] font-medium text-gray-600">
            미리보기 — {drafts.length}개 구간으로 나뉩니다
          </p>
          {drafts.map((d, i) => (
            <div key={d.id} className="flex items-start gap-2 text-[11px]">
              <span className="w-16 flex-none font-mono text-gray-400">
                {pageLabel(d) ?? "미지정"}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-600">
                {d.text.slice(0, 80).replace(/\s+/g, " ")}
              </span>
              <span className="flex-none text-gray-400">{d.text.length}자</span>
              {i === 0 && drafts.length === 1 && mode !== "none" && (
                <span className="flex-none text-amber-600">기준에 걸린 줄 없음</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onApply(drafts, false)}
          disabled={drafts.length === 0}
        >
          구간으로 추가
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (confirm("기존 구간을 모두 지우고 이걸로 대체할까요?")) onApply(drafts, true);
          }}
          disabled={drafts.length === 0}
        >
          기존 구간 대체
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          닫기
        </Button>
      </div>
    </div>
  );
}
