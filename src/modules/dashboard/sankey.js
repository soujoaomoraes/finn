// src/modules/dashboard/sankey.js
import { fmt } from '../../core/utils.js';

const pct = (v, t) => Math.round((v / Math.max(t, 1)) * 100) + '%';
const C = {
  green2: '#34d399', cyan: '#22d3ee', green: '#4ade80',
  red: '#f87171', amber: '#fbbf24', purple: '#c084fc',
  orange: '#fb923c', blue: '#60a5fa', indigo: '#818cf8',
  t3: '#6b5f52',
};

const nodeColor = {
  'Salário': C.green2, 'Rendimento': C.cyan, 'Receitas': C.green,
  'Despesas': C.red, 'Reservado': C.purple, 'Saldo livre': C.amber,
  'Alimentação': C.orange, 'Combustível': C.blue, 'Moradia': C.indigo, 'Viagem México': C.purple,
  'Reserva usada': C.purple, 'Desp. reserva': C.red, 'Alim. reserva': C.orange, 'Comb. reserva': C.blue,
};

export function renderSankey(containerId, nodes, links, H, opts, getCategoryColor = null) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // We rely on global d3 being loaded
  if (!window.d3 || !window.d3.sankey) {
    console.error('d3 ou d3-sankey não carregados');
    return;
  }

  el.__draw = () => {
    el.innerHTML = ''; // Clear previous SVG

    if (!nodes || nodes.length === 0 || !links || links.length === 0) {
      el.innerHTML = '<div style="color:var(--t3);font-size:12px;padding:20px 0;">Sem dados suficientes para gerar o gráfico neste mês.</div>';
      return;
    }

    const W = el.getBoundingClientRect().width || el.offsetWidth || 800;
    if (W === 0) return; // Wait until visible

    const LABEL_W = 115;
    const pad = { top: 8, right: LABEL_W, bottom: 8, left: LABEL_W };
    const iW = W - pad.left - pad.right;
    const iH = H - pad.top - pad.bottom;

    const svg = d3.select(el).append('svg')
      .attr('width', W).attr('height', H)
      .style('display', 'block').style('overflow', 'visible');

    const g = svg.append('g').attr('transform', `translate(${pad.left},${pad.top})`);

    const sankey = d3.sankey()
      .nodeId(d => d.name)
      .nodeWidth(10)
      .nodePadding(opts.nodePadding || 16)
      .extent([[0, 0], [iW, iH]]);

    // Ensure all links have valid sources/targets in nodes
    const nodeNames = new Set(nodes.map(n => n.name));
    const validLinks = links.filter(l => nodeNames.has(l.source) && nodeNames.has(l.target));

    if (validLinks.length === 0) return;

    const graph = sankey({
      nodes: nodes.map(d => ({ ...d })),
      links: validLinks.map(d => ({ ...d })),
    });

    const getColor = (name) => {
      if (getCategoryColor) {
        const catColor = getCategoryColor(name);
        if (catColor) return catColor;
      }
      return nodeColor[name] || '#888';
    };

    const defs = svg.append('defs');
    graph.links.forEach((lk, i) => {
      const id = `g-${containerId}-${i}`;
      lk._gid = id;
      const gr = defs.append('linearGradient').attr('id', id)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', lk.source.x1 + pad.left).attr('x2', lk.target.x0 + pad.left);
      gr.append('stop').attr('offset', '0%').attr('stop-color', getColor(lk.source.name)).attr('stop-opacity', .55);
      gr.append('stop').attr('offset', '100%').attr('stop-color', getColor(lk.target.name)).attr('stop-opacity', .4);
    });

    g.append('g').selectAll('path').data(graph.links).enter().append('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', lk => `url(#${lk._gid})`)
      .attr('stroke-width', lk => Math.max(1, lk.width))
      .attr('fill', 'none').attr('opacity', .5);

    g.append('g').selectAll('rect').data(graph.nodes).enter().append('rect')
      .attr('x', d => d.x0).attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0).attr('height', d => Math.max(2, d.y1 - d.y0))
      .attr('rx', 3).attr('fill', d => getColor(d.name));

    const total = opts.total || 1;
    
    // Topological classification
    const isLeft = d => (!d.targetLinks || d.targetLinks.length === 0);
    const isRight = d => (!d.sourceLinks || d.sourceLinks.length === 0);
    const isMid = d => !isLeft(d) && !isRight(d);

    // Left nodes (Labels on the left)
    g.append('g').selectAll('g.ll').data(graph.nodes.filter(isLeft)).enter()
      .append('g').each(function (d) {
        const my = (d.y0 + d.y1) / 2, x = d.x0 - 8;
        d3.select(this).append('text').attr('x', x).attr('y', my - 5)
          .attr('font-size', 10.5).attr('font-family', 'Inter').attr('font-weight', '500')
          .attr('text-anchor', 'end')
          .attr('fill', getColor(d.name)).text(d.name);
        d3.select(this).append('text').attr('x', x).attr('y', my + 7)
          .attr('font-size', 9).attr('font-family', 'Inter').attr('fill', C.t3)
          .attr('text-anchor', 'end')
          .text(`${fmt(d.value)} · ${pct(d.value, total)}`);
      });

    // Middle nodes (Labels centered vertically on the right)
    g.append('g').selectAll('g.lm').data(graph.nodes.filter(isMid)).enter()
      .append('g').each(function (d) {
        const my = (d.y0 + d.y1) / 2, x = d.x1 + 8;
        d3.select(this).append('text').attr('x', x).attr('y', my - 5)
          .attr('font-size', 11).attr('font-family', 'Inter')
          .attr('font-weight', '600').attr('fill', getColor(d.name)).text(d.name);
        d3.select(this).append('text').attr('x', x).attr('y', my + 9)
          .attr('font-size', 9).attr('font-family', 'Inter')
          .attr('fill', C.t3).text(`${fmt(d.value)} · ${pct(d.value, total)}`);
      });

    // Right nodes (Labels with anti-overlap on the right)
    const rightNodes = graph.nodes.filter(isRight).sort((a, b) => a.y0 - b.y0);
    const MIN_GAP = 22;
    
    // Pass 1: Push down
    let yPos = rightNodes.map(d => (d.y0 + d.y1) / 2);
    for(let i = 1; i < yPos.length; i++) {
      if (yPos[i] < yPos[i - 1] + MIN_GAP) yPos[i] = yPos[i - 1] + MIN_GAP;
    }
    
    // Pass 2: Pull up if overflowing the bottom
    if (yPos.length > 0 && yPos[yPos.length - 1] > iH + 10) {
      let overflow = yPos[yPos.length - 1] - (iH + 10);
      for(let i = 0; i < yPos.length; i++) yPos[i] -= overflow;
      for(let i = yPos.length - 2; i >= 0; i--) {
        if (yPos[i] > yPos[i + 1] - MIN_GAP) yPos[i] = yPos[i + 1] - MIN_GAP;
      }
    }

    g.append('g').selectAll('g.lr').data(rightNodes).enter()
      .append('g').each(function (d, i) {
        const y = yPos[i];
        const x = d.x1 + 8;
        d3.select(this).append('text').attr('x', x).attr('y', y - 5)
          .attr('font-size', 10.5).attr('font-family', 'Inter').attr('font-weight', '500')
          .attr('fill', getColor(d.name)).text(d.name);
        d3.select(this).append('text').attr('x', x).attr('y', y + 7)
          .attr('font-size', 9).attr('font-family', 'Inter').attr('fill', C.t3)
          .text(`${fmt(d.value)} · ${pct(d.value, total)}`);
      });
  };

  if (!el.__ro) {
    el.__ro = new ResizeObserver(() => {
      if (el.__draw) el.__draw();
    });
    el.__ro.observe(el);
  }

  el.__draw();
}
