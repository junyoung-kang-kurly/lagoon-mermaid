# Lagoon — Mermaid editor that fixes itself

실시간 렌더링, 사람이 읽을 수 있는 오류 해설, **파서로 검증된 원클릭 자동 수정**을 갖춘 Mermaid 에디터.
서버도, 계정도, API 키도 없습니다. 모든 처리는 브라우저 안에서 끝납니다.

**https://lagoon-mermaid.vercel.app**

## 기능

- **실시간 렌더** — 입력 160ms 뒤 다시 그림. 오류가 나면 마지막 정상 렌더를 흐리게 남겨 둔다.
- **오류 해설** — jison(flowchart·sequence·class…)과 Langium(pie·gitGraph·packet…) 파서 오류를 정규화해
  원래 줄·칸을 짚고, 원인과 고치는 법을 한국어/영어로 설명한다. frontmatter·`%%` 주석 때문에 줄 번호가 어긋나는 문제도 보정한다.
- **자동 수정** — 규칙 20종이 후보 수정을 만들고, 실제 `mermaid.parse()`로 하나씩 검증해 오류가 사라지거나
  파서가 더 멀리 진행한 수정만 채택한다(`src/lib/fix/engine.ts`). diff로 미리 보고 `⌘.`로 적용, `⌘Z`로 되돌린다.
  라벨·문자열·주석 안의 텍스트는 건드리지 않고, 고칠 수 없는 줄을 주석 처리하는 최후 수단은 따로 표시한다.
  - 라벨 속 특수문자 따옴표 처리, `->`/`=>`/`..>`/`→`/`—>` 화살표 교정, 예약어 `end`, 닫히지 않은 괄호·블록(여러 겹 포함),
    마크다운 코드 펜스, 보이지 않는 문자·둥근 따옴표, 헤더 누락·오타(`graphTD` 등), 잘못된 방향,
    sequence/ER/gantt의 빠진 `:`, 메시지 속 `;`, `Note right X`, `List<T>` 제네릭, 키워드 오타, 공백이 든 노드 이름 등
- **렌더 보정** — 서브그래프에 붙은 엣지의 라벨이 선에서 떨어지는 mermaid 버그를 바로잡고, 한글 라벨이
  단어 중간에서 줄바뀌지 않게 한다. 보정은 SVG 자체에 들어가 내보낸 파일에도 그대로 남는다.
- **노드 클릭 → 코드 이동**, 팬/줌 캔버스, 22종 템플릿(실시간 썸네일), 명령 팔레트(`⌘K`)
- **내보내기** — PNG(2x/4x/투명), SVG, 클립보드 이미지, Markdown 코드 블록, `.mmd`
- **공유 링크** — mermaid.live와 같은 `#pako:` 형식. mermaid.live 링크의 해시를 그대로 붙여도 열린다.
  링크에 담긴 설정으로는 `securityLevel`·크기 제한 같은 보안 키를 바꿀 수 없고, 열기 전 문서는 히스토리에 백업된다.
- 자동 저장 + 히스토리, 라이트/다크, Lagoon 전용 다이어그램 테마, 손그림 스타일, ELK 레이아웃, 모바일 레이아웃

## 개발

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm test     # 자동 수정·오류 해설·앱 동작 테스트 (jsdom + 실제 mermaid 파서)
pnpm build
```

Vite + React 19 + TypeScript + CodeMirror 6 + Tailwind CSS 4 + mermaid 12.

## 배포

정적 사이트라 Vercel이 Vite 프로젝트로 자동 인식한다. 해시가 붙은 `/assets/*`는 `vercel.json`에서 1년 캐시를 건다.

```bash
vercel build --prod && vercel deploy --prebuilt --prod
```
