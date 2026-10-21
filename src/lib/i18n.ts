import { useSyncExternalStore } from 'react'

export type Lang = 'ko' | 'en'

const ko = {
  'app.tagline': 'Mermaid 스튜디오',
  'app.untitled': '제목 없는 다이어그램',

  'status.rendering': '렌더링 중',
  'status.ok': '정상',
  'status.error': '오류',
  'status.fixable': '자동 수정 가능',
  'status.loading': '엔진 불러오는 중',

  'toolbar.templates': '템플릿',
  'toolbar.share': '공유',
  'toolbar.export': '내보내기',
  'toolbar.settings': '설정',
  'toolbar.history': '히스토리',
  'toolbar.theme': '테마 전환',
  'toolbar.command': '명령',
  'toolbar.lang': 'English',

  'pane.code': '코드',
  'pane.preview': '미리보기',
  'pane.config': '설정 JSON',

  'editor.position': '{line}줄, {col}열',
  'editor.saved': '자동 저장됨',
  'editor.chars': '{n}자',

  'preview.lastGood': '마지막 정상 렌더',
  'preview.broken.title': '오류 때문에 아직 그릴 수 없어요',
  'preview.broken.body': '왼쪽 아래 설명을 확인하거나 자동 수정을 눌러 보세요.',
  'preview.empty.title': '다이어그램을 그려 보세요',
  'preview.empty.body': '왼쪽에 Mermaid 코드를 입력하면 바로 그려집니다.',
  'preview.zoomIn': '확대',
  'preview.zoomOut': '축소',
  'preview.fit': '화면에 맞추기',
  'preview.reset': '100%',
  'preview.fullscreen': '전체 화면',
  'preview.hint': '드래그로 이동 · ⌘+휠로 확대',
  'preview.clickToSource': '노드를 클릭하면 코드로 이동',
  'preview.grid': '격자 배경',

  'error.where': '{line}번째 줄, {col}번째 칸',
  'error.goto': '해당 줄로 이동',
  'error.fixCta': '자동 수정',
  'error.fixCount': '{n}곳 수정',
  'error.fixing': '수정 방법 찾는 중…',
  'error.noFix': '자동으로 고칠 수 없는 오류예요. 아래 설명을 참고해 주세요.',
  'error.raw': '파서 원문 메시지',
  'error.expected': '여기에 올 수 있는 것',
  'error.partial': '일부만 고칠 수 있어요',
  'error.review': '변경 내용 보기',

  'fix.title': '자동 수정 미리보기',
  'fix.subtitle': 'Mermaid 파서로 하나하나 검증한 수정만 보여드려요.',
  'fix.apply': '적용',
  'fix.applyAll': '모두 적용',
  'fix.cancel': '취소',
  'fix.applied': '{n}곳을 고쳤어요',
  'fix.lossyWarn': '이 단계는 문제 줄을 주석 처리합니다. 내용을 직접 확인해 주세요.',
  'fix.line': '{line}줄',
  'fix.verified': '파서 검증 완료',
  'fix.stillBroken': '남은 오류가 있어요',

  'fix.fences': '마크다운 코드 펜스(```)를 제거했어요',
  'fix.invisible': '복사-붙여넣기로 딸려온 보이지 않는 문자·특수 공백을 정리했어요',
  'fix.typography': '둥근 따옴표·긴 대시·화살표 기호(→)를 Mermaid 문법 기호로 바꿨어요',
  'fix.entities': 'HTML 엔티티(&gt; 등)를 원래 문자로 되돌렸어요',
  'fix.comments': '// 또는 # 주석을 Mermaid 주석(%%)으로 바꿨어요',
  'fix.headerTypo': '다이어그램 종류 `{from}` → `{to}` 오타를 고쳤어요',
  'fix.headerMissing': '첫 줄에 빠져 있던 다이어그램 선언 `{type}` 줄을 추가했어요',
  'fix.direction': '방향을 `{from}` → `{to}`로 고쳤어요',
  'fix.quoteLabel': '특수문자가 든 라벨을 큰따옴표로 감쌌어요',
  'fix.subgraphTitle': 'subgraph 제목을 id["제목"] 형식으로 바꿨어요',
  'fix.arrow': '연결선을 올바른 화살표 문법으로 고쳤어요',
  'fix.reservedEnd': '예약어 `end`를 노드 이름으로 쓸 수 없어 `End`로 바꿨어요',
  'fix.unclosed': '닫히지 않은 괄호·따옴표를 닫았어요',
  'fix.missingEnd': '빠진 `{closer}`를 추가해 블록을 닫았어요',
  'fix.seqColon': '메시지 앞에 빠진 `:`을 넣었어요',
  'fix.erLabel': '관계에 필요한 라벨 `: ""`을 붙였어요',
  'fix.taskColon': '작업 이름과 일정 사이에 `:`을 넣었어요',
  'fix.journeyScore': '작업에 필요한 점수 `: 3`을 붙였어요',
  'fix.quadrantPoint': '좌표를 `[x, y]` 형식으로 감쌌어요',
  'fix.insertToken': '빠져 있던 `{token}` 기호를 넣었어요',
  'fix.keywordTypo': '키워드 오타 `{from}` → `{to}`',
  'fix.spacedId': '공백이 든 노드 이름을 id로 바꾸고 원래 이름은 라벨로 남겼어요: `{phrase}` → `{id}`',
  'fix.commentOut': '고칠 수 없는 줄을 주석 처리해 나머지를 먼저 그렸어요',
  'fix.fencesExtra': '마크다운 코드 펜스를 지우고, 첫 번째 다이어그램 외의 블록은 주석으로 남겼어요',
  'fix.reservedEndTo': '예약어 `end`는 노드 이름으로 쓸 수 없어 `{to}`로 바꿨어요',
  'fix.seqSemicolon': '메시지 안의 `;`이 문장 끝으로 읽히지 않도록 `#59;`로 바꿨어요',
  'fix.classGeneric': '제네릭 표기 `<T>`를 Mermaid 형식 `~T~`로 바꿨어요',

  'explain.fence.title': '마크다운 코드 펜스가 섞여 있어요',
  'explain.fence.detail': '```mermaid 와 ``` 줄은 Markdown 문서용 표시라서 Mermaid 문법이 아니에요.',
  'explain.fence.hint': '펜스 줄을 지우고 안쪽 코드만 남기세요. 자동 수정이 대신 해 드려요.',
  'explain.unknown.title': '다이어그램 종류를 알 수 없어요',
  'explain.unknown.detail': '첫 줄 `{word}`은(는) 알려진 다이어그램 선언이 아니에요.',
  'explain.unknown.hint': '첫 줄에 `flowchart TD`, `sequenceDiagram`, `classDiagram` 같은 선언이 있어야 해요.',
  'explain.unknown.typo': '혹시 `{guess}` 말인가요?',
  'explain.empty.title': '코드가 비어 있어요',
  'explain.lexical.title': 'Mermaid가 모르는 문자가 있어요',
  'explain.lexical.detail': '{where}에 쓸 수 없는 {char}이(가) 있어요.',
  'explain.lexical.hintArrow': '화살표는 키보드 하이픈으로 `-->`처럼 써야 해요.',
  'explain.lexical.hintInvisible': '눈에 보이지 않는 문자예요. 문서나 메신저에서 복사할 때 자주 딸려와요.',
  'explain.lexical.hintQuote': '둥근 따옴표 대신 키보드의 `"`를 써 주세요.',
  'explain.lexical.hintGeneric': '이 문자를 지우거나 큰따옴표로 감싼 라벨 안에 넣어 주세요.',
  'explain.pieLabel.hint': 'pie 라벨은 큰따옴표로 감싸세요: `{example}`',
  'explain.direction.title': '지원하지 않는 방향이에요: `{dir}`',
  'explain.direction.detail': '`graph`/`flowchart` 뒤의 방향은 `TD`, `TB`, `BT`, `LR`, `RL` 중 하나여야 해요.',
  'explain.direction.hint': '예: `{fix}`',
  'explain.keyword.title': '알 수 없는 키워드 `{word}`',
  'explain.keyword.detail': '{where}의 `{word}`은(는) 이 다이어그램의 키워드가 아니라서 다른 문장으로 해석됐어요.',
  'explain.label.title': '라벨 안에 특수문자 `{char}`가 있어요',
  'explain.label.detail': 'Mermaid는 `(` `[` `{` 같은 기호를 노드 모양으로 읽어요. 라벨에 그대로 쓰면 모양이 중간에 끝난 것으로 해석돼요.',
  'explain.label.hint': '라벨 전체를 큰따옴표로 감싸세요: `A["Start (beta)"]`',
  'explain.label.hintQuote': '라벨 안의 큰따옴표는 `#quot;`로 쓰세요: `A["say #quot;hi#quot;"]`',
  'explain.end.title': '`end`는 예약어예요',
  'explain.end.detail': '`end`는 subgraph나 블록을 닫는 키워드라 노드 이름으로 쓸 수 없어요.',
  'explain.end.hint': '`End`, `finish`처럼 바꾸거나 `done["end"]`처럼 라벨로 쓰세요.',
  'explain.end.detailName': '`end`는 블록을 닫는 키워드라 대소문자와 상관없이 이름으로 쓸 수 없어요.',
  'explain.end.hintRename': '`finish`, `done`처럼 다른 이름으로 바꾸세요.',
  'explain.endUnmatched.title': '짝이 없는 `end`가 있어요',
  'explain.endUnmatched.detail': '이 `end`가 닫을 블록(`subgraph`, `loop`, `alt` 등)이 열려 있지 않아요.',
  'explain.endUnmatched.hint': '남는 `end` 줄을 지우거나 위에 블록 시작 줄을 추가하세요.',
  'explain.eof.title': '코드가 덜 끝났어요',
  'explain.eof.detail': '문서가 끝났는데 아직 닫히지 않은 부분이 있어요.',
  'explain.eof.hint': '{closers}로 닫아 주세요.',
  'explain.eof.incomplete': '{where}에서 문장이 완성되기 전에 문서가 끝났어요.',
  'explain.link.title': '연결선 모양이 올바르지 않아요',
  'explain.link.detail': '{where}에서 노드 다음에 연결선이 와야 하는데 {found}이(가) 나왔어요.',
  'explain.link.hint': '`-->`, `---`, `-.->`, `==>` 중 하나를 쓰고, 공백이 든 이름은 `id["이름"]`으로 쓰세요.',
  'explain.seqArrow.title': '메시지 화살표 모양이 올바르지 않아요',
  'explain.seqArrow.detail': '{where}의 `{found}`은(는) sequenceDiagram 화살표가 아니에요.',
  'explain.seqArrow.hint': '`->>`(실선), `-->>`(점선), `->`, `-x`, `-)` 중 하나를 쓰세요. 예: `Alice->>Bob: 안녕하세요`',
  'explain.seqText.title': '메시지 앞에 `:`이 필요해요',
  'explain.seqText.detail': 'sequenceDiagram의 메시지는 `보내는이->>받는이: 내용` 형식이에요.',
  'explain.seqText.hint': '예: `Alice->>Bob: 안녕하세요`',
  'explain.erLabel.title': '관계에 라벨이 필요해요',
  'explain.erLabel.detail': 'erDiagram의 관계선 뒤에는 `: 라벨`이 와야 해요.',
  'explain.erLabel.hint': '예: `CUSTOMER ||--o{ ORDER : places`',
  'explain.erAttr.title': '속성 형식이 올바르지 않아요',
  'explain.erAttr.detail': '엔터티 속성은 `타입 이름` 형식이에요.',
  'explain.erAttr.hint': '예: `string name`',
  'explain.task.title': '작업 정보가 빠졌어요',
  'explain.task.detail': '작업 이름 뒤에 `:`과 일정이 필요해요.',
  'explain.task.hint': '예: `디자인 : 2024-01-01, 3d`',
  'explain.journeyTask.detail': 'journey의 작업은 `작업 이름: 점수(1~5): 참여자` 형식이에요.',
  'explain.journeyTask.hint': '예: `차 끓이기: 5: 나`',
  'explain.token.title': '여기에는 `{want}` 기호가 와야 해요',
  'explain.token.detail': '{where}에서 `{want}` 기호를 기대했는데 `{found}`이(가) 나왔어요.',
  'explain.token.detailNewline': '{where}에서 `{want}` 기호를 기대했는데 줄바꿈이 나왔어요.',
  'explain.generic.title': '문법 오류',
  'explain.generic.detail': '{where}의 {found}에서 해석이 멈췄어요.',
  'explain.generic.hint': '여기에는 {expected} 중 하나가 올 수 있어요.',
  'explain.generic.hintOne': '여기에는 {expected}이(가) 와야 해요.',
  'explain.other.title': '렌더링 오류',
  'explain.found.end': '문서 끝',
  'explain.found.newline': '줄바꿈',

  'char.dash': '긴 대시(—)',
  'char.arrow': '화살표 기호({c})',
  'char.invisible': '보이지 않는 문자(U+{code})',
  'char.space': '특수 공백(U+{code})',
  'char.quote': '둥근 따옴표({c})',
  'char.generic': '`{c}` 문자',
  'char.text': '`{c}`',

  'tok.newline': '줄바꿈',
  'tok.eof': '문서 끝',
  'tok.space': '공백',
  'tok.nodeName': '노드 이름',
  'tok.text': '텍스트',
  'tok.string': '"문자열"',
  'tok.message': '메시지 내용',
  'tok.taskData': '일정',
  'tok.name': '이름',
  'tok.member': '멤버',
  'tok.description': '설명',
  'tok.edgeText': '연결선 텍스트',
  'tok.number': '숫자',

  'templates.title': '템플릿',
  'templates.subtitle': '클릭하면 에디터에 불러와요. 지금 작업은 히스토리에 저장돼요.',
  'templates.search': '템플릿 검색…',
  'templates.broken': '고장 난 예제로 자동 수정 체험',
  'templates.brokenDesc': '오류 5개가 섞인 다이어그램. 자동 수정을 눌러 보세요.',

  'export.svg': 'SVG 다운로드',
  'export.png': 'PNG 다운로드',
  'export.png2x': 'PNG 다운로드 (2x)',
  'export.png4x': 'PNG 다운로드 (4x)',
  'export.copyPng': '이미지 복사',
  'export.copySvg': 'SVG 코드 복사',
  'export.copyMd': 'Markdown 코드 블록 복사',
  'export.mmd': '.mmd 파일 저장',
  'export.open': '파일 열기',
  'export.transparent': '투명 배경',
  'export.noDiagram': '내보낼 다이어그램이 없어요',
  'export.done': '저장했어요',
  'export.copied': '클립보드에 복사했어요',
  'export.failed': '내보내기에 실패했어요',

  'share.copied': '공유 링크를 복사했어요',
  'share.desc': '링크에 다이어그램이 통째로 담겨요. 서버에 저장되지 않아요.',
  'share.loaded': '공유 링크에서 불러왔어요',
  'share.liveCompat': 'mermaid.live 링크(#pako:)도 그대로 열 수 있어요',

  'settings.title': '다이어그램 설정',
  'settings.theme': '다이어그램 테마',
  'settings.theme.auto': 'Lagoon (앱 테마를 따라감)',
  'settings.look': '스타일',
  'settings.look.classic': '기본',
  'settings.look.handDrawn': '손그림',
  'settings.layout': '레이아웃 엔진',
  'settings.layout.dagre': 'Dagre (기본)',
  'settings.layout.elk': 'ELK (복잡한 그래프)',
  'settings.curve': '곡선',
  'settings.advanced': '고급 설정 (JSON)',
  'settings.invalidJson': 'JSON 형식이 올바르지 않아요',
  'settings.reset': '기본값으로',

  'history.title': '히스토리',
  'history.empty': '아직 저장된 버전이 없어요. 편집하면 자동으로 쌓여요.',
  'history.restore': '복원',
  'history.restored': '이전 버전을 불러왔어요',
  'history.saveNow': '지금 버전 저장',
  'history.saved': '버전을 저장했어요',
  'history.clear': '모두 지우기',

  'palette.placeholder': '명령 검색…',
  'palette.empty': '일치하는 명령이 없어요',
  'cmd.fix': '자동 수정',
  'cmd.format': '들여쓰기 정리',
  'cmd.newDoc': '새 다이어그램',
  'cmd.toggleTheme': '라이트/다크 전환',
  'cmd.toggleLang': 'Switch to English',
  'cmd.fit': '미리보기 화면에 맞추기',
  'cmd.focusEditor': '에디터로 포커스',
  'cmd.layoutSwap': '패널 좌우 바꾸기',

  'toast.newDoc': '새 다이어그램을 시작했어요',
  'toast.fileLoaded': '{name} 파일을 불러왔어요',
  'drop.title': '파일을 놓으면 불러와요',
  'drop.body': '.mmd · .md · .txt',

  'kbd.fix': '⌘ .',
} as const

