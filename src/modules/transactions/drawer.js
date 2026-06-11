// components/drawer.js — Drawer lateral de nova/editar transação (v0.9.1)
import './drawer.css';
import { setTodayDate } from '../../core/utils.js';
import { showToast } from '../../core/toast.js';
import { getReservaSaldos } from '../../core/db.js';

let getCategorias = () => [];
let onSave = async () => {};
let editMode = false;
let _reservaSaldos = [];
let _selectedReservaId = null; // null = saldo livre

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function drawerTemplate() {
  return `
    <div class="drawer-overlay hidden" id="drawer-overlay">
      <div class="drawer" id="drawer">
        <div class="drawer-header">
          <div>
            <div class="drawer-title" id="drawer-title">Nova Transação</div>
            <div class="drawer-subtitle">Lançamento financeiro</div>
          </div>
          <button class="btn-icon" id="drawer-close" type="button" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
        <div class="drawer-body">
          <div class="tabs">
            <button class="tab active" id="tab-despesa" type="button" data-drawer-tipo="despesa">Despesa</button>
            <button class="tab" id="tab-receita" type="button" data-drawer-tipo="receita">Receita</button>
            <button class="tab tab-reserva" id="tab-reserva" type="button" data-drawer-tipo="reserva">Reserva</button>
          </div>
          <input type="hidden" id="f-id">
          <input type="hidden" id="f-tipo" value="despesa">

          <div class="form-group">
            <label>Descrição</label>
            <input type="text" id="f-desc" placeholder="Ex: Supermercado, Salário...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valor</label>
              <div class="input-prefix"><span>R$</span><input type="number" id="f-valor" step="0.01" min="0" placeholder="0,00"></div>
            </div>
            <div class="form-group">
              <label>Data</label>
              <input type="date" id="f-data">
            </div>
          </div>
          <!-- Categoria (receita/despesa) -->
          <div class="form-group" id="f-cat-group">
            <label id="f-cat-label">Categoria</label>
            <select id="f-cat"></select>
          </div>
          <!-- Observação -->
          <div class="form-group">
            <label>Observação (opcional)</label>
            <input type="text" id="f-obs" placeholder="Notas adicionais...">
          </div>
          <!-- Origem do dinheiro (só despesa) -->
          <div class="form-group" id="f-origem-group" style="display:none;">
            <label>Origem do dinheiro</label>
            <div id="f-origem-opts" class="origem-opts"></div>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" type="button" id="drawer-save-btn" data-drawer-save>Salvar</button>
          <button class="btn btn-ghost" type="button" data-drawer-close>Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function byId(id) {
  return document.getElementById(id);
}

function populateCatSelect(tipo) {
  const sel = byId('f-cat');
  if (!sel) return;
  const catGroup = byId('f-cat-group');
  const catLabel = byId('f-cat-label');

  if (tipo === 'reserva') {
    // For reserva: show only reserva categories
    const cats = getCategorias().filter((c) => c.tipo === 'reserva');
    sel.innerHTML = cats.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
    if (catLabel) catLabel.textContent = 'Reserva de destino';
    if (catGroup) catGroup.style.display = cats.length === 0 ? 'none' : '';
  } else {
    const filtered = getCategorias().filter((c) => c.tipo === tipo);
    sel.innerHTML = filtered.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
    if (catLabel) catLabel.textContent = 'Categoria';
    if (catGroup) catGroup.style.display = '';
  }
}

async function renderOrigemOpts() {
  const origemGroup = byId('f-origem-group');
  const origemOpts = byId('f-origem-opts');
  if (!origemGroup || !origemOpts) return;

  // Compute free balance estimate (total receitas - total despesas sem reserva_id)
  // We use reservaSaldos already loaded for display
  try {
    _reservaSaldos = await getReservaSaldos();
  } catch (_) {
    _reservaSaldos = [];
  }

  const items = [
    { id: null, label: 'Saldo livre', saldo: null },
    ..._reservaSaldos.map((r) => ({ id: r.reserva_id, label: r.nome, saldo: r.saldo_atual })),
  ];

  origemOpts.innerHTML = items.map((item) => {
    const hasBalance = item.id === null || item.saldo > 0;
    const isSelected = _selectedReservaId === item.id;
    const saldoText = item.id === null
      ? ''
      : item.saldo > 0
        ? fmtBRL(item.saldo)
        : 'R$ 0 · sem saldo';

    return `
      <div class="origem-opt ${isSelected ? 'on' : ''} ${!hasBalance ? 'disabled' : ''}"
           data-origem-id="${item.id ?? 'null'}"
           style="${!hasBalance ? 'opacity:.4;cursor:not-allowed;pointer-events:none;' : 'cursor:pointer;'}">
        <div class="origem-radio"></div>
        <span class="origem-label">${item.label}</span>
        ${saldoText ? `<span class="origem-saldo">${saldoText}</span>` : ''}
      </div>`;
  }).join('');
}

export function setTipo(tipo, btn) {
  const tipoInput = byId('f-tipo');
  if (tipoInput) tipoInput.value = tipo;

  document.querySelectorAll('.tabs .tab').forEach((tab) => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');

  populateCatSelect(tipo);

  // Show/hide origem
  const origemGroup = byId('f-origem-group');
  const saveBtn = byId('drawer-save-btn');

  if (tipo === 'despesa') {
    _selectedReservaId = null;
    if (origemGroup) origemGroup.style.display = '';
    void renderOrigemOpts();
    if (saveBtn) { saveBtn.textContent = 'Salvar'; saveBtn.style.background = ''; }
  } else if (tipo === 'reserva') {
    if (origemGroup) origemGroup.style.display = 'none';
    if (saveBtn) { saveBtn.textContent = 'Guardar na reserva'; saveBtn.style.background = 'var(--purple)'; }
  } else {
    if (origemGroup) origemGroup.style.display = 'none';
    if (saveBtn) { saveBtn.textContent = 'Salvar'; saveBtn.style.background = ''; }
  }
}

function resetForm() {
  byId('f-id').value = '';
  byId('f-desc').value = '';
  byId('f-valor').value = '';
  byId('f-obs').value = '';
  _selectedReservaId = null;
  setTodayDate();

  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach((tab) => tab.classList.remove('active'));
  tabs[0]?.classList.add('active');
  byId('f-tipo').value = 'despesa';
  populateCatSelect('despesa');

  const saveBtn = byId('drawer-save-btn');
  if (saveBtn) { saveBtn.textContent = 'Salvar'; saveBtn.style.background = ''; }

  // Show origem on despesa
  const origemGroup = byId('f-origem-group');
  if (origemGroup) origemGroup.style.display = '';
  void renderOrigemOpts();

  editMode = false;
}

export function openDrawer(transacao = null) {
  if (transacao) {
    editMode = true;
    byId('drawer-title').textContent = 'Editar Transação';
    byId('f-id').value = transacao.id;
    byId('f-desc').value = transacao.descricao;
    byId('f-valor').value = transacao.valor;
    byId('f-data').value = transacao.data;
    byId('f-obs').value = transacao.obs || '';
    _selectedReservaId = transacao.reserva_id ?? null;

    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach((tab) => tab.classList.remove('active'));
    let activeTab = byId('tab-despesa');
    if (transacao.tipo === 'receita') activeTab = byId('tab-receita');
    else if (transacao.tipo === 'reserva') activeTab = byId('tab-reserva');
    activeTab?.classList.add('active');

    byId('f-tipo').value = transacao.tipo;
    populateCatSelect(transacao.tipo);
    byId('f-cat').value = transacao.categoria;

    const origemGroup = byId('f-origem-group');
    const saveBtn = byId('drawer-save-btn');
    if (transacao.tipo === 'despesa') {
      if (origemGroup) origemGroup.style.display = '';
      void renderOrigemOpts();
      if (saveBtn) { saveBtn.textContent = 'Salvar'; saveBtn.style.background = ''; }
    } else if (transacao.tipo === 'reserva') {
      if (origemGroup) origemGroup.style.display = 'none';
      if (saveBtn) { saveBtn.textContent = 'Guardar na reserva'; saveBtn.style.background = 'var(--purple)'; }
    } else {
      if (origemGroup) origemGroup.style.display = 'none';
      if (saveBtn) { saveBtn.textContent = 'Salvar'; saveBtn.style.background = ''; }
    }
  } else {
    resetForm();
    byId('drawer-title').textContent = 'Nova Transação';
  }

  byId('drawer-overlay').classList.remove('hidden');
}

export function closeDrawer() {
  byId('drawer-overlay').classList.add('hidden');
  editMode = false;
}

export function isDrawerOpen() {
  return !byId('drawer-overlay')?.classList.contains('hidden');
}

async function salvarTransacao() {
  const id = byId('f-id').value;
  const descricao = byId('f-desc').value.trim();
  const valor = parseFloat(byId('f-valor').value);
  const data = byId('f-data').value;
  const tipo = byId('f-tipo').value;
  const categoria = byId('f-cat').value;
  const obs = byId('f-obs').value.trim();

  if (!descricao) return showToast('Informe a descrição');
  if (!valor || valor <= 0) return showToast('Informe um valor válido');
  if (!data) return showToast('Informe a data');
  if (!categoria) return showToast('Selecione uma categoria');

  const transacao = {
    descricao, valor, data, tipo, categoria, obs,
    reserva_id: tipo === 'despesa' ? _selectedReservaId : null,
    is_transferencia: false,
    transferencia_par_id: null,
  };
  if (id) transacao.id = parseInt(id);

  try {
    await onSave(transacao);
    showToast(id ? 'Transação atualizada!' : 'Transação salva!');
    closeDrawer();
  } catch (e) {
    const msg = String(e);
    if (msg.includes('SALDO_INSUFICIENTE')) {
      const saldo = parseFloat(msg.split('|')[1] || '0');
      showToast(`Saldo insuficiente! Reserva possui apenas ${fmtBRL(saldo)}`);
    } else {
      showToast('Erro ao salvar: ' + msg);
    }
  }
}

export function updateDrawerCategories() {
  const tipo = byId('f-tipo')?.value || 'despesa';
  populateCatSelect(tipo);
}

export function initDrawer(options = {}) {
  getCategorias = options.getCategorias || getCategorias;
  onSave = options.onSave || onSave;

  const root = byId('drawer-root');
  if (root) root.innerHTML = drawerTemplate();

  byId('drawer-close')?.addEventListener('click', closeDrawer);
  byId('drawer-overlay')?.addEventListener('click', (event) => {
    if (event.target === byId('drawer-overlay')) closeDrawer();
  });
  document.querySelectorAll('[data-drawer-tipo]').forEach((button) => {
    button.addEventListener('click', () => setTipo(button.dataset.drawerTipo, button));
  });
  document.querySelector('[data-drawer-close]')?.addEventListener('click', closeDrawer);
  document.querySelector('[data-drawer-save]')?.addEventListener('click', salvarTransacao);

  // Origem click delegation
  byId('drawer-overlay')?.addEventListener('click', (e) => {
    const opt = e.target.closest('.origem-opt:not(.disabled)');
    if (!opt) return;
    const rawId = opt.dataset.origemId;
    _selectedReservaId = rawId === 'null' ? null : parseInt(rawId, 10);
    document.querySelectorAll('.origem-opt').forEach((o) => o.classList.remove('on'));
    opt.classList.add('on');
  });
}
