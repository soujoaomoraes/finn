// screens/recorrentes.js — Tela Recorrentes
import './recorrentes.css';
import { invoke } from '@tauri-apps/api/core';
import { showToast } from '../toast.js';
import { initRecorrenteDrawer, openRecorrenteDrawer, updateRecorrenteDrawerCategories } from '../components/recorrente-drawer.js';
import { fmt, fmtDate } from '../utils.js';

let _recorrentes = [];
let _categorias = [];
let _onOpenDrawer = () => {};

export function initRecorrentes({ getCategorias, onOpenDrawer }) {
  _categorias = getCategorias();
  _onOpenDrawer = onOpenDrawer;

  initRecorrenteDrawer({
    getCategorias,
    onSave: async (recorrente) => {
      await invoke('save_recorrente', { recorrente });
      await loadRecorrentes();
    },
  });

  const btnNova = document.getElementById('btn-nova-recorrente');
  if (btnNova) {
    btnNova.addEventListener('click', () => {
      updateRecorrenteDrawerCategories();
      openRecorrenteDrawer();
    });
  }

  loadRecorrentes();
}

async function loadRecorrentes() {
  try {
    _recorrentes = await invoke('get_all_recorrentes');
    renderRecorrentes();
  } catch (error) {
    console.error('Error loading recorrentes:', error);
    showToast('Erro ao carregar recorrentes');
  }
}

function renderRecorrentes() {
  const container = document.getElementById('recorrentes-list');
  if (!container) return;

  if (_recorrentes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nenhuma transação recorrente cadastrada</p>
      </div>
    `;
    return;
  }

  container.innerHTML = _recorrentes.map(r => {
    const statusClass = r.ativo ? 'is-active' : 'is-paused';
    const statusText = r.ativo ? 'Ativa' : 'Pausada';
    const valueClass = r.ativo ? (r.tipo === 'receita' ? 'is-income' : 'is-expense') : 'is-muted';
    const sign = r.tipo === 'receita' ? '+' : '-';
    const category = _categorias.find(c => c.nome === r.categoria);
    const color = category?.cor || '#94a3b8';

    return `
      <div class="recorrente-row">
        <span class="recorrente-icon ${r.tipo === 'receita' ? 'is-income' : 'is-expense'}">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M13 5A5 5 0 0 0 4.4 3.2L3 4.7"/>
            <path d="M3 2v2.7h2.7"/>
            <path d="M3 11a5 5 0 0 0 8.6 1.8L13 11.3"/>
            <path d="M13 14v-2.7h-2.7"/>
          </svg>
        </span>
        <div class="recorrente-main">
          <div class="recorrente-title">${r.descricao}</div>
          <div class="recorrente-meta">
            <span>${r.frequencia}</span>
            <span>proximo ${fmtDate(r.proximo_vencimento)}</span>
            <span><span class="cat-dot" style="background:${color}"></span>${r.categoria}</span>
          </div>
        </div>
        <span class="status-chip ${statusClass}"><span></span>${statusText}</span>
        <div class="recorrente-value ${valueClass}">${sign}${fmt(r.valor)}</div>
        <div class="recorrente-actions">
          <button class="btn-icon" onclick="editRecorrente(${r.id})" title="Editar" aria-label="Editar recorrente">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9.8 3.2 12.8 6.2"/>
              <path d="M4 12l1-3.2 6.7-6.7a1.5 1.5 0 0 1 2.1 2.1L7.1 10.9 4 12Z"/>
              <path d="M3 13h10"/>
            </svg>
          </button>
          <button class="btn-icon" onclick="toggleRecorrente(${r.id})" title="${r.ativo ? 'Pausar' : 'Retomar'}" aria-label="${r.ativo ? 'Pausar' : 'Retomar'} recorrente">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              ${r.ativo ? '<path d="M5.5 4v8M10.5 4v8"/>' : '<path d="M5 3.5 12 8l-7 4.5v-9Z"/>'}
            </svg>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="deleteRecorrente(${r.id})" title="Excluir" aria-label="Excluir recorrente">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 4h10"/>
              <path d="M6 4V2.8h4V4"/>
              <path d="M5 6v6M8 6v6M11 6v6"/>
              <path d="M4.5 4 5 14h6l.5-10"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleRecorrente = async (id) => {
  try {
    await invoke('toggle_recorrente', { id });
    await loadRecorrentes();
    showToast('Status atualizado');
  } catch (error) {
    console.error('Error toggling recorrente:', error);
    showToast('Erro ao atualizar status');
  }
};

window.deleteRecorrente = async (id) => {
  if (!confirm('Deseja excluir esta transação recorrente?')) return;

  try {
    await invoke('delete_recorrente', { id });
    await loadRecorrentes();
    showToast('Recorrente excluído');
  } catch (error) {
    console.error('Error deleting recorrente:', error);
    showToast('Erro ao excluir recorrente');
  }
};

window.editRecorrente = async (id) => {
  const recorrente = _recorrentes.find(r => r.id === id);
  if (recorrente) {
    updateRecorrenteDrawerCategories();
    openRecorrenteDrawer(recorrente);
  }
};
