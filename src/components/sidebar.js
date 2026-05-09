// components/sidebar.js — Navegacao e estado ativo da sidebar

const NAV_SECTION_MAP = {
  'nav-dashboard': 'dashboard',
  'nav-lancamentos': 'lancamentos',
  'nav-categorias': 'categorias',
  'nav-importar': 'importar'
};

export function setSidebarActive(section) {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  const active = document.getElementById(`nav-${section}`);
  if (active) active.classList.add('active');
}

export function initSidebar({ onNavigate, onOpenDrawer }) {
  Object.entries(NAV_SECTION_MAP).forEach(([id, section]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', () => onNavigate(section));
  });

  const newTransactionButton = document.getElementById('nav-nova');
  if (newTransactionButton) {
    newTransactionButton.addEventListener('click', () => onOpenDrawer());
  }
}
