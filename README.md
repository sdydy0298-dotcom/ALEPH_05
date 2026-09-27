# RATE FLOW v1.1.0

> T04 · 오늘의 진짜 정보판 — 데이터가 안 올 때

RATE FLOW는 비개인 공개 원천의 실제 환율 데이터를 조회해 현재 환율, 변화 추이, 빠른 환전 정보를 제공하고, 외부 데이터가 오지 않는 상황에서도 마지막 정상값과 상태를 명확하게 보여 주는 글로벌 환율 대시보드입니다.

## v1.1.0

T04 최종 제출용 첫 정식 버전입니다.

- USD / JPY / EUR / GBP 현재 환율 조회
- JPY는 `100 JPY` 기준으로 표시
- 7일 / 30일 실제 환율 추이 그래프
- KRW 포함 양방향 환전 계산
- `Asia/Seoul` 기준 실제 일별 snapshot 저장
- 메인 최근 3일 표시 + 전체 기록 모달, 최대 30일 snapshot 보존
- 같은 날짜 성공 조회는 한 일별 기록으로 갱신
- 서로 다른 실제 날짜 2건부터 저장값 기준 전일 변화량 / 변화율 계산
- 원천 URL, 원천 관측 시각, 조회 시각, 정규화 값, 단위, raw rate 보존
- 실패 시 마지막 정상값 유지 및 `STALE` 상태 표시
- 공식 T04 공개 fixture 9종 재생 및 복구 검증
- 공식 asset SHA-256 무결성 검증
- 실제 라이브 기록과 합성 fixture 평가 상태 분리

## 주요 기능

### 실제 환율 정보

공개 동적 데이터 원천을 사용해 다음 환율을 표시합니다.

- USD / KRW
- JPY / KRW (`100 JPY` 기준)
- EUR / KRW
- GBP / KRW

화면에는 환율 값과 함께 데이터 출처, 원천 관측 시각, 실제 조회 시각, 기준 시간대(`Asia/Seoul`)를 표시합니다.

### 환율 추이와 환전

- 선택 통화의 7일 / 30일 시장 추이
- KRW, USD, JPY, EUR, GBP 간 빠른 환전
- 자주 사용하는 외화 금액의 원화 환산

### 실제 일별 기록

정상 조회 결과는 `Asia/Seoul` 날짜를 기준으로 저장합니다.

- 같은 날짜의 반복 성공 조회: 기존 날짜 기록 갱신
- 다음 실제 날짜의 성공 조회: 새 일별 기록 생성
- 실제 날짜가 다른 기록 2건부터 저장된 두 값으로 전일 대비 변화 계산
- 일별 상세에서 원천 URL / 관측 시각 / 조회 시각 / 정규화 값 / 단위 / raw rate 확인
- 브라우저에는 최근 30일의 실제 일별 snapshot을 보존
- 메인 화면에는 최신 3일 기록만 표시해 화면이 길어지지 않도록 구성
- 4일 이상 기록이 쌓이면 `전체 기록 보기` 버튼으로 전체 기록 모달을 열어 확인
- 전체 기록 모달에서도 날짜별 원자료·저장값 상세를 펼쳐 확인 가능

합성 fixture의 D1/D2는 실제 날짜 기록을 대신하지 않습니다.

## 데이터 원천

| 용도 | 공개 원천 |
| --- | --- |
| 현재 환율 | `https://open.er-api.com/v6/latest/KRW` |
| 7일 / 30일 추이 | `https://api.frankfurter.dev/v2` |

브라우저에 비밀 API Key를 포함하지 않는 공개 원천만 사용합니다.

## 데이터 장애 대응

실제 데이터 조회에 실패하면 마지막 정상값을 지우지 않고 `STALE` 상태로 유지합니다. 실패 원인별로 설명과 다음 행동을 구분합니다.

- 느린 외부 응답 / timeout
- 외부 원천 401 거절
- 호출 제한 / 429
- 오프라인
- 응답 스키마 변경

## 공식 T04 Fixture Replay

공식 공개 fixture는 다음 경로에 포함되어 있습니다.

```text
assets/studio-task-assets/t04-real-information-board/
```

검증 도구는 아래 9개 fixture JSON을 직접 불러와 재생합니다.

```text
T04-NORMAL-D1-A
T04-NORMAL-D1-B
T04-NORMAL-D2
T04-TIMEOUT
T04-AUTH-401
T04-RATE-429
T04-OFFLINE
T04-SCHEMA-BREAK
T04-RECOVER-D2
```

정상 저장 흐름은 `100 → 105 → 120`입니다. D1-A와 D1-B는 같은 합성 날짜이므로 일별 행 1건을 유지하고, D2에서 다음 날짜 행 1건이 추가됩니다. 실패 fixture에서는 마지막 정상값을 유지하며 `stale / error_code`를 표시하고, Recover 후 `fresh / none`으로 복구합니다.

### Fixture 무결성 확인

브라우저 Web Crypto SHA-256으로 `asset-manifest.json`에 등록된 공식 파일을 확인합니다. 로컬에서는 아래 명령으로도 확인할 수 있습니다.

```bash
python tools/verify-official-assets.py
```

## 저장 데이터 분리

```text
실제 환율 snapshot
rateflow.dailySnapshots.v3

공식 fixture 평가 상태
rateflow.fixtureEvaluation.v1
```

Fixture `Reset`은 합성 평가 상태만 초기화하며 실제 환율 일별 기록에는 영향을 주지 않습니다.

## 프로젝트 구조

```text
RATE-FLOW/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ tools/
│  └─ verify-official-assets.py
└─ assets/
   └─ studio-task-assets/
      └─ t04-real-information-board/
         ├─ README.md
         ├─ public-contract.json
         ├─ criterion-registry.json
         ├─ asset-manifest.json
         ├─ fixture-manifest.json
         ├─ fixture.schema.json
         ├─ normalized-reading.schema.json
         ├─ reading-status.schema.json
         ├─ adapter-reset.example.js
         └─ fixtures/
```

## 실행 방법

공식 fixture 파일을 `fetch()`하므로 `file://`로 직접 열지 않고 웹 서버에서 실행합니다.

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`으로 접속합니다. Vercel에서는 저장소 루트를 정적 사이트로 배포하면 됩니다.

## T04 요구사항 대응

공식 공개 contract의 정본 registry는 `T04-C01`부터 `T04-C35`까지 35개 조건입니다. v1.1.0은 사이트에서 구현 가능한 실제 데이터 조회·정규화·일별 저장·장애 5종·마지막 정상값·STALE·복구·합성 fixture 분리 요구를 반영했습니다.

배포 후에는 별도로 다음 항목을 확인해야 합니다.

- 결과물과 소스 URL의 새 시크릿 창 공개 접근
- 서로 다른 실제 `Asia/Seoul` 날짜의 live 기록 2건 확보
- 두 실제 기록의 원천 정보 및 전일 변화값 대조
- 결과물 HTTPS URL 제출
- 40자리 또는 64자리 소문자 full commit 식별자가 포함된 HTTPS 소스 URL 제출
- 재현·통과 확인 4가지 작성
- AI와 내 판단 3줄 작성

## 보안 및 공개 원칙

- 실제 개인정보 및 개인 기록을 공개 화면/제출 파일에 사용하지 않음
- 실패 재생은 공식 합성 fixture만 사용
- 비밀키 원문을 브라우저 코드나 배포 파일에 저장하지 않음
- 결과물과 소스는 최종 제출 시 로그인·인증·초대·비밀번호·OAuth·CAPTCHA 없이 접근 가능해야 함

## Version

**RATE FLOW v1.1.0**