export type MessageKey = keyof typeof ko

const en: Record<MessageKey, string> = {
  'app.tagline': 'Mermaid Studio',
  'app.untitled': 'Untitled diagram',

  'status.rendering': 'Rendering',
  'status.ok': 'Valid',
  'status.error': 'Error',
  'status.fixable': 'Auto-fixable',
  'status.loading': 'Loading engine',

  'toolbar.templates': 'Templates',
  'toolbar.share': 'Share',
  'toolbar.export': 'Export',
  'toolbar.settings': 'Settings',
  'toolbar.history': 'History',
  'toolbar.theme': 'Toggle theme',
  'toolbar.command': 'Commands',
  'toolbar.lang': '한국어',

  'pane.code': 'Code',
  'pane.preview': 'Preview',
  'pane.config': 'Config JSON',

  'editor.position': 'Ln {line}, Col {col}',
  'editor.saved': 'Autosaved',
  'editor.chars': '{n} chars',

  'preview.lastGood': 'Last valid render',
  'preview.broken.title': "Can't draw this yet",
  'preview.broken.body': 'Check the explanation next to the code, or let auto-fix handle it.',
  'preview.empty.title': 'Start drawing',
  'preview.empty.body': 'Type Mermaid code on the left and it renders instantly.',
  'preview.zoomIn': 'Zoom in',
  'preview.zoomOut': 'Zoom out',
  'preview.fit': 'Fit to screen',
  'preview.reset': '100%',
  'preview.fullscreen': 'Fullscreen',
  'preview.hint': 'Drag to pan · ⌘+scroll to zoom',
  'preview.clickToSource': 'Click a node to jump to its code',
  'preview.grid': 'Grid background',

  'error.where': 'line {line}, column {col}',
  'error.goto': 'Go to line',
  'error.fixCta': 'Auto-fix',
  'error.fixCount': 'Fix {n}',
  'error.fixing': 'Looking for a fix…',
  'error.noFix': "This one can't be fixed automatically. The explanation below should help.",
  'error.raw': 'Raw parser message',
  'error.expected': 'Allowed here',
  'error.partial': 'Partially fixable',
  'error.review': 'Review changes',

  'fix.title': 'Auto-fix preview',
  'fix.subtitle': 'Every change below was verified against the real Mermaid parser.',
  'fix.apply': 'Apply',
  'fix.applyAll': 'Apply all',
  'fix.cancel': 'Cancel',
  'fix.applied': 'Fixed {n} issue(s)',
  'fix.lossyWarn': 'This step comments out a line it could not repair. Please double-check it.',
  'fix.line': 'Line {line}',
  'fix.verified': 'Parser verified',
  'fix.stillBroken': 'Some errors remain',

  'fix.fences': 'Removed Markdown code fences (```)',
  'fix.invisible': 'Cleaned up invisible characters and odd spaces from copy-paste',
  'fix.typography': 'Replaced smart quotes, long dashes and arrow symbols (→) with Mermaid syntax',
  'fix.entities': 'Decoded HTML entities like &gt;',
  'fix.comments': 'Converted // and # comments to Mermaid comments (%%)',
  'fix.headerTypo': 'Fixed diagram type typo `{from}` → `{to}`',
  'fix.headerMissing': 'Added the missing `{type}` declaration',
  'fix.direction': 'Fixed direction `{from}` → `{to}`',
  'fix.quoteLabel': 'Wrapped labels containing special characters in quotes',
  'fix.subgraphTitle': 'Rewrote the subgraph title as id["title"]',
  'fix.arrow': 'Fixed the link syntax',
  'fix.reservedEnd': 'Renamed node `end` (a reserved word) to `End`',
  'fix.unclosed': 'Closed an unclosed bracket or quote',
  'fix.missingEnd': 'Added the missing `{closer}`',
  'fix.seqColon': 'Inserted the missing `:` before the message',
  'fix.erLabel': 'Added the required relationship label `: ""`',
  'fix.taskColon': 'Inserted `:` between the task name and its schedule',
  'fix.journeyScore': 'Added the required task score `: 3`',
  'fix.quadrantPoint': 'Wrapped the point coordinates as `[x, y]`',
  'fix.insertToken': 'Inserted the missing `{token}`',
  'fix.keywordTypo': 'Keyword typo `{from}` → `{to}`',
  'fix.spacedId': 'Turned `{phrase}` into id `{id}` and kept the text as its label',
  'fix.commentOut': 'Commented out a line that could not be repaired so the rest renders',
  'fix.fencesExtra': 'Removed the Markdown fences and kept the other diagram blocks as comments',
  'fix.reservedEndTo': 'Renamed node `end` (a reserved word) to `{to}`',
  'fix.seqSemicolon': 'Escaped `;` in message text as `#59;` so it does not end the statement',
  'fix.classGeneric': "Rewrote generics in Mermaid's `~T~` form instead of `<T>`",

  'explain.fence.title': 'Markdown code fence detected',
  'explain.fence.detail': 'The ```mermaid and ``` lines belong to Markdown, not to Mermaid syntax.',
  'explain.fence.hint': 'Keep only the code inside the fence — auto-fix can do it for you.',
  'explain.unknown.title': 'Unknown diagram type',
  'explain.unknown.detail': '`{word}` on the first line is not a known diagram declaration.',
  'explain.unknown.hint': 'Start with a declaration such as `flowchart TD`, `sequenceDiagram` or `classDiagram`.',
  'explain.unknown.typo': 'Did you mean `{guess}`?',
  'explain.empty.title': 'The code is empty',
  'explain.lexical.title': 'Unrecognized character',
  'explain.lexical.detail': 'The {char} at {where} is not allowed in this syntax.',
  'explain.lexical.hintArrow': 'Write arrows with plain hyphens, like `-->`.',
  'explain.lexical.hintInvisible': 'It is invisible — usually picked up when copying from docs or chat apps.',
  'explain.lexical.hintQuote': 'Use the plain keyboard `"` instead of curly quotes.',
  'explain.lexical.hintGeneric': 'Remove it, or put it inside a quoted label.',
  'explain.pieLabel.hint': 'Wrap pie labels in double quotes: `{example}`',
  'explain.direction.title': 'Unsupported direction `{dir}`',
  'explain.direction.detail': 'The direction after `graph`/`flowchart` must be `TD`, `TB`, `BT`, `LR` or `RL`.',
  'explain.direction.hint': 'e.g. `{fix}`',
  'explain.keyword.title': 'Unknown keyword `{word}`',
  'explain.keyword.detail': '`{word}` at {where} is not a keyword of this diagram, so it was read as something else.',
  'explain.label.title': 'Special character `{char}` inside a label',
  'explain.label.detail': 'Mermaid reads `(` `[` `{` as node shapes, so the label looks like it ended early.',
  'explain.label.hint': 'Wrap the whole label in double quotes: `A["Start (beta)"]`',
  'explain.label.hintQuote': 'Write inner quotes as `#quot;`: `A["say #quot;hi#quot;"]`',
  'explain.end.title': '`end` is a reserved word',
  'explain.end.detail': '`end` closes subgraphs and blocks, so it cannot be a node name.',
  'explain.end.hint': 'Rename it (`End`, `finish`) or use it as a label: `done["end"]`.',
  'explain.end.detailName': '`end` closes blocks, so it cannot be used as a name in any letter case.',
  'explain.end.hintRename': 'Rename it, e.g. `finish` or `done`.',
  'explain.endUnmatched.title': 'Unmatched `end`',
  'explain.endUnmatched.detail': 'There is no open block (`subgraph`, `loop`, `alt`, …) for this `end` to close.',
  'explain.endUnmatched.hint': 'Delete the extra `end`, or add the missing block opener above it.',
  'explain.eof.title': 'The code ends too early',
  'explain.eof.detail': 'The document ended while something was still open.',
  'explain.eof.hint': 'Close it with {closers}.',
  'explain.eof.incomplete': 'The document ended at {where} before the statement was complete.',
  'explain.link.title': 'Invalid link',
  'explain.link.detail': 'At {where} a link was expected after the node, but found {found}.',
  'explain.link.hint': 'Use `-->`, `---`, `-.->` or `==>`, and write names with spaces as `id["name"]`.',
  'explain.seqArrow.title': 'Invalid message arrow',
  'explain.seqArrow.detail': '`{found}` at {where} is not a sequence arrow.',
  'explain.seqArrow.hint': 'Use `->>` (solid), `-->>` (dotted), `->`, `-x` or `-)`, e.g. `Alice->>Bob: Hello`.',
  'explain.seqText.title': 'Missing `:` before the message',
  'explain.seqText.detail': 'Sequence messages look like `From->>To: text`.',
  'explain.seqText.hint': 'e.g. `Alice->>Bob: Hello`',
  'explain.erLabel.title': 'Relationship needs a label',
  'explain.erLabel.detail': 'In erDiagram every relationship ends with `: label`.',
  'explain.erLabel.hint': 'e.g. `CUSTOMER ||--o{ ORDER : places`',
  'explain.erAttr.title': 'Invalid attribute',
  'explain.erAttr.detail': 'Entity attributes are written as `type name`.',
  'explain.erAttr.hint': 'e.g. `string name`',
  'explain.task.title': 'Task details missing',
  'explain.task.detail': 'A task name needs `:` followed by its schedule.',
  'explain.task.hint': 'e.g. `Design : 2024-01-01, 3d`',
  'explain.journeyTask.detail': 'Journey tasks look like `Task: score (1-5): actors`.',
  'explain.journeyTask.hint': 'e.g. `Make tea: 5: Me`',
  'explain.token.title': '`{want}` expected here',
  'explain.token.detail': 'At {where} the parser expected `{want}` but found `{found}`.',
  'explain.token.detailNewline': 'At {where} the parser expected `{want}` but found a line break.',
  'explain.generic.title': 'Syntax error',
  'explain.generic.detail': 'Parsing stopped at {found} on {where}.',
  'explain.generic.hint': 'Allowed here: {expected}.',
  'explain.generic.hintOne': 'Expected here: {expected}.',
  'explain.other.title': 'Render error',
  'explain.found.end': 'end of document',
  'explain.found.newline': 'a line break',

  'char.dash': 'long dash (—)',
  'char.arrow': 'arrow symbol ({c})',
  'char.invisible': 'invisible character (U+{code})',
  'char.space': 'special space (U+{code})',
  'char.quote': 'curly quote ({c})',
  'char.generic': '`{c}` character',
  'char.text': '`{c}`',

  'tok.newline': 'line break',
  'tok.eof': 'end of document',
  'tok.space': 'space',
  'tok.nodeName': 'node name',
  'tok.text': 'text',
  'tok.string': '"string"',
  'tok.message': 'message text',
  'tok.taskData': 'schedule',
  'tok.name': 'name',
  'tok.member': 'member',
  'tok.description': 'description',
  'tok.edgeText': 'link text',
  'tok.number': 'number',

  'templates.title': 'Templates',
  'templates.subtitle': 'Click to load into the editor. Your current work is saved to history.',
  'templates.search': 'Search templates…',
  'templates.broken': 'Try auto-fix on a broken diagram',
  'templates.brokenDesc': 'A diagram with 5 mixed errors. Hit auto-fix.',

  'export.svg': 'Download SVG',
  'export.png': 'Download PNG',
  'export.png2x': 'Download PNG (2x)',
  'export.png4x': 'Download PNG (4x)',
  'export.copyPng': 'Copy image',
  'export.copySvg': 'Copy SVG code',
  'export.copyMd': 'Copy as Markdown',
  'export.mmd': 'Save .mmd file',
  'export.open': 'Open file',
  'export.transparent': 'Transparent background',
  'export.noDiagram': 'Nothing to export yet',
  'export.done': 'Saved',
  'export.copied': 'Copied to clipboard',
  'export.failed': 'Export failed',

  'share.copied': 'Share link copied',
  'share.desc': 'The whole diagram lives in the link. Nothing is stored on a server.',
  'share.loaded': 'Loaded from shared link',
  'share.liveCompat': 'mermaid.live links (#pako:) open here too',

  'settings.title': 'Diagram settings',
  'settings.theme': 'Diagram theme',
  'settings.theme.auto': 'Lagoon (follows app theme)',
  'settings.look': 'Look',
  'settings.look.classic': 'Classic',
  'settings.look.handDrawn': 'Hand-drawn',
  'settings.layout': 'Layout engine',
  'settings.layout.dagre': 'Dagre (default)',
  'settings.layout.elk': 'ELK (complex graphs)',
  'settings.curve': 'Curve',
  'settings.advanced': 'Advanced (JSON)',
  'settings.invalidJson': 'Invalid JSON',
  'settings.reset': 'Reset',

  'history.title': 'History',
  'history.empty': 'No versions yet. They pile up automatically as you edit.',
  'history.restore': 'Restore',
  'history.restored': 'Restored a previous version',
  'history.saveNow': 'Save this version',
  'history.saved': 'Version saved',
  'history.clear': 'Clear all',

  'palette.placeholder': 'Search commands…',
  'palette.empty': 'No matching commands',
  'cmd.fix': 'Auto-fix',
  'cmd.format': 'Tidy indentation',
  'cmd.newDoc': 'New diagram',
  'cmd.toggleTheme': 'Toggle light/dark',
  'cmd.toggleLang': '한국어로 전환',
  'cmd.fit': 'Fit preview to screen',
  'cmd.focusEditor': 'Focus editor',
  'cmd.layoutSwap': 'Swap panes',

  'toast.newDoc': 'Started a new diagram',
  'toast.fileLoaded': 'Loaded {name}',
  'drop.title': 'Drop to open',
  'drop.body': '.mmd · .md · .txt',

  'kbd.fix': '⌘ .',
}

