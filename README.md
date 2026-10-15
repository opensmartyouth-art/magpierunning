# MAGPIE RUNNING

러닝크루 대회 사진 갤러리입니다. 이 레포에 사진을 올리면 1~2분 뒤 사이트가 자동으로 바뀝니다.

사이트: https://opensmartyouth-art.github.io/magpierunning/

## 폴더 구조

```
events/
  2026/                         ← 연도
    seoul-half-marathon/        ← 대회 (폴더 이름이 주소가 됩니다)
      event.md                  ← 이름·날짜·소개
      001.jpg, 002.jpg …        ← 그 대회의 사진들
  2025/
    …
```

사이트 메뉴의 연도는 `events/` 아래 연도 폴더에서 자동으로 만들어집니다. 새 연도 폴더를 만들면 메뉴에 생깁니다.

## 하는 일 (GitHub 웹에서)

| 하려는 일 | 방법 |
| --- | --- |
| 사진 올리기 | 대회 폴더로 들어가 Add file → Upload files 로 끌어다 놓고 Commit changes |
| 제목·날짜·소개 고치기 | 대회 폴더의 `event.md` 를 열고 연필 아이콘으로 고친 뒤 Commit changes |
| 새 대회 만들기 | 연도 폴더 안에서 Add file → Create new file, 이름에 `새대회이름/event.md` 라고 쓰면 폴더가 만들어집니다. 내용을 아래 형식으로 쓰고 Commit한 뒤, 그 폴더에 사진을 올립니다 |
| 사진 지우기 | 사진 파일을 열고 휴지통 아이콘 |

폴더 이름은 영문 소문자와 하이픈(`seoul-half-marathon`)을 권장합니다. 한글이나 공백이 있으면 주소가 길어집니다.

## event.md 형식

맨 위를 `---`로 감쌉니다.

```
---
title: Seoul Half Marathon 2026
date: 2026-10-04
summary: 소개 문장 (선택, 영어로 쓰면 사이트와 맞습니다)
link: View the Results | https://… (선택, 소개 아래 밑줄 링크 한 줄)
cover: 003.jpg (선택, 목록에 보일 대표 사진. 없으면 첫 사진)
---
```

- `date` 는 `YYYY-MM-DD` 이고, 연도가 폴더 연도와 같아야 합니다(`2026/` 폴더면 2026-…).
- 목록은 날짜가 최신인 대회가 앞에 옵니다.
- 사진은 파일 이름 순서대로 나옵니다(`001`, `002` … 처럼 번호를 붙이면 순서를 정하기 쉽습니다).

## 알아 두실 점

- 사진은 jpg, png, webp 만 됩니다. 아이폰 사진(HEIC)은 건너뜁니다. 아이폰이면 설정에서 형식을 "호환성 우선(JPEG)"으로 바꾸거나 JPEG로 내보내 올려 주세요.
- 웹에서 올릴 때는 파일당 25MB, 한 번에 100개까지입니다. 더 많으면 나눠서 올립니다.
- 이 레포는 공개라서 올린 원본 사진도 레포에서 누구나 볼 수 있습니다. 사이트에는 줄인 사진만 올라갑니다.
- 올린 뒤 반영 상태는 위쪽 Actions 탭에서 볼 수 있습니다. 초록 체크면 반영 완료, 빨간 X면 실패입니다. 실패하면 열어서 이유(예: date 형식, event.md 없음)를 읽을 수 있습니다.

## 로컬에서 확인

```
npm install
npm run build        # dist/ 에 사이트 생성
cd dist && python3 -m http.server 4173
```

`site/` 는 빌드 스크립트와 CSS(ALD 디자인 시스템 `ssxekun-designsystem`에서 가져온 값)입니다. 폰트는 ALD 서버에서 불러옵니다.
