// screens/dashboard.js — Tela Dashboard v1.1 Warm Dark
import './styles.css';
import { fmt } from '../../core/utils.js';

let _transacoes = [];
let _categorias = [];
let _currentMonth = new Date().getMonth();
let _currentYear = new Date().getFullYear();

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function initDashboard({ transacoes, categorias, currentMonth, currentYear }) {
  _transacoes = transacoes;
  _categorias = categorias;
  _currentMonth = currentMonth;
  _currentYear = currentYear;
}

export function updateDashboardState({ transacoes, categorias, currentMonth, currentYear }) {
  if (transacoes !== undefined) _transacoes = transacoes;
  if (categorias !== undefined) _categorias = categorias;
  if (currentMonth !== undefined) _currentMonth = currentMonth;
  if (currentYear !== undefined) _currentYear = currentYear;
}

function getMonthTransactions(m, y) {
  return _transacoes.filter(t => {
    const d = new Date(t.data + 'T12:00:00');
    return d.getMonth() === m && d.getFullYear() === y;
  });
}

export function renderDashboard() {
  const mt = getMonthTransactions(_currentMonth, _currentYear);
  const receitas = mt.filter(t => t.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
  const despesas = mt.filter(t => t.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
  const saldo = receitas - despesas;
  const total = _transacoes.reduce((a, b) => b.tipo === 'receita' ? a + b.valor : a - b.valor, 0);

  // Metric cards
  const elR = document.getElementById('d-receitas');
  const elD = document.getElementById('d-despesas');
  const elS = document.getElementById('d-saldo');
  const elA = document.getElementById('d-acumulado');
  if (elR) elR.textContent = fmt(receitas);
  if (elD) elD.textContent = fmt(despesas);
  if (elS) elS.textContent = fmt(saldo);
  if (elA) elA.textContent = fmt(total);

  // Chart panel KPI
  const elKpi = document.getElementById('d-acumulado-kpi');
  const elSub = document.getElementById('d-acumulado-sub');
  if (elKpi) elKpi.textContent = fmt(total);
  if (elSub) elSub.textContent = `acumulado até ${MONTHS_LONG[_currentMonth]} ${_currentYear}`;

  renderCatBreakdown(receitas, mt);
  renderMonthlyChart(total);
}

function renderCatBreakdown(receitas, mt) {
  const bycat = {};
  mt.filter(t => t.tipo === 'despesa').forEach(t => {
    bycat[t.categoria] = (bycat[t.categoria] || 0) + t.valor;
  });

  const catDiv = document.getElementById('cat-breakdown');
  const footerDiv = document.getElementById('cats-total-footer');
  const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1]);

  if (!catDiv) return;

  if (sorted.length === 0) {
    catDiv.innerHTML = '<div class="dashboard-empty">Sem gastos neste mês</div>';
    if (footerDiv) footerDiv.innerHTML = '';
    return;
  }

  // Build category items (top 4 only)
  catDiv.innerHTML = sorted.slice(0, 4).map(([cat, val]) => {
    const c = _categorias.find(x => x.nome === cat);
    const cor = c ? c.cor : '#94a3b8';
    const pct = receitas > 0 ? Math.round(val / receitas * 100) : 0;
    return `<div class="cat-item">
      <div class="cat-row">
        <div class="cat-left">
          <div class="cat-dot" style="background:${cor}"></div>
          <span class="cat-name">${cat}</span>
        </div>
        <div class="cat-right">
          <span class="cat-val">${fmt(val)}</span>
          <span class="cat-pct">${pct}%</span>
        </div>
      </div>
      <div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${cor}"></div></div>
    </div>`;
  }).join('');

  // Build stacked progress bar footer
  if (footerDiv) {
    const totalSpent = sorted.reduce((a, b) => a + b[1], 0);
    const spentPct = receitas > 0 ? Math.round(totalSpent / receitas * 100) : 0;
    const remainPct = 100 - spentPct;

    const stackedBars = sorted.map(([cat, val]) => {
      const c = _categorias.find(x => x.nome === cat);
      const cor = c ? c.cor : '#94a3b8';
      const pct = receitas > 0 ? (val / receitas * 100).toFixed(1) : 0;
      return `<div style="width:${pct}%;height:100%;background:${cor};opacity:.8;"></div>`;
    }).join('');

    footerDiv.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;gap:7px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="cats-total-label">Saldo do mês</span>
          <span style="font-size:9px;color:var(--t3)">${spentPct}% gastos · ${remainPct}% restante</span>
        </div>
        <div style="height:4px;background:var(--b2);border-radius:3px;overflow:hidden;display:flex;gap:1px;">
          ${stackedBars}
          <div style="flex:1;height:100%;background:var(--green);opacity:.5;border-radius:0 2px 2px 0;"></div>
        </div>
      </div>`;
  }
}

function renderMonthlyChart(totalAcumulado) {
  // Build 6-month window
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = _currentMonth - i, y = _currentYear;
    if (m < 0) { m += 12; y--; }
    months.push({ m, y });
  }

  const data = months.map(({ m, y }) => {
    const end = new Date(y, m + 1, 0);
    const accumulated = _transacoes
      .filter(t => new Date(t.data + 'T12:00:00') <= end)
      .reduce((sum, t) => t.tipo === 'receita' ? sum + t.valor : sum - t.valor, 0);
    return { label: MONTHS_SHORT[m], value: accumulated };
  });

  const values = data.map(d => d.value);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);
  const range = Math.max(maxVal - minVal, 1);

  const W = 380, H = 130;
  const padL = 28, padR = 10, padT = 20, padB = 18;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - ((d.value - minVal) / range) * chartH;
    return { ...d, x, y };
  });

  // Trend badge
  const prev = points[points.length - 2]?.value ?? 0;
  const curr = points[points.length - 1]?.value ?? 0;
  const deltaPct = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;
  const trendEl = document.getElementById('d-chart-trend');
  const trendText = document.getElementById('trend-text');
  if (trendEl && trendText) {
    trendEl.style.display = 'flex';
    trendText.textContent = `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% vs mês anterior`;
    trendEl.style.color = deltaPct >= 0 ? 'var(--orange)' : 'var(--red)';
    trendEl.style.background = deltaPct >= 0 ? 'var(--og10)' : 'var(--rd10)';
    trendEl.style.borderColor = deltaPct >= 0 ? 'var(--og20)' : 'rgba(248,113,113,.18)';
  }

  // Path
  const linePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' C');
  const linePath = `M${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`;
  const areaPath = `${linePath} L${(W - padR).toFixed(1)},${(padT + chartH).toFixed(1)} L${padL},${(padT + chartH).toFixed(1)} Z`;

  // Dots with floating value pills
  const dotsHtml = points.map((p, i) => {
    const isActive = i === points.length - 1;
    const labelVal = fmt(p.value);
    // Position pill: if near left edge anchor right, near right edge anchor left
    let rx = p.x - 23;
    if (rx < 0) rx = 0;
    if (rx + 46 > W) rx = W - 46;
    const ry = p.y - 20;

    if (isActive) {
      // Double-halo active point
      return `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="var(--orange)" opacity=".18"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--orange)" opacity=".35"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="var(--orange)"/>
        <rect x="${rx.toFixed(1)}" y="${Math.max(2, ry).toFixed(1)}" width="46" height="14" rx="4" fill="var(--s4)"/>
        <text x="${(rx + 23).toFixed(1)}" y="${(Math.max(2, ry) + 9.5).toFixed(1)}" font-size="7.5" fill="var(--orange)" font-family="Inter" font-weight="600" text-anchor="middle">${labelVal}</text>`;
    }
    const opacity = (0.4 + i * 0.1).toFixed(2);
    return `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--s2)" stroke="var(--orange)" stroke-width="1.5" opacity="${opacity}"/>
      <rect x="${rx.toFixed(1)}" y="${Math.max(2, ry).toFixed(1)}" width="46" height="14" rx="4" fill="var(--s4)"/>
      <text x="${(rx + 23).toFixed(1)}" y="${(Math.max(2, ry) + 9.5).toFixed(1)}" font-size="7.5" fill="var(--orange)" font-family="Inter" font-weight="600" text-anchor="middle" opacity="${opacity}">${labelVal}</text>`;
  }).join('');

  // Month labels
  const labelsHtml = points.map((p, i) => {
    const isActive = i === points.length - 1;
    return `<span class="chart-month${isActive ? ' now' : ''}">${p.label}</span>`;
  }).join('');

  const chartContainer = document.getElementById('monthly-chart');
  if (!chartContainer) return;

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" aria-label="Gráfico de saldo acumulado dos últimos 6 meses">
      <defs>
        <linearGradient id="og-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f97316" stop-opacity=".30"/>
          <stop offset="80%" stop-color="#f97316" stop-opacity=".03"/>
          <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="og-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f97316" stop-opacity=".20"/>
          <stop offset="60%" stop-color="#f97316" stop-opacity=".9"/>
          <stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
        <filter id="og-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      <!-- grid lines -->
      <line x1="${padL}" y1="${padT}" x2="${W - padR}" y2="${padT}" stroke="var(--b2)" stroke-width="1"/>
      <line x1="${padL}" y1="${(padT + chartH / 2).toFixed(1)}" x2="${W - padR}" y2="${(padT + chartH / 2).toFixed(1)}" stroke="var(--b2)" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}" stroke="var(--b2)" stroke-width="1"/>

      <!-- area -->
      <path d="${areaPath}" fill="url(#og-area)"/>

      <!-- line glow -->
      <path d="${linePath}" fill="none" stroke="url(#og-line)" stroke-width="2" stroke-linecap="round" filter="url(#og-glow)" opacity=".5"/>
      <!-- line crisp -->
      <path d="${linePath}" fill="none" stroke="#f97316" stroke-width="1.8" stroke-linecap="round"/>

      <!-- dots + value pills -->
      ${dotsHtml}
    </svg>
    <div class="chart-months">
      <span class="chart-month">·</span>
      ${labelsHtml}
      <span class="chart-month">·</span>
    </div>`;
}
