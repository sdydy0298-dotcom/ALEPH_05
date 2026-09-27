# T05 작업 결과 — AI A

> AI A의 실제 작업 기록입니다. AI B와 최종 비교는 아직 실행하지 않았습니다.

## 1. 기준과 식별

| 항목 | AI A |
| --- | --- |
| 서비스 / 모델 | ChatGPT / GPT-6 Astra Pro (AI의 식별명; UI 모델 선택·백엔드 버전 ID는 독립 미확인) |
| 시작 Full Commit | `2b1612fa08ed60cd7d92174cd4fb3a3440c723fc` (첨부 ZIP의 .git HEAD와 일치 확인) |
| 종료 소스 Full Commit | `5cc2ac4e9a203c71cab049fa2d1f4e79dc8b2093` |
| 시간 / 요청 상한 | 30분 / 5회 |
| 실제 작업 요청 | 1회 (사전 준비 대화 제외) |
| 요청 원문 | `T05_AI_REQUEST_LOG_v1.0.0.xlsx`, AI A 1회차 |
| PLAN SHA-256 (LF) | `6ab8d5b4eeb7f4adabcf12b1ffe3ea7f79a14e8b805d1a7e4cc646750919e365` |
| 고정 검사 변경 | 0건; PLAN은 시작 커밋과 바이트기준 일치 |
| 소스 추가 / 삭제 행 | +542 / -0 (종료 커밋 확정 도구가 채움) |

담당자의 종료 커밋은 아직 생성되지 않았습니다. 파일 적용·커밋 후 `python tools/finalize_handoff.py`로 정확한 버전을 반영하세요. 행 수 비교는 HTML/CSS/JS와 새 Python 검사/인계 도구를 포함하며, 산출된 이미지·검사 결과·문서·Excel·lockfile은 제외합니다. 정확한 대상 경로는 `AI_A_source_manifest.json`에 남겼습니다.

## 2. 시간 측정과 한계

| 항목 | 기록 |
| --- | --- |
| 시작 직후 관측시각 | 2026-09-27 16:17:22 KST (web.time UTC+09:00) |
| 작업 종료 직전 관측시각 | 2026-09-27 16:32:24 KST (web.time UTC+09:00) |
| 두 관측값 사이 경과 | 15분 02초 (관측값 차이) |
| 정확한 요청 전송시각 | 제공되지 않아 미확인 |
| 정확한 최종 응답 전달시각 | 제공되지 않아 미확인 |

PLAN 5번은 요청 전달부터 결과 전달까지의 시간을 정의합니다. 그 기준은 수정하지 않았으며, 위 경과는 즉시 확인 가능한 도구 시각의 차이입니다. 정확한 채팅 전달 시각을 대신한다고 단정하지 않습니다. 채팅 시각을 추가로 확인할 수 있을 때만 근거와 함께 보완하세요.

## 3. 고정 검사 최종 결과

검사 입력·기대값은 PLAN의 원문을 그대로 가져왔습니다. 외부 환율은 고정 응답을 사용했으며, 실제 라이브 환율으로 표시하지 않습니다.

| ID | 검사 | 기대값 (원문) | 실제 관측 | 결과 |
| --- | --- | --- | --- | --- |
| TEST-01 | 여행 국가 선택 | 선택한 국가에 대응하는 통화와 환율이 적용된다. | JP/US/FR/DE/ES/GB mapped to JPY/USD/EUR/EUR/EUR/GBP with the matching fixed rates. | PASS |
| TEST-02 | 정상 여행 예산 입력 | 입력값이 정상적으로 인정되고 계산할 수 있다. | 111,209 JPY | PASS |
| TEST-03 | 환전 예정 금액 계산 | `1,050,000원` | 1,050,000 KRW | PASS |
| TEST-04 | 예상 수수료 계산 | `15,750원` | 15,750 KRW | PASS |
| TEST-05 | 실제 환전 금액 계산 | `1,034,250원` | 1,034,250 KRW | PASS |
| TEST-06 | 예상 외화 수령액 계산 | 약 `111,209 JPY` | 111,209 JPY (unrounded: 111209.67741935483) | PASS |
| TEST-07 | 국가 변경 | 변경한 국가의 통화와 환율로 다시 계산된다. | 111,209 JPY -> 738.75 USD | PASS |
| TEST-08 | 잘못된 여행 예산 | 정상 계산하지 않고 안내를 표시한다. | 0 / -1 / abc: error visible, all previous result amounts cleared. | PASS |
| TEST-09 | 잘못된 환전 비율 | 0~100% 범위를 벗어난 값을 정상 계산하지 않는다. | -1 / 101: error visible, all previous result amounts cleared. | PASS |
| TEST-10 | 초기화 | 입력값과 계산 결과가 초기 상태로 돌아간다. | Initial form state restored: ["JP", "", "70", "1.5"]; results cleared; no error. | PASS |

