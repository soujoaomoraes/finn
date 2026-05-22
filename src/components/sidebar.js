// components/sidebar.js — Navegacao e estado ativo da sidebar

const NAV_SECTION_MAP = {
  'nav-dashboard': 'dashboard',
  'nav-lancamentos': 'lancamentos',
  'nav-recorrentes': 'recorrentes',
  'nav-categorias': 'categorias',
  'nav-importar': 'importar',
  'nav-backup': 'backup'
};

export function setSidebarActive(section) {
  document.querySelectorAll('.sb-item').forEach((item) => item.classList.remove('on'));
  const active = document.getElementById(`nav-${section}`);
  if (active) active.classList.add('on');
}

export function initSidebar({ onNavigate, onOpenDrawer }) {
  Object.entries(NAV_SECTION_MAP).forEach(([id, section]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', () => onNavigate(section));
  });
}

