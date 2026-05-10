# ROADMAP — FinLedger

## Filosofia de Produto

O FinLedger cresce em camadas. Cada versão entrega algo completo e utilizável por si só. O usuário começa simples e ativa complexidade conforme sente necessidade — nunca é bombardeado com recursos logo de cara.

---

## Fora do Escopo (por enquanto)
- Sincronização multi-dispositivo em tempo real
- Autenticação / múltiplos usuários no mesmo app
- App mobile
- Relatórios avançados em PDF
- Integração direta com bancos (Open Finance)
- Notificações push no sistema operacional

---

## Versões

### V4: Contas Múltiplas
> ⚠️ Requer planejamento cuidadoso do modelo de dados. O ciclo de fatura do cartão de crédito precisa ser bem resolvido antes de começar.

- [ ] Criar entidade `conta` (Corrente, Poupança, Carteira, Cartão de Crédito)
- [ ] Vincular transações a uma conta
- [ ] Implementar ciclo de fatura para Cartão de Crédito (fechamento / vencimento)
- [ ] Transferência entre contas
- [ ] Dashboard com visão agregada e filtro por conta

---

### V3: Metas e Orçamentos

- [ ] Adicionar campo de orçamento mensal por categoria
- [ ] Indicador discreto no formulário de transação ("R$320 de R$500 usados")
- [ ] Barra de progresso por categoria no Dashboard
- [ ] Alerta visual (não intrusivo) ao ultrapassar meta
- [ ] Comparativo previsto × realizado no Dashboard

---

### V2: Registro Rápido

- [ ] Templates de transação — salvar combo frequente e lançar com 1 clique
- [ ] Gerenciar templates (criar, editar, excluir)
- [ ] Quick entry — atalho global `Ctrl+Shift+N` abre mini-formulário flutuante
- [ ] Documentar template de prompt para IA gratuita (ChatGPT/Claude) gerar CSV importável

---

### V1: Backup + Recorrentes 🔜 PRÓXIMA

- [ ] Backup automático no Google Drive via OAuth (opcional, offline continua funcionando)
- [ ] Exportar backup local em JSON
- [ ] Restaurar backup (Google Drive ou arquivo local)
- [ ] Cadastrar transação recorrente (frequência: diária, semanal, mensal, anual)
- [ ] Geração automática da transação na data configurada
- [ ] Indicador visual na lista para transações recorrentes
- [ ] Gerenciar recorrentes (pausar, editar, excluir)

---

### V0.5: Fundação Técnica + Redesign Visual ✅ CONCLUÍDA

- [x] Refatorar JS monolítico em módulos (um arquivo por tela/componente)
- [x] Renomear "Caixa" para "FinLedger" na sidebar
- [x] Nova paleta: dark quente, acento laranja/âmbar, verde/vermelho apenas semânticos
- [x] Nova tipografia com personalidade (display bold para valores grandes)
- [x] Cards com border-radius generoso, sombras sutis, sem bordas pesadas
- [x] Transação em drawer lateral deslizante (em vez de tela separada)
- [x] Botão "Nova Transação" abre drawer sem sair da tela atual

---

### V0: Paridade Funcional (MVP) ✅ CONCLUÍDA

- [x] Geração da estrutura de diretórios e conversão de docs
- [x] Implementação do backend Rust com `tauri-plugin-sql`
- [x] Separação do HTML vanilla em componentes JS/CSS locais
- [x] Migração do IndexedDB para chamadas `invoke`
- [x] Build final