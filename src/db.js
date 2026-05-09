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
