const CURRENT_SOURCE_URL = "https://open.er-api.com/v6/latest/KRW";
const HISTORY_API_BASE = "https://api.frankfurter.dev/v2";
const STORAGE_KEY = "rateflow.dailySnapshots.v3";
const FIXTURE_STORAGE_KEY = "rateflow.fixtureEvaluation.v1";
const FIXTURE_ROOT = "assets/studio-task-assets/t04-real-information-board";
const TRACKED = ["USD", "JPY", "EUR", "GBP"];
const PRIMARY_SIGNAL = "JPY";

const CURRENCIES = {
  USD: { name: "미국 달러", symbol: "$", displayUnit: 1, quick: [10, 50, 100, 500], color: "#4f46e5" },
  JPY: { name: "일본 엔", symbol: "¥", displayUnit: 100, quick: [1000, 5000, 10000, 50000], color: "#0ea5e9" },
  EUR: { name: "유로", symbol: "€", displayUnit: 1, quick: [10, 50, 100, 500], color: "#8b5cf6" },
  GBP: { name: "영국 파운드", symbol: "£", displayUnit: 1, quick: [10, 50, 100, 500], color: "#ec4899" },
  KRW: { name: "대한민국 원", symbol: "₩", displayUnit: 1, quick: [10000, 50000, 100000, 500000], color: "#111827" }
};

const FIXTURE_FILES = {
  "T04-NORMAL-D1-A": "normal-d1-a.json",
  "T04-NORMAL-D1-B": "normal-d1-b.json",
  "T04-NORMAL-D2": "normal-d2.json",
  "T04-TIMEOUT": "timeout.json",
  "T04-AUTH-401": "auth-401.json",
  "T04-RATE-429": "rate-429.json",
  "T04-OFFLINE": "offline.json",
  "T04-SCHEMA-BREAK": "schema-break.json",
  "T04-RECOVER-D2": "recover-d2.json"
};

const ERROR_COPY = {
  timeout: { title: "응답 지연", message: "외부 원천의 응답 시간이 제한 시간을 초과했습니다.", action: "잠시 후 다시 시도해 주세요." },
  auth: { title: "접근 거부", message: "외부 원천이 401/403으로 요청을 거절했습니다.", action: "원천의 접근 정책을 확인한 뒤 다시 시도해 주세요." },
  rate_limit: { title: "호출 제한", message: "외부 원천의 호출 한도에 도달했습니다.", action: "호출 간격을 둔 뒤 다시 시도해 주세요." },
  offline: { title: "오프라인", message: "네트워크 연결이 끊겨 외부 원천에 접근할 수 없습니다.", action: "인터넷 연결을 확인한 뒤 다시 시도해 주세요." },
  schema_error: { title: "응답 형식 변경", message: "응답의 필수 필드 또는 타입이 예상 형식과 다릅니다.", action: "원천 스키마 변경 여부를 확인해 주세요." }
};

const state = {
  selected: "USD",
  rangeDays: 7,
  krwBaseRates: null,
  displayRates: null,
  sourceUrl: CURRENT_SOURCE_URL,
  observedAt: null,
  fetchedAt: null,
  history: [],
  status: "loading",
  lastGood: null,
  fixtureCache: new Map(),
  fixtureState: null
};

const el = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));

function kstParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date).reduce((acc, part) => (acc[part.type] = part.value, acc), {});
}

function kstDateKey(date = new Date()) {
  const p = kstParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function formatKstDate(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short"
  }).format(date);
}

function formatKstDateTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date) + " KST";
}

