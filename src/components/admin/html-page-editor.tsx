"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Code2, AlertTriangle, LayoutTemplate, Minus, Plus, Upload, Copy, ImagePlus, Undo2, Redo2, Trash2 } from "lucide-react";
import { HtmlPage } from "@/components/public/html-page";
import { updateHtmlPage } from "@/actions/page-actions";
import { deleteMagazineAsset } from "@/actions/magazine-asset-actions";
import { uploadMagazineAsset, type MagazineAssetDTO } from "@/lib/upload-client";
import {
  ArticlePicker,
  type ArticleOpt,
  type Placement,
} from "@/components/admin/article-picker";

const REF_W = 800; // 2:3 논리 지면 폭(HtmlPage와 동일)
const REF_H = 1200;

// kind=html 페이지 편집기 — 구성형과 골격 통일: 좌측 레일(레이아웃 → 구성형 전환),
// 중앙에 실제 매거진에 보이는 페이지(2:3 렌더, 배율 지원), 우측에 HTML 코드 입력 패널.
// 미리보기는 뷰어와 같은 HtmlPage(스케일)라 실제와 100% 동일. 자동저장(디바운스) + 수동 저장 + 기사 연동.
export function HtmlPageEditor({
  magazineId,
  pageId,
  pageNumber,
  totalPages,
  initialHtml,
  initialArticleId,
  articles,
  placements = {},
  initialAssets,
  onConvertToComposed,
}: {
  magazineId: string;
  pageId: string;
  pageNumber: number;
  totalPages?: number;
  initialHtml: string;
  initialArticleId: string | null;
  articles: ArticleOpt[];
  placements?: Record<string, Placement>;
  initialAssets: MagazineAssetDTO[]; // 매거진 미디어 라이브러리(영속)
  onConvertToComposed?: () => void; // 레일 레이아웃 → 구성형으로 전환
}) {
  const router = useRouter();
  const [html, setHtml] = useState(initialHtml);
  // 미리보기는 200ms 디바운스 — 타이핑마다 Shadow DOM 재파싱 부하를 줄인다(코드는 즉시 반영).
  const [previewHtml, setPreviewHtml] = useState(initialHtml);
  const [articleId, setArticleId] = useState<string | null>(initialArticleId);
  // idle(초기) → dirty(변경) → saving → saved
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [layoutPop, setLayoutPop] = useState(false);
  // 매거진 미디어 라이브러리(영속). 페이지 이동해도 유지되고 매거진 전체에서 재사용된다.
  const [assets, setAssets] = useState<MagazineAssetDTO[]>(initialAssets);
  const [uploading, setUploading] = useState(false);

  const railRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);

  // <script>·인라인 이벤트 핸들러 감지(sandbox=""가 막지만 사용자에게 경고)
  const hasScript = /<script[\s>]/i.test(html) || /\son\w+\s*=/i.test(html);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false); // 마지막 저장 이후 미저장 변경 존재
  const mountedRef = useRef(false);
  const dataRef = useRef({ html, articleId });
  dataRef.current = { html, articleId };

  async function doSave(auto = false) {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    setSaveState("saving");
    const { html: h, articleId: aid } = dataRef.current;
    const r = await updateHtmlPage(pageId, magazineId, h, aid);
    if (r && "success" in r && r.success) {
      pendingRef.current = false;
      setSaveState("saved");
      // 저장 성공 → 현재 페이지 사용처를 뱃지에 즉시 반영(새로고침 없이)
      setAssets((prev) =>
        prev.map((a) => {
          const others = (a.usedIn ?? []).filter((n) => n !== pageNumber);
          return { ...a, usedIn: h.includes(a.url) ? [...others, pageNumber].sort((x, y) => x - y) : others };
        })
      );
      if (!auto) { toast.success("저장되었습니다"); router.refresh(); }
    } else {
      setSaveState("dirty");
      if (!auto) toast.error(("error" in r && r.error) || "저장 실패");
    }
  }

  // 미리보기 디바운스(코드 입력 후 200ms)
  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(html), 200);
    return () => clearTimeout(t);
  }, [html]);

  // 변경 감지 → dirty + 디바운스 자동저장(초기 마운트는 건너뜀)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    pendingRef.current = true;
    setSaveState("dirty");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(true), 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, articleId]);

  // 미저장 상태에서 탭 닫기/새로고침 경고
  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "saving") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [saveState]);

  // 언마운트(페이지 전환) 시 미저장분 즉시 flush
  useEffect(() => {
    return () => {
      if (!pendingRef.current) return;
      const { html: h, articleId: aid } = dataRef.current;
      updateHtmlPage(pageId, magazineId, h, aid).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 레이아웃 팝오버: 레일 바깥 클릭 시 닫기
  useEffect(() => {
    if (!layoutPop) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setLayoutPop(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [layoutPop]);

  // 캔버스 fit — 가용 영역(wrapRef)에 2:3 논리 지면을 맞춤
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) {
        const pad = 32;
        setFitScale(Math.min(1, (w - pad) / REF_W, (h - pad) / REF_H));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.max(0.05, fitScale * userZoom);
  const zoomBy = (f: number) =>
    setUserZoom((z) => Math.min(5 / fitScale, Math.max(0.25 / fitScale, z * f)));
  const zoomFit = () => setUserZoom(1);

  // ── 실행취소/다시실행 (HTML 문자열 스냅샷 히스토리, 구성형 에디터와 동등) ──
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const [, bumpHist] = useState(0);
  const histTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef(initialHtml);
  // 연속 입력은 400ms 디바운스로 1엔트리로 합쳐 스냅샷
  useEffect(() => {
    if (html === lastCommitted.current) return;
    if (histTimer.current) clearTimeout(histTimer.current);
    histTimer.current = setTimeout(() => {
      past.current.push(lastCommitted.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      lastCommitted.current = html;
      bumpHist((v) => v + 1);
    }, 400);
    return () => { if (histTimer.current) clearTimeout(histTimer.current); };
  }, [html]);
  function undo() {
    if (histTimer.current) { clearTimeout(histTimer.current); histTimer.current = null; }
    // 아직 커밋 안 된 변경이 있으면 먼저 커밋(현재 편집 상태 보존)
    if (html !== lastCommitted.current) { past.current.push(lastCommitted.current); lastCommitted.current = html; }
    if (!past.current.length) return;
    future.current.push(lastCommitted.current);
    const prev = past.current.pop()!;
    lastCommitted.current = prev;
    setHtml(prev);
    bumpHist((v) => v + 1);
  }
  function redo() {
    if (!future.current.length) return;
    past.current.push(lastCommitted.current);
    const nxt = future.current.pop()!;
    lastCommitted.current = nxt;
    setHtml(nxt);
    bumpHist((v) => v + 1);
  }

  // textarea 커서 위치에 스니펫 삽입(없으면 끝에). 이미지 <img> 삽입에 사용.
  function insertAtCursor(snippet: string) {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? html.length;
    const end = ta?.selectionEnd ?? html.length;
    const next = html.slice(0, start) + snippet + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // <img> 스니펫(라이브러리 삽입·드래그 공통)
  const imgTag = (url: string) => `<img src="${url}" alt="" style="width:100%;display:block" />`;

  // 네이티브 label→input 업로드(프로그램적 click 미사용). 업로드 후 라이브러리에 추가.
  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadMagazineAsset(magazineId, file);
      setAssets((s) => [asset, ...s]);
      router.refresh(); // 서버 목록 동기화(다른 페이지로 전환해도 유지)
      toast.success("업로드 완료 — 드래그하거나 ‘삽입’으로 코드에 넣으세요");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    }
    setUploading(false);
  }
  function insertImg(url: string) {
    insertAtCursor(imgTag(url));
  }
  // 중앙 미리보기에서 <img> 영역에 이미지를 드롭 → 해당 순번 <img>의 src를 채운다.
  function handleDropImageUrl(imgIndex: number, url: string) {
    if (imgIndex < 0) {
      toast.error("이미지 자리(<img>)가 있는 영역에 놓아주세요");
      return;
    }
    setHtml((h) => setNthImgSrc(h, imgIndex, url));
    toast.success("이미지를 적용했습니다");
  }
  // 라이브러리 이미지 삭제 — 사용 중이면 사용처를 알리고, 확인 시 강제 삭제(참조 페이지는 깨짐).
  async function removeAsset(a: MagazineAssetDTO) {
    const r = await deleteMagazineAsset(a.id);
    if (r && "inUse" in r && r.inUse && r.inUse.length > 0) {
      if (!window.confirm(`${r.inUse.join(", ")}쪽 페이지에서 사용 중입니다. 삭제하면 해당 페이지의 이 이미지가 깨집니다. 그래도 삭제할까요?`)) return;
      const r2 = await deleteMagazineAsset(a.id, { force: true });
      if (r2 && "success" in r2 && r2.success) { setAssets((s) => s.filter((x) => x.id !== a.id)); router.refresh(); toast.success("이미지를 삭제했습니다"); }
      else toast.error("삭제 실패");
      return;
    }
    if (r && "success" in r && r.success) { setAssets((s) => s.filter((x) => x.id !== a.id)); router.refresh(); toast.success("이미지를 삭제했습니다"); }
    else toast.error((r && "error" in r && r.error) || "삭제 실패");
  }
  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL을 복사했습니다");
    } catch {
      toast.error("복사 실패");
    }
  }

  // 구성형(자유배치)으로 되돌리기 — HTML이 있으면 손실 경고.
  function toComposed() {
    setLayoutPop(false);
    if (html.trim() && !window.confirm("이 페이지를 구성형으로 전환하면 입력한 HTML이 사라집니다. 계속할까요?"))
      return;
    onConvertToComposed?.();
  }

  return (
    <div className="flex h-full gap-3">
      {/* 좌: 도구 레일 — 구성형과 대칭. HTML 페이지는 레이아웃(종류 전환)만 노출 */}
      <nav ref={railRef} className="flex w-16 flex-none flex-col items-center gap-1 rounded-lg bg-ink-deep py-2.5">
        <div className="relative">
          <RailTool icon={<LayoutTemplate size={18} />} label="레이아웃" active={layoutPop} onClick={() => setLayoutPop((v) => !v)} />
          {layoutPop && (
            <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-lg border bg-popover p-2 shadow-md">
              <div className="ed-grouplabel mb-1.5">페이지 종류</div>
              <button
                type="button"
                onClick={toComposed}
                className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left hover:border-primary hover:bg-primary/5"
              >
                <LayoutTemplate size={16} className="flex-none text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-foreground">구성형 페이지로 전환</span>
                  <span className="block text-[9px] leading-tight text-muted-foreground">자유배치(텍스트·이미지·도형)로</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 가운데: 툴바 + 캔버스(실제 매거진에 보이는 페이지) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-card px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Code2 size={16} /> HTML 페이지
          </span>
          <div className="ml-2 flex items-center gap-1">
            <button type="button" onClick={undo} disabled={past.current.length === 0 && html === lastCommitted.current} title="실행취소 (Ctrl+Z)" aria-label="실행취소" className="tbtn ghost"><Undo2 size={16} /></button>
            <button type="button" onClick={redo} disabled={future.current.length === 0} title="다시실행 (Ctrl+⇧Z)" aria-label="다시실행" className="tbtn ghost"><Redo2 size={16} /></button>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              페이지 {pageNumber}{totalPages ? ` / ${totalPages}` : ""}
            </span>
            {/* 배율 */}
            <span className="inline-flex items-center overflow-hidden rounded-md border">
              <button type="button" onClick={() => zoomBy(1 / 1.2)} title="축소" className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:bg-accent"><Minus size={14} /></button>
              <button type="button" onClick={zoomFit} title="화면 맞춤" className="w-12 border-x py-1 text-center font-mono text-[11px] hover:bg-accent">{Math.round(scale * 100)}%</button>
              <button type="button" onClick={() => zoomBy(1.2)} title="확대" className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:bg-accent"><Plus size={14} /></button>
            </span>
            <span className="tbsep" />
            <ArticlePicker
              articles={articles}
              placements={placements}
              value={articleId}
              onChange={setArticleId}
              allowNone
              placeholder="싣는 기사 연동…"
              className="w-[170px]"
            />
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              {saveState === "saving" ? (
                <span className="text-muted-foreground">저장 중…</span>
              ) : saveState === "dirty" ? (
                <span className="flex items-center gap-1 text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />변경됨</span>
              ) : saveState === "saved" ? (
                <span className="flex items-center gap-1 text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-600" />저장됨</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => doSave(false)}
              disabled={saveState === "saving"}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
        {/* 캔버스 — 구성형과 동일한 회색 데스크 위 2:3 페이지(배율 적용) */}
        <div ref={wrapRef} className="flex min-h-0 flex-1 overflow-auto bg-[#e9e7e4] p-6">
          <div className="m-auto flex-none" style={{ width: REF_W * scale, height: REF_H * scale }}>
            <div
              className="overflow-hidden rounded-md bg-white shadow-[0_10px_40px_rgba(0,0,0,0.18)]"
              style={{ width: REF_W, height: REF_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            >
              <HtmlPage html={previewHtml} onDropImageUrl={handleDropImageUrl} />
            </div>
          </div>
        </div>
      </div>

      {/* 우: HTML 코드 입력 패널 */}
      <div className="flex w-[400px] flex-none flex-col overflow-hidden rounded-lg border">
        <div className="flex items-center gap-1.5 border-b bg-card px-3 py-2 text-sm font-medium">
          <Code2 size={16} /> HTML 코드
        </div>
        {hasScript && (
          <div className="flex items-start gap-2 border-b bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-none" />
            <span>
              <b>&lt;script&gt;·이벤트 핸들러</b>가 감지됐습니다. <b>저장 시 자동 제거</b>되며 실행되지 않습니다
              (정적 HTML·CSS만 표시). 인터랙션 대신 정적 레이아웃으로 작성하세요.
            </span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          onKeyDown={(e) => {
            const meta = e.ctrlKey || e.metaKey;
            const k = e.key.toLowerCase();
            if (meta && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
            else if (meta && k === "y") { e.preventDefault(); redo(); }
          }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("text/plain")) e.preventDefault(); }}
          onDrop={(e) => {
            const data = e.dataTransfer.getData("text/plain");
            if (data.includes("<img")) { e.preventDefault(); insertAtCursor(data); }
          }}
          spellCheck={false}
          placeholder="<!doctype html> … 외부 AI가 만든 페이지 HTML을 붙여넣으세요"
          className="min-h-0 flex-1 resize-none bg-neutral-950 p-3 font-mono text-[12px] leading-relaxed text-neutral-100 outline-none"
        />
        {/* 미디어 라이브러리 — 매거진 단위 영속. 드래그/삽입으로 코드에 넣고, 삭제 시 사용처 경고. */}
        <div className="border-t bg-card p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              <ImagePlus size={13} /> 이미지 라이브러리
            </span>
            <label className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-accent ${uploading ? "pointer-events-none opacity-50" : ""}`}>
              <input type="file" accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
              <Upload size={12} /> {uploading ? "업로드 중…" : "업로드"}
            </label>
          </div>
          {assets.length > 0 ? (
            <div className="mb-2 grid max-h-[188px] grid-cols-5 gap-1.5 overflow-y-auto">
              {assets.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", imgTag(a.url));
                    e.dataTransfer.setData("application/x-mag-url", a.url);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  title="미리보기의 이미지 자리로 드래그 · 클릭 삽입"
                  className="group relative aspect-square cursor-grab overflow-hidden rounded border active:cursor-grabbing"
                >
                  <span
                    title={(a.usedIn?.length ?? 0) === 0 ? "어느 페이지에서도 사용되지 않음" : `${a.usedIn!.join(", ")}쪽에서 사용 중`}
                    className={`pointer-events-none absolute left-0.5 top-0.5 z-10 rounded px-1 text-[8px] font-medium leading-tight ${(a.usedIn?.length ?? 0) === 0 ? "bg-amber-500/90 text-white" : "bg-black/55 text-white"}`}
                  >
                    {(a.usedIn?.length ?? 0) === 0 ? "미사용" : a.usedIn!.length}
                  </span>
                  <img src={a.url} alt={a.filename} loading="lazy" className="pointer-events-none h-full w-full object-cover" />
                  <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/55 group-hover:flex">
                    <button type="button" onClick={() => insertImg(a.url)} title="코드에 삽입(<img>)" className="rounded bg-white/90 p-1 hover:bg-white"><Plus size={11} /></button>
                    <button type="button" onClick={() => copyUrl(a.url)} title="URL 복사" className="rounded bg-white/90 p-1 hover:bg-white"><Copy size={11} /></button>
                    <button type="button" onClick={() => removeAsset(a)} title="삭제" className="rounded bg-white/90 p-1 text-red-600 hover:bg-white"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-2 rounded border border-dashed py-3 text-center text-[10.5px] text-muted-foreground">아직 업로드한 이미지가 없습니다</p>
          )}
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            이미지를 <b>드래그</b>해 코드에 넣거나 <b>삽입</b>을 누르세요. 매거진 전체에서 <b>재사용</b>되고, 삭제 시 사용 중이면 알려줍니다.
          </p>
        </div>
        <div className="border-t bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">외부 AI 프롬프트 팁</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li><b>800 × 1200px(2:3 세로)</b> 지면 기준으로 작성(넘치면 잘림)</li>
            <li>스타일은 <b>인라인/&lt;style&gt;</b>로 자기완결적으로</li>
            <li>이미지 자리는 <b>&lt;img src=&quot;&quot;&gt;</b>로 비워두고 위에서 업로드해 채우기</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// n번째 <img>의 src를 교체(없으면 추가). 미리보기 드롭으로 이미지 자리를 채운다.
// 코드 포맷은 보존하고 대상 태그만 바꾼다(재직렬화 없음).
function setNthImgSrc(html: string, n: number, url: string): string {
  let i = -1;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    i++;
    if (i !== n) return tag;
    if (/\bsrc\s*=\s*("[^"]*"|'[^']*')/i.test(tag)) {
      return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*')/i, `src="${url}"`);
    }
    return tag.replace(/<img\b/i, `<img src="${url}"`);
  });
}

// 좌측 레일 도구 버튼(구성형 에디터 RailTool과 동일 톤)
function RailTool({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] transition ${
        active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
