import { getAllTransacoes, getAllCategorias, saveTransacao, saveCategoria, deleteTransacao } from './core/db.js';
import { showToast } from './core/toast.js';
import { go as goToSection } from './core/router.js';
import { initSidebar, setSidebarActive } from './shared/sidebar.js';
import { initDrawer, openDrawer, closeDrawer, isDrawerOpen, updateDrawerCategories } from './modules/transactions/drawer.js';
import { initDashboard, updateDashboardState, renderDashboard } from './modules/dashboard/index.js';
import { initTransacoes, updateTransacoesState, populateFilters, renderLancamentos } from './modules/transactions/index.js';
import { initCategorias, renderCategorias, renderColorSwatches, fecharModalCategoria, bindNovaCategoriaButton } from './modules/categories/index.js';
import { initImportar } from './modules/import-export/index.js';
import { initRecorrentes } from './modules/recurring/index.js';
import { closeRecorrenteDrawer, isRecorrenteDrawerOpen } from './modules/recurring/drawer.js';
import { initBackup, markBackupDirty } from './modules/backup/index.js';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

let transacoes = [];
let categorias = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

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

async function salvarTransacao(transacao) {
  const isEdit = Boolean(transacao.id);
  const newId = await saveTransacao(transacao);
  if (!isEdit) transacao.id = newId;

  if (isEdit) {
    const idx = transacoes.findIndex((item) => item.id === transacao.id);
    if (idx >= 0) transacoes[idx] = transacao;
  } else {
    transacoes.push(transacao);
  }

  const d = new Date(transacao.data + 'T12:00:00');
  currentMonth = d.getMonth();
  currentYear = d.getFullYear();
  syncScreenState();
  updateMonthLabel();
  populateFilters();
  renderDashboard();
  renderLancamentos();
  markBackupDirty();
}

function editarTransacao(id) {
  const transacao = transacoes.find((item) => item.id === id);
  if (transacao) openDrawer(transacao);
}

async function deletarTransacao(id) {
  if (!confirm('Excluir esta transação?')) return;
  await deleteTransacao(id);
  transacoes = transacoes.filter((item) => item.id !== id);
  syncScreenState();
  renderLancamentos();
  renderDashboard();
  markBackupDirty();
  showToast('Transação excluída');
}

function updateCatSelects() {
  updateDrawerCategories();
  const catSel = document.getElementById('filter-cat');
  if (!catSel) return;
  catSel.innerHTML =
    '<option value="">Todas</option>' +
    categorias.map((categoria) => `<option value="${categoria.nome}">${categoria.nome}</option>`).join('');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (isDrawerOpen()) closeDrawer();
    if (isRecorrenteDrawerOpen()) closeRecorrenteDrawer();
    fecharModalCategoria();
  }
});

window.go = go;
window.changeMonth = changeMonth;
window.renderLancamentos = renderLancamentos;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
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
  markBackupDirty();
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
    onOpenDrawer: openDrawer,
  });
  initSidebar({
    onNavigate: go,
    onOpenDrawer: openDrawer,
  });
  initDrawer({
    getCategorias: () => categorias,
    onSave: salvarTransacao,
  });

  initCategorias({
    getCategorias: () => categorias,
    onAfterMutation: () => {
      syncScreenState();
      populateFilters();
      updateCatSelects();
      markBackupDirty();
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
      markBackupDirty();
    },
    onExport: async (startDate, endDate) => {
      try {
        const filePath = await save({
          defaultPath: `finledger_export_${startDate}_to_${endDate}.csv`,
          filters: [
            {
              name: 'CSV',
              extensions: ['csv']
            }
          ]
        });

        if (filePath) {
          try {
            await invoke('export_csv', { startDate, endDate, filePath });
            showToast('Exportação concluída com sucesso!');
          } catch (exportError) {
            console.error('Export error:', exportError);
            showToast('Erro ao exportar: ' + exportError);
          }
        }
      } catch (error) {
        console.error('Dialog error:', error);
        // User canceled the dialog - no error shown
      }
    },
  });

  initRecorrentes({
    getCategorias: () => categorias,
    onOpenDrawer: openDrawer,
  });

  initBackup();

  updateMonthLabel();
  renderColorSwatches();
  populateFilters();
  renderDashboard();
  renderLancamentos();
  renderCategorias();
}
init();