function formatKRW(value, digits = 2) {
  return Number.isFinite(value)
    ? `₩${value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
    : "—";
}

function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency", currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2
  }).format(value);
}

function toRfc3339FromUnix(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function getSnapshots() {
  try {
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function putSnapshots(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-30)));
}

function buildSnapshot() {
  const values = {};
  TRACKED.forEach((code) => {
    values[code] = {
      normalizedValue: Number(state.displayRates[code]),
      unit: `KRW / ${CURRENCIES[code].displayUnit} ${code}`,
      rawRate: Number(state.krwBaseRates[code])
    };
  });

  const primary = values[PRIMARY_SIGNAL];
  return {
    signalId: `${PRIMARY_SIGNAL.toLowerCase()}-${CURRENCIES[PRIMARY_SIGNAL].displayUnit}-krw`,
    date: kstDateKey(new Date(state.fetchedAt)),
    sourceUrl: state.sourceUrl,
    observedAt: state.observedAt,
    fetchedAt: state.fetchedAt,
    timezone: "Asia/Seoul",
    normalizedValue: primary.normalizedValue,
    unit: primary.unit,
    rawRate: primary.rawRate,
    values
  };
}

function saveDailySnapshot() {
  if (!state.displayRates || state.status !== "fresh") return;
  const rows = getSnapshots();
  const snapshot = buildSnapshot();
  const idx = rows.findIndex((row) => row.signalId === snapshot.signalId && row.date === snapshot.date);
  if (idx >= 0) rows[idx] = snapshot;
  else rows.push(snapshot);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  putSnapshots(rows);
  renderSnapshots();
}

function realSnapshots() {
  return getSnapshots().sort((a, b) => a.date.localeCompare(b.date));
}

function changeFromRealSnapshots(code) {
  const rows = realSnapshots();
  if (rows.length < 2) return null;
  const prevRow = rows.at(-2);
  const currRow = rows.at(-1);
  const prev = prevRow.values?.[code]?.normalizedValue;
  const curr = currRow.values?.[code]?.normalizedValue;
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return null;
  const diff = curr - prev;
  return {
    prev, curr, diff,
    pct: prev ? (diff / prev) * 100 : 0,
    prevDate: prevRow.date,
    currDate: currRow.date
  };
}

function recordDetail(row) {
  const primary = row.values?.[PRIMARY_SIGNAL] || {};
  return `
    <div class="record-detail">
      <b>제출 검증 기준 ${PRIMARY_SIGNAL}</b><br>
      원천 URL: ${row.sourceUrl || "—"}<br>
      원천 관측 시각: ${row.observedAt || "—"}<br>
      조회 시각: ${row.fetchedAt || "—"}<br>
      기준 시간대: ${row.timezone || "—"}<br>
      정규화 값: ${Number.isFinite(row.normalizedValue) ? row.normalizedValue : primary.normalizedValue ?? "—"}<br>
      단위: ${row.unit || primary.unit || "—"}<br>
      원자료 rate: ${Number.isFinite(row.rawRate) ? row.rawRate : primary.rawRate ?? "—"}
    </div>`;
}

function snapshotRowMarkup(row, modal = false) {
  return `
    <div class="record-row-wrap${modal ? " modal-record" : ""}">
      <div class="record-row">
        <span class="record-date">${row.date.replaceAll("-", ".")}</span>
        ${TRACKED.map((code) => `<span class="record-value"><small>${code}</small><strong>${formatKRW(row.values?.[code]?.normalizedValue, 2)}</strong></span>`).join("")}
      </div>
      <details>
        <summary>원자료 · 저장값 상세 보기</summary>
        ${recordDetail(row)}
      </details>
    </div>`;
}

function renderHistoryModal(rows = realSnapshots().slice().reverse()) {
  const list = el("historyModalList");
  if (!list) return;
  list.innerHTML = rows.length
    ? rows.map((row) => snapshotRowMarkup(row, true)).join("")
    : '<div class="empty-state">저장된 실제 일별 기록이 없습니다.</div>';
}

function openHistoryModal() {
  const modal = el("historyModal");
  if (!modal) return;
  renderHistoryModal();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  el("closeHistoryBtn")?.focus();
}

function closeHistoryModal() {
  const modal = el("historyModal");
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  el("openHistoryBtn")?.focus();
}

function renderSnapshots() {
  const rows = realSnapshots().slice().reverse();
  el("snapshotCount").textContent = `${rows.length}일`;

  if (!rows.length) {
    el("recordsList").innerHTML = '<div class="empty-state">정상 조회가 완료되면 오늘 기록이 저장됩니다.</div>';
    el("recordsFooter").hidden = true;
    el("snapshotCompare").innerHTML = '<div><span>비교 상태</span><strong>첫 실제 기록을 기다리는 중</strong><small>서로 다른 KST 날짜의 실제 조회 2건이 필요합니다.</small></div>';
    renderHistoryModal(rows);
    return;
  }

  const visibleRows = rows.slice(0, 3);
  el("recordsList").innerHTML = visibleRows.map((row) => snapshotRowMarkup(row)).join("");
  el("recordsFooter").hidden = false;
  el("recordsSummary").textContent = rows.length > 3
    ? `최근 3일 표시 · 이전 ${rows.length - 3}일은 전체 기록에서 확인`
    : `최근 ${rows.length}일 기록 표시`;
  el("openHistoryBtn").textContent = `전체 기록 보기 (${rows.length}일)`;
  renderHistoryModal(rows);

  const change = changeFromRealSnapshots(state.selected);
  if (change) {
    const arrow = change.diff > 0 ? "▲" : change.diff < 0 ? "▼" : "—";
    el("snapshotCompare").innerHTML = `<div><span>${state.selected} 실제 일별 기록 비교</span><strong>${change.prevDate} → ${change.currDate} · ${arrow} ${formatKRW(Math.abs(change.diff), 2)} (${Math.abs(change.pct).toFixed(2)}%)</strong><small>화면 변화값은 저장된 두 실제 KST 기록으로 다시 계산됩니다.</small></div>`;
  } else {
    el("snapshotCompare").innerHTML = `<div><span>${state.selected} 비교 상태</span><strong>${rows[0].date} · 첫 기록 저장 완료</strong><small>다른 실제 KST 날짜에 한 번 더 정상 조회하면 변화값이 계산됩니다.</small></div>`;
  }
}

function deriveDisplayRates(krwRates) {
  const out = {};
  for (const code of TRACKED) {
    const rate = Number(krwRates[code]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("SCHEMA");
    out[code] = (1 / rate) * CURRENCIES[code].displayUnit;
  }
  return out;
}

async function fetchCurrentRates() {
  const res = await fetch(CURRENT_SOURCE_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = await res.json();
  if (!data || data.result !== "success" || data.base_code !== "KRW" || !data.rates) throw new Error("SCHEMA");

  const rates = {};
  TRACKED.forEach((code) => rates[code] = Number(data.rates[code]));
  if (TRACKED.some((code) => !Number.isFinite(rates[code]) || rates[code] <= 0)) throw new Error("SCHEMA");

  const observedAt = Number.isFinite(data.time_last_update_unix)
    ? toRfc3339FromUnix(data.time_last_update_unix)
    : null;
  if (!observedAt) throw new Error("SCHEMA");

  return { krwRates: rates, observedAt, sourceUrl: CURRENT_SOURCE_URL };
}

function isoDateNDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function fetchHistory(code, days) {
  const from = isoDateNDaysAgo(days + 8);
  const res = await fetch(`${HISTORY_API_BASE}/rates?base=${code}&quotes=KRW&from=${from}`, {
    headers: { Accept: "application/json" }, cache: "no-store"
  });
  if (!res.ok) throw new Error(`HISTORY_${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("HISTORY_SCHEMA");

  const parsed = rows
    .filter((row) => row?.base === code && row?.quote === "KRW" && Number.isFinite(row.rate) && row.date)
    .map((row) => ({ date: row.date, value: row.rate * CURRENCIES[code].displayUnit }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!parsed.length) throw new Error("HISTORY_EMPTY");
  return parsed.slice(-days);
}

function liveErrorInfo(error) {
  const msg = String(error?.message || "");
  if (msg === "SCHEMA") return { code: "schema_error", ...ERROR_COPY.schema_error };
  if (msg === "HTTP_401" || msg === "HTTP_403") return { code: "auth", ...ERROR_COPY.auth };
  if (msg === "HTTP_429") return { code: "rate_limit", ...ERROR_COPY.rate_limit };
  return { code: "network_error", title: "데이터 조회 실패", message: "현재 환율 데이터를 가져오지 못했습니다.", action: "네트워크와 원천 상태를 확인한 뒤 다시 시도해 주세요." };
}

function setStatus(status, info = null) {
  state.status = status;
  const fresh = status === "fresh";
  const stale = status === "stale";
  el("globalStatus").dataset.state = fresh ? "fresh" : stale ? "stale" : "loading";
  el("globalStatusText").textContent = fresh ? "최신 데이터" : stale ? "마지막 정상값" : "데이터 불러오는 중";
  el("dataStateBadge").className = `state-badge ${fresh ? "fresh" : stale ? "stale" : "loading"}`;
  el("dataStateBadge").textContent = fresh ? "FRESH" : stale ? "STALE" : "LOADING";
  el("errorCode").textContent = info?.code || "none";
  el("sourceMessage").textContent = fresh
    ? "정상 조회 완료 · 화면값과 일별 저장값은 같은 정규화 값을 사용합니다."
    : stale
      ? `${info.title} · ${info.message} ${info.action} 마지막 정상값을 계속 표시합니다.`
      : "환율 데이터를 불러오고 있습니다.";
}

function baseToKRW(code) {
  if (code === "KRW") return 1;
  if (!state.krwBaseRates?.[code]) return null;
  return 1 / state.krwBaseRates[code];
}

function convert(amount, from, to) {
  const fromKRW = baseToKRW(from);
  const toKRW = baseToKRW(to);
  return Number.isFinite(amount) && fromKRW && toKRW ? amount * fromKRW / toKRW : null;
}

function renderConverter() {
  if (!state.krwBaseRates) return;
  const from = el("fromCurrency").value;
  const to = el("toCurrency").value;
  const amount = Number(el("fromAmount").value || 0);
  const result = convert(amount, from, to);
  const one = convert(1, from, to);
  el("toAmount").textContent = result === null ? "—" : formatMoney(result, to);
  el("appliedRate").textContent = Number.isFinite(one)
    ? `1 ${from} = ${one.toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${to} · 현재 공개 원천 기준 · 수수료/스프레드 미포함`
    : "환율 데이터를 기다리는 중입니다.";
}

function renderTravelGuide() {
  if (!state.krwBaseRates) return;
  let code = el("toCurrency").value;
  if (code === "KRW") code = el("fromCurrency").value;
  if (!CURRENCIES[code] || code === "KRW") code = state.selected;
  const info = CURRENCIES[code];
  el("guideSymbol").textContent = info.symbol;
  el("guideTitle").textContent = `${info.name} 빠른 금액표`;
  el("quickMoneyGrid").innerHTML = info.quick.map((value) => `
    <div class="quick-money-item"><strong>${formatMoney(value, code)}</strong><span>≈ ${formatMoney(convert(value, code, "KRW"), "KRW")}</span></div>`).join("");
}

function renderChange(code) {
  const node = el(`change-${code}`);
  const change = changeFromRealSnapshots(code);
  if (!change) {
    node.className = "rate-change neutral";
    node.textContent = realSnapshots().length ? "다음 실제 날짜 기록 필요" : "첫 실제 기록 대기";
    return;
  }
  const cls = change.diff > 0 ? "up" : change.diff < 0 ? "down" : "neutral";
  const arrow = change.diff > 0 ? "▲" : change.diff < 0 ? "▼" : "—";
  node.className = `rate-change ${cls}`;
  node.textContent = `${arrow} ${formatKRW(Math.abs(change.diff), 2)} · ${Math.abs(change.pct).toFixed(2)}%`;
}

function renderSelected() {
  const code = state.selected;
  const info = CURRENCIES[code];
  const change = changeFromRealSnapshots(code);
  el("trendTitle").textContent = `${code} / KRW`;
  el("trendSubtitle").textContent = `${info.name} · ${info.displayUnit} ${code} 기준`;
  el("selectedRate").textContent = state.displayRates
    ? `${info.symbol}${info.displayUnit.toLocaleString("ko-KR")} = ${formatKRW(state.displayRates[code], 2)}`
    : "—";

  if (change) {
    const arrow = change.diff > 0 ? "▲" : change.diff < 0 ? "▼" : "—";
    el("selectedChange").textContent = `${arrow} ${formatKRW(Math.abs(change.diff), 2)} (${Math.abs(change.pct).toFixed(2)}%)`;
    el("selectedChangeHint").textContent = `${change.prevDate} → ${change.currDate}`;
  } else {
    el("selectedChange").textContent = "비교 기록 1일 더 필요";
    el("selectedChangeHint").textContent = "실제 KST 일별 기록 기준";
  }

  el("sourceObservedAtShort").textContent = state.observedAt
    ? new Date(state.observedAt).toISOString().replace("T", " ").slice(0, 16) + "Z"
    : "—";
  document.documentElement.style.setProperty("--chart-color", info.color);
}

function renderRates() {
  if (!state.displayRates) return;
  TRACKED.forEach((code) => {
    el(`rate-${code}`).textContent = formatKRW(state.displayRates[code], 2);
    renderChange(code);
  });
  el("heroJpy").textContent = formatKRW(state.displayRates.JPY, 2);
  renderSelected();
  renderConverter();
  renderTravelGuide();
  renderSnapshots();
}

function renderMeta() {
  el("sourceUrl").textContent = state.sourceUrl || "—";
  el("sourceObservedAt").textContent = state.observedAt
    ? `${state.observedAt} · ${formatKstDateTime(new Date(state.observedAt))}`
    : "—";
  el("fetchedAt").textContent = state.fetchedAt
    ? `${state.fetchedAt} · ${formatKstDateTime(new Date(state.fetchedAt))}`
    : "—";
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function renderChart() {
  const svg = el("rateChart");
  svg.innerHTML = "";
  const data = state.history;
  if (!data.length) return;

  const W = 800, H = 300, margin = { top: 24, right: 20, bottom: 38, left: 72 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;
  const values = data.map((d) => d.value);
  let min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, max * 0.0025, 0.2);
  min -= pad; max += pad;

  const x = (i) => margin.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (value) => margin.top + ((max - value) / (max - min)) * innerH;

  const defs = svgEl("defs");
  const gradient = svgEl("linearGradient", { id: "chartAreaGradient", x1: "0", y1: "0", x2: "0", y2: "1" });
  gradient.append(
    svgEl("stop", { offset: "0%", "stop-color": CURRENCIES[state.selected].color, "stop-opacity": ".22" }),
    svgEl("stop", { offset: "100%", "stop-color": CURRENCIES[state.selected].color, "stop-opacity": "0" })
  );
  defs.append(gradient); svg.append(defs);

  for (let i = 0; i < 4; i++) {
    const gy = margin.top + (i / 3) * innerH;
    const value = max - (i / 3) * (max - min);
    svg.append(svgEl("line", { x1: margin.left, y1: gy, x2: W - margin.right, y2: gy, class: "chart-grid-line" }));
    const label = svgEl("text", { x: margin.left - 12, y: gy + 3, "text-anchor": "end", class: "chart-label" });
    label.textContent = `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}`;
    svg.append(label);
  }

  const points = data.map((item, i) => [x(i), y(item.value)]);
  const line = points.map((point, i) => `${i ? "L" : "M"}${point[0]},${point[1]}`).join(" ");
  const area = `${line} L${points.at(-1)[0]},${margin.top + innerH} L${points[0][0]},${margin.top + innerH} Z`;
  svg.append(svgEl("path", { d: area, class: "chart-area" }), svgEl("path", { d: line, class: "chart-path" }));

  const labelIndexes = new Set([0, data.length - 1, Math.floor((data.length - 1) / 2)]);
  data.forEach((item, i) => {
    if (labelIndexes.has(i)) {
      const label = svgEl("text", { x: x(i), y: H - 11, "text-anchor": i === 0 ? "start" : i === data.length - 1 ? "end" : "middle", class: "chart-label" });
      label.textContent = item.date.slice(5).replace("-", ".");
      svg.append(label);
    }
    svg.append(svgEl("circle", { cx: x(i), cy: y(item.value), r: data.length > 10 ? 2.5 : 4, class: "chart-dot" }));
    svg.append(svgEl("circle", { cx: x(i), cy: y(item.value), r: 14, class: "chart-hit", "data-index": i }));
  });

  svg.querySelectorAll(".chart-hit").forEach((hit) => {
    const show = (event) => {
      const i = Number(event.currentTarget.dataset.index);
      const item = data[i];
      const wrapBox = el("chartWrap").getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      const tip = el("chartTooltip");
      tip.innerHTML = `${item.date}<strong>${formatKRW(item.value, 2)}</strong>`;
      tip.style.left = `${x(i) / W * svgBox.width + svgBox.left - wrapBox.left}px`;
      tip.style.top = `${y(item.value) / H * svgBox.height + svgBox.top - wrapBox.top}px`;
      tip.hidden = false;
    };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("mousemove", show);
    hit.addEventListener("mouseleave", () => el("chartTooltip").hidden = true);
  });
}

async function loadHistory() {
  el("chartLoading").style.display = "grid";
  try {
    state.history = await fetchHistory(state.selected, state.rangeDays);
    renderChart();
    if (state.lastGood) {
      state.lastGood.historyByCurrency ??= {};
      state.lastGood.historyByCurrency[state.selected] ??= {};
      state.lastGood.historyByCurrency[state.selected][state.rangeDays] = clone(state.history);
    }
  } catch {
    const cached = state.lastGood?.historyByCurrency?.[state.selected]?.[state.rangeDays];
    state.history = cached ? clone(cached) : [];
    renderChart();
  } finally {
    el("chartLoading").style.display = "none";
  }
}

function storeLastGood() {
  const old = state.lastGood || {};
  state.lastGood = {
    krwBaseRates: { ...state.krwBaseRates },
    displayRates: { ...state.displayRates },
    sourceUrl: state.sourceUrl,
    observedAt: state.observedAt,
    fetchedAt: state.fetchedAt,
    historyByCurrency: old.historyByCurrency || {}
  };
}

function restoreLastGood() {
  if (!state.lastGood) return false;
  Object.assign(state, {
    krwBaseRates: { ...state.lastGood.krwBaseRates },
    displayRates: { ...state.lastGood.displayRates },
    sourceUrl: state.lastGood.sourceUrl,
    observedAt: state.lastGood.observedAt,
    fetchedAt: state.lastGood.fetchedAt
  });
  const history = state.lastGood.historyByCurrency?.[state.selected]?.[state.rangeDays];
  if (history) state.history = clone(history);
  return true;
}

async function refreshAll() {
  el("refreshBtn").classList.add("spinning");
  setStatus("loading");
  try {
    const current = await fetchCurrentRates();
    state.krwBaseRates = current.krwRates;
    state.displayRates = deriveDisplayRates(current.krwRates);
    state.sourceUrl = current.sourceUrl;
    state.observedAt = current.observedAt;
    state.fetchedAt = new Date().toISOString();
    setStatus("fresh");
    renderRates();
    renderMeta();
    saveDailySnapshot();
    storeLastGood();
    await loadHistory();
  } catch (error) {
    const info = liveErrorInfo(error);
    const restored = restoreLastGood();
    setStatus("stale", info);
    if (restored) {
      renderRates(); renderMeta(); renderChart();
    }
  } finally {
    el("refreshBtn").classList.remove("spinning");
  }
}

/* ---------- Official T04 deterministic replay ---------- */
function resetFixtureState() {
  return {
    schema_version: "aleph-t04-evaluation-state-v1",
    daily_readings: [],
    current_reading: null,
    status: null,
    last_delta: null,
    last_comparison: { state: "insufficient", direction: null, magnitude: null, unit: null },
    last_run: null,
    sequence: 0
  };
}

function loadFixtureState() {
  try {
    const saved = JSON.parse(localStorage.getItem(FIXTURE_STORAGE_KEY) || "null");
    return saved && Array.isArray(saved.daily_readings) ? saved : resetFixtureState();
  } catch {
    return resetFixtureState();
  }
}

function persistFixtureState() {
  localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(state.fixtureState));
}

function validateNormalizedReading(reading) {
  const required = ["signal_id", "normalized_value", "unit", "source_name", "source_url", "source_time", "fetched_at", "record_timezone", "record_date"];
  if (!reading || typeof reading !== "object" || Array.isArray(reading)) throw new Error("schema_error");
  const keys = Object.keys(reading).sort();
  const expected = [...required].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) throw new Error("schema_error");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(reading.signal_id)) throw new Error("schema_error");
  if (typeof reading.normalized_value !== "number" || !Number.isFinite(reading.normalized_value)) throw new Error("schema_error");
  if (typeof reading.unit !== "string" || !reading.unit.trim()) throw new Error("schema_error");
  if (typeof reading.source_name !== "string" || !reading.source_name.trim()) throw new Error("schema_error");
  try { if (new URL(reading.source_url).protocol !== "https:") throw new Error(); } catch { throw new Error("schema_error"); }
  if (reading.source_time !== null && Number.isNaN(new Date(reading.source_time).getTime())) throw new Error("schema_error");
  if (Number.isNaN(new Date(reading.fetched_at).getTime())) throw new Error("schema_error");
  if (reading.record_timezone !== "Asia/Seoul") throw new Error("schema_error");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reading.record_date)) throw new Error("schema_error");
  return true;
}

