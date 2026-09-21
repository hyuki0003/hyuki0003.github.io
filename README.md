# Dong-Hyuk Lee — Research Portfolio

아이보리 바탕, 차콜 타이포그래피, 세이지 포인트의 연구자 홈페이지입니다. ECG 모니터 테마 대신 편집 디자인을 사용했습니다. 연구 내용은 제공된 GitHub 프로필 README를 바탕으로 구성했습니다.

**완성된 HTML이 포함되어 있습니다. 사이트를 열거나 배포할 때 빌드·패키지 설치·서버는 필요하지 않습니다.**

## 1. 먼저 확인하기

압축을 푼 뒤 `index.html`을 브라우저로 여세요. `assets`와 `projects` 폴더를 같은 위치에 유지해야 합니다. 사이트는 외부 폰트, 라이브러리, CDN, API를 불러오지 않습니다.

- 메인: `index.html`
- 논문 목록: `publications.html`
- ICASSP 연구 상세: `projects/inter-dialog.html`
- ICEIC 연구 상세: `projects/balanced-rppg.html`

메인에는 연구 소개, 대표 연구 2편, 소식, 경력, 학력, 기술 스택, 연락처를 배치했습니다. 목록에는 국제 학회 2건, 국내 학회 5건, 진행 중 원고 3건, 학위논문 1건, 특허 출원 1건을 넣었습니다. **총 12개 기록이며, 이를 모두 게재 논문으로 표시하지 않습니다.**

다크 모드, 논문 검색·분류, 인용 대화상자, BibTeX 복사, 이메일 복사, 모바일 메뉴를 제공합니다. JS가 비활성화되어도 본문과 논문 목록은 읽을 수 있습니다. 클립보드 사용이 차단된 브라우저에서는 직접 선택하여 복사할 수 있도록 안내합니다.

## 2. GitHub Pages에 올리기

현재 파일은 로컬에서 제작된 것이며, GitHub 저장소 생성·업로드·공개 배포는 수행하지 않았습니다.

### 웹 화면에서 설정

1. GitHub에서 **`hyuki0003.github.io`** 저장소를 만드세요. GitHub Free라면 공개 저장소를 사용하세요. 기존에 같은 저장소가 있다면 덮어쓰기 전에 내용을 백업하세요.
2. 압축을 푼 폴더의 **내부 파일과 하위 폴더**를 저장소에 업로드하세요. `index.html`이 저장소 최상위에 있어야 합니다. ZIP 파일 자체를 올리는 것이 아닙니다.
3. `Settings → Pages → Build and deployment`로 이동하세요.
4. `Source`를 **Deploy from a branch**로 선택하세요.
5. `Branch`를 **main**, 폴더를 **/(root)**로 선택한 뒤 **Save**를 누르세요.
6. 배포가 끝나면 Pages 설정의 **Visit site**에서 확인하세요. 반영에는 시간이 걸릴 수 있습니다.

예정된 기본 주소는 `https://hyuki0003.github.io/`입니다. 실제 공개 여부는 배포 후 확인해야 합니다.

`.nojekyll`은 정적 파일을 그대로 배포하도록 포함한 숨김 파일입니다. 웹 업로드에서 이 파일이 빠졌다면 저장소 최상위에 `.nojekyll`이라는 빈 파일을 추가하세요. 별도 GitHub Actions 워크플로는 필요하지 않습니다.

### 터미널로 업로드하는 경우

아래는 **비어 있는 원격 저장소를 이미 생성한 경우**의 예시입니다. 기존 원격 커밋이 있다면 먼저 clone하여 작업하세요. 강제 push는 사용하지 마세요.

```bash
cd /path/to/hyuki0003.github.io

git init -b main
git add .
git commit -m "Create research portfolio"
git remote add origin https://github.com/hyuki0003/hyuki0003.github.io.git
git push -u origin main
```

GitHub 인증이 필요합니다. push 후 Pages의 `main / (root)` 설정을 확인하세요.

## 3. 내용 수정

대부분의 콘텐츠는 **`content/site.json`**에 모았습니다.

| 수정 대상 | 위치 |
|---|---|
| 소개·헤드라인·이메일·소셜 링크·날짜 | `profile` |
| 현재 연구 방향 | `research` |
| 논문·원고·학위논문·특허 | `publications` |
| 경력·학력 | `career`, `education` |
| 최근 소식 | `news` |
| 기술 스택 | `stack` |
| 배색·글자 크기·간격·반응형 레이아웃 | `assets/styles.css` |
| HTML 공통 헤더 메타데이터 | `templates/base.html` |
| 섹션 문구·고정 레이아웃·사이트 생성 로직 | `build.py` |

내용 파일을 수정했다면 사이트 폴더에서 실행하세요.

```bash
python3 build.py
```

생성기는 **Python 3.12 이상**을 권장하며 외부 패키지는 필요 없습니다. Python은 로컬 파일 재생성에만 쓰입니다. GitHub Pages 서버에서 Python을 실행하는 구조가 아닙니다. 생성된 `index.html`, `publications.html`, `projects/`, `assets/citations.js` 등을 함께 커밋해야 변경 내용이 반영됩니다.

생성 HTML을 직접 수정할 수도 있지만, 이후 `build.py`를 실행하면 직접 수정한 내용은 덮어써집니다.

