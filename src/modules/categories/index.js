// screens/categorias.js — Tela Categorias + modal
import './styles.css';
import { saveCategoria, deleteCategoria } from '../../core/db.js';
import { showToast } from '../../core/toast.js';

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
      const tipoBtn = e.target.closest('[data-cat-tipo]');
      if (tipoBtn) setCategoriaTipo(tipoBtn.dataset.catTipo);
      if (e.target.closest('[data-cat-cancel]')) fecharModalCategoria();
      if (e.target.closest('[data-cat-save]')) void salvarCategoria();
    });
  }

  ['despesa', 'receita', 'reserva'].forEach((tipo) => {
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

function setCategoriaTipo(tipo) {
  const input = document.getElementById('mc-tipo');
  if (input) input.value = tipo;
  document.querySelectorAll('[data-cat-tipo]').forEach((button) => {
    button.classList.toggle('active', button.dataset.catTipo === tipo);
  });
}

export function renderColorSwatches() {
  const container = document.getElementById('color-swatches');
  if (!container) return;
  container.innerHTML = COLORS.map(
    (c) =>
      `<button type="button" class="swatch ${_selectedColor === c ? 'selected' : ''}" data-color="${c}" style="background:${c}" aria-label="Selecionar cor ${c}"></button>`
  ).join('');
}

export function renderCategorias() {
  const categorias = _getCategorias();
  ['despesa', 'receita', 'reserva'].forEach((tipo) => {
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
        <div class="cat-actions">
          <button type="button" class="btn-icon" data-edit-cat="${c.id}" title="Editar" aria-label="Editar categoria">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9.8 3.2 12.8 6.2"/>
              <path d="M4 12l1-3.2 6.7-6.7a1.5 1.5 0 0 1 2.1 2.1L7.1 10.9 4 12Z"/>
              <path d="M3 13h10"/>
            </svg>
          </button>
          <button type="button" class="btn-icon btn-icon-danger" data-delete-cat="${c.id}" title="Excluir" aria-label="Excluir categoria">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 4h10"/>
              <path d="M6 4V2.8h4V4"/>
              <path d="M5 6v6M8 6v6M11 6v6"/>
              <path d="M4.5 4 5 14h6l.5-10"/>
            </svg>
          </button>
        </div>
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
  setCategoriaTipo('despesa');
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
  setCategoriaTipo(c.tipo);
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
