# T05 작업 결과 — AI A

> AI A의 실제 작업 기록입니다. AI B와 최종 비교는 아직 실행하지 않았습니다.

## 1. 기준과 식별

| 항목 | AI A |
| --- | --- |
| 서비스 / 모델 | ChatGPT / GPT-6 Astra Pro (AI의 식별명; UI 모델 선택·백엔드 버전 ID는 독립 미확인) |
| 시작 Full Commit | `2b1612fa08ed60cd7d92174cd4fb3a3440c723fc` (첨부 ZIP의 .git HEAD와 일치 확인) |
| 종료 소스 Full Commit | `A_END_COMMIT_PENDING` |
| 시간 / 요청 상한 | 30분 / 5회 |
| 실제 작업 요청 | 1회 (사전 준비 대화 제외) |
| 요청 원문 | `T05_AI_REQUEST_LOG_v1.0.0.xlsx`, AI A 1회차 |
| PLAN SHA-256 (LF) | `6ab8d5b4eeb7f4adabcf12b1ffe3ea7f79a14e8b805d1a7e4cc646750919e365` |
| 고정 검사 변경 | 0건; PLAN은 시작 커밋과 바이트기준 일치 |
| 소스 추가 / 삭제 행 | +A_SOURCE_ADDED_PENDING / -A_SOURCE_DELETED_PENDING (종료 커밋 확정 도구가 채움) |

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

## 6. AI B 기록 (아직 미실행)

| 항목 | AI B |
| --- | --- |
| 서비스 / 모델 / 식별정보 | 미기록 |
| 시작 / 종료 버전 | 미기록 |
| 시간 / 요청 수 / 오류 회차 | 미기록 |
| 고정 검사 결과 | 미기록 |
| 인수인계 누락 여부 | 확인 대기 |

## 7. 최종 비교 / 학생 판단 (B 종료 후)

이름을 가린 비교는 아직 실행하지 않았습니다. 판정 구간에서는 서비스·모델명을 가리고 시간, 요청 수, 오류 회차, 소스 변경량, 검사 통과 수를 같은 기준으로 비교합니다.

다음 작업에서 도구를 고를 학생 본인의 기준 한 문장: **작성 대기**.

공개 결과물 URL, 고정 소스 URL, 재현 확인 4항목, AI/내 판단 3항목, 개인정보·비밀값 검사는 최종 제출 단계에서 마무리합니다. 이 문서를 최종 제출 완료로 표시하지 않습니다.
