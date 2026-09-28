# Plano da sessão longa (Claude Code)

Cada tarefa tem um critério de pronto verificável. Depois de cada passo: rodar o jogo, rodar os
testes (`tests/bots.mjs`, `tests/screens.mjs`), olhar os screenshots, e só então fazer commit.

Ferramentas de teste (criadas na Fase 1):
- `node tests/screens.mjs [--legacy] --dir tests/screens/<pasta>`: 4 cenas fixas (clareira, trilha, duelo, grupo).
- `node tests/diff.mjs <pastaA> <pastaB>`: diferença pixel a pixel entre duas pastas.
- `node tests/bots.mjs [--legacy] --runs N`: bots "só ataca", "só defende", "habilidoso", "humano ±120 ms".
- `node tests/perf.mjs`: FPS por nível de qualidade, com e sem limitação de CPU (Fase 7).

## Ordem de execução

A ordem difere um pouco da do pedido: a arquitetura de animação (3a) vem antes do combate,
porque os inimigos novos (lança, escudo) já precisam dela; a troca do boneco pelo modelo
(3b) vem depois do combate e da interface, porque é o item de maior risco e não pode
bloquear o resto.

### Fase 1 — projeto de verdade, sem mudar nada ✅
- [x] Vite + módulos ES (`src/`), `legacy/index.html` intacto, `git init`.
- [x] Divisão automática por blocos (`tools/split_legacy.mjs`), imports gerados por análise do código.
- [x] Screenshots iguais ao legado nas 4 cenas (pixel a pixel).
- [x] Bots com resultado idêntico ao legado (mesmo JSON).

### Fase 2 — câmera
- [ ] 2.1 Afastar ~25% (3,6 → 4,5 m) e subir o pivô (1,52 → 1,62 m). Pronto: screenshot da clareira e da trilha mostra o corpo inteiro com mais campo.
- [ ] 2.2 Grama não tapa a visão: hastes afinam e se abrem no cone câmera→personagem; câmera sempre acima do topo da grama. Pronto: cena "grupo" mostra o jogador e os inimigos sem grama na frente; grama continua no resto.
- [ ] 2.3 Travar a mira: tecla Q / botão do meio (PC), toque no inimigo ou botão novo (celular); trocar arrastando/movendo o mouse para o lado. Pronto: teste automático trava, troca de alvo e solta; screenshot com marcador.
- [ ] 2.4 Enquadrar o grupo: a câmera recua e se orienta para caber os inimigos próximos. Pronto: screenshot "grupo" mostra os dois inimigos e o jogador.
- [ ] Bots sem mudança (câmera não mexe no combate).

### Fase 3a — arquitetura de animação
- [ ] `AnimationController` por lutador: camadas corpo inteiro / parte de cima, crossfade curto, velocidade ajustada ao tempo do golpe.
- [ ] O boneco procedural vira `ProceduralBody` (uma implementação da interface). Pronto: screenshots e bots iguais aos da Fase 2.

### Fase 4 — combate mais realista
- [ ] 4.1 Sem estabilidade, golpe de espada/lança mata (jogador e inimigos).
- [ ] 4.2 Janela de aparar por tipo e por golpe (`parryWin`).
- [ ] 4.3 Maestria: ao vencer um encontro, escolher 1 de 2 melhorias.
- [ ] 4.4 Foco: esquiva perfeita dá 1 ponto (máx. 3); gastar recupera estabilidade com respiração exposta.
- [ ] 4.5 Ataques simultâneos: vence quem acerta primeiro; lâminas cruzadas travam (apertar ataque repetidamente).
- [ ] 4.6 Estocadas: indefensáveis; "aparo absoluto" de ~50 ms quebra a estabilidade.
- [ ] 4.7 Inimigos novos: lanceiro, escudeiro, esquivo.
- [ ] 4.8 Trilha com 5 encontros + duelo, grupos até 3, um tipo novo por vez.
- [ ] 4.9 Impacto empurra na direção do golpe. 4.10 Ferido respira pesado e recupera mais devagar.
- [ ] 4.11 Morte: joelhos, queda, espada cai, chapéu rola; morte do jogador em câmera lenta e dessaturada.
- [ ] 4.12 Bots novos (esquiva perfeita + foco, travar espadas) e rebalanceamento. Metas: só ataca e só defende perdem; humano ±120 ms vence os primeiros quase sempre e o duelo ~50%; nenhuma vitória sem aparo.

### Fase 5 — interface
- [ ] Menu de pausa (continuar, controles, ajustes, reiniciar encontro).
- [ ] Dicas com desenho do botão (teclado/mouse/toque).
- [ ] Barras só em combate; vitalidade como traço de pincel.
- [ ] Tela de título cinematográfica com dificuldade (fácil/normal/difícil).
- [ ] UI de foco e de escolha de melhoria no mesmo estilo.
Pronto: screenshots de cada tela em PC e celular (retrato bloqueado, paisagem).

### Fase 3b — personagem 3D
- [ ] Carregar o manequim da Universal Animation Library 2 (CC0) com `GLTFLoader`, trocar o corpo procedural por `SkinnedBody` (mesma interface), katana no osso da mão, lâmina animada no acerto, chapéu/capa/contorno/sombra mantidos, cor por tipo.
- [ ] Fallback automático para o boneco procedural se o arquivo não carregar.
Pronto: screenshots lado a lado, bots dentro das metas, FPS medido.

### Fase 6 — assets opcionais
- [ ] Carregador de sons gravados com reserva sintetizada; carregador de HDRI com reserva no céu atual.
(Não há arquivos em `assets/sounds` nem `assets/hdri`: fica o código pronto e testado com a reserva.)

### Fase 7 — performance e celular
- [ ] Medir FPS nos 4 níveis, com CPU limitada (4×/6×) simulando Android intermediário.
- [ ] GLB comprimido (Meshopt) e tela de carregamento com progresso.

### Fase 8 — entrega
- [ ] Todos os testes verdes; screenshots finais em `tests/screens/final`.
- [ ] `PROJETO.md`, `RELATORIO.md`, build de produção (`dist/`) funcionando.
