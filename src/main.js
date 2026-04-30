// ===== DB (Tauri) =====
const { invoke } = window.__TAURI__.core;

async function initDB() {
  // Backend Rust handles schema initialization
  return Promise.resolve();
}

async function dbGetAll(store) {
  if (store === 'transacoes') return await invoke('get_all_transacoes');
  if (store === 'categorias') return await invoke('get_all_categorias');
  return [];
}

async function dbPut(store, obj) {
  if (store === 'transacoes') return await invoke('save_transacao', { transacao: obj });
  if (store === 'categorias') return await invoke('save_categoria', { categoria: obj });
  return null;
}

async function dbDelete(store, id) {
  if (store === 'transacoes') await invoke('delete_transacao', { id });
  if (store === 'categorias') await invoke('delete_categoria', { id });
}

// ===== STATE =====
let transacoes = [], categorias = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let importRows = [];
let editMode = false;

const COLORS = [
  '#f87171','#fb923c','#fbbf24','#a3e635',
  '#4ade80','#34d399','#22d3ee','#60a5fa',
  '#818cf8','#c084fc','#f472b6','#94a3b8'
];

// ===== INIT =====
async function init() {
  await initDB();
  transacoes = await dbGetAll('transacoes');
  categorias = await dbGetAll('categorias');

  if (categorias.length === 0) await seedCategories();

  renderColorSwatches();
  updateMonthLabel();
  renderDashboard();
  renderLancamentos();
  renderCategorias();
  populateFilters();
  setTodayDate();
}

async function seedCategories() {
  const defaults = [
    {nome:'Alimentação', tipo:'despesa', cor:'#fb923c'},
    {nome:'Transporte', tipo:'despesa', cor:'#60a5fa'},
    {nome:'Moradia', tipo:'despesa', cor:'#818cf8'},
    {nome:'Saúde', tipo:'despesa', cor:'#f472b6'},
    {nome:'Lazer', tipo:'despesa', cor:'#4ade80'},
    {nome:'Educação', tipo:'despesa', cor:'#22d3ee'},
    {nome:'Outros', tipo:'despesa', cor:'#94a3b8'},
    {nome:'Salário', tipo:'receita', cor:'#4ade80'},
    {nome:'Freelance', tipo:'receita', cor:'#34d399'},
    {nome:'Investimentos', tipo:'receita', cor:'#fbbf24'},
    {nome:'Outros', tipo:'receita', cor:'#94a3b8'},
  ];
  for (const c of defaults) { const id = await dbPut('categorias', c); c.id = id; }
  categorias = defaults;
}

// ===== NAV =====
function go(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-'+sec).classList.add('active');
  const btn = [...document.querySelectorAll('.nav-item')].find(b => b.getAttribute('onclick')?.includes("'"+sec+"'"));
  if (btn) btn.classList.add('active');

  if (sec === 'dashboard') renderDashboard();
  if (sec === 'lancamentos') renderLancamentos();
  if (sec === 'categorias') renderCategorias();
  if (sec === 'novo' && !editMode) {
    resetForm();
    document.getElementById('form-page-title').textContent = 'Nova Transação';
  }
}

// ===== MONTH =====
function changeMonth(d) {
  currentMonth += d;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  updateMonthLabel();
  renderDashboard();
}

function updateMonthLabel() {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  document.getElementById('month-label').textContent = months[currentMonth]+' '+currentYear;
}

function getMonthTransactions(m, y) {
  return transacoes.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === m && d.getFullYear() === y;
  });
}

