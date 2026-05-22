// components/recorrente-drawer.js — Drawer para nova/editar recorrente
import './recorrente-drawer.css';
import { showToast } from '../toast.js';

let getCategorias = () => [];
let onSave = async () => {};
let editMode = false;

function drawerTemplate() {
  return `
    <div class="drawer-overlay hidden" id="recorrente-drawer-overlay">
      <div class="drawer" id="recorrente-drawer">
        <div class="drawer-header">
          <div>
            <div class="drawer-title" id="recorrente-drawer-title">Nova Recorrente</div>
            <div class="drawer-subtitle">Transação automática agendada</div>
          </div>
          <button class="btn-icon" id="recorrente-drawer-close" type="button" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </div>
        <div class="drawer-body">
          <div class="tabs">
            <button class="tab active" id="recorrente-tab-despesa" type="button" data-recorrente-tipo="despesa">Despesa</button>
            <button class="tab" id="recorrente-tab-receita" type="button" data-recorrente-tipo="receita">Receita</button>
          </div>
          <input type="hidden" id="recorrente-f-id">
          <input type="hidden" id="recorrente-f-tipo" value="despesa">

          <div class="form-group">
            <label>Descrição</label>
            <input type="text" id="recorrente-f-desc" placeholder="Ex: Aluguel, Salário...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valor</label>
              <div class="input-prefix"><span>R$</span><input type="number" id="recorrente-f-valor" step="0.01" min="0" placeholder="0,00"></div>
            </div>
            <div class="form-group">
              <label>Frequência</label>
              <select id="recorrente-f-frequencia">
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Dia do vencimento</label>
              <input type="number" id="recorrente-f-dia-vencimento" min="1" max="31" placeholder="Dia (mensal)">
            </div>
            <div class="form-group">
              <label>Data início</label>
              <input type="date" id="recorrente-f-data-inicio">
            </div>
          </div>
          <div class="form-group">
            <label>Categoria</label>
            <select id="recorrente-f-cat"></select>
          </div>
          <div class="form-group">
            <label>Observação (opcional)</label>
            <input type="text" id="recorrente-f-obs" placeholder="Notas adicionais...">
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" type="button" data-recorrente-save>Salvar</button>
          <button class="btn btn-ghost" type="button" data-recorrente-close>Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function byId(id) {
  return document.getElementById(id);
}

function populateCatSelect(tipo) {
  const sel = byId('recorrente-f-cat');
  if (!sel) return;
  const filtered = getCategorias().filter((categoria) => categoria.tipo === tipo);
  sel.innerHTML = filtered.map((categoria) => `<option value="${categoria.nome}">${categoria.nome}</option>`).join('');
}

export function setTipo(tipo, btn) {
  const tipoInput = byId('recorrente-f-tipo');
  if (tipoInput) tipoInput.value = tipo;
  document.querySelectorAll('#recorrente-drawer .tabs .tab').forEach((tab) => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  populateCatSelect(tipo);
}

function resetForm() {
  byId('recorrente-f-id').value = '';
  byId('recorrente-f-desc').value = '';
  byId('recorrente-f-valor').value = '';
  byId('recorrente-f-dia-vencimento').value = '';
  byId('recorrente-f-data-inicio').value = '';
  byId('recorrente-f-obs').value = '';
  byId('recorrente-f-frequencia').value = 'mensal';

  const tabs = document.querySelectorAll('#recorrente-drawer .tabs .tab');
  tabs.forEach((tab) => tab.classList.remove('active'));
  tabs[0]?.classList.add('active');
  byId('recorrente-f-tipo').value = 'despesa';
  populateCatSelect('despesa');
  editMode = false;
}

export function openRecorrenteDrawer(recorrente = null) {
  if (recorrente) {
    editMode = true;
    byId('recorrente-drawer-title').textContent = 'Editar Recorrente';
    byId('recorrente-f-id').value = recorrente.id;
    byId('recorrente-f-desc').value = recorrente.descricao;
    byId('recorrente-f-valor').value = recorrente.valor;
    byId('recorrente-f-frequencia').value = recorrente.frequencia;
    byId('recorrente-f-dia-vencimento').value = recorrente.dia_vencimento || '';
    byId('recorrente-f-data-inicio').value = recorrente.data_inicio;
    byId('recorrente-f-obs').value = recorrente.obs || '';

    const tabs = document.querySelectorAll('#recorrente-drawer .tabs .tab');
    tabs.forEach((tab) => tab.classList.remove('active'));
    const activeTab = recorrente.tipo === 'receita' ? byId('recorrente-tab-receita') : byId('recorrente-tab-despesa');
    activeTab?.classList.add('active');
    byId('recorrente-f-tipo').value = recorrente.tipo;
    populateCatSelect(recorrente.tipo);
    byId('recorrente-f-cat').value = recorrente.categoria;
  } else {
    resetForm();
    byId('recorrente-drawer-title').textContent = 'Nova Recorrente';
    // Set default data_inicio to today
    const today = new Date().toISOString().split('T')[0];
    byId('recorrente-f-data-inicio').value = today;
  }

  byId('recorrente-drawer-overlay').classList.remove('hidden');
}

export function closeRecorrenteDrawer() {
  byId('recorrente-drawer-overlay').classList.add('hidden');
  editMode = false;
}

export function isRecorrenteDrawerOpen() {
  return !byId('recorrente-drawer-overlay')?.classList.contains('hidden');
}

async function salvarRecorrente() {
  const id = byId('recorrente-f-id').value;
  const descricao = byId('recorrente-f-desc').value.trim();
  const valor = parseFloat(byId('recorrente-f-valor').value);
  const tipo = byId('recorrente-f-tipo').value;
  const categoria = byId('recorrente-f-cat').value;
  const obs = byId('recorrente-f-obs').value.trim();
  const frequencia = byId('recorrente-f-frequencia').value;
  const dia_vencimento = byId('recorrente-f-dia-vencimento').value ? parseInt(byId('recorrente-f-dia-vencimento').value) : null;
  const data_inicio = byId('recorrente-f-data-inicio').value;

  if (!descricao) return showToast('Informe a descrição');
  if (!valor || valor <= 0) return showToast('Informe um valor válido');
  if (!data_inicio) return showToast('Informe a data início');

  // Calculate proximo_vencimento from data_inicio
  const proximo_vencimento = data_inicio;

  const recorrente = { 
    descricao, 
    valor, 
    tipo, 
    categoria, 
    obs, 
    frequencia, 
    dia_vencimento, 
    proximo_vencimento, 
    ativo: true, 
    data_inicio 
  };
  if (id) recorrente.id = parseInt(id);

  await onSave(recorrente);
  showToast(id ? 'Recorrente atualizada!' : 'Recorrente salva!');
  closeRecorrenteDrawer();
}

export function updateRecorrenteDrawerCategories() {
  const tipo = byId('recorrente-f-tipo')?.value || 'despesa';
  populateCatSelect(tipo);
}

export function initRecorrenteDrawer(options = {}) {
  getCategorias = options.getCategorias || getCategorias;
  onSave = options.onSave || onSave;

  const root = byId('recorrente-drawer-root');
  if (root) root.innerHTML = drawerTemplate();

  byId('recorrente-drawer-close')?.addEventListener('click', closeRecorrenteDrawer);
  byId('recorrente-drawer-overlay')?.addEventListener('click', (event) => {
    if (event.target === byId('recorrente-drawer-overlay')) closeRecorrenteDrawer();
  });
  document.querySelectorAll('[data-recorrente-tipo]').forEach((button) => {
    button.addEventListener('click', () => setTipo(button.dataset.recorrenteTipo, button));
  });
  document.querySelector('[data-recorrente-close]')?.addEventListener('click', closeRecorrenteDrawer);
  document.querySelector('[data-recorrente-save]')?.addEventListener('click', salvarRecorrente);
}
