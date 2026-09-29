# Fio da Lâmina — regras do projeto

Protótipo de combate com espada em 3D (Three.js), inspirado na sensação do Ghost of Tsushima,
sem copiar nada proprietário. Leia `docs/PROJETO.md` inteiro antes de mexer em qualquer coisa:
ele tem o histórico, as decisões aprovadas e os números de balanceamento.

## Filosofia (vem do documento original do dono do projeto)

Prioridades, nesta ordem: sensação do combate, responsividade, animação, clareza visual,
iluminação, som, estabilidade, performance, quantidade de conteúdo.
- Entre adicionar conteúdo e melhorar o que existe: melhore o que existe.
- Entre sistema complexo e sistema simples que dá o mesmo resultado: o simples.
- Entre tecnologia impressionante e tecnologia confiável: a confiável.
- Não fazer: mundo aberto, inventário, árvore de habilidades, dezenas de inimigos ou armas,
  crafting, multiplayer, economia, quests, diálogos, IA de machine learning.
- Ideias boas fora do escopo vão para a seção "Ideias futuras" do `docs/PROJETO.md`, não para o código.

## Idioma

Todo texto visível ao jogador em português do Brasil. Comentários do código em português.
Mensagens de commit em português.

## Como trabalhar

- Trabalhe em passos pequenos. Depois de CADA passo: rode o jogo, rode os testes, tire
  screenshots, compare com o esperado, e só então faça commit.
- Nunca considere algo pronto só porque compila. Tem que funcionar como gameplay.
- Registre toda decisão não trivial em `docs/DECISOES.md` (o que, por quê, alternativa descartada).
- Mantenha `docs/PROJETO.md` atualizado ao fim de cada fase.
- Se um asset esperado não estiver em `assets/`, não invente substituto de licença duvidosa:
  continue com o boneco procedural e anote em `docs/DECISOES.md`.
- **Modelos 3D:** se `assets/characters/` estiver vazio, NÃO crie modelos na sessão principal.
  Mantenha o boneco procedural e deixe o `AnimationController` pronto. A criação de modelos é
  uma sessão separada, com `docs/PROMPT-CRIAR-MODELOS.md`.
- Nunca use personagens, modelos ou sons de jogos/franquias existentes (mesmo fan art gratuita).

## Testes automáticos (obrigatório)

O jogo expõe `window.__game` quando aberto com `?test`: o loop não roda sozinho e
`__game.step(n, dt)` / `__game.update(dt)` / `__game.render()` avançam a simulação de forma
determinística. Os testes são em Node + Playwright (`tests/`, Chromium já instalado na máquina,
ver `tests/lib/harness.mjs`; os scripts Python em `tools/` são só referência histórica):
1. `npm run test:telas` / `node tests/screens.mjs --dir tests/screens/<pasta>` (e `--touch --q 1` para
   celular): cenas fixas (clareira, trilha, duelo, grupo, mira, inimigos novos, trava, morte, título,
   pausa). Compare com `node tests/diff.mjs A B` antes e depois de cada mudança visual.
2. `npm run test:bots`: lutas por bots em todos os encontros — "só ataca", "só defende", "humano com
   erro de ±120 ms" (com as melhorias que teria até ali), "binder" (provoca a trava) e "dodger"
   (esquiva perfeita + foco). Metas atuais: só atacar e só defender perdem; o humano vence os
   primeiros encontros quase sempre e o duelo ~50–60%; nenhuma vitória sem aparo ou trava vencida.
   Rode depois de qualquer mudança de combate. `--boneco` roda com o boneco de cápsulas: o
   resultado tem que ser idêntico ao do modelo 3D (o visual não pode mudar o combate).
3. `npm run test:logica`: verificações diretas das regras (mira, estabilidade letal, estocada, foco,
   trava, maestria, morte, pausa).
4. `npm run test:desempenho`: FPS por nível na GPU real (ANGLE/D3D11) com CPU 1× e 4×.
Cuidado: no headless, `requestPointerLock` trava screenshots (o harness faz stub) e áudio pesado
atrapalha em máquina fraca (use `?noaudio` nos testes). Nada de `setTimeout` na lógica do jogo:
use `Later.after()` (roda no tempo do loop; senão os bots deixam de ser determinísticos).

## Performance

Alvo: 60 fps em PC médio, 30 fps estáveis em celular Android intermediário (o dono joga no
celular). O sistema de qualidade adaptativa (4 níveis) tem que continuar funcionando.
Todo efeito novo precisa de versão leve ou desligável no nível "baixa"/"mínima".

## Publicação

Build estático (Vite) que roda abertura direta e no GitHub Pages. Créditos de assets CC-BY em
`docs/CREDITS.md` e numa tela de créditos no jogo.