function fixtureRecordId(reading) {
  return `demo-${reading.signal_id}-${reading.record_date}`;
}

function fixtureComparison(rows, current) {
  const previous = rows
    .filter((row) => row.signal_id === current.signal_id && row.record_date < current.record_date)
    .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];
  if (!previous) return { state: "insufficient", direction: null, magnitude: null, unit: null };
  if (previous.unit !== current.unit) return { state: "unit_mismatch", direction: null, magnitude: null, unit: null };
  const signed = current.normalized_value - previous.normalized_value;
  return {
    state: "comparable",
    direction: signed > 0 ? "increase" : signed < 0 ? "decrease" : "unchanged",
    magnitude: Math.abs(signed),
    unit: current.unit
  };
}

function applyFixtureSuccess(fixture) {
  const reading = clone(fixture.payload);
  validateNormalizedReading(reading);
  const s = clone(state.fixtureState);
  const idx = s.daily_readings.findIndex((row) => row.signal_id === reading.signal_id && row.record_date === reading.record_date);
  const existing = idx >= 0 ? s.daily_readings[idx] : null;
  const row = {
    record_id: existing ? existing.record_id : fixtureRecordId(reading),
    signal_id: reading.signal_id,
    record_date: reading.record_date,
    normalized_value: reading.normalized_value,
    unit: reading.unit,
    first_fetched_at: existing ? existing.first_fetched_at : reading.fetched_at,
    last_fetched_at: reading.fetched_at,
    reading
  };
  if (idx >= 0) s.daily_readings[idx] = row;
  else s.daily_readings.push(row);
  s.daily_readings.sort((a, b) => a.record_date.localeCompare(b.record_date));
  s.current_reading = reading;
  s.status = { freshness: "fresh", error_code: "none" };
  s.last_comparison = fixtureComparison(s.daily_readings, row);
  s.last_delta = s.last_comparison.magnitude;
  s.sequence += 1;
  s.last_run = { fixture_id: fixture.fixture_id, virtual_now: fixture.virtual_now, outcome: "success", error_code: "none" };
  state.fixtureState = s;
}

