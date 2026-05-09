// screens/dashboard.js — Tela Dashboard
import './dashboard.css';
import { fmt, fmtDate } from '../utils.js';

let _transacoes = [];
let _categorias = [];
let _currentMonth = new Date().getMonth();
let _currentYear = new Date().getFullYear();

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
    const d = new Date(t.data);
    return d.getMonth() === m && d.getFullYear() === y;
  });
}

export function renderDashboard() {
  const mt = getMonthTransactions(_currentMonth, _currentYear);
  const receitas = mt.filter(t => t.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
  const despesas = mt.filter(t => t.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
  const saldo = receitas - despesas;
  const total = _transacoes.reduce((a, b) => b.tipo === 'receita' ? a + b.valor : a - b.valor, 0);

  document.getElementById('d-receitas').textContent = fmt(receitas);
  document.getElementById('d-despesas').textContent = fmt(despesas);
  document.getElementById('d-saldo').textContent = fmt(saldo);
  document.getElementById('d-acumulado').textContent = fmt(total);

  renderCatBreakdown(despesas, mt);
  renderRecentList();
  renderMonthlyChart();
}

function renderCatBreakdown(despesas, mt) {
  const bycat = {};
  mt.filter(t => t.tipo === 'despesa').forEach(t => {
    bycat[t.categoria] = (bycat[t.categoria] || 0) + t.valor;
  });
  const catDiv = document.getElementById('cat-breakdown');
  const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    catDiv.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Sem gastos neste mês</p></div>';
    return;
  }

  catDiv.innerHTML = sorted.map(([cat, val]) => {
    const c = _categorias.find(x => x.nome === cat);
    const cor = c ? c.cor : '#94a3b8';
    const pct = despesas > 0 ? (val / despesas * 100) : 0;
    return `<div class="cat-progress-item">
      <div class="cat-progress-header">
        <span><span class="cat-dot" style="background:${cor}"></span>${cat}</span>
        <span class="cat-progress-value">${fmt(val)} <span class="cat-progress-pct">${pct.toFixed(0)}%</span></span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="--target-width:${pct}%;background:${cor}"></div></div>
    </div>`;
  }).join('');
}

function renderRecentList() {
  const recent = [..._transacoes].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
  const recDiv = document.getElementById('recent-list');

  if (recent.length === 0) {
    recDiv.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Nenhuma transação ainda</p></div>';
    return;
  }

  recDiv.innerHTML = recent.map(t => {
    const c = _categorias.find(x => x.nome === t.categoria);
    const cor = c ? c.cor : '#94a3b8';
    return `<div class="recent-item">
      <span class="recent-dot" style="background:${cor}"></span>
      <div class="recent-info">
        <div class="recent-desc">${t.descricao}</div>
        <div class="recent-meta">${fmtDate(t.data)} · ${t.categoria}</div>
      </div>
      <span class="recent-value" style="color:${t.tipo === 'receita' ? 'var(--green)' : 'var(--red)'}">
        ${t.tipo === 'receita' ? '+' : '-'}${fmt(t.valor)}
      </span>
    </div>`;
  }).join('');
}

function renderMonthlyChart() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = _currentMonth - i, y = _currentYear;
    if (m < 0) { m += 12; y--; }
    months.push({ m, y });
  }
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const data = months.map(({ m, y }) => {
    const mt = getMonthTransactions(m, y);
    return {
      label: names[m],
      rec: mt.filter(t => t.tipo === 'receita').reduce((a, b) => a + b.valor, 0),
      des: mt.filter(t => t.tipo === 'despesa').reduce((a, b) => a + b.valor, 0),
    };
  });
  const max = Math.max(...data.flatMap(d => [d.rec, d.des]), 1);

  document.getElementById('monthly-chart').innerHTML = `
    <div class="chart-legend">
      <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--green)"></span>Receitas</div>
      <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--red)"></span>Despesas</div>
    </div>
    <div class="bar-chart">
      ${data.map(d => `
        <div class="bar-wrap">
          <div class="bar-cols">
            <div class="bar" style="background:var(--green);height:${(d.rec / max * 100)}%" title="Receita: ${fmt(d.rec)}"></div>
            <div class="bar" style="background:var(--red);height:${(d.des / max * 100)}%" title="Despesa: ${fmt(d.des)}"></div>
          </div>
          <div class="bar-label">${d.label}</div>
        </div>`).join('')}
    </div>`;
}