export const DICTS: Record<Lang, Record<MessageKey, string>> = { ko, en }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lagoon:lang')
    if (saved === 'ko' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

let current: Lang = typeof window === 'undefined' ? 'ko' : initialLang()
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem('lagoon:lang', lang)
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = lang
  listeners.forEach((l) => l())
}

const PARTICLES: Record<string, [afterConsonant: string, afterVowel: string]> = {
  '이(가)': ['이', '가'], '은(는)': ['은', '는'], '을(를)': ['을', '를'], '과(와)': ['과', '와'],
}
// digits read 영 일 이 삼 사 오 육 칠 팔 구; these end in a consonant
const DIGITS_WITH_FINAL = '013678'

/** whether the reading of `word` ends in a consonant; null when it can't be read (code, Latin) */
function endsInConsonant(word: string): boolean | null {
  // the particle follows the reading before closing quotes/backticks and a trailing (gloss): 문자(U+200B)이(가) → 문자가
  const c = word.replace(/[`"'”’]+$/, '').replace(/\([^()]*\)$/, '').replace(/[`"'”’]+$/, '').slice(-1)
  const code = c.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  return /\d/.test(c) ? DIGITS_WITH_FINAL.includes(c) : null
}

/** resolves 이(가)-style particles for the word in front when it can be read, and keeps the 이(가) form otherwise */
function attachParticles(text: string): string {
  return text.replace(/이\(가\)|은\(는\)|을\(를\)|과\(와\)/g, (marker, offset: number) => {
    const consonant = endsInConsonant(text.slice(0, offset))
    return consonant === null ? marker : PARTICLES[marker][consonant ? 0 : 1]
  })
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const template = (DICTS[lang] as Record<string, string>)[key] ?? (DICTS.en as Record<string, string>)[key] ?? key
  const text = params ? template.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? String(params[name]) : m)) : template
  return lang === 'ko' ? attachParticles(text) : text
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(current, key, params)
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}