**최종: 10/10 PASS.** 검사용 환율: 100 JPY = 930 KRW, 1 USD = 1,400 KRW, 1 EUR = 1,600 KRW, 1 GBP = 1,900 KRW.

## 4. 오류 회차와 중단 기록

| 실행 | 사실 기록 | 판정 |
| --- | --- | --- |
| 첫 검사 도구 실행 | 90초 도구 실행 제한으로 중단. 출력 버퍼링으로 개별 검사 결과 미확보 | 결과 미확인; PASS/FAIL 임의 부여 안 함 |
| 다음 부분 회차 | TEST-03/05/07에서 초기화 결과 대기 시간 초과 FAIL. TEST-10 전에 실행 제한으로 중단. 6 PASS / 3 FAIL / 1 NOT_RUN | FAIL 확인 회차 1개 |
| 수정 후 완주 | TEST-01~10 전부 PASS | FAIL 회차 0개 |

발견한 결함은 `reset` 이벤트에서 `queueMicrotask`로 결과를 갱신하면 입력 초기화보다 앞서 실행될 수 있는 문제였습니다. 기본 reset 완료 뒤 렌더하도록 `setTimeout(..., 0)`로 수정했습니다. 고정 검사의 기대값은 수정하지 않았습니다.

확인된 FAIL 회차는 **1개**이지만 첫 중단 실행은 결과가 남지 않아 정확한 전체 오류 회차를 확정할 수 없습니다. 최종 비교에서도 '확인 1회 + 미확인 중단 1건'으로 한계를 함께 표기하세요. 마지막 PASS만 보고 오류 0회로 바꾸지 마세요.

추가로 새 폴더에 산출물을 복사하여 동일한 고정 검사 10개를 다시 실행했고 **10/10 PASS**를 확인했습니다. 이 회차도 `evidence/t05-runs.json`에 별도 보존했습니다. 실제 HTTP로 재현한 것은 아니며 같은 오프라인 DOM 환경입니다.

## 5. 보조 확인과 환경

| Check | Result |
| --- | --- |
| Fee invalid input and 0/100 boundaries | PASS |
| Budget malformed/overflow and ratio 0/100 boundaries | PASS |
| Original quick converter, swap and currency card | PASS |
| Original T04 browser asset integrity | PASS |
| T04 normal fixture sequence and reset isolation | PASS |
| Refresh failure keeps a labeled last-good planner rate | PASS |
| Responsive 1920/1366/768/390/320 and error-state screenshots | PASS |
| No uncaught browser JavaScript errors | PASS |

Browser: `Chromium 144.0.7559.96`; Python Playwright: `1.57.0`.

기존 T04 공식 asset 17개는 `tools/verify-official-assets.py`에서 원본 해시와 일치했습니다. 새 기능의 보조 검증은 고정 검사 10개의 수를 늘리거나 교체한 것이 아닙니다.

이 환경의 Chromium은 모든 URL 이동이 정책상 차단되어 있어, 정책를 바꾸지 않고 오프라인 DOM 검사를 사용했습니다. HTML/CSS/JS는 실제 산출물을 실행했고, 환경 어댑터로 fetch/localStorage/WebCrypto를 제공했습니다. 배포와 라이브 연동을 통과한 것으로 보면 안 됩니다.

스크린샷도 고정 환율 시험 화면입니다. 검사 모드를 일반 HTTP로 바꿔 실행할 수 있는 환경에서 B가 독립 재현해야 합니다.

## 6. AI B 기록

| 항목 | AI B |
| --- | --- |
| 서비스 / 모델 | Claude (Anthropic) / Claude Sonnet 5 (채팅 인터페이스 표시명; 백엔드 세부 버전 ID는 독립 미확인) |
| 시작 Full Commit | `1c3a36ec8ae242e454f7266fc22351101bfac41a` (A의 문서화 커밋; `git rev-parse HEAD`로 확인) |
| 종료 소스 Full Commit | A와 동일 `5cc2ac4e9a203c71cab049fa2d1f4e79dc8b2093` — 애플리케이션 소스(`index.html`/`script.js`/`style.css`) 변경 없음 |
| B 문서화/증적 커밋 | `58533c7b00f8b785daa082ca126d6b69c9911451` (README/T05_RESULT/xlsx/evidence만 반영; 애플리케이션 소스 포함 안 함) |
| 시간 / 요청 상한 | 30분 / 5회 (PLAN과 동일) |
| 실제 작업 요청 | 1회 (사전 준비 대화 제외) |
| 요청 원문 | `T05_AI_REQUEST_LOG_v1.0.0.xlsx`, AI B 1회차 |
| 소스 추가 / 삭제 행 (생성 파일 제외) | 0 / 0 |

### 인수인계 상태 확인