function applyFixtureError(fixture, errorCode) {
  const s = clone(state.fixtureState);
  s.status = { freshness: "stale", error_code: errorCode };
  s.sequence += 1;
  s.last_run = {
    fixture_id: fixture.fixture_id,
    virtual_now: fixture.virtual_now,
    outcome: "error",
    error_code: errorCode,
    retry_after_seconds: errorCode === "rate_limit" ? Number(fixture.transport?.headers?.["retry-after"] || 0) || null : null
  };
  state.fixtureState = s;
}

function errorCodeForFixture(fixture) {
  if (fixture.transport?.mode === "timeout") return "timeout";
  if (fixture.transport?.mode === "offline") return "offline";
  if (fixture.transport?.status === 401 || fixture.transport?.status === 403) return "auth";
  if (fixture.transport?.status === 429) return "rate_limit";
  if (fixture.transport?.status === 200) {
    try { validateNormalizedReading(fixture.payload); return null; }
    catch { return "schema_error"; }
  }
  return "schema_error";
}

async function loadFixture(fixtureId) {
  if (state.fixtureCache.has(fixtureId)) return clone(state.fixtureCache.get(fixtureId));
  const file = FIXTURE_FILES[fixtureId];
  if (!file) throw new Error(`Unknown fixture: ${fixtureId}`);
  const res = await fetch(`${FIXTURE_ROOT}/fixtures/${file}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fixture load failed: ${fixtureId}`);
  const fixture = await res.json();
  if (fixture.fixture_id !== fixtureId) throw new Error(`Fixture id mismatch: ${fixtureId}`);
  state.fixtureCache.set(fixtureId, fixture);
  return clone(fixture);
}

