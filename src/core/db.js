// db.js — Camada de dados: todos os invoke() centralizados aqui
function getInvoke() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    throw new Error('Tauri API indisponivel no contexto atual');
  }
  return invoke;
}

export async function getAllTransacoes() {
  const invoke = getInvoke();
  return await invoke('get_all_transacoes');
}

export async function saveTransacao(transacao) {
  const invoke = getInvoke();
  return await invoke('save_transacao', { transacao });
}

export async function deleteTransacao(id) {
  const invoke = getInvoke();
  await invoke('delete_transacao', { id });
}

export async function getAllCategorias() {
  const invoke = getInvoke();
  return await invoke('get_all_categorias');
}

export async function saveCategoria(categoria) {
  const invoke = getInvoke();
  return await invoke('save_categoria', { categoria });
}

export async function deleteCategoria(id) {
  const invoke = getInvoke();
  await invoke('delete_categoria', { id });
}

// ── Reserves ─────────────────────────────────────────────────────────────────

export async function getReservaSaldos() {
  const invoke = getInvoke();
  return await invoke('get_reserva_saldos');
}

export async function transferirReserva(payload) {
  const invoke = getInvoke();
  await invoke('transferir_reserva', { payload });
}

// ── Metas ─────────────────────────────────────────────────────────────────────

export async function getAllMetas(dataInicio, dataFim) {
  const invoke = getInvoke();
  return await invoke('get_all_metas', { payload: { data_inicio: dataInicio, data_fim: dataFim } });
}

export async function saveMeta(meta) {
  const invoke = getInvoke();
  return await invoke('save_meta', { meta });
}

export async function deleteMeta(id) {
  const invoke = getInvoke();
  await invoke('delete_meta', { id });
}

export async function toggleMeta(id) {
  const invoke = getInvoke();
  await invoke('toggle_meta', { id });
}
