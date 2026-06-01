// screens/importar.js — Tela Importar Planilha
import './styles.css';
import { parseDate, fmt, fmtDate } from '../../core/utils.js';
import { showToast } from '../../core/toast.js';
import { saveTransacao, saveCategoria } from '../../core/db.js';
import { COLORS } from '../categories/index.js';

let _getTransacoes = () => [];
let _getCategorias = () => [];
let _importRows = [];
let _onAfterImport = () => {};
let _onExport = () => {};

export function initImportar({ getTransacoes, getCategorias, onAfterImport, onExport }) {
  _getTransacoes = getTransacoes;
  _getCategorias = getCategorias;
  _onAfterImport = onAfterImport;
  _onExport = onExport || (() => {});

  initExportDates();

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', dragOver);
    dropzone.addEventListener('dragleave', dragLeave);
    dropzone.addEventListener('drop', dropFile);
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => handleFile(e));
  }

  const preview = document.getElementById('import-preview');
  if (preview) {
    preview.addEventListener('click', (e) => {
      if (e.target.closest('[data-import-confirm]')) confirmarImport();
      if (e.target.closest('[data-import-cancel]')) cancelarImport();
    });
  }

  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
}

function initExportDates() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDateInput = document.getElementById('export-start-date');
  const endDateInput = document.getElementById('export-end-date');

  if (startDateInput) {
    startDateInput.value = firstDay.toISOString().split('T')[0];
  }
  if (endDateInput) {
    endDateInput.value = lastDay.toISOString().split('T')[0];
  }
}

function handleExport() {
  const startDate = document.getElementById('export-start-date')?.value;
  const endDate = document.getElementById('export-end-date')?.value;

  if (!startDate || !endDate) {
    showToast('Selecione o período para exportar');
    return;
  }

  _onExport(startDate, endDate);
}

function dragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone')?.classList.add('drag');
}

function dragLeave() {
  document.getElementById('dropzone')?.classList.remove('drag');
}

function dropFile(e) {
  e.preventDefault();
  dragLeave();
  handleFileData(e.dataTransfer.files[0]);
}

function handleFile(e) {
  handleFileData(e.target.files[0]);
}

function handleFileData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      if (rows.length < 2) return showToast('Planilha vazia ou sem dados');
      const headers = rows[0].map((h) => (h || '').toString().toLowerCase().trim());
      const dataIdx = headers.findIndex((h) => h.includes('data'));
      const descIdx = headers.findIndex((h) => h.includes('descri'));
      const valorIdx = headers.findIndex((h) => h.includes('valor'));
      const tipoIdx = headers.findIndex((h) => h.includes('tipo'));
      const catIdx = headers.findIndex((h) => h.includes('cat'));
      if (dataIdx < 0 || descIdx < 0 || valorIdx < 0) {
        return showToast('Colunas não encontradas. Verifique o formato.');
      }
      _importRows = rows
        .slice(1)
        .filter((r) => r.length > 0 && r[valorIdx])
        .map((r) => ({
          data: parseDate(r[dataIdx]),
          descricao: (r[descIdx] || '').toString().trim(),
          valor: parseFloat((r[valorIdx] || '0').toString().replace(',', '.')),
          tipo:
            tipoIdx >= 0
              ? (r[tipoIdx] || 'despesa').toString().toLowerCase().trim()
              : 'despesa',
          categoria: catIdx >= 0 ? (r[catIdx] || 'Outros').toString().trim() : 'Outros',
          obs: ''
        }))
        .filter((r) => r.descricao && r.valor > 0 && r.data);

      if (_importRows.length === 0) return showToast('Nenhuma linha válida encontrada');
      showImportPreview();
    } catch (err) {
      showToast('Erro ao ler arquivo: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function showImportPreview() {
  const div = document.getElementById('import-table');
  if (!div) return;
  const prev = _importRows.slice(0, 10);
  div.innerHTML = `<table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Tipo</th><th>Categoria</th></tr></thead>
    <tbody>${prev
      .map(
        (r) => `<tr>
      <td>${fmtDate(r.data)}</td><td>${r.descricao}</td>
      <td class="${r.tipo === 'receita' ? 'import-preview-val--receita' : 'import-preview-val--despesa'}">${fmt(r.valor)}</td>
      <td><span class="badge ${r.tipo === 'receita' ? 'badge-green' : 'badge-red'}">${r.tipo}</span></td>
      <td>${r.categoria}</td>
    </tr>`
      )
      .join('')}</tbody>
  </table>
  ${
    _importRows.length > 10
      ? `<p class="import-preview-extra">...e mais ${_importRows.length - 10} linhas. Total: ${_importRows.length} transações.</p>`
      : ''
  }`;
  document.getElementById('import-preview')?.classList.remove('hidden');
}

async function confirmarImport() {
  let count = 0;
  const transacoes = _getTransacoes();
  const categorias = _getCategorias();
  for (const row of _importRows) {
    let cat = categorias.find(
      (c) => c.nome.toLowerCase() === row.categoria.toLowerCase() && c.tipo === row.tipo
    );
    if (!cat) {
      const cor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const newCat = { nome: row.categoria, tipo: row.tipo, cor };
      const cid = await saveCategoria(newCat);
      newCat.id = cid;
      categorias.push(newCat);
    } else {
      row.categoria = cat.nome;
    }
    const newId = await saveTransacao(row);
    row.id = newId;
    transacoes.push({ ...row });
    count++;
  }
  _importRows = [];
  document.getElementById('import-preview')?.classList.add('hidden');
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';

  showToast(`${count} transações importadas!`);
  _onAfterImport(count);
}

function cancelarImport() {
  _importRows = [];
  document.getElementById('import-preview')?.classList.add('hidden');
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';
}