async function replayFixture(fixtureId) {
  const fixture = await loadFixture(fixtureId);
  const errorCode = errorCodeForFixture(fixture);
  if (errorCode) applyFixtureError(fixture, errorCode);
  else applyFixtureSuccess(fixture);
  persistFixtureState();
  renderFixtureState();
  return fixture;
}

async function prepareFailureBaseline() {
  state.fixtureState = resetFixtureState();
  await replayFixture("T04-NORMAL-D1-A");
  await replayFixture("T04-NORMAL-D1-B");
}

async function runFailureFixture(fixtureId) {
  await prepareFailureBaseline();
  await replayFixture(fixtureId);
  const status = state.fixtureState.status;
  const copy = ERROR_COPY[status.error_code];
  el("fixtureAction").textContent = `${copy.title}: ${copy.message} 다음 행동: ${copy.action}`;
  el("testResult").textContent = `${fixtureId} 재생 완료 · 마지막 정상값 105 유지 · 일별 행 1건 유지 · ${status.freshness}/${status.error_code}`;
}

async function runNormalSequence() {
  state.fixtureState = resetFixtureState();
  await replayFixture("T04-NORMAL-D1-A");
  await replayFixture("T04-NORMAL-D1-B");
  await replayFixture("T04-NORMAL-D2");
  el("fixtureAction").textContent = "정상 저장 검증 완료: 같은 날짜 D1-B는 기존 행을 갱신하고, D2에서 새 날짜 행 1건이 추가됩니다.";
  el("testResult").textContent = "정상 sequence 통과 기대값 · 100 → 105 → 120 · 행 1 → 1 → 2 · 전일 대비 +15 pt";
}

