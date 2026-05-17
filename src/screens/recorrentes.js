// screens/recorrentes.js — Tela Recorrentes
import './recorrentes.css';
import { invoke } from '@tauri-apps/api/core';
import { showToast } from '../toast.js';
import { initRecorrenteDrawer, openRecorrenteDrawer, updateRecorrenteDrawerCategories } from '../components/recorrente-drawer.js';

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

  let html = '<table><thead><tr><th>Descrição</th><th>Valor</th><th>Frequência</th><th>Próximo Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>';

  _recorrentes.forEach(r => {
    const statusBadge = r.ativo 
      ? '<span class="badge badge-green">Ativo</span>'
      : '<span class="badge badge-gray">Inativo</span>';
    
    html += `
      <tr>
        <td>${r.descricao}</td>
        <td>R$ ${r.valor.toFixed(2)}</td>
        <td>${r.frequencia}</td>
        <td>${r.proximo_vencimento}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="editRecorrente(${r.id})">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="toggleRecorrente(${r.id})">Toggle</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRecorrente(${r.id})">Excluir</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
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
