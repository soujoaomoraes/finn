// src/modules/metas/index.js — Tela Metas (CRUD + progresso)
import './styles.css';
import { getAllMetas, saveMeta, deleteMeta, toggleMeta } from '../../core/db.js';
import { showToast } from '../../core/toast.js';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';

const PERIOD_LABELS = {
  mensal: 'mensal',
  trimestral: 'trimestral',
  anual: 'anual',
  especifico: 'período',
};

const TIPO_COLORS = {
  receita: 'var(--green)',
  despesa: 'var(--red)',
  reserva: 'var(--purple)',
};

const TIPO_LABELS = {
  receita: 'Receitas',
  despesa: 'Despesas',
  reserva: 'Reservas',
};

let _getCategorias = () => [];
let _metas = [];
let _editingMeta = null;

function getPeriodoRange(periodo, dataInicio, dataLimite) {
  const now = new Date();
  if (periodo === 'mensal') return { ini: format(startOfMonth(now), 'yyyy-MM-dd'), fim: format(endOfMonth(now), 'yyyy-MM-dd') };
  if (periodo === 'trimestral') return { ini: format(startOfQuarter(now), 'yyyy-MM-dd'), fim: format(endOfQuarter(now), 'yyyy-MM-dd') };
  if (periodo === 'anual') return { ini: format(startOfYear(now), 'yyyy-MM-dd'), fim: format(endOfYear(now), 'yyyy-MM-dd') };
  return { ini: dataInicio, fim: dataLimite || format(now, 'yyyy-MM-dd') };
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function getMetaColor(meta) {
  const pct = meta.percentual ?? 0;
  if (meta.tipo === 'reserva') return 'var(--purple)';
  if (meta.tipo === 'receita') return pct >= 100 ? 'var(--green)' : 'var(--blue)';
  // despesa
  if (pct >= 100) return 'var(--red)';
  if (pct >= 80) return 'var(--amber)';
  return 'var(--green)';
}

function getMetaStatus(meta) {
  const pct = meta.percentual ?? 0;
  const restante = meta.valor_meta - meta.valor_realizado;
  if (meta.tipo === 'reserva') {
    if (pct >= 100) return { left: 'Meta atingida', right: '✓ Concluída', rightColor: 'var(--green)' };
    return { left: `${fmtBRL(restante)} restantes`, right: 'Em andamento', rightColor: 'var(--purple)' };
  }
  if (meta.tipo === 'receita') {
    if (pct >= 100) return { left: 'Meta atingida', right: '✓ Concluída', rightColor: 'var(--green)' };
    return { left: `${fmtBRL(restante)} restantes`, right: 'No caminho certo', rightColor: 'var(--green)' };
  }
  // despesa (menor = melhor)
  if (pct >= 100) return { left: `${fmtBRL(-restante)} acima do limite`, right: '⚠ Ultrapassado', rightColor: 'var(--red)' };
  if (pct >= 80) return { left: `${fmtBRL(restante)} disponíveis`, right: 'Atenção', rightColor: 'var(--amber)' };
  return { left: `${fmtBRL(restante)} disponíveis`, right: 'Sob controle', rightColor: 'var(--green)' };
}

function renderMetaCard(meta) {
  const color = getMetaColor(meta);
  const pct = Math.min(meta.percentual ?? 0, 100);
  const status = getMetaStatus(meta);
  const periodLabel = PERIOD_LABELS[meta.periodo] || meta.periodo;
  const inactiveClass = meta.ativa ? '' : 'meta-card-inactive';

  return `
    <div class="meta-card ${inactiveClass}" data-meta-id="${meta.id}">
      <div class="meta-card-top">
        <div style="display:flex;align-items:center;gap:0;">
          <div class="meta-cat">
            <div class="meta-dot" style="background:${meta.categoria_cor}"></div>
            <span class="meta-name">${meta.categoria_nome}</span>
          </div>
          <span class="meta-period-badge">${periodLabel}</span>
        </div>
        <div class="meta-card-actions">
          <button type="button" class="btn-icon" data-meta-toggle="${meta.id}" title="${meta.ativa ? 'Desativar' : 'Ativar'}" aria-label="${meta.ativa ? 'Desativar' : 'Ativar'} meta">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px">
              ${meta.ativa
                ? '<path d="M8 3v10M3 8h10"/>'
                : '<circle cx="8" cy="8" r="5"/><path d="M8 6v2l1.5 1.5"/>'}
            </svg>
          </button>
          <button type="button" class="btn-icon" data-meta-edit="${meta.id}" title="Editar" aria-label="Editar meta">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px">
              <path d="M9.8 3.2 12.8 6.2"/><path d="M4 12l1-3.2 6.7-6.7a1.5 1.5 0 0 1 2.1 2.1L7.1 10.9 4 12Z"/><path d="M3 13h10"/>
            </svg>
          </button>
          <button type="button" class="btn-icon btn-icon-danger" data-meta-delete="${meta.id}" title="Excluir" aria-label="Excluir meta">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px">
              <path d="M3 4h10"/><path d="M6 4V2.8h4V4"/><path d="M5 6v6M8 6v6M11 6v6"/><path d="M4.5 4 5 14h6l.5-10"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="meta-vals">
        <span class="meta-realizado" style="color:${color}">${fmtBRL(meta.valor_realizado)}</span>
        <span class="meta-sep">/</span>
        <span class="meta-alvo">${fmtBRL(meta.valor_meta)}</span>
        <span class="meta-pct" style="color:${color}">${Math.round(meta.percentual ?? 0)}%</span>
      </div>
      <div class="meta-track">
        <div class="meta-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="meta-label-row">
        <span class="meta-status">${status.left}</span>
        <span class="meta-status" style="color:${status.rightColor}">${status.right}</span>
      </div>
    </div>`;
}

export function renderMetas() {
  const grid = document.getElementById('metas-grid');
  if (!grid) return;

  const tipos = ['receita', 'despesa', 'reserva'];

  grid.innerHTML = tipos.map((tipo) => {
    const tipoMetas = _metas.filter((m) => m.tipo === tipo);
    const color = TIPO_COLORS[tipo];
    const label = TIPO_LABELS[tipo];
    const cards = tipoMetas.map(renderMetaCard).join('');

    return `
      <div>
        <div class="metas-col-header">
          <div class="metas-col-title" style="color:${color}">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
            ${label}
          </div>
          <span class="metas-col-count">${tipoMetas.length} meta${tipoMetas.length !== 1 ? 's' : ''}</span>
        </div>
        ${cards}
        <button class="meta-add-btn" data-meta-add="${tipo}">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Adicionar meta de ${tipo}
        </button>
      </div>`;
  }).join('');
}

async function loadMetas() {
  const now = new Date();
  const ini = format(startOfYear(now), 'yyyy-MM-dd');
  const fim = format(endOfYear(now), 'yyyy-MM-dd');
  try {
    _metas = await getAllMetas(ini, fim);
  } catch (e) {
    console.error('Erro ao carregar metas:', e);
    _metas = [];
  }
  renderMetas();
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function abrirModalMeta(tipo = 'despesa', metaExistente = null) {
  _editingMeta = metaExistente;
  const overlay = document.getElementById('modal-meta-overlay');
  const title = document.getElementById('modal-meta-title');
  const categorias = _getCategorias().filter((c) => c.tipo === tipo);

  if (metaExistente) {
    title.textContent = 'Editar Meta';
    document.getElementById('mm-tipo').value = metaExistente.tipo;
    populateMetaCatSelect(metaExistente.tipo, metaExistente.categoria_id);
    document.getElementById('mm-valor').value = metaExistente.valor_meta;
    document.getElementById('mm-periodo').value = metaExistente.periodo;
    document.getElementById('mm-inicio').value = metaExistente.data_inicio;
    document.getElementById('mm-limite').value = metaExistente.data_limite || '';
  } else {
    title.textContent = 'Nova Meta';
    document.getElementById('mm-tipo').value = tipo;
    populateMetaCatSelect(tipo);
    document.getElementById('mm-valor').value = '';
    document.getElementById('mm-periodo').value = 'mensal';
    const hoje = format(new Date(), 'yyyy-MM-dd');
    document.getElementById('mm-inicio').value = hoje;
    document.getElementById('mm-limite').value = '';
  }

  updateMetaLimiteVisibility();
  overlay.classList.remove('hidden');
}

function populateMetaCatSelect(tipo, selectedId = null) {
  const sel = document.getElementById('mm-cat');
  if (!sel) return;
  const cats = _getCategorias().filter((c) => c.tipo === tipo);
  sel.innerHTML = cats.map((c) =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.nome}</option>`
  ).join('');
  if (cats.length === 0) sel.innerHTML = '<option value="">— Nenhuma categoria —</option>';
}

function updateMetaLimiteVisibility() {
  const periodo = document.getElementById('mm-periodo')?.value;
  const limiteGroup = document.getElementById('mm-limite-group');
  if (limiteGroup) limiteGroup.style.display = periodo === 'especifico' ? 'flex' : 'none';
}

function fecharModalMeta() {
  document.getElementById('modal-meta-overlay').classList.add('hidden');
  _editingMeta = null;
}

async function salvarMeta() {
  const tipo = document.getElementById('mm-tipo').value;
  const cat = parseInt(document.getElementById('mm-cat').value, 10);
  const valor = parseFloat(document.getElementById('mm-valor').value.replace(',', '.'));
  const periodo = document.getElementById('mm-periodo').value;
  const inicio = document.getElementById('mm-inicio').value;
  const limite = document.getElementById('mm-limite').value || null;

  if (!cat || isNaN(cat)) return showToast('Selecione uma categoria');
  if (isNaN(valor) || valor <= 0) return showToast('Informe um valor válido');
  if (!inicio) return showToast('Informe a data de início');

  const meta = {
    id: _editingMeta ? _editingMeta.id : null,
    categoria_id: cat,
    tipo,
    valor_meta: valor,
    periodo,
    data_inicio: inicio,
    data_limite: limite,
    ativa: true,
  };

  try {
    await saveMeta(meta);
    await loadMetas();
    fecharModalMeta();
    showToast(_editingMeta ? 'Meta atualizada!' : 'Meta criada!');
  } catch (e) {
    showToast('Erro ao salvar: ' + e);
  }
}

async function excluirMeta(id) {
  if (!confirm('Excluir esta meta?')) return;
  try {
    await deleteMeta(id);
    _metas = _metas.filter((m) => m.id !== id);
    renderMetas();
    showToast('Meta excluída');
  } catch (e) {
    showToast('Erro ao excluir: ' + e);
  }
}

async function alternarMeta(id) {
  try {
    await toggleMeta(id);
    await loadMetas();
  } catch (e) {
    showToast('Erro: ' + e);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initMetas({ getCategorias }) {
  _getCategorias = getCategorias;

  // Grid delegated click
  const grid = document.getElementById('metas-grid');
  if (grid) {
    grid.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('[data-meta-add]');
      const editBtn = e.target.closest('[data-meta-edit]');
      const delBtn = e.target.closest('[data-meta-delete]');
      const toggleBtn = e.target.closest('[data-meta-toggle]');

      if (addBtn) abrirModalMeta(addBtn.dataset.metaAdd);
      if (editBtn) {
        const meta = _metas.find((m) => m.id === parseInt(editBtn.dataset.metaEdit, 10));
        if (meta) abrirModalMeta(meta.tipo, meta);
      }
      if (delBtn) await excluirMeta(parseInt(delBtn.dataset.metaDelete, 10));
      if (toggleBtn) await alternarMeta(parseInt(toggleBtn.dataset.metaToggle, 10));
    });
  }

  // "Nova meta" header button
  const btnNova = document.getElementById('btn-nova-meta');
  if (btnNova) btnNova.addEventListener('click', () => abrirModalMeta('despesa'));

  // Modal
  const overlay = document.getElementById('modal-meta-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModalMeta(); });
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-meta-cancel]')) fecharModalMeta();
      if (e.target.closest('[data-meta-save]')) void salvarMeta();
    });
  }

  // Tipo select → repopulate categorias
  const tipoSel = document.getElementById('mm-tipo');
  if (tipoSel) tipoSel.addEventListener('change', () => populateMetaCatSelect(tipoSel.value));

  // Periodo select → toggle data-limite visibility
  const periodoSel = document.getElementById('mm-periodo');
  if (periodoSel) periodoSel.addEventListener('change', updateMetaLimiteVisibility);
}

export async function onNavigateMetas() {
  await loadMetas();
}