// ===== DASHBOARD =====
function renderDashboard() {
  const mt = getMonthTransactions(currentMonth, currentYear);
  const receitas = mt.filter(t=>t.tipo==='receita').reduce((a,b)=>a+b.valor,0);
  const despesas = mt.filter(t=>t.tipo==='despesa').reduce((a,b)=>a+b.valor,0);
  const saldo = receitas - despesas;
  const total = transacoes.reduce((a,b)=> b.tipo==='receita' ? a+b.valor : a-b.valor, 0);

  document.getElementById('d-receitas').textContent = fmt(receitas);
  document.getElementById('d-despesas').textContent = fmt(despesas);
  document.getElementById('d-saldo').textContent = fmt(saldo);
  document.getElementById('d-acumulado').textContent = fmt(total);

  // Categoria breakdown
  const bycat = {};
  mt.filter(t=>t.tipo==='despesa').forEach(t => {
    bycat[t.categoria] = (bycat[t.categoria]||0) + t.valor;
  });
  const catDiv = document.getElementById('cat-breakdown');
  const sorted = Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
  if (sorted.length === 0) {
    catDiv.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Sem gastos neste mês</p></div>';
  } else {
    catDiv.innerHTML = sorted.map(([cat, val]) => {
      const c = categorias.find(x=>x.nome===cat);
      const cor = c ? c.cor : '#94a3b8';
      const pct = despesas > 0 ? (val/despesas*100) : 0;
      return `<div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;"><span class="cat-dot" style="background:${cor}"></span>${cat}</span>
          <span style="font-size:13px;color:var(--text2)">${fmt(val)} <span style="color:var(--text3);font-size:11px;">${pct.toFixed(0)}%</span></span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cor}"></div></div>
      </div>`;
    }).join('');
  }

  // Recent
  const recent = [...transacoes].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,6);
  const recDiv = document.getElementById('recent-list');
  if (recent.length === 0) {
    recDiv.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Nenhuma transação ainda</p></div>';
  } else {
    recDiv.innerHTML = recent.map(t => {
      const c = categorias.find(x=>x.nome===t.categoria);
      const cor = c ? c.cor : '#94a3b8';
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
        <span class="cat-dot" style="background:${cor};width:8px;height:8px;border-radius:50%;flex-shrink:0"></span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.descricao}</div>
          <div style="font-size:11px;color:var(--text3);">${fmtDate(t.data)} · ${t.categoria}</div>
        </div>
        <span style="font-size:13px;font-weight:500;color:${t.tipo==='receita'?'var(--green)':'var(--red)'};">${t.tipo==='receita'?'+':'-'}${fmt(t.valor)}</span>
      </div>`;
    }).join('');
  }

  // Monthly chart
  renderMonthlyChart();
}

function renderMonthlyChart() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i, y = currentYear;
    if (m < 0) { m += 12; y--; }
    months.push({m, y});
  }
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const data = months.map(({m,y}) => {
    const mt = getMonthTransactions(m,y);
    return {
      label: names[m],
      rec: mt.filter(t=>t.tipo==='receita').reduce((a,b)=>a+b.valor,0),
      des: mt.filter(t=>t.tipo==='despesa').reduce((a,b)=>a+b.valor,0),
    };
  });
  const max = Math.max(...data.flatMap(d=>[d.rec, d.des]), 1);

  document.getElementById('monthly-chart').innerHTML = `
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text3);"><span style="width:10px;height:10px;background:var(--green);border-radius:2px;display:inline-block"></span>Receitas</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text3);margin-left:12px;"><span style="width:10px;height:10px;background:var(--red);border-radius:2px;display:inline-block"></span>Despesas</div>
    </div>
    <div class="bar-chart">
      ${data.map(d=>`
        <div class="bar-wrap">
          <div style="display:flex;gap:3px;height:calc(100% - 30px);align-items:flex-end;width:100%;">
            <div class="bar" style="background:var(--green);height:${(d.rec/max*100)}%;flex:1" title="Receita: ${fmt(d.rec)}"></div>
            <div class="bar" style="background:var(--red);height:${(d.des/max*100)}%;flex:1" title="Despesa: ${fmt(d.des)}"></div>
          </div>
          <div class="bar-label">${d.label}</div>
        </div>`).join('')}
    </div>`;
}

// ===== LANÇAMENTOS =====
function populateFilters() {
  const sel = document.getElementById('filter-mes');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const years = [...new Set(transacoes.map(t=>new Date(t.data).getFullYear()))].sort().reverse();
  sel.innerHTML = '<option value="">Todos</option>';
  for (let y of (years.length ? years : [currentYear])) {
    for (let m=11; m>=0; m--) {
      sel.innerHTML += `<option value="${y}-${m}">${months[m]} ${y}</option>`;
    }
  }
  sel.value = `${currentYear}-${currentMonth}`;

  const catSel = document.getElementById('filter-cat');
  catSel.innerHTML = '<option value="">Todas</option>' + categorias.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
}

function renderLancamentos() {
  const mes = document.getElementById('filter-mes').value;
  const tipo = document.getElementById('filter-tipo').value;
  const cat = document.getElementById('filter-cat').value;
  const busca = document.getElementById('filter-busca').value.toLowerCase();

  let data = [...transacoes].sort((a,b)=>new Date(b.data)-new Date(a.data));

  if (mes) {
    const [y,m] = mes.split('-').map(Number);
    data = data.filter(t=>{ const d=new Date(t.data); return d.getFullYear()===y && d.getMonth()===m; });
  }
  if (tipo) data = data.filter(t=>t.tipo===tipo);
  if (cat) data = data.filter(t=>t.categoria===cat);
  if (busca) data = data.filter(t=>t.descricao.toLowerCase().includes(busca));

  const totalRec = data.filter(t=>t.tipo==='receita').reduce((a,b)=>a+b.valor,0);
  const totalDes = data.filter(t=>t.tipo==='despesa').reduce((a,b)=>a+b.valor,0);

  const div = document.getElementById('table-lancamentos');
  if (data.length === 0) {
    div.innerHTML = '<div class="empty-state"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Nenhuma transação encontrada</p></div>';
  } else {
    div.innerHTML = `<table>
      <thead><tr>
        <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th><th></th>
      </tr></thead>
      <tbody>
      ${data.map(t => {
        const c = categorias.find(x=>x.nome===t.categoria);
        const cor = c ? c.cor : '#94a3b8';
        return `<tr>
          <td style="color:var(--text2);white-space:nowrap">${fmtDate(t.data)}</td>
          <td>${t.descricao}${t.obs ? `<div style="font-size:11px;color:var(--text3)">${t.obs}</div>`:''}
          </td>
          <td><span class="cat-dot" style="background:${cor}"></span>${t.categoria}</td>
          <td><span class="badge ${t.tipo==='receita'?'badge-green':'badge-red'}">${t.tipo}</span></td>
          <td style="text-align:right;font-weight:500;color:${t.tipo==='receita'?'var(--green)':'var(--red)'}">
            ${t.tipo==='receita'?'+':'-'}${fmt(t.valor)}
          </td>
          <td style="white-space:nowrap;text-align:right;">
            <button class="btn-icon" onclick="editarTransacao(${t.id})" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deletarTransacao(${t.id})" title="Excluir" style="margin-left:4px">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
      <tr class="totals-row">
        <td colspan="4" style="color:var(--text3);font-size:12px;padding-top:14px">Total filtrado</td>
        <td style="text-align:right;padding-top:14px;font-size:13px">
          <span style="color:var(--green)">${fmt(totalRec)}</span> <span style="color:var(--text3)">/ </span><span style="color:var(--red)">${fmt(totalDes)}</span>
        </td>
        <td></td>
      </tr>
      </tbody>
    </table>`;
  }
  document.getElementById('table-summary').textContent = `${data.length} transaç${data.length===1?'ão':'ões'}`;
}

// ===== FORM TRANSAÇÃO =====
function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-data').value = today;
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

function cancelarForm() { editMode = false; go('lancamentos'); }

async function salvarTransacao() {
  const id = document.getElementById('f-id').value;
  const desc = document.getElementById('f-desc').value.trim();
  const valor = parseFloat(document.getElementById('f-valor').value);
  const data = document.getElementById('f-data').value;
  const tipo = document.getElementById('f-tipo').value;
  const cat = document.getElementById('f-cat').value;
  const obs = document.getElementById('f-obs').value.trim();

  if (!desc) return toast('Informe a descrição');
  if (!valor || valor <= 0) return toast('Informe um valor válido');
  if (!data) return toast('Informe a data');

  const obj = {descricao:desc, valor, data, tipo, categoria:cat, obs};
  if (id) obj.id = parseInt(id);

  const newId = await dbPut('transacoes', obj);
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
  updateMonthLabel();

  toast(id ? 'Transação atualizada!' : 'Transação salva!');
  populateFilters();
  editMode = false;
  go('lancamentos');
}

function editarTransacao(id) {
  const t = transacoes.find(x=>x.id===id);
  if (!t) return;
  editMode = true;
  go('novo');
  document.getElementById('form-page-title').textContent = 'Editar Transação';
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
  setTimeout(()=>{ document.getElementById('f-cat').value = t.categoria; }, 50);
}

async function deletarTransacao(id) {
  if (!confirm('Excluir esta transação?')) return;
  await dbDelete('transacoes', id);
  transacoes = transacoes.filter(t=>t.id!==id);
  renderLancamentos();
  renderDashboard();
  toast('Transação excluída');
}

// ===== CATEGORIAS =====
function renderCategorias() {
  ['despesa','receita'].forEach(tipo => {
    const div = document.getElementById('list-cats-'+tipo);
    const cats = categorias.filter(c=>c.tipo===tipo);
    if (cats.length === 0) {
      div.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0;">Nenhuma categoria</div>';
      return;
    }
    div.innerHTML = cats.map(c=>`
      <div class="cat-row">
        <div class="cat-color-dot" style="background:${c.cor}"></div>
        <div class="cat-name">${c.nome}</div>
        <button class="btn-icon" onclick="editarCategoria(${c.id})" title="Editar">✏️</button>
        <button class="btn-icon" onclick="deletarCategoria(${c.id})" title="Excluir" style="margin-left:4px">🗑️</button>
      </div>`).join('');
  });
}

let selectedColor = COLORS[0];

function renderColorSwatches() {
  document.getElementById('color-swatches').innerHTML = COLORS.map(c=>
    `<div class="swatch ${c===selectedColor?'selected':''}" style="background:${c}" onclick="pickColor('${c}', this)"></div>`
  ).join('');
}

function pickColor(c, el) {
  selectedColor = c;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
}

function abrirModalCategoria(id) {
  selectedColor = COLORS[0];
  renderColorSwatches();
  document.getElementById('mc-id').value = '';
  document.getElementById('mc-nome').value = '';
  document.getElementById('mc-tipo').value = 'despesa';
  document.getElementById('modal-cat-title').textContent = 'Nova Categoria';
  document.getElementById('modal-cat-overlay').classList.remove('hidden');
}

function editarCategoria(id) {
  const c = categorias.find(x=>x.id===id);
  if (!c) return;
  selectedColor = c.cor;
  renderColorSwatches();
  document.getElementById('mc-id').value = c.id;
  document.getElementById('mc-nome').value = c.nome;
  document.getElementById('mc-tipo').value = c.tipo;
  document.getElementById('modal-cat-title').textContent = 'Editar Categoria';
  document.getElementById('modal-cat-overlay').classList.remove('hidden');
}

function fecharModalCategoria() {
  document.getElementById('modal-cat-overlay').classList.add('hidden');
}

async function salvarCategoria() {
  const id = document.getElementById('mc-id').value;
  const nome = document.getElementById('mc-nome').value.trim();
  const tipo = document.getElementById('mc-tipo').value;
  if (!nome) return toast('Informe o nome');
  const obj = {nome, tipo, cor: selectedColor};
  if (id) obj.id = parseInt(id);
  const newId = await dbPut('categorias', obj);
  if (!id) obj.id = newId;
  if (id) {
    const idx = categorias.findIndex(c=>c.id===parseInt(id));
    if (idx>=0) categorias[idx]=obj;
  } else categorias.push(obj);
  fecharModalCategoria();
  renderCategorias();
  updateCatSelects();
  toast('Categoria salva!');
}

async function deletarCategoria(id) {
  if (!confirm('Excluir esta categoria?')) return;
  await dbDelete('categorias', id);
  categorias = categorias.filter(c=>c.id!==id);
  renderCategorias();
  updateCatSelects();
  toast('Categoria excluída');
}

function updateCatSelects() {
  const tipo = document.getElementById('f-tipo').value;
  populateCatSelect(tipo);
  const catSel = document.getElementById('filter-cat');
  catSel.innerHTML = '<option value="">Todas</option>' + categorias.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
}

// ===== IMPORTAR =====
function dragOver(e) { e.preventDefault(); document.getElementById('dropzone').classList.add('drag'); }
function dragLeave() { document.getElementById('dropzone').classList.remove('drag'); }
function dropFile(e) { e.preventDefault(); dragLeave(); handleFileData(e.dataTransfer.files[0]); }
function handleFile(e) { handleFileData(e.target.files[0]); }

function handleFileData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:false});
      if (rows.length < 2) return toast('Planilha vazia ou sem dados');
      const headers = rows[0].map(h=>(h||'').toString().toLowerCase().trim());
      const dataIdx = headers.findIndex(h=>h.includes('data'));
      const descIdx = headers.findIndex(h=>h.includes('descri'));
      const valorIdx = headers.findIndex(h=>h.includes('valor'));
      const tipoIdx = headers.findIndex(h=>h.includes('tipo'));
      const catIdx = headers.findIndex(h=>h.includes('cat'));
      if (dataIdx<0||descIdx<0||valorIdx<0) return toast('Colunas não encontradas. Verifique o formato.');
      importRows = rows.slice(1).filter(r=>r.length>0&&r[valorIdx]).map(r=>{
        return {
          data: parseDate(r[dataIdx]),
          descricao: (r[descIdx]||'').toString().trim(),
          valor: parseFloat((r[valorIdx]||'0').toString().replace(',','.')),
          tipo: tipoIdx>=0 ? (r[tipoIdx]||'despesa').toString().toLowerCase().trim() : 'despesa',
          categoria: catIdx>=0 ? (r[catIdx]||'Outros').toString().trim() : 'Outros',
          obs: ''
        };
      }).filter(r=>r.descricao && r.valor>0 && r.data);

      if (importRows.length === 0) return toast('Nenhuma linha válida encontrada');
      showImportPreview();
    } catch(err) { toast('Erro ao ler arquivo: '+err.message); }
  };
  reader.readAsBinaryString(file);
}