### 논문 정보 관리

`category`는 아래 값 중 하나를 사용하세요.

| 값 | 표시 위치 |
|---|---|
| `international` | International conferences |
| `domestic` | Domestic conferences |
| `manuscript` | Ongoing manuscripts |
| `other` | Thesis & patent |

논문의 `id`는 소문자 영문·숫자·하이픈만 사용하고 서로 중복되지 않게 하세요. `authors`에는 실제 저자 순서를 입력하세요. 초안·심사 중 원고가 채택되면 `status`, `category`, `venue`, `citation_type` 등을 함께 검토하세요. 상태를 자동으로 갱신하지 않습니다.

실제 공개 URL이 생기면 `paper_url`, `code_url`에 HTTPS 주소를 넣으세요. 비어 있으면 버튼을 표시하지 않습니다. URL을 추가한 뒤 상세 페이지 하단의 서지정보 안내 문구도 필요에 맞게 조정하세요.

현재 대표 논문 2편의 `featured: true`와 `page: true`가 각각 메인 카드와 상세 페이지를 만듭니다. 새 상세 페이지를 추가할 때는 기존 항목의 `art`와 `context` 필드까지 복사한 뒤 실제 내용에 맞게 수정하세요. `context`는 공개할 수 있는 근거 있는 내용만 입력하세요.

`profile.site_url`을 바꾸면 canonical URL과 sitemap도 재생성됩니다. 이 패키지의 404 페이지는 계정 루트 사이트를 기준으로 `/index.html`에 연결됩니다. 저장소 하위 경로에 배포하는 프로젝트 사이트로 바꿀 때는 404 페이지의 절대 경로도 조정하세요.

## 4. 공개 전 확인할 원문 표기

제공된 README에 아래처럼 서로 다른 표기가 있습니다. 외부 검색으로 원고 상태나 투고지를 추정해 바꾸지 않았습니다.

- Journal Articles 표에는 **`IEEE ESWA`**, 2026.08 소식에는 **`EWSA`**라고 적혀 있습니다. 각 위치의 원문 표기를 그대로 유지했습니다. 실제 학술지 명칭을 확인해 `publications`와 `news`를 함께 정리하세요.
- Research Journey 표의 `TAFFC review`, `JBHI review` 표기와 Journal Articles 표 사이에도 차이가 있습니다. 원고 목록과 상태는 **Journal Articles 표**를 기준으로 했으며, Research Journey의 투고 상태 표시는 웹사이트에 중복해서 싣지 않았습니다.
- `In progress`와 `Under review`는 게재·채택 상태가 아닙니다. 별도 원고 그룹과 상태 배지로 구분했습니다.
- 특허는 **출원**으로 표시했습니다. 등록된 특허라고 표기하지 않았습니다.
- 원문에 없는 초록, 방법론 세부 내용, 실험 수치, DOI, 논문 PDF, 코드 저장소, 사진, CV는 만들거나 추정해 넣지 않았습니다.
- 상세 페이지의 그림은 **장식용 추상 도형**이며, 실제 모델 구조도나 실험 결과가 아닙니다.
- BibTeX는 제공된 제목·저자·연도·학회/기관명으로 구성한 기본 형식입니다. 최종 인용 시 공식 서지정보를 확인하세요. 원문의 `et al.`은 BibTeX의 `and others`로 옮겼습니다.

현재 이름·소속·날짜·이메일·소셜 주소 등은 제공된 README의 내용입니다. 이를 홈페이지에 공개할 의사가 있는지 배포 전에 확인하세요. 트래킹, 애널리틱스, 쿠키 배너, 연락처 수집 폼은 넣지 않았습니다. 다크 모드 선택만 브라우저의 localStorage에 저장합니다.

## 5. 디렉터리

```text
hyuki0003.github.io/
├── index.html
├── publications.html
├── projects/
│   ├── inter-dialog.html
│   └── balanced-rppg.html
├── assets/
│   ├── styles.css
│   ├── site.js
│   ├── citations.js
│   └── favicon.svg
├── content/
│   └── site.json
├── templates/
│   └── base.html
├── build.py
├── 404.html
├── .nojekyll
├── .gitignore
├── robots.txt
├── sitemap.xml
└── README.md
```

## 6. 제작 시 점검 범위

Chromium에서 로컬 CSS·JS를 직접 주입하여 320, 375, 390, 620, 768, 1024, 1440, 1920px 너비로 렌더링했습니다. 메인·목록·상세 2개 페이지의 가로 넘침, 논문 필터, 검색, 빈 결과 초기화, 다크 모드 전환, 모바일 메뉴, 인용 대화상자, Escape 닫기, JS 비활성화 본문 표시를 확인했습니다. 내부 파일 경로와 HTML ID도 점검했습니다.

제작 환경의 브라우저가 file/localhost 직접 탐색을 차단하므로, 실제 파일 탐색과 GitHub Pages 배포는 검증하지 않았습니다. 클립보드는 OS 권한에 의존하므로 복사 처리기에 전달되는 문자열을 모의 클립보드로 확인했습니다. 업로드 후 실제 브라우저의 탐색·클립보드 동작을 최종 확인하세요.

## GitHub 공식 배포 문서

2026-09-21에 확인한 공식 안내입니다.

- Creating a GitHub Pages site: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Configuring a publishing source: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
