# Decisões

Registro de decisões de projeto (o que, por quê, alternativa descartada). As decisões tomadas
até a migração estão no `PROJETO.md`; a partir daqui, anote aqui.

## 2026-09-28 — Fase 1: migração para projeto Vite

**Divisão em módulos por script, não à mão.** `tools/split_legacy.mjs` corta o arquivo único
pelos blocos que ele já tinha e gera os imports analisando o código (acorn). Por quê: garante
que nenhuma linha de lógica mude; a prova é pixel a pixel e resultado de bot idêntico.
Descartado: reescrever à mão (risco de mudança sutil de comportamento).

**Registro `G` (em `core/time.js`) para jogador, boneco, câmera e encontros.** Módulos de baixo
(lutador, combate, interface) acessam essas instâncias por `G.player`, `G.rig`, `G.Encounters`.
Por quê: `class Enemy extends Fighter` quebra se houver ciclo de import que avalie `enemy.js`
antes de `fighter.js`. Descartado: injetar dependências em todo construtor (muda muito código).

**Ordem de avaliação dos módulos igual à do arquivo antigo.** O gerador aleatório `rand` é
compartilhado entre a geração do mundo e a IA; `main.js` importa os módulos na ordem original
para que a sequência de números seja a mesma (é isso que mantém os bots determinísticos).

**Testes em Node (Playwright) e não em Python.** Não há Python com Playwright instalado aqui e
o Node já é necessário para o Vite. O Chromium baixado pelo Playwright falhou (tempo esgotado na
rede); os testes usam o Chromium 1234 que já estava instalado na máquina (`tests/lib/harness.mjs`).

**`Samurai.fbx` não será usado.** Está em `assets/characters/`, mas: (1) não traz licença nem
autor; pelas características (low poly, Blender, katana e bainha separadas) parece ser um modelo
do Sketchfab, e o candidato mais próximo encontrado é CC BY-NC (proíbe uso comercial);
(2) usa o esqueleto "metarig" do Rigify, diferente do esqueleto da Universal Animation Library 2,
o que exigiria redirecionar todas as animações. Regra do projeto: nada de licença duvidosa.
Usaremos o manequim que vem junto da Universal Animation Library 2 (CC0, mesmo esqueleto das
animações). Se o dono confirmar a origem e a licença do `Samurai.fbx`, dá para reavaliar.

**Balanceamento de partida (legado):** o bot "só ataca" vence o recruta (2/2, sem aparar),
o que contraria a meta do `CLAUDE.md`. Anotado para a Fase 4 (rebalanceamento), não mexido na
Fase 1, que precisava ser idêntica ao legado.

## 2026-09-28 — Fase 2: câmera

- **Distância 3,6 → 4,5 m (+25%), pivô 1,52 → 1,62 m**, mesmo ombro e mesma inclinação baixa.
  A câmera nunca fica a menos de 1,25 m do chão (antes 0,95), acima do topo típico da grama.
- **Grama no caminho da visão**: no shader da grama, um cone entre a câmera e cada personagem em
  foco (jogador e o alvo dele, se a menos de 10 m). Dentro do cone a haste baixa até ficar 32 cm
  abaixo da linha de visão, afina 45% e se abre para o lado. Descartado: esconder hastes (buraco
  visível) ou levantar muito a câmera (perde a sensação baixa da referência).
- **Travar a mira**: Q (ou L) e botão do meio no PC; no celular, tocar no inimigo ou no botão
  "mira". Com a mira travada, mover o mouse / arrastar para o lado troca de alvo (limiar de
  arrasto + recarga de 0,3 s) em vez de girar a câmera. Se o alvo cai, passa para o inimigo
  mais próximo que ainda luta (até 10 m), senão solta. Implementado como `forcedTarget` no
  lutador: sem mira travada, o combate é idêntico.
- **Enquadrar o grupo**: "em combate" = inimigos atentos a menos de 11 m (mesmo sem sacar a
  espada). A câmera mira no centro do grupo (alvo com peso 2) e recua até 3,2 m a mais para
  que todos caibam em 78% da largura da tela.

## 2026-09-28 — Fase 3a: arquitetura de animação

- **`AnimationController` (src/anim/controller.js)**: um por lutador. Traduz o estado de combate em
  ações em duas camadas (`full`: andar, esquiva, reação, queda, morte; `upper`: guarda, defesa,
  golpes), com crossfade curto (0,14 s / 0,08 s). `movePhase()` converte o tempo do golpe em três
  trechos (preparação, ativo, recuperação): quem anima só precisa respeitar esses trechos.
- **Boneco procedural = `ProceduralController`** (src/anim/procedural.js). Código movido sem
  mudança de lógica; prova: bots idênticos antes/depois.
- **Fábrica `createAnimController`** com registro: quando o modelo 3D carregar, ele se registra e
  passa a ser usado; se falhar, o boneco continua.
- **`bladeAt()`** no controlador: o teste de acerto pede a posição da lâmina ao controlador. No
  boneco vem das poses de dados; no modelo pode vir do osso da mão.
