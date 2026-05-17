// screens/transacoes.js — Tela Transações
import './transacoes.css';
import { fmt, fmtDate } from '../utils.js';

let _transacoes = [];
let _categorias = [];
let _currentMonth = new Date().getMonth();
let _currentYear = new Date().getFullYear();
let _onEdit = null;
let _onDelete = null;
let _onOpenDrawer = null;

export function initTransacoes({ transacoes, categorias, currentMonth, currentYear, onEdit, onDelete, onOpenDrawer }) {
  _transacoes = transacoes;
  _categorias = categorias;
  _currentMonth = currentMonth;
  _currentYear = currentYear;
  _onEdit = onEdit;
  _onDelete = onDelete;
  _onOpenDrawer = onOpenDrawer;
}

export function updateTransacoesState({ transacoes, categorias, currentMonth, currentYear }) {
  if (transacoes !== undefined) _transacoes = transacoes;
  if (categorias !== undefined) _categorias = categorias;
  if (currentMonth !== undefined) _currentMonth = currentMonth;
  if (currentYear !== undefined) _currentYear = currentYear;
}

export function populateFilters() {
  const sel = document.getElementById('filter-mes');
  if (!sel) return;
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const years = [...new Set(_transacoes.map(t => new Date(t.data).getFullYear()))].sort().reverse();
  sel.innerHTML = '<option value="">Todos</option>';
  for (let y of (years.length ? years : [_currentYear])) {
    for (let m = 11; m >= 0; m--) {
      sel.innerHTML += `<option value="${y}-${m}">${months[m]} ${y}</option>`;
    }
  }
  sel.value = `${_currentYear}-${_currentMonth}`;

  const catSel = document.getElementById('filter-cat');
  if (catSel) {
    catSel.innerHTML = '<option value="">Todas</option>' +
      _categorias.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
  }
}

export function renderLancamentos() {
  const mes = document.getElementById('filter-mes')?.value || '';
  const tipo = document.getElementById('filter-tipo')?.value || '';
  const cat = document.getElementById('filter-cat')?.value || '';
  const busca = (document.getElementById('filter-busca')?.value || '').toLowerCase();

  let data = [..._transacoes].sort((a, b) => new Date(b.data) - new Date(a.data));

  if (mes) {
    const [y, m] = mes.split('-').map(Number);
    data = data.filter(t => {
      const d = new Date(t.data);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }
  if (tipo) data = data.filter(t => t.tipo === tipo);
  if (cat) data = data.filter(t => t.categoria === cat);
  if (busca) data = data.filter(t => t.descricao.toLowerCase().includes(busca));

  const totalRec = data.filter(t => t.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
  const totalDes = data.filter(t => t.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);

  const div = document.getElementById('table-lancamentos');
  if (!div) return;

  if (data.length === 0) {
    div.innerHTML = '<div class="empty-state"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Nenhuma transação encontrada</p></div>';
  } else {
    div.innerHTML = `<table>
      <thead><tr>
        <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th><th></th>
      </tr></thead>
      <tbody>
      ${data.map(t => {
        const c = _categorias.find(x => x.nome === t.categoria);
        const cor = c ? c.cor : '#94a3b8';
        const recorrenteIcon = t.recorrente_id
          ? `<span class="recorrente-indicator" title="Transação recorrente">🔄</span>`
          : '';
        return `<tr>
          <td style="color:var(--text2);white-space:nowrap">${fmtDate(t.data)}</td>
          <td>${t.descricao}${t.obs ? `<div style="font-size:11px;color:var(--text3)">${t.obs}</div>` : ''} ${recorrenteIcon}</td>
          <td><span class="cat-dot" style="background:${cor}"></span>${t.categoria}</td>
          <td><span class="badge ${t.tipo === 'receita' ? 'badge-green' : 'badge-red'}">${t.tipo}</span></td>
          <td style="text-align:right;font-weight:500;color:${t.tipo === 'receita' ? 'var(--green)' : 'var(--red)'}">
            ${t.tipo === 'receita' ? '+' : '-'}${fmt(t.valor)}
          </td>
          <td style="white-space:nowrap;text-align:right;">
            <button class="btn-icon" data-edit="${t.id}" title="Editar">✏️</button>
            <button class="btn-icon" data-delete="${t.id}" title="Excluir" style="margin-left:4px">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
      <tr class="totals-row">
        <td colspan="4" style="color:var(--text3);font-size:12px;padding-top:14px">Total filtrado</td>
        <td style="text-align:right;padding-top:14px;font-size:13px">
          <span style="color:var(--green)">${fmt(totalRec)}</span> <span style="color:var(--text3)">/ </span><span style="color:var(--red)">${fmt(totalDes)}</span>
        </td>
        <td></td>
      </tr>
      </tbody>
    </table>`;

    // Bind botões via delegação de evento
    div.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => _onEdit && _onEdit(parseInt(btn.dataset.edit)));
    });
    div.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => _onDelete && _onDelete(parseInt(btn.dataset.delete)));
    });
  }

  const summary = document.getElementById('table-summary');
  if (summary) summary.textContent = `${data.length} transaç${data.length === 1 ? 'ão' : 'ões'}`;
}

export function updateCatFilter() {
  const catSel = document.getElementById('filter-cat');
  if (catSel) {
    catSel.innerHTML = '<option value="">Todas</option>' +
      _categorias.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
  }
}