function parseDate(v) {
  if (!v) return null;
  const s = v.toString().trim();
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d,m,y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000) {
    const d = new Date((n - 25569)*86400*1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

function showImportPreview() {
  const div = document.getElementById('import-table');
  const prev = importRows.slice(0,10);
  div.innerHTML = `<table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Tipo</th><th>Categoria</th></tr></thead>
    <tbody>${prev.map(r=>`<tr>
      <td>${fmtDate(r.data)}</td><td>${r.descricao}</td>
      <td style="color:${r.tipo==='receita'?'var(--green)':'var(--red)'}">${fmt(r.valor)}</td>
      <td><span class="badge ${r.tipo==='receita'?'badge-green':'badge-red'}">${r.tipo}</span></td>
      <td>${r.categoria}</td>
    </tr>`).join('')}</tbody>
  </table>
  ${importRows.length>10?`<p style="font-size:12px;color:var(--text3);margin-top:8px;">...e mais ${importRows.length-10} linhas. Total: ${importRows.length} transações.</p>`:''}`;
  document.getElementById('import-preview').classList.remove('hidden');
}

async function confirmarImport() {
  let count = 0;
  for (const row of importRows) {
    // criar categoria se não existir
    let cat = categorias.find(c=>c.nome.toLowerCase()===row.categoria.toLowerCase() && c.tipo===row.tipo);
    if (!cat) {
      const cor = COLORS[Math.floor(Math.random()*COLORS.length)];
      const newCat = {nome: row.categoria, tipo: row.tipo, cor};
      const cid = await dbPut('categorias', newCat);
      newCat.id = cid;
      categorias.push(newCat);
    } else {
      row.categoria = cat.nome;
    }
    const newId = await dbPut('transacoes', row);
    row.id = newId;
    transacoes.push({...row});
    count++;
  }
  importRows = [];
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
  populateFilters();
  updateCatSelects();
  renderDashboard();
  toast(`${count} transações importadas!`);
  go('lancamentos');
}

function cancelarImport() {
  importRows = [];
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
}

// ===== HELPERS =====
function fmt(v) {
  return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s+'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 2800);
}

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key==='Escape') fecharModalCategoria();
});
document.getElementById('modal-cat-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-cat-overlay')) fecharModalCategoria();
});

init();