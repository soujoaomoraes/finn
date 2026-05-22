// components/drawer.js — Drawer lateral de nova/editar transação
import './drawer.css';
import { setTodayDate } from '../utils.js';
import { showToast } from '../toast.js';

let getCategorias = () => [];
let onSave = async () => {};
let editMode = false;

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
          <div class="form-group">
            <label>Categoria</label>
            <select id="f-cat"></select>
          </div>
          <div class="form-group">
            <label>Observação (opcional)</label>
            <input type="text" id="f-obs" placeholder="Notas adicionais...">
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" type="button" data-drawer-save>Salvar</button>
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
  const filtered = getCategorias().filter((categoria) => categoria.tipo === tipo);
  sel.innerHTML = filtered.map((categoria) => `<option value="${categoria.nome}">${categoria.nome}</option>`).join('');
}

export function setTipo(tipo, btn) {
  const tipoInput = byId('f-tipo');
  if (tipoInput) tipoInput.value = tipo;
  document.querySelectorAll('.tabs .tab').forEach((tab) => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  populateCatSelect(tipo);
}

function resetForm() {
  byId('f-id').value = '';
  byId('f-desc').value = '';
  byId('f-valor').value = '';
  byId('f-obs').value = '';
  setTodayDate();

  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach((tab) => tab.classList.remove('active'));
  tabs[0]?.classList.add('active');
  byId('f-tipo').value = 'despesa';
  populateCatSelect('despesa');
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

    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach((tab) => tab.classList.remove('active'));
    const activeTab = transacao.tipo === 'receita' ? byId('tab-receita') : byId('tab-despesa');
    activeTab?.classList.add('active');
    byId('f-tipo').value = transacao.tipo;
    populateCatSelect(transacao.tipo);
    byId('f-cat').value = transacao.categoria;
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

  const transacao = { descricao, valor, data, tipo, categoria, obs };
  if (id) transacao.id = parseInt(id);

  await onSave(transacao);
  showToast(id ? 'Transação atualizada!' : 'Transação salva!');
  closeDrawer();
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
}