- `HANDOFF.md`의 7개 항목(목표/현재 상태/실행 명령/통과 검사/남은 문제/다음 행동/건드리지 말 것)을 모두 확인했습니다.
- `tools/finalize_handoff.py` 재실행 결과 `Handoff already has an A source commit. No files changed.` — 종료 소스 커밋은 이미 확정되어 있었습니다.
- `tools/verify-official-assets.py` 실행 → 공식 fixture/계약/해시 17개 전부 `OK`.
- 누락 발견: 없음.

### 남아 있는 문제 확인 및 조치

HANDOFF.md 5번 항목 중 "실제 배포 URL·라이브 환율·실제 브라우저 저장 지속성: 미확인" 부분을 이 환경에서 가능한 범위로 독립 재검증했습니다.

- A는 Chromium의 URL 이동이 차단된 환경이라 `--offline-dom`(메모리 내 DOM/저장소/응답 어댑터)으로만 검증했습니다.
- B의 환경은 실제 로컬 HTTP 서버(`python -m http.server`와 동일한 `http.server.ThreadingHTTPServer`)로 페이지를 서빙하고, 외부 API만 `page.route`로 고정 응답을 주는 방식으로 재현했습니다. 이 모드는 실제 DOM 내비게이션과 브라우저 네이티브 `localStorage`를 사용합니다(외부 인터넷 접근 자체는 이 환경에서도 차단되어 있어 실제 라이브 환율 원천 접속은 여전히 미확인입니다).
- 두 모드 모두에서 TEST-01~TEST-10과 보조 검증이 동일하게 전부 PASS했고, 재현되는 기능 결함은 없었습니다. 따라서 애플리케이션 소스는 수정하지 않았습니다(불필요한 변경 방지).
- 실제 공개 배포 URL 및 실제 라이브 환율 API 접속 확인은 이 환경의 네트워크 제한으로 여전히 미확인 상태이며, 추측으로 채우지 않습니다.

### 고정 검사 결과 — 오프라인 DOM 모드 (`--offline-dom --actor AI_B`)

| ID | 결과 | 관측 |
| --- | --- | --- |
| TEST-01 | PASS | JP/US/FR/DE/ES/GB → JPY/USD/EUR/EUR/EUR/GBP, 고정 환율 일치 |
| TEST-02 | PASS | 111,209 JPY |
| TEST-03 | PASS | 1,050,000 KRW |
| TEST-04 | PASS | 15,750 KRW |
| TEST-05 | PASS | 1,034,250 KRW |
| TEST-06 | PASS | 111,209 JPY (unrounded: 111209.67741935483) |
| TEST-07 | PASS | 111,209 JPY → 738.75 USD |
| TEST-08 | PASS | 0 / -1 / abc: 오류 표시, 이전 결과 모두 초기화 |
| TEST-09 | PASS | -1 / 101: 오류 표시, 이전 결과 모두 초기화 |
| TEST-10 | PASS | 초기 폼 상태 복원, 결과 비움, 오류 없음 |

**10/10 PASS.** 보조 검증 8건(수수료 경계, 예산/비율 경계, 기존 빠른 환전, T04 asset 무결성, T04 정상 fixture, 새로고침 실패 시 last-good 유지, 반응형 5종 + 오류 화면 스크린샷, 콘솔 오류 없음) 전부 PASS.

### 고정 검사 결과 — 실제 HTTP 서버 모드 (`--actor AI_B`, `--offline-dom` 미사용)

동일한 TEST-01~TEST-10 **10/10 PASS**. 보조 검증 7건(오프라인 전용 "새로고침 실패" 항목은 이 모드에서 정의상 미실행) 전부 PASS. 관측값은 오프라인 DOM 모드와 완전히 동일했습니다.

### 오류 회차

이번 회차(오프라인 DOM 1회 + 실제 HTTP 서버 1회, 각 10개 고정 검사 전량 실행)에서 FAIL 0건. A가 남긴 과거 오류 회차 기록(확인 1회 + 결과 미확보 중단 1건)은 수정하거나 대체하지 않고 4번 절에 그대로 보존합니다.

### 인수인계 누락 여부

B 자체 점검에서 누락 발견 없음.

## 7. 최종 비교 / 학생 판단 (B 종료 후)

| 항목 | AI A | AI B |
| --- | --- | --- |
| 시간 상한 | 30분 | 30분 |
| 요청 수 | 1회 | 1회 |
| 오류 회차 | 확인 1회 + 미확인 중단 1건 (수정 후 완주 0건) | 0건 |
| 소스 변경 (생성 파일 제외) | +542 / -0 | +0 / -0 |
| 고정 검사 통과 | 10/10 (오프라인 DOM) | 10/10 (오프라인 DOM) + 10/10 (실제 HTTP 서버, 독립 재현) |

이름을 가린 서비스·모델 비교, 개인정보·비밀값 검사, 공개 결과물 URL 확인, 학생 본인의 도구 선택 기준 문장은 T05_EXPERIMENT_PLAN.md 12번 항목에 따라 최종 제출 담당자가 마무리합니다. 이 문서를 최종 제출 완료로 표시하지 않습니다.
