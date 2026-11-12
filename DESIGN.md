# KAKU — 書く。 · Design System

> Status: **UI implementation on \`design/kaku-writing-studio\`**  
> Scope: presentation, navigation and feedback states. The Japanese OCR model, dictionary, Canvas pointer handling and saved-data keys are preserved.  
> **This is not an OCR accuracy upgrade.**

## 1. Product direction

KAKU is a Japanese handwriting-and-composition studio: **write → recognize → choose phrase and candidate → commit into a document**.

Design pillars:
- **Japanese editorial** — restrained contrast, refined Japanese typography, quiet text hierarchy.
- **Digital stationery** — warm ivory surfaces, familiar writing tools, high-contrast handwriting grid.
- **Minimal studio** — prioritize input and content over dashboard cards or decorative elements.
- **No-interference input** — the drawing layer must never be obscured by overlays, gradients or animations.

## 2. References and design decisions

| Reference | Link | Applied design principle |
|---|---|---|
| Notion design system | https://getdesign.md/notion/design-md | Warm quiet workspace; light borders and whitespace |
| Weave Minimal Writing App | https://dribbble.com/shots/25274737--Weave-Minimal-Writing-App | Clear manuscript focus and distraction-free editing |
| 21st.dev Toolbar | https://21st.dev/@preetsuthar17/components/toolbar | Grouped writing tools and visible selected state |

These are references, not imported components. The application remains **static HTML + vanilla JavaScript**, with no React or animation dependency.

## 3. Colors

| CSS token | Hex | Usage |
|---|---|---|
| \`--k-bg\` | \`#F8F6F1\` | warm ivory outer background |
| \`--k-surface\` | \`#FFFEFA\` | writing panels |
| \`--k-paper\` | \`#FAF8F3\` | existing Canvas background |
| \`--k-ink\` | \`#26241F\` | primary text and main action |
| \`--k-secondary\` | \`#6E675C\` | descriptions and supporting text |
| \`--k-muted\` | \`#797267\` | quiet metadata |
| \`--k-line\` | \`#E7E3D9\` | borders and separators |
| \`--k-accent\` | \`#B85D3F\` | terracotta selection and focus hierarchy |
| \`--k-accent-soft\` | \`#F7E8DC\` | selected candidates and active navigation |
| \`--k-focus\` | \`#9F452C\` | visible keyboard focus |
| \`--k-success\` | \`#496A56\` | confirmed ready/saved statuses |
| \`--k-error\` | \`#AD4D37\` | model or persistence failure |

Do not use accent or success color alone to explain a state; retain textual labels. Avoid heavy shadows and decorative gradients.

## 4. Typography

- Korean UI: **Pretendard**, with system fallbacks. Font source: https://noonnu.cc/font_page/694 (SIL OFL).
- Japanese paragraphs, candidate glyphs, composer: **Noto Serif JP**; fallback to Yu Mincho / Hiragino Mincho ProN / serif.
- Japanese tool metadata and instructions: **Noto Sans JP**.
- Logo: compact **DM Sans / Pretendard** wordmark with a Noto Serif JP \`書\` seal.
- Main title: 28–40px serif; section labels: ~19px; supporting UI: 12–14px.
- Candidate: 21px Japanese serif, min-height 52px; composer phrases: ~24px; editor text: 21px, line-height 1.9.
- Japanese character samples to check: \`あ きょう カ 力 ロ 口 っ ツ 日 本 語 。 、\`. Not all Unicode ideographs are covered by any single font; verify fallback rendering where relevant.
- External font failure must never prevent handwriting or editing.

## 5. Layout and information architecture

1. **Brand header** with \`KAKU / 書く。\`, Writing / Saved records / Help navigation, and engine status.
2. **01 · 손글씨 입력** — toolbar; 14 native cells; previous/next scroll controls; manual entry; recognize; model status.
3. **02 · 구절 변환** — active segment, candidates, manual correction, merge/split, commit.
4. **03 · 나의 텍스트** — native Japanese textarea, autosave status, save record, TXT, copy.
5. **Help / Model information / Saved records** — below the core writing flow, not competing with Canvas.

The former 228px sidebar and large decorative Kanji are no longer primary layout elements. Main writing width is capped around 1160px; panels use light 1px borders, a consistent 16px radius and editorial whitespace.

## 6. Canvas, pen and navigation invariants

**Do not change these without a dedicated, separate input-engine review:**

- \`CELL_W=80\`, \`CELL_COUNT=14\`, \`CANVAS_W=1120\`, \`CANVAS_H=183\`.
- \`#ink-canvas\` CSS dimensions 1120×183, backing-store DPR scaling, \`canvasPosition()\` bounding-rect mapping and stroke ownership by the starting cell.
- \`penTipIsDown()\`, all \`pointerdown\`/\`pointermove\`/\`pointerup\`/\`pointercancel\`/\`lostpointercapture\` handlers, \`finishPointer()\`, blur and visibility cleanup.
- \`touch-action:none\` on the Canvas, existing no-interception hint \`pointer-events:none\`.
- Undo/redo stack, eraser behavior, stroke rendering.

The redesigned horizontal controls scroll **the outer \`#canvas-window\` only** and show the current visible 80px-cell range. CSS does not transform, zoom, scale, relocate coordinate origins or intercept pointer input. The pen-only checkbox is a filter (not hardware detection).

The existing handler's logic requires \`(e.buttons & 1) !== 0\` and for stylus events \`e.pressure > 0\`. A hover or barrel-button hover should therefore not draw. This is a **code-based conclusion**, not proof from a physical S Pen.

## 7. Tools and selection states

- Pen, eraser, undo, redo and clear have consistent 44px+ touch targets.
- Pen and eraser are mutually exclusive with visual selection and \`aria-pressed\`.
- Undo/redo are disabled when their stacks are empty.
- Candidates have larger touch targets and \`aria-pressed\`. Selection changes only the **phrase override**.
- Active phrase status says **후보 적용 중 · 문서 확정 전**.
- **텍스트에 추가** is the only stage that commits the composed phrase into the editor, then clears the handwriting work area.
- Existing confusable characters, dictionary, grouping, split/merge, manual correction and examples are untouched.

## 8. Editor, saving and model states

- Keep the native \`<textarea lang="ja">\` editor; not WYSIWYG.
- Persist the current text under \`kaku.editor.v1\`; snapshots under \`kaku.archive.v1\`; keep original structures compatible.
- The autosave indicator becomes **saved** only after a successful \`localStorage.setItem\`; failure is displayed explicitly.
- Record-save and record-delete success toasts are conditional on storage success.
- TXT export still creates a UTF-8 file with BOM. Clipboard fallback still selects text when API access is denied.
- Model loading status remains explicit. Manual and demo inputs must not be described as real OCR.
- Keep \`LT8/japanese-handwriting-onnx\`, model priority, labels and ONNX Runtime Web URLs unchanged.

## 9. Responsive and motion rules

| Viewport | Behavior |
|---|---|
| >=1100px | centered single writing stack; compact header; supplementary panels in three columns |
| 769–1100px | one-column writing, supplementary panels in two columns |
| <=768px | wrapped header; stacked sections and supplementary panels; toolbar wraps |
| <=420px | previous/next actions have their own row; save/export buttons wrap ergonomically |

Keep all 14 glyph cells at 80px; the view scrolls instead of shrinking the Canvas. A mobile user can move by pressing previous/next without a horizontal finger gesture over the drawing surface. Touch controls should be at least 44×44px and keyboard focus must be visible.

CSS transitions on ordinary buttons only (140ms); no Canvas animation or added work inside \`pointermove\`. Respect \`prefers-reduced-motion\`.

## 10. Verification plan and reporting

Run automated source/DOM integrity and browser tests where available:
- Source invariants: pointer filtering, input geometry, OCR resource URLs, persistence keys, existing element IDs.
- Mouse and synthetic pointer events: initial drawing, hover non-drawing, ending strokes, undo/redo/erase.
- Composer: sample candidate, merge/split, manual correction, commit to textarea.
- Draft persistence, record snapshots, TXT and copy.
- Responsive widths 390/768/1440 and horizontal scrolling controls.
- Model failure/manual fallback and a mocked local ONNX inference path.

**Not verified without external resources:** real Android S Pen tip contact/hover/barrel semantics, real ONNX network/download/WASM execution and genuine recognition accuracy. These must be tested on the actual hardware/network and disclosed in the PR. A mocked inference test is not an accuracy benchmark.

## 11. Files and safety

- \`index.html\`: existing functionality, updated presentation markup, small status and navigation additions.
- \`styles.css\`: new standalone UI layer that overrides existing inline styles; style extraction of legacy CSS may be performed in a separate refactor.
- \`DESIGN.md\`: source of truth for this UI redesign.
- \`tests/browser-smoke.cjs\` and GitHub Actions smoke workflow: automated non-hardware checks.

**Do not merge automatically**. Open PR against \`main\`; keep real S Pen hardware verification clearly outstanding.

## 12. Reference links

- https://getdesign.md/notion/design-md
- https://dribbble.com/shots/25274737--Weave-Minimal-Writing-App
- https://21st.dev/@preetsuthar17/components/toolbar
- https://noonnu.cc/font_page/694
- https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md
