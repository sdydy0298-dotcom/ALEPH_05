# T05 HANDOFF — AI A → AI B

## 1. 목표

여행 예산 환전 계산

기존 T04 환율 계산기에 국가·예산·환전 비율·수수료율을 입력하여 예상 외화 수령액을 계산하는 기능을 추가합니다. 공통 제한은 AI별 30분 / 요청 5회입니다. 상세 정의는 저장소의 `T05_EXPERIMENT_PLAN.md`를 따릅니다.

## 2. 현재 상태

| 구분 | 내용 |
| --- | --- |
| A 시작 Full Commit ID | `2b1612fa08ed60cd7d92174cd4fb3a3440c723fc` |
| A 종료 소스 Full Commit ID | `A_END_COMMIT_PENDING` |
| 소스 식별 | `evidence/AI_A_source_manifest.json`의 LF 정규화 SHA-256 |
| PLAN | 시작 원문 그대로; 변경 없음 |
| A 요청 | 1/5회; 엑셀의 A 1회차에 실제 원문 기록 |
| 최종 고정 검사 | 10/10 PASS (고정 환율, 오프라인 DOM) |
| AI B | 미실행 |

결과를 생성한 환경에서 사용자의 종료 커밋은 아직 생성되지 않았으므로 임의의 hash를 적지 않았습니다. 종료 버전이 미확정이면 **B로 넘기기 전** 산출물을 커밋하고 `python tools/finalize_handoff.py`로 채워야 합니다.

추가 영역은 `#travelPlanner`이며, 기존 빠른 환전과 입력값은 분리합니다. 환율만 기존 `state.krwBaseRates`에서 공유합니다. 새 외부 의존성은 없습니다.

| 파일 / 함수 | 역할 |
| --- | --- |
| `index.html` | `#travelPlanner` 영역 |
| `style.css` | `.planner-*` 반응형 스타일 |
| `script.js` | `parseTravelNumber`, `calculateTravelBudget`, `renderTravelPlanner`, `bindTravelPlanner` |
| `README.md` | v1.2.0 추가 내용을 상단에 기록, 기존 설명 보존 |
| `tools/test_t05.py` | PLAN 원문과 고정 검사 재현 |

## 3. 실행 명령

새 폴더에 저장소를 받은 뒤 루트에서 실행합니다. B 시작 시점의 실제 HEAD를 먼저 기록하세요.

```bash
git rev-parse HEAD
python -m http.server 8080
```

브라우저: `http://localhost:8080/#travelPlanner`

```bash
python -m pip install playwright
python -m playwright install chromium
python tools/test_t05.py --actor AI_B
python tools/verify-official-assets.py
```

A의 제한된 환경에서 사용한 명령:

```bash
python tools/test_t05.py --offline-dom --browser /usr/bin/chromium --actor AI_A
```

`evidence/t05-runs.json`에 결과를 덮어쓰지 않고 회차별로 추가합니다. B는 `--actor AI_B`로 자신의 결과를 구분하세요.

## 4. 통과 검사

최종 고정 검사 결과: **TEST-01~TEST-10, 10/10 PASS**.

| ID | 검사 | 실제 결과 |
| --- | --- | --- |
| TEST-01 | 여행 국가 선택 | PASS |
| TEST-02 | 정상 여행 예산 입력 | PASS |
| TEST-03 | 환전 예정 금액 계산 | PASS |
| TEST-04 | 예상 수수료 계산 | PASS |
| TEST-05 | 실제 환전 금액 계산 | PASS |
| TEST-06 | 예상 외화 수령액 계산 | PASS |
| TEST-07 | 국가 변경 | PASS |
| TEST-08 | 잘못된 여행 예산 | PASS |
| TEST-09 | 잘못된 환전 비율 | PASS |
| TEST-10 | 초기화 | PASS |

입력과 기대값은 PLAN 3번을 그대로 사용했습니다. 자세한 관측값은 `evidence/t05-runs.json`의 마지막 AI_A 회차에 있습니다. 수수료 범위, 모바일, 기존 환전·fixture 분리도 보조 검증했으며 고정 10개를 대체하지 않았습니다.

새 폴더 복사본에서도 같은 오프라인 DOM 모드로 10/10 PASS를 재확인했습니다.

## 5. 남은 문제

- 최종 고정 검사에서 재현된 미해결 기능 오류: 없음. 일부러 실패를 남기지 않았습니다.
- 실제 배포 URL·라이브 환율·실제 브라우저 저장 지속성: 미확인. A는 URL 접속이 차단된 환경에서 DOM·원본 JS를 고정 응답으로 검증했습니다.
- 정확한 채팅 전송/응답 전달 시각: 확인 불가. 도구 관측값과 그 한계를 엑셀 메모와 `T05_RESULT.md`에 기록했습니다. 추측하여 채우지 마세요.
- 이전 검사에서 초기화 순서 결함을 수정했습니다. FAIL이 확인된 부분 회차 1개와 결과 미확보 중단 1건을 함께 보존합니다. 오류 회차의 완전한 총합을 단정할 수 없습니다.
- 인수인계 누락 여부: A 자체 점검에서는 발견 없음; B 확인은 대기 중입니다.

## 6. 다음 행동

1. 담당자는 소스 커밋 후 `tools/finalize_handoff.py`로 종료 버전을 채우고 문서를 다시 커밋합니다.
2. B는 이전 채팅 없이 저장소와 이 문서만 보고 새 폴더에서 실행·고정 검사를 재현합니다. B의 실제 요청은 기존 엑셀의 B 행에 적고 갱신본을 돌려줍니다.
3. 실제 웹 서버·배포 환경에서 기능과 환율 연동을 확인하고, 문제가 발견될 때만 수정합니다. A가 10/10이어도 그대로 독립 검증하면 됩니다.
4. 누락이 없으면 '없음'을 기록하고, 있으면 A가 남긴 이 문서를 보존한 채 수정 전후를 별도로 남깁니다.
5. B 종료 후 `T05_RESULT.md`의 B 사실값을 채우고, 이름을 가린 비교와 학생의 판단을 완성합니다.

## 7. 건드리지 말 것

- `T05_EXPERIMENT_PLAN.md`의 고정 검사 10개, 입력·기대값, 시간/요청 상한.
- `assets/studio-task-assets/t04-real-information-board/`의 공식 fixture·계약·해시 파일.
- 실제 저장값과 합성 fixture의 분리, 기존 빠른 환전·일별 기록·모달 기능.
- A 요청 로그·이전 검사 회차·인수인계 원문. 수정이 필요하면 전후를 별도 보존합니다.
- 검사용 환율을 라이브값으로 표시하거나, 아직 실행하지 않은 B 결과를 채우지 마세요.
