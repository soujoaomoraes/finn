// screens/dashboard.js — Tela Dashboard v1.1 Warm Dark
import './styles.css';
import { fmt } from '../../core/utils.js';
import { renderSankey } from './sankey.js';

let _transacoes = [];
let _categorias = [];
let _currentMonth = new Date().getMonth();
let _currentYear = new Date().getFullYear();

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function initDashboard({ transacoes, categorias, currentMonth, currentYear }) {
  _transacoes = transacoes;
  _categorias = categorias;
  _currentMonth = currentMonth;
  _currentYear = currentYear;
}

export function updateDashboardState({ transacoes, categorias, currentMonth, currentYear }) {
  if (transacoes !== undefined) _transacoes = transacoes;
  if (categorias !== undefined) _categorias = categorias;
  if (currentMonth !== undefined) _currentMonth = currentMonth;
  if (currentYear !== undefined) _currentYear = currentYear;
}

function getMonthTransactions(m, y) {
  return _transacoes.filter(t => {
    const d = new Date(t.data + 'T12:00:00');
    return d.getMonth() === m && d.getFullYear() === y;
  });
}

export function renderDashboard() {
  const mt = getMonthTransactions(_currentMonth, _currentYear);
  const receitas = mt.filter(t => t.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
  const despesas = mt.filter(t => t.tipo === 'despesa' && !t.is_transferencia).reduce((a, b) => a + b.valor, 0);
  // Saldo do mês is Receitas - Despesas (aportes de reserva não afetam esse saldo)
  const saldo = receitas - despesas;
  
  // Acumulado: Receitas - Despesas (tudo)
  const total = _transacoes.reduce((a, b) => {
    if (b.tipo === 'receita') return a + b.valor;
    if (b.tipo === 'despesa') return a - b.valor;
    return a; // 'reserva' ou transferências não alteram o patrimônio total
  }, 0);

  // Reservado: Aportes (tipo reserva) - Despesas (usando reserva_id)
  const totalReservado = _transacoes.reduce((a, b) => {
    if (b.tipo === 'reserva' && !b.is_transferencia) return a + b.valor;
    if (b.tipo === 'despesa' && b.reserva_id && !b.is_transferencia) return a - b.valor;
    return a;
  }, 0);

  // Metric cards
  const elR = document.getElementById('d-receitas');
  const elD = document.getElementById('d-despesas');
  const elS = document.getElementById('d-saldo');
  const elA = document.getElementById('d-acumulado');
  const elRes = document.getElementById('d-reservado');
  
  if (elR) elR.textContent = fmt(receitas);
  if (elD) elD.textContent = fmt(despesas);
  if (elS) elS.textContent = fmt(saldo);
  if (elRes) elRes.textContent = fmt(totalReservado);
  if (elRes) elRes.textContent = fmt(totalReservado);

  const elSankeyTot = document.getElementById('d-sankey-total');
  if (elSankeyTot) elSankeyTot.textContent = `${MONTHS_SHORT[_currentMonth]} ${_currentYear} · ${fmt(receitas || despesas || totalReservado)} total`;

  setTimeout(() => {
    renderDashboardSankey(mt);
  }, 50);
}



function renderDashboardSankey(mt) {
  // If no transactions, clear
  if (!mt || mt.length === 0) {
    const elR = document.getElementById('sankey-receitas');
    const elRes = document.getElementById('sankey-reservas');
    if (elR) elR.innerHTML = '';
    if (elRes) elRes.innerHTML = '';
    return;
  }

  // 1. Receitas Sankey
  const receitasList = mt.filter(t => t.tipo === 'receita');
  const despesasList = mt.filter(t => t.tipo === 'despesa' && !t.is_transferencia);
  const reservasList = mt.filter(t => t.tipo === 'reserva' && !t.is_transferencia);

  const totalReceitas = receitasList.reduce((a, b) => a + b.valor, 0);
  const totalDespesas = despesasList.reduce((a, b) => a + b.valor, 0);
  const totalReservado = reservasList.reduce((a, b) => a + b.valor, 0);

  if (totalReceitas > 0 || totalDespesas > 0 || totalReservado > 0) {
    let nodes = [{ name: 'Receitas', value: totalReceitas }];
    let links = [];

    // Sources (Receitas categories)
    const recByCat = {};
    receitasList.forEach(t => { recByCat[t.categoria] = (recByCat[t.categoria] || 0) + t.valor; });
    Object.entries(recByCat).forEach(([cat, val]) => {
      nodes.push({ name: cat, value: val });
      links.push({ source: cat, target: 'Receitas', value: val });
    });

    // If no receitas but there are despesas, we need a dummy source or just start from Saldo livre
    const effectiveReceitas = totalReceitas || (totalDespesas + totalReservado);

    // Targets (Despesas categories, Reservado, Saldo livre)
    if (totalDespesas > 0) {
      nodes.push({ name: 'Despesas', value: totalDespesas });
      links.push({ source: 'Receitas', target: 'Despesas', value: totalDespesas });
      
      const despByCat = {};
      despesasList.forEach(t => { despByCat[t.categoria] = (despByCat[t.categoria] || 0) + t.valor; });
      Object.entries(despByCat).forEach(([cat, val]) => {
        // avoid name collisions with receitas categories
        const nodeName = recByCat[cat] ? cat + ' (D)' : cat;
        nodes.push({ name: nodeName, value: val });
        links.push({ source: 'Despesas', target: nodeName, value: val });
      });
    }

    if (totalReservado > 0) {
      nodes.push({ name: 'Reservado', value: totalReservado });
      links.push({ source: 'Receitas', target: 'Reservado', value: totalReservado });
      
      const resByCat = {};
      reservasList.forEach(t => { resByCat[t.categoria] = (resByCat[t.categoria] || 0) + t.valor; });
      Object.entries(resByCat).forEach(([cat, val]) => {
        const nodeName = recByCat[cat] || nodes.find(n => n.name === cat) ? cat + ' (R)' : cat;
        nodes.push({ name: nodeName, value: val });
        links.push({ source: 'Reservado', target: nodeName, value: val });
      });
    }

    const saldoLivre = totalReceitas - totalDespesas - totalReservado;
    if (saldoLivre > 0) {
      nodes.push({ name: 'Saldo livre', value: saldoLivre });
      links.push({ source: 'Receitas', target: 'Saldo livre', value: saldoLivre });
    }

    renderSankey('sankey-receitas', nodes, links, 230, { total: effectiveReceitas, nodePadding: 18 }, (name) => {
      const cleanName = name.replace(/ \([DR]\)$/, '');
      const c = _categorias.find(x => x.nome === cleanName);
      return c ? c.cor : null;
    });
  }

  // 2. Reservas Sankey
  const despesasReserva = despesasList.filter(t => t.reserva_id != null);
  const totalDespReserva = despesasReserva.reduce((a, b) => a + b.valor, 0);

  if (totalDespReserva > 0) {
    let nodesR = [{ name: 'Reserva usada', value: totalDespReserva }, { name: 'Desp. reserva', value: totalDespReserva }];
    let linksR = [{ source: 'Reserva usada', target: 'Desp. reserva', value: totalDespReserva }];

    const usedResByCat = {};
    despesasReserva.forEach(t => { 
      const resName = t.reserva_nome || 'Reserva desconhecida';
      usedResByCat[resName] = (usedResByCat[resName] || 0) + t.valor; 
    });
    Object.entries(usedResByCat).forEach(([cat, val]) => {
      nodesR.push({ name: cat, value: val });
      linksR.push({ source: cat, target: 'Reserva usada', value: val });
    });

    const despRByCat = {};
    despesasReserva.forEach(t => { despRByCat[t.categoria] = (despRByCat[t.categoria] || 0) + t.valor; });
    Object.entries(despRByCat).forEach(([cat, val]) => {
      const nodeName = usedResByCat[cat] || nodesR.find(n => n.name === cat) ? cat + ' (D)' : cat;
      nodesR.push({ name: nodeName, value: val });
      linksR.push({ source: 'Desp. reserva', target: nodeName, value: val });
    });

    renderSankey('sankey-reservas', nodesR, linksR, 110, { total: totalDespReserva, nodePadding: 10 }, (name) => {
      const cleanName = name.replace(/ \([DR]\)$/, '');
      const c = _categorias.find(x => x.nome === cleanName);
      return c ? c.cor : null;
    });
    
    const wrapperR = document.getElementById('sankey-reservas')?.parentElement;
    if (wrapperR) {
      wrapperR.style.display = 'block';
    }
  } else {
    const elR = document.getElementById('sankey-reservas');
    if (elR) elR.innerHTML = '<div style="color:var(--t4);font-size:11px;">Nenhuma reserva utilizada para pagamento de despesas neste mês.</div>';
  }
}
