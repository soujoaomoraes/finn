// screens/categorias.js — Tela Categorias + modal
import './categorias.css';
import { saveCategoria, deleteCategoria } from '../db.js';
import { showToast } from '../toast.js';

export const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#22d3ee',
  '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#94a3b8'
];

let _getCategorias = () => [];
let _onAfterMutation = () => {};

let _selectedColor = COLORS[0];

export function initCategorias({ getCategorias, onAfterMutation }) {
  _getCategorias = getCategorias;
  _onAfterMutation = onAfterMutation;

  const overlay = document.getElementById('modal-cat-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fecharModalCategoria();
    });
  }

  const swatches = document.getElementById('color-swatches');
  if (swatches) {
    swatches.addEventListener('click', (e) => {
      const el = e.target.closest('.swatch');
      if (!el) return;
      const c = el.dataset.color;
      if (c) pickColor(c, el);
    });
  }

  const modal = document.querySelector('#modal-cat-overlay .modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-cat-cancel]')) fecharModalCategoria();
      if (e.target.closest('[data-cat-save]')) void salvarCategoria();
    });
  }

  ['despesa', 'receita'].forEach((tipo) => {
    const div = document.getElementById('list-cats-' + tipo);
    if (!div) return;
    div.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-cat]');
      const delBtn = e.target.closest('[data-delete-cat]');
      if (editBtn) editarCategoria(parseInt(editBtn.dataset.editCat, 10));
      if (delBtn) deletarCategoria(parseInt(delBtn.dataset.deleteCat, 10));
    });
  });
}

function pickColor(c, el) {
  _selectedColor = c;
  document.querySelectorAll('#color-swatches .swatch').forEach((s) => s.classList.remove('selected'));
  el.classList.add('selected');
}

export function renderColorSwatches() {
  const container = document.getElementById('color-swatches');
  if (!container) return;
  container.innerHTML = COLORS.map(
    (c) =>
      `<div class="swatch ${_selectedColor === c ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`
  ).join('');
}

export function renderCategorias() {
  const categorias = _getCategorias();
  ['despesa', 'receita'].forEach((tipo) => {
    const div = document.getElementById('list-cats-' + tipo);
    if (!div) return;
    const cats = categorias.filter((c) => c.tipo === tipo);
    if (cats.length === 0) {
      div.innerHTML = '<div class="cat-list-empty">Nenhuma categoria</div>';
      return;
    }
    div.innerHTML = cats
      .map(
        (c) => `
      <div class="cat-row">
        <div class="cat-color-dot" style="background:${c.cor}"></div>
        <div class="cat-name">${c.nome}</div>
        <button type="button" class="btn-icon" data-edit-cat="${c.id}" title="Editar">✏️</button>
        <button type="button" class="btn-icon" data-delete-cat="${c.id}" title="Excluir" style="margin-left:4px">🗑️</button>
      </div>`
      )
      .join('');
  });
}

export function abrirModalCategoria() {
  _selectedColor = COLORS[0];
  renderColorSwatches();
  document.getElementById('mc-id').value = '';
  document.getElementById('mc-nome').value = '';
  document.getElementById('mc-tipo').value = 'despesa';
  document.getElementById('modal-cat-title').textContent = 'Nova Categoria';
  document.getElementById('modal-cat-overlay').classList.remove('hidden');
}

function editarCategoria(id) {
  const categorias = _getCategorias();
  const c = categorias.find((x) => x.id === id);
  if (!c) return;
  _selectedColor = c.cor;
  renderColorSwatches();
  document.getElementById('mc-id').value = c.id;
  document.getElementById('mc-nome').value = c.nome;
  document.getElementById('mc-tipo').value = c.tipo;
  document.getElementById('modal-cat-title').textContent = 'Editar Categoria';
  document.getElementById('modal-cat-overlay').classList.remove('hidden');
}

export function fecharModalCategoria() {
  document.getElementById('modal-cat-overlay').classList.add('hidden');
}

export async function salvarCategoria() {
  const id = document.getElementById('mc-id').value;
  const nome = document.getElementById('mc-nome').value.trim();
  const tipo = document.getElementById('mc-tipo').value;
  if (!nome) return showToast('Informe o nome');

  const categorias = _getCategorias();
  const obj = { nome, tipo, cor: _selectedColor };
  if (id) obj.id = parseInt(id, 10);
  const newId = await saveCategoria(obj);
  if (!id) obj.id = newId;
  if (id) {
    const idx = categorias.findIndex((c) => c.id === parseInt(id, 10));
    if (idx >= 0) categorias[idx] = obj;
  } else categorias.push(obj);

  fecharModalCategoria();
  renderCategorias();
  _onAfterMutation();
  showToast('Categoria salva!');
}

async function deletarCategoria(id) {
  if (!confirm('Excluir esta categoria?')) return;
  await deleteCategoria(id);
  const categorias = _getCategorias();
  const idx = categorias.findIndex((c) => c.id === id);
  if (idx >= 0) categorias.splice(idx, 1);
  renderCategorias();
  _onAfterMutation();
  showToast('Categoria excluída');
}

export function bindNovaCategoriaButton() {
  const btn = document.querySelector('[data-action="nova-categoria"]');
  if (btn) btn.addEventListener('click', () => abrirModalCategoria());
}
