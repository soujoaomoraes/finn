# FinLedger V1 Tasks

**Spec**: `.specs/features/v1-backup and repeater/SPEC.md`  
**Design**: `.specs/features/v1-backup and repeater/DESIGN.md`  
**Status**: Draft  
**Feature**: Backup + Importar/Exportar + Recorrentes

---

## Gate Commands

No `.specs/codebase/TESTING.md` exists yet. Until a formal test matrix is added, V1 tasks use these gates:

| Gate | Command | Use When |
|---|---|---|
| Frontend build | `npm.cmd run build` | Any frontend or Vite-facing change |
| Rust check | `cargo check` in `src-tauri` | Any Rust/Tauri/backend change |
| Manual smoke | Run app and exercise flow | User-facing workflows |

---

## Execution Plan

### Phase 1: Importar / Exportar

```text
T1 -> T2 -> T3 -> T4
```

### Phase 2: Recorrentes Foundation

```text
T5 -> T6 -> T7 -> T8
```

### Phase 3: Recorrentes UI

```text
T9 -> T10 -> T11 -> T12 -> T13
```

### Phase 4: Backup Google Drive

```text
T14 -> T15 -> T16 -> T17 -> T18 -> T19
```

### Phase 5: Final Validation

```text
T20
```

---

## Task Breakdown

### T1: Rename Import Screen UI

**What**: Rename visible "Importar Planilha" labels to "Importar / Exportar" and add the Dashboard "+ Nova transação" action.  
**Where**: `index.html`, `src/components/sidebar.js`, `src/main.js`, `src/screens/dashboard.*` if needed  
**Depends on**: None  
**Reuses**: Existing sidebar/router/dashboard patterns  
**Requirement**: V1-IMPORT-01, V1-REC-08

**Done when**:
- [x] Sidebar shows "Importar / Exportar"
- [x] Import screen header shows "Importar / Exportar"
- [x] Dashboard has "+ Nova transação" opening the existing transaction drawer
- [x] Frontend build passes

**Tests**: build + manual smoke  
**Gate**: `npm.cmd run build`

---

### T2: Add CSV Export UI

**What**: Add the export section with start/end date inputs and "Exportar CSV" button above the existing import UI.  
**Where**: `index.html`, `src/screens/importar.js`, `src/screens/importar.css`  
**Depends on**: T1  
**Reuses**: Existing import screen, toast, date helpers
**Requirement**: V1-IMPORT-02

**Done when**:
- [x] Export section appears above import section
- [x] Default period is first and last day of current month
- [x] Button calls export handler without breaking existing import
- [x] Frontend build passes

**Tests**: build + manual smoke  
**Gate**: `npm.cmd run build`

---

### T3: Add Native Save Dialog Support

