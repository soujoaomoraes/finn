// router.js — Navegação entre telas

let currentSection = 'dashboard';

export function go(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const section = document.getElementById('sec-' + sec);
  if (section) section.classList.add('active');

  currentSection = sec;
  return sec;
}

export function getCurrentSection() {
  return currentSection;
}
