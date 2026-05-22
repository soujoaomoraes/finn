// screens/backup.js — Tela Backup
import './backup.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { showToast } from '../toast.js';

let uploadDebounceTimer = null;
let isConnecting = false;

function formatBackupDate(value) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', ' às');
}

function setSyncing(isSyncing) {
  document.getElementById('cloud-sync-indicator')?.classList.toggle('hidden', !isSyncing);
}

export function initBackup() {
  // Do not bind click handler here to avoid duplicate bindings; loadBackupStatus will set the single handler.
  const btnUpload = document.getElementById('btn-upload-backup');
  if (btnUpload) {
    btnUpload.addEventListener('click', () => {
      triggerBackupUpload();
    });
  }

  const btnRestore = document.getElementById('btn-restore-backup');
  if (btnRestore) {
    btnRestore.addEventListener('click', () => {
      if (confirm('Isso substituirá todos os seus dados locais pelo backup do Google Drive. Deseja continuar?')) {
        triggerRestore();
      }
    });
  }

  listen('oauth_callback', () => {
    loadBackupStatus();
  });

  loadBackupStatus();
}

async function triggerRestore() {
  try {
    const result = await invoke('restore_from_drive');
    showToast(result);
    // Reload app data
    location.reload();
  } catch (error) {
    console.error('Error restoring backup:', error);
    showToast('Erro ao restaurar backup');
  }
}

async function triggerBackupUpload() {
  if (uploadDebounceTimer) {
    clearTimeout(uploadDebounceTimer);
  }

  uploadDebounceTimer = setTimeout(async () => {
    try {
      setSyncing(true);
      await invoke('upload_backup_to_drive');
      showToast('Backup enviado para o Google Drive');
      loadBackupStatus();
    } catch (error) {
      console.error('Error uploading backup:', error);
      showToast('Erro ao enviar backup');
    } finally {
      setSyncing(false);
    }
    uploadDebounceTimer = null;
  }, 1000); // 1 second debounce
}

async function loadBackupStatus() {
  try {
    const isConnected = await invoke('is_drive_connected');
    const lastBackup = await invoke('get_backup_metadata', { key: 'last_backup' });
    const lastError = await invoke('get_backup_metadata', { key: 'last_error' });

    const statusDiv = document.getElementById('backup-status');
    const btnConnect = document.getElementById('btn-connect-drive');
    const btnUpload = document.getElementById('btn-upload-backup');
    const btnRetry = document.getElementById('btn-retry-backup');
    const btnRestore = document.getElementById('btn-restore-backup');
    
    if (statusDiv) {
      if (isConnected) {
        const lastBackupLabel = formatBackupDate(lastBackup);
        let statusHtml = `
          <div class="backup-status-line">
            <span class="status-chip is-active"><span></span>Conectado</span>
          </div>
          <p class="backup-account">Google Drive</p>
          <p class="backup-meta">Último backup: ${lastBackupLabel}</p>
        `;
        
        if (lastError) {
          statusHtml += `
            <p class="backup-error">
              Erro: ${lastError}
            </p>
          `;
        }
        
        statusDiv.innerHTML = statusHtml;
        
        if (btnConnect) {
          btnConnect.textContent = 'Desconectar';
          btnConnect.onclick = async () => {
            if (isConnecting) return;
            isConnecting = true;
            btnConnect.disabled = true;
            try {
              await invoke('disconnect_google_drive');
              showToast('Desconectado do Google Drive');
              loadBackupStatus();
            } catch (error) {
              console.error('Error disconnecting:', error);
              showToast('Erro ao desconectar');
            } finally {
              isConnecting = false;
              btnConnect.disabled = false;
            }
          };
        }
        if (btnUpload) {
          btnUpload.style.display = 'inline-block';
        }
        if (btnRetry && lastError) {
          btnRetry.style.display = 'inline-block';
          btnRetry.onclick = async () => {
            try {
              await invoke('clear_retry_metadata');
              triggerBackupUpload();
            } catch (error) {
              console.error('Error clearing retry:', error);
              showToast('Erro ao tentar novamente');
            }
          };
        } else if (btnRetry) {
          btnRetry.style.display = 'none';
        }
        if (btnRestore) {
          btnRestore.style.display = 'inline-block';
        }
      } else {
        let statusHtml = `
          <div class="backup-status-line">
            <span class="status-chip is-paused"><span></span>Desconectado</span>
          </div>
          <p class="backup-account">Backup opcional via Google Drive</p>
          <p class="backup-meta">Seus dados continuam salvos localmente neste dispositivo.</p>
        `;
        if (lastError) {
          statusHtml += `<p class="backup-error">Erro: ${lastError}</p>`;
        }
        statusDiv.innerHTML = statusHtml;
        if (btnConnect) {
          btnConnect.textContent = 'Conectar ao Google Drive';
          btnConnect.onclick = async () => {
            if (isConnecting) return;
            isConnecting = true;
            btnConnect.disabled = true;
            try {
              const authUrl = await invoke('connect_google_drive');
              await openUrl(authUrl);
              showToast('Abra o navegador para autorizar o acesso ao Google Drive');
            } catch (error) {
              console.error('Error connecting to Drive:', error);
              showToast('Erro ao conectar ao Google Drive');
            } finally {
              // keep the button enabled so the user can retry; some flows expect manual exchange
              isConnecting = false;
              btnConnect.disabled = false;
            }
          };
        }
        if (btnUpload) {
          btnUpload.style.display = 'none';
        }
        if (btnRetry) {
          btnRetry.style.display = 'none';
        }
        if (btnRestore) {
          btnRestore.style.display = 'none';
        }
      }
    }

    const historyDiv = document.getElementById('backup-history');
    if (historyDiv && lastBackup) {
      historyDiv.innerHTML = `
        <p class="backup-meta">Último ponto disponível: ${formatBackupDate(lastBackup)}</p>
        <p class="backup-warning">Restaurar substitui os dados locais pelos dados do Drive.</p>
      `;
    } else if (historyDiv) {
      historyDiv.innerHTML = `
        <p class="backup-meta">Nenhum backup disponível para restauração.</p>
        <p class="backup-warning">Conecte o Google Drive e faça um backup antes de restaurar.</p>
      `;
    }
  } catch (error) {
    console.error('Error loading backup status:', error);
  }
}

// Export function to mark backup as dirty when mutations occur
export function markBackupDirty() {
  invoke('save_backup_metadata', { key: 'backup_dirty', value: 'true' }).catch(console.error);
  triggerBackupUpload();
}