**What**: Add Tauri dialog plugin and frontend wrapper to choose the CSV save path.  
**Where**: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src/screens/importar.js`  
**Depends on**: T2  
**Reuses**: Tauri v2 plugin pattern
**Requirement**: V1-IMPORT-03

**Done when**:
- [x] Tauri dialog plugin is installed/configured
- [x] Save dialog opens from "Exportar CSV"
- [x] Canceling the dialog does not show an error
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T4: Implement CSV Export Command

**What**: Add Rust command to export transactions in the selected period as CSV.  
**Where**: `src-tauri/src/db/export.rs`, `src-tauri/src/lib.rs`, `src/db.js`, `src/screens/importar.js`  
**Depends on**: T3  
**Reuses**: Existing DB connection and transaction schema
**Requirement**: V1-IMPORT-04

**Done when**:
- [x] CSV includes header `Data,Descrição,Valor,Tipo,Categoria,Observação`
- [x] Dates are `DD/MM/YYYY`
- [x] Values use decimal point and no currency symbol
- [x] Empty period shows "Nenhuma transação encontrada no período"
- [x] Successful export shows "CSV exportado com sucesso"
- [x] Existing import still works
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual CSV inspection  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T5: Add Recorrentes Schema

**What**: Add `recorrentes` table and `transacoes.recorrente_id` migration.  
**Where**: `src-tauri/src/db/schema.rs`  
**Depends on**: T4  
**Reuses**: Existing schema init pattern
**Requirement**: V1-REC-01

**Done when**:
- [x] `recorrentes` table exists with fields from SPEC
- [x] `criada_em` is present and defaults to current date
- [x] `transacoes.recorrente_id` is added idempotently
- [x] Existing databases can initialize without duplicate-column failure
- [x] Rust check passes

**Tests**: Rust check + manual app startup  
**Gate**: `cargo check`

---

### T6: Add Recorrentes CRUD Commands

**What**: Add commands for listing, saving, deleting, and toggling recurring templates.  
**Where**: `src-tauri/src/db/recorrentes.rs`, `src-tauri/src/db/mod.rs`, `src-tauri/src/lib.rs`, `src/db.js`  
**Depends on**: T5  
**Reuses**: `categorias.rs` and `transacoes.rs` command patterns
**Requirement**: V1-REC-02

**Done when**:
- [x] `get_all_recorrentes` returns templates ordered predictably
- [x] `save_recorrente` inserts/updates and returns ID
- [x] `delete_recorrente` deletes only template, not generated transactions
- [x] `toggle_recorrente` updates `ativa`
- [x] All new `invoke()` calls are centralized in `src/db.js`
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T7: Implement Recurrence Date Generation

**What**: Implement pure recurrence date calculation for daily, weekly, monthly, and annual frequencies.  
**Where**: `src-tauri/src/db/recorrentes.rs` or `src-tauri/src/db/recurrence.rs`  
**Depends on**: T6  
**Reuses**: Rust date handling selected during implementation
**Requirement**: V1-REC-03

**Done when**:
- [x] Generates only dates up to today
- [x] Never generates dates before `criada_em`
- [x] Handles monthly day 29/30/31 by clamping to month end
- [x] Handles weekly mapping `0 = domingo` through `6 = sábado`
- [x] Rust check passes

**Tests**: Rust check; add focused Rust unit tests if date helper is separated  
**Gate**: `cargo check`

---

### T8: Generate Due Recorrentes on Startup

**What**: Generate overdue transactions when the app opens and update local state.  
**Where**: `src-tauri/src/db/recorrentes.rs`, `src-tauri/src/lib.rs`, `src/main.js`, `src/db.js`  
**Depends on**: T7  
**Reuses**: Existing transaction insert flow
**Requirement**: V1-REC-04

**Done when**:
- [x] Active recurring templates generate overdue transactions on startup
- [x] Paused templates generate nothing
- [x] Multiple missed occurrences are generated in sequence
- [x] `ultima_geracao` updates to last generated date
- [x] Generated transactions include `recorrente_id`
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual smoke with sample templates  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T9: Add Recorrentes Screen Route

**What**: Add Recorrentes section to HTML, router, sidebar, and main initialization.  
**Where**: `index.html`, `src/router.js`, `src/components/sidebar.js`, `src/main.js`, `src/screens/recorrentes.js`, `src/screens/recorrentes.css`  
**Depends on**: T8  
**Reuses**: Existing screen initialization pattern
**Requirement**: V1-REC-05

**Done when**:
- [x] Sidebar shows "Recorrentes" under Lançamentos
- [x] "Nova Transação" is removed from sidebar
- [x] Recorrentes screen renders empty state
- [x] Navigation active state works
- [x] Frontend build passes

**Tests**: build + manual navigation smoke  
**Gate**: `npm.cmd run build`

---

### T10: Add Recorrente Drawer

**What**: Create drawer for new/edit recurring templates.  
**Where**: `src/components/recorrenteDrawer.js`, `src/components/recorrenteDrawer.css`, `src/screens/recorrentes.js`  
**Depends on**: T9  
**Reuses**: `src/components/drawer.js` visual/interaction pattern
**Requirement**: V1-REC-06

**Done when**:
- [x] Drawer opens from "Nova recorrente"
- [x] Type tabs filter categories
- [x] Frequency controls show correct day fields
- [x] Validation prevents invalid save
- [x] `criada_em` is not shown in the form
- [x] Escape/overlay closes drawer
- [x] Frontend build passes

**Tests**: build + manual drawer smoke  
**Gate**: `npm.cmd run build`

---

### T11: Wire Recorrentes CRUD UI

**What**: Connect Recorrentes screen and drawer to CRUD commands.  
**Where**: `src/screens/recorrentes.js`, `src/components/recorrenteDrawer.js`, `src/main.js`  
**Depends on**: T10  
**Reuses**: Existing category/transaction mutation callbacks
**Requirement**: V1-REC-07

**Done when**:
- [x] New recurring template saves and appears in list
- [x] Edit fills drawer and persists changes
- [x] Pause/resume updates badge and generation eligibility
- [x] Delete asks confirmation and keeps generated transactions
- [x] Toasts appear for save/delete/toggle
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual CRUD smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T12: Add Recurrence Indicators

**What**: Show recurrence indicator in Transactions list and Dashboard recent list.  
**Where**: `src/screens/transacoes.js`, `src/screens/dashboard.js`, related CSS  
**Depends on**: T11  
**Reuses**: Existing table/recent item rendering
**Requirement**: V1-REC-09

**Done when**:
- [x] Generated transactions show a small recurrence indicator
- [x] Tooltip says "Gerada automaticamente por recorrente"
- [x] Normal transactions have no indicator
- [x] Frontend build passes

**Tests**: build + manual visual smoke  
**Gate**: `npm.cmd run build`

---

### T13: Recorrentes End-to-End Smoke

**What**: Run a full manual recurrence flow and fix any integration gaps.  
**Where**: App-wide  
**Depends on**: T12  
**Reuses**: All recorrentes implementation
**Requirement**: V1-REC-10

**Done when**:
- [x] Daily, weekly, monthly, and annual recurring templates can be created
- [x] Startup generation works for overdue items
- [x] Paused templates do not generate
- [x] Generated transactions can be edited/deleted without changing template
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual e2e smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T14: Add Backup Screen Shell

**What**: Add Backup screen, sidebar entry, status states, and cloud indicator UI without Drive calls yet.  
**Where**: `index.html`, `src/components/sidebar.js`, `src/router.js`, `src/main.js`, `src/screens/backup.js`, `src/screens/backup.css`  
**Depends on**: T13  
**Reuses**: Existing screen/router/sidebar/toast patterns
**Requirement**: V1-BACKUP-01

**Done when**:
- [x] Sidebar shows "Backup" under Configurações
- [x] Backup screen renders disconnected/loading/connected/error state placeholders
- [x] Cloud indicator component can be shown/hidden
- [x] No fake Google connection is presented as real
- [x] Frontend build passes

**Tests**: build + manual navigation smoke  
**Gate**: `npm.cmd run build`

---

### T15: Add Backup Status Persistence

**What**: Persist local sync metadata and expose backup status commands.  
**Where**: `src-tauri/src/backup.rs`, `src-tauri/src/lib.rs`, `src/db.js`, `src/screens/backup.js`  
**Depends on**: T14  
**Reuses**: App data dir pattern from database setup
**Requirement**: V1-BACKUP-02

**Done when**:
- [x] Status includes connected/email/last_sync_at/dirty/syncing/last_error
- [x] Sync metadata survives app restart
- [x] No token is exposed to frontend
- [x] Frontend build and Rust check pass

**Tests**: build + Rust check + manual restart smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T16: Implement OAuth PKCE Connect

**What**: Implement Google OAuth desktop flow with PKCE and `drive.appdata`.  
**Where**: `src-tauri/src/backup.rs`, OAuth helper module if needed, `src/screens/backup.js`  
**Depends on**: T15  
**Reuses**: Tauri opener, app data dir, OAuth Client ID from design
**Requirement**: V1-BACKUP-03

**Done when**:
- [x] Connect opens system browser
- [x] Scope requested is only `drive.appdata`
- [x] Token is stored locally outside UI
- [x] Connected state shows email if available
- [x] Disconnect removes local token
- [x] Frontend build and Rust check pass

**Note**: Requer dependências externas Google OAuth e HTTP client - implementação completa

**Tests**: build + Rust check + manual Google connect/disconnect  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T17: Implement Drive Snapshot Upload

**What**: Upload full `finledger-backup.json` snapshot to Drive appDataFolder.  
**Where**: `src-tauri/src/backup.rs`, `src/main.js`, mutation callbacks  
**Depends on**: T16  
**Reuses**: Existing transaction/category queries
**Requirement**: V1-BACKUP-04

**Done when**:
- [x] Backup file contains version/exportedAt/transacoes/categorias
- [x] Recorrentes are excluded in V1 initial backup
- [x] Mutations mark backup as dirty
- [x] Debounce batches rapid changes into one upload
- [x] Successful sync clears dirty and updates last_sync_at
- [x] Cloud indicator appears while syncing
- [x] Frontend build and Rust check pass

**Note**: Implementação completa

**Tests**: build + Rust check + manual sync smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T18: Add Retry with Exponential Backoff

**What**: Persist retry metadata and retry failed backup uploads without blocking UI.  
**Where**: `src-tauri/src/backup.rs`, `src/screens/backup.js`, `src/main.js`  
**Depends on**: T17  
**Reuses**: Backup status persistence from T15
**Requirement**: V1-BACKUP-05

**Done when**:
- [x] Temporary failures keep dirty state
- [x] Retry delay increases after repeated failures
- [x] Retry state survives app restart
- [x] Backup screen shows inline error and "Tentar novamente"
- [x] Frontend build and Rust check pass

**Note**: Implementação completa

**Tests**: build + Rust check + manual failure/retry smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T19: Implement Restore from Drive

**What**: Download backup from Drive and restore local SQLite after confirmation.  
**Where**: `src-tauri/src/backup.rs`, `src/screens/backup.js`, `src/main.js`  
**Depends on**: T18  
**Reuses**: Backup JSON format and DB insert patterns
**Requirement**: V1-BACKUP-06

**Done when**:
- [x] Restore button appears only when connected
- [x] Confirmation modal warns that local data will be replaced
- [x] Version is validated
- [x] Restore clears/reinserts transactions/categories transactionally
- [x] IDs from backup are ignored
- [x] Success toast includes imported counts
- [x] Missing file shows "Arquivo não encontrado no Drive"
- [x] Frontend build and Rust check pass

**Note**: Implementação completa

**Tests**: build + Rust check + manual restore smoke  
**Gate**: `npm.cmd run build`; `cargo check`

---

### T20: Final V1 Validation

**What**: Run complete V1 acceptance pass and update docs/checklists.  
**Where**: App-wide, `.specs/features/v1-backuo and repeater/SPEC.md`, `.specs/features/v1-backuo and repeater/TASK.md`  
**Depends on**: T19  
**Reuses**: All V1 implementation
**Requirement**: V1-ALL

**Done when**:
- [x] Import existing spreadsheet flow still works
- [x] Export CSV works for current month and empty period (Bug fix: adicionado BOM UTF-8 e formato Excel PT-BR com ';')
- [x] Recorrentes pass all acceptance criteria
- [x] Backup connect/sync/restore/disconnect pass acceptance criteria (Bug fix: restauração agora preserva cor e tipo da categoria)
- [x] `npm.cmd run build` passes
- [x] `cargo check` passes
- [x] SPEC/TASK checklists reflect actual completed work

**Tests**: full manual acceptance + build + Rust check  
**Gate**: `npm.cmd run build`; `cargo check`

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Start | OK |
| T2 | T1 | T1 -> T2 | OK |
| T3 | T2 | T2 -> T3 | OK |
| T4 | T3 | T3 -> T4 | OK |
| T5 | T4 | T4 -> T5 | OK |
| T6 | T5 | T5 -> T6 | OK |
| T7 | T6 | T6 -> T7 | OK |
| T8 | T7 | T7 -> T8 | OK |
| T9 | T8 | T8 -> T9 | OK |
| T10 | T9 | T9 -> T10 | OK |
| T11 | T10 | T10 -> T11 | OK |
| T12 | T11 | T11 -> T12 | OK |
| T13 | T12 | T12 -> T13 | OK |
| T14 | T13 | T13 -> T14 | OK |
| T15 | T14 | T14 -> T15 | OK |
| T16 | T15 | T15 -> T16 | OK |
| T17 | T16 | T16 -> T17 | OK |
| T18 | T17 | T17 -> T18 | OK |
| T19 | T18 | T18 -> T19 | OK |
| T20 | T19 | T19 -> T20 | OK |

---

## Task Granularity Check

| Task Group | Scope | Status |
|---|---|---|
| T1-T4 Import/Export | Each task has one UI/plugin/backend/export focus | OK |
| T5-T8 Recorrentes backend | Schema, commands, generation helper, startup integration split apart | OK |
| T9-T13 Recorrentes UI | Route, drawer, CRUD, indicators, smoke split apart | OK |
| T14-T19 Backup | Shell, status, OAuth, upload, retry, restore split apart | OK |
| T20 Final validation | Acceptance pass only | OK |

---

## Test Co-location Validation

| Task | Code Layer | Required by Local Matrix | Task Says | Status |
|---|---|---|---|---|
| T1-T2 | Frontend | No formal matrix; build/manual | build + smoke | OK |
| T3-T4 | Frontend + Tauri/Rust | No formal matrix; build + Rust check | build + cargo check | OK |
| T5-T8 | Rust/Tauri + frontend integration | No formal matrix; Rust check/build/manual | cargo check + build where needed | OK |
| T9-T13 | Frontend + Tauri integration | No formal matrix; build/Rust/manual | build + cargo check where needed | OK |
| T14-T19 | Backup UI + Rust/Tauri + Google flow | No formal matrix; build/Rust/manual | build + cargo check + manual OAuth/sync | OK |
| T20 | Full app | Acceptance validation | full manual + gates | OK |

---

## Tooling Before Execute

Available project skills relevant to execution:

- `tlc-spec-driven`
- `tauri-v2`
- `testing-tauri-apps`
- `frontend-design`
- `integrating-tauri-js-frontends`
- `token-efficiency`

Before starting implementation, confirm whether to execute tasks strictly in order from T1 or reprioritize.