async function runRecoverySequence() {
  state.fixtureState = resetFixtureState();
  await replayFixture("T04-NORMAL-D1-A");
  await replayFixture("T04-NORMAL-D1-B");
  await replayFixture("T04-TIMEOUT");
  renderFixtureState();
  await replayFixture("T04-RECOVER-D2");
  el("fixtureAction").textContent = "복구 완료: stale/timeout에서 fresh/none으로 돌아왔고 2026-08-25 신규 행이 정확히 1건 추가되었습니다.";
  el("testResult").textContent = "T04-C19 기대값 · 값 120 · fresh/none · 행 2건 · 전일 대비 +15 pt";
}

async function retryFixtureRecovery() {
  if (state.fixtureState?.status?.freshness !== "stale") return;
  await replayFixture("T04-RECOVER-D2");
  el("fixtureAction").textContent = "다시 시도 성공: 공개 asset T04-RECOVER-D2가 fresh/none 상태로 복구했습니다.";
  el("testResult").textContent = "Recover 완료 · 값 120 · 일별 행 2건 · 다음 합성 날짜 신규 행 1건";
}

function resetFixtureEvaluation() {
  state.fixtureState = resetFixtureState();
  localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(state.fixtureState));
  renderFixtureState();
  el("fixtureAction").textContent = "합성 평가 상태만 초기화했습니다. 실제 환율 일별 기록은 유지됩니다.";
  el("testResult").textContent = "Reset 완료 · synthetic state only";
}

