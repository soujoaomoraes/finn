import { getAllTransacoes, getAllCategorias, saveTransacao, saveCategoria, deleteTransacao } from './db.js';
import { setTodayDate } from './utils.js';
import { showToast } from './toast.js';
import { go as goToSection } from './router.js';
import { initSidebar, setSidebarActive } from './components/sidebar.js';
import { initDashboard, updateDashboardState, renderDashboard } from './screens/dashboard.js';
import { initTransacoes, updateTransacoesState, populateFilters, renderLancamentos } from './screens/transacoes.js';
import {
  initCategorias,
  renderCategorias,
  renderColorSwatches,
  fecharModalCategoria,
  bindNovaCategoriaButton,
} from './screens/categorias.js';
import { initImportar } from './screens/importar.js';

let transacoes = [];
let categorias = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let editMode = false;

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function syncScreenState() {
  updateDashboardState({ transacoes, categorias, currentMonth, currentYear });
  updateTransacoesState({ transacoes, categorias, currentMonth, currentYear });
}

function updateMonthLabel() {
  const label = document.getElementById('month-label');
  if (label) label.textContent = `${MONTHS_SHORT[currentMonth]} ${currentYear}`;
}

function go(sec) {
  goToSection(sec);
  setSidebarActive(sec);
  if (sec === 'dashboard') renderDashboard();
  if (sec === 'lancamentos') renderLancamentos();
  if (sec === 'categorias') renderCategorias();
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear += 1; }
  if (currentMonth < 0) { currentMonth = 11; currentYear -= 1; }
  syncScreenState();
  updateMonthLabel();
  renderDashboard();
}

function openDrawer() {
  if (!editMode) {
    resetForm();
    document.getElementById('drawer-title').textContent = 'Nova Transação';
  }
  document.getElementById('drawer-overlay').classList.remove('hidden');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.add('hidden');
  editMode = false;
}

function setTipo(tipo, btn) {
  document.getElementById('f-tipo').value = tipo;
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  populateCatSelect(tipo);
}

function populateCatSelect(tipo) {
  const sel = document.getElementById('f-cat');
  const filtered = categorias.filter(c=>c.tipo===tipo);
  sel.innerHTML = filtered.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
}

function resetForm() {
  document.getElementById('f-id').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-valor').value = '';
  document.getElementById('f-obs').value = '';
  setTodayDate();
  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(t=>t.classList.remove('active'));
  tabs[0].classList.add('active');
  document.getElementById('f-tipo').value = 'despesa';
  populateCatSelect('despesa');
  editMode = false;
}

async function salvarTransacao() {
  const id = document.getElementById('f-id').value;
  const desc = document.getElementById('f-desc').value.trim();
  const valor = parseFloat(document.getElementById('f-valor').value);
  const data = document.getElementById('f-data').value;
  const tipo = document.getElementById('f-tipo').value;
  const cat = document.getElementById('f-cat').value;
  const obs = document.getElementById('f-obs').value.trim();

  if (!desc) return showToast('Informe a descrição');
  if (!valor || valor <= 0) return showToast('Informe um valor válido');
  if (!data) return showToast('Informe a data');

  const obj = {descricao:desc, valor, data, tipo, categoria:cat, obs};
  if (id) obj.id = parseInt(id);

  const newId = await saveTransacao(obj);
  if (!id) obj.id = newId;

  if (id) {
    const idx = transacoes.findIndex(t=>t.id===parseInt(id));
    if (idx >= 0) transacoes[idx] = obj;
  } else {
    transacoes.push(obj);
  }

  // update month
  const d = new Date(data);
  currentMonth = d.getMonth();
  currentYear = d.getFullYear();
  syncScreenState();
  updateMonthLabel();
  populateFilters();
  renderDashboard();
  renderLancamentos();
  showToast(id ? 'Transação atualizada!' : 'Transação salva!');
  editMode = false;
  closeDrawer();
}