- **Agendador `Later` no lugar de `setTimeout`** (ritual da espada, fade da morte, dicas). O
  `setTimeout` dependia do relógio da máquina e deixava os bots não determinísticos entre
  versões do código. Com `Later`, rodado dentro do `update()`, o jogo real se comporta igual.

## 2026-09-28 — Fase 4: combate mais realista

Regras novas (valores em `src/combat/rules.js`, `ENEMY_LIB` e `ETYPES`):
- **Sem estabilidade = morte**: jogador desequilibrado morre com qualquer golpe de lâmina
  (agarrão e empurrão de escudo não matam). Inimigos já funcionavam assim (golpe decisivo).
- **Janela de aparar por tipo** (`pw`): recruta 190 ms, escudeiro 160, agressivo e lanceiro 150,
  paciente 140, esquivo 120, duelista 90. Por golpe (`pwK`): rápidos ×0,85, atrasados ×1,1.
  Dificuldade multiplica (fácil ×1,3, difícil ×0,78); o painel de ajustes continua valendo
  (160 ms = 1×). Dificuldade nunca dá vida extra.
- **Maestria**: 6 melhorias pequenas, 1 de 2 ao vencer cada encontro (jogo pausa). Sorteio com
  gerador próprio (não mexe na IA).
- **Foco**: esquiva perfeita dá 1 ponto (máx. 3, 4 com melhoria). F/R ou botão "foco": respiração
  de 0,75 s que devolve 55% da estabilidade; nesse tempo não defende nem ataca.
- **Ataques simultâneos (tempo e geometria decidem, sem sorteio)**: o inimigo ainda está em
  guarda até 85% da preparação; nos últimos 15% está comprometido — se sua lâmina chegar antes,
  você acerta primeiro. Se os dois golpes se encontram no mesmo instante (seu corte chega a
  ±60 ms do contato dele, de frente) ou as lâminas passam a menos de 30 cm, **as espadas
  travam**: cada toque no golpe empurra 0,12; o inimigo empurra em ondas (0,35 a 0,72/s por
  tipo). Quem chega ao fim desequilibra o outro; em 3 s sem vencedor, as lâminas se soltam.
  Descartado: sorteio de quem ganha (pedido explícito do dono: sem sorteio).
- **Estocadas** (T, S da lança): indefensáveis; "aparo absoluto" se apertar a defesa até 50 ms
  antes do contato, que quebra a estabilidade do inimigo. Varredura baixa (W): só esquiva.
- **Inimigos novos**: lanceiro (alcance 2 m de lâmina, recua se você chega perto, não defende a
  menos de 1,5 m), escudeiro (escudo anula golpes leves de frente sem custo; forte, flanco e
  aparo abrem; empurrão de escudo azul que derruba 38 de estabilidade sem ferir), esquivo (esquiva
  65% dos golpes e contra-ataca 0,26 s depois; 50 de estabilidade).
- **Trilha**: 6 encontros + duelo (z 116, 84, 52, 20, −12, −46, −100), um tipo novo por vez,
  grupos até 3. Ficou 6 e não 5 para manter o paciente, que já existia, e ainda apresentar um
  tipo novo de cada vez.
- **Impacto**: o empurrão mistura "para longe do atacante" (45%) com a direção da ponta da
  lâmina (55%). **Ferido**: curvado, respiração pesada (som), estabilidade volta a 60%.
- **Morte**: joelhos cedem (0,42 s), cai de joelhos, tomba para a frente; a espada solta da mão
  com física simples e deita no chão; o chapéu rola na borda e tomba. Jogador: câmera lenta
  (0,28× por 1,5 s) e imagem sem cor (filtro CSS: funciona com e sem pós-processamento).

Correções de equilíbrio descobertas pelos bots:
- O "só ataca" vencia acertando o inimigo no fim da preparação e de novo enquanto ele cambaleava.
  Agora: (1) inimigo ferido volta à guarda em 0,14 s; (2) o terceiro golpe seguido na guarda é
  aparado; (3) a IA não começa um golpe lento enquanto você está golpeando; (4) quem apara
  contra-ataca.
- Um aparo só decidia o duelo (aparo 45 + contra-golpe 50 + ferimento 30). Contra-golpe caiu para
  20 (+12 por melhoria) e o duelista tem 125 de estabilidade: precisa de dois bons aparos.

Resultado dos bots (6 lutas por combinação; duelo com 24):
- Só ataca: perde em todos (1/6 contra lanceiro+agressivo, que é fraco de perto).
- Só defende: perde ou empata em todos.
- Humano ±120 ms: 6/6 nos três primeiros, 5–6/6 nos seguintes, duelo ~62% (15/24). Sem
  melhorias, os números são parecidos: as melhorias são pequenas e o bot lê todos os golpes;
  para um humano de verdade elas dão margem de erro.
- "Binder" (provoca a trava e aperta sem parar): vence sem aparar contra os primeiros usando só
  travas vencidas. Decisão: trava vencida conta como defesa habilidosa (é uma janela de tempo de
  ±60 ms), então a meta "nenhuma vitória sem aparo" vira "nenhuma vitória sem aparo ou trava".
- Bot humano também reage com atraso às fintas (antes ele relia o golpe na hora, sem se enganar).