function renderFixtureState() {
  const s = state.fixtureState || resetFixtureState();
  const current = s.current_reading;
  const status = s.status;
  el("fixtureStateBadge").textContent = status ? status.freshness.toUpperCase() : "EMPTY";
  el("fixtureCurrentValue").textContent = current ? `${current.normalized_value} ${current.unit}` : "—";
  el("fixtureFreshness").textContent = status?.freshness || "—";
  el("fixtureErrorCode").textContent = status?.error_code || "—";
  el("fixtureRowCount").textContent = String(s.daily_readings.length);
  el("fixtureDelta").textContent = Number.isFinite(s.last_delta) ? `${s.last_delta} ${s.last_comparison?.unit || ""}` : "—";
  el("fixtureLastRun").textContent = s.last_run?.fixture_id || "—";
  el("fixtureRetryBtn").hidden = status?.freshness !== "stale";

  if (!s.daily_readings.length) {
    el("fixtureRecords").innerHTML = '<div class="empty-state dark">합성 일별 기록 없음</div>';
  } else {
    el("fixtureRecords").innerHTML = s.daily_readings.map((row) => `
      <div class="fixture-record">
        <span>${row.record_date}</span>
        <strong>${row.normalized_value} ${row.unit}</strong>
        <span>${row.record_id}</span>
        <span>${row.last_fetched_at}</span>
      </div>`).join("");
  }
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyOfficialPackage() {
  try {
    const [manifestRes, contractRes] = await Promise.all([
      fetch(`${FIXTURE_ROOT}/asset-manifest.json`, { cache: "no-store" }),
      fetch(`${FIXTURE_ROOT}/public-contract.json`, { cache: "no-store" })
    ]);
    if (!manifestRes.ok || !contractRes.ok) throw new Error("manifest load failed");
    const manifest = await manifestRes.json();
    const contract = await contractRes.json();
    el("fixturePackageId").textContent = contract.package_id;
    el("fixtureContractVersion").textContent = `${contract.contract_version} / fixture ${contract.fixture_contract?.version || "—"}`;

    let checked = 0;
    for (const item of manifest.files) {
      const res = await fetch(`${FIXTURE_ROOT}/${item.path}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`missing ${item.path}`);
      const buffer = await res.arrayBuffer();
      const actual = await sha256Hex(buffer);
      if (actual !== item.sha256) throw new Error(`hash mismatch ${item.path}`);
      checked += 1;
    }
    el("fixtureIntegrity").textContent = `VERIFIED ${checked}/${manifest.files.length}`;
  } catch (error) {
    el("fixtureIntegrity").textContent = "CHECK FAILED";
    el("testResult").textContent = `공식 asset 무결성 확인 실패: ${error.message}`;
  }
}

function bindEvents() {
  document.querySelectorAll(".rate-card").forEach((card) => card.addEventListener("click", async () => {
    document.querySelectorAll(".rate-card").forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    state.selected = card.dataset.currency;
    renderSelected(); renderSnapshots();
    await loadHistory();
  }));

  document.querySelectorAll(".range-tab").forEach((tab) => tab.addEventListener("click", async () => {
    document.querySelectorAll(".range-tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    state.rangeDays = Number(tab.dataset.days);
    await loadHistory();
  }));

  ["fromCurrency", "toCurrency", "fromAmount"].forEach((id) => el(id).addEventListener("input", () => {
    renderConverter(); renderTravelGuide();
  }));

  el("swapBtn").addEventListener("click", () => {
    const from = el("fromCurrency").value;
    el("fromCurrency").value = el("toCurrency").value;
    el("toCurrency").value = from;
    renderConverter(); renderTravelGuide();
  });

  el("refreshBtn").addEventListener("click", refreshAll);
  el("openHistoryBtn").addEventListener("click", openHistoryModal);
  el("closeHistoryBtn").addEventListener("click", closeHistoryModal);
  document.querySelectorAll("[data-close-history]").forEach((node) => node.addEventListener("click", closeHistoryModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHistoryModal();
  });
  el("fixtureResetBtn").addEventListener("click", resetFixtureEvaluation);
  el("fixtureRetryBtn").addEventListener("click", retryFixtureRecovery);

  document.querySelectorAll("[data-fixture]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try { await runFailureFixture(button.dataset.fixture); }
    finally { button.disabled = false; }
  }));

  document.querySelectorAll("[data-sequence]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (button.dataset.sequence === "normal") await runNormalSequence();
      if (button.dataset.sequence === "recovery") await runRecoverySequence();
    } finally { button.disabled = false; }
  }));
}

async function init() {
  el("todayLabel").textContent = formatKstDate();
  state.fixtureState = loadFixtureState();
  renderSnapshots();
  renderFixtureState();
  bindEvents();
  verifyOfficialPackage();
  refreshAll();
}

document.addEventListener("DOMContentLoaded", init);