function editarTransacao(id) {
  const t = transacoes.find(x=>x.id===id);
  if (!t) return;
  editMode = true;
  document.getElementById('drawer-title').textContent = 'Editar Transação';
  document.getElementById('f-id').value = t.id;
  document.getElementById('f-desc').value = t.descricao;
  document.getElementById('f-valor').value = t.valor;
  document.getElementById('f-data').value = t.data;
  document.getElementById('f-obs').value = t.obs||'';

  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(tab=>tab.classList.remove('active'));
  if (t.tipo === 'receita') tabs[1].classList.add('active');
  else tabs[0].classList.add('active');
  document.getElementById('f-tipo').value = t.tipo;
  populateCatSelect(t.tipo);
  document.getElementById('f-cat').value = t.categoria;
  openDrawer();
}

async function deletarTransacao(id) {
  if (!confirm('Excluir esta transação?')) return;
  await deleteTransacao(id);
  transacoes = transacoes.filter(t=>t.id!==id);
  syncScreenState();
  renderLancamentos();
  renderDashboard();
  showToast('Transação excluída');
}

function updateCatSelects() {
  const tipo = document.getElementById('f-tipo').value;
  populateCatSelect(tipo);
  const catSel = document.getElementById('filter-cat');
  catSel.innerHTML =
    '<option value="">Todas</option>' +
    categorias.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('drawer-overlay').classList.contains('hidden')) closeDrawer();
    fecharModalCategoria();
  }
});

document.getElementById('drawer-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('drawer-overlay')) closeDrawer();
});

window.go = go;
window.changeMonth = changeMonth;
window.renderLancamentos = renderLancamentos;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.setTipo = setTipo;
window.salvarTransacao = salvarTransacao;
window.editarTransacao = editarTransacao;
window.deletarTransacao = deletarTransacao;
async function seedCategories() {
  const defaults = [
    { nome: 'Alimentação', tipo: 'despesa', cor: '#fb923c' },
    { nome: 'Transporte', tipo: 'despesa', cor: '#60a5fa' },
    { nome: 'Moradia', tipo: 'despesa', cor: '#818cf8' },
    { nome: 'Saúde', tipo: 'despesa', cor: '#f472b6' },
    { nome: 'Lazer', tipo: 'despesa', cor: '#4ade80' },
    { nome: 'Educação', tipo: 'despesa', cor: '#22d3ee' },
    { nome: 'Outros', tipo: 'despesa', cor: '#94a3b8' },
    { nome: 'Salário', tipo: 'receita', cor: '#4ade80' },
    { nome: 'Freelance', tipo: 'receita', cor: '#34d399' },
    { nome: 'Investimentos', tipo: 'receita', cor: '#fbbf24' },
    { nome: 'Outros', tipo: 'receita', cor: '#94a3b8' }
  ];
  for (const categoria of defaults) {
    const id = await saveCategoria(categoria);
    categoria.id = id;
  }
  categorias = defaults;
}

async function init() {
  transacoes = await getAllTransacoes();
  categorias = await getAllCategorias();
  if (categorias.length === 0) await seedCategories();

  initDashboard({ transacoes, categorias, currentMonth, currentYear });
  initTransacoes({
    transacoes,
    categorias,
    currentMonth,
    currentYear,
    onEdit: editarTransacao,
    onDelete: deletarTransacao,
    onOpenDrawer: openDrawer
  });
  initSidebar({
    onNavigate: go,
    onOpenDrawer: openDrawer
  });

  initCategorias({
    getCategorias: () => categorias,
    onAfterMutation: () => {
      syncScreenState();
      populateFilters();
      updateCatSelects();
    },
  });
  bindNovaCategoriaButton();

  initImportar({
    getTransacoes: () => transacoes,
    getCategorias: () => categorias,
    onAfterImport: () => {
      syncScreenState();
      populateFilters();
      updateCatSelects();
      renderDashboard();
      renderLancamentos();
      go('lancamentos');
    },
  });

  updateMonthLabel();
  renderColorSwatches();
  populateFilters();
  setTodayDate();
  renderDashboard();
  renderLancamentos();
  renderCategorias();
}

init();