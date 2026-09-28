# Fio da Lâmina — regras do projeto

Protótipo de combate com espada em 3D (Three.js), inspirado na sensação do Ghost of Tsushima,
sem copiar nada proprietário. Leia `PROJETO.md` inteiro antes de mexer em qualquer coisa:
ele tem o histórico, as decisões aprovadas e os números de balanceamento.

## Filosofia (vem do documento original do dono do projeto)

Prioridades, nesta ordem: sensação do combate, responsividade, animação, clareza visual,
iluminação, som, estabilidade, performance, quantidade de conteúdo.
- Entre adicionar conteúdo e melhorar o que existe: melhore o que existe.
- Entre sistema complexo e sistema simples que dá o mesmo resultado: o simples.
- Entre tecnologia impressionante e tecnologia confiável: a confiável.
- Não fazer: mundo aberto, inventário, árvore de habilidades, dezenas de inimigos ou armas,
  crafting, multiplayer, economia, quests, diálogos, IA de machine learning.
- Ideias boas fora do escopo vão para a seção "Ideias futuras" do `PROJETO.md`, não para o código.

## Idioma

Todo texto visível ao jogador em português do Brasil. Comentários do código em português.
Mensagens de commit em português.

## Como trabalhar

- Trabalhe em passos pequenos. Depois de CADA passo: rode o jogo, rode os testes, tire
  screenshots, compare com o esperado, e só então faça commit.
- Nunca considere algo pronto só porque compila. Tem que funcionar como gameplay.
- Registre toda decisão não trivial em `DECISOES.md` (o que, por quê, alternativa descartada).
- Mantenha `PROJETO.md` atualizado ao fim de cada fase.
- Se um asset esperado não estiver em `assets/`, não invente substituto de licença duvidosa:
  continue com o boneco procedural e anote em `DECISOES.md`.
- **Modelos 3D:** se `assets/characters/` estiver vazio, NÃO crie modelos na sessão principal.
  Mantenha o boneco procedural e deixe o `AnimationController` pronto. A criação de modelos é
  uma sessão separada, com `PROMPT-CRIAR-MODELOS.md`.
- Nunca use personagens, modelos ou sons de jogos/franquias existentes (mesmo fan art gratuita).

## Testes automáticos (obrigatório)

O jogo expõe `window.__game` quando aberto com `?test`: o loop não roda sozinho e
`__game.step(n, dt)` / `__game.update(dt)` / `__game.render()` avançam a simulação de forma
determinística. Use Playwright (Chromium headless com `--use-angle=swiftshader`) para:
1. Screenshots de posições fixas (clareira, meio da trilha, duelo ao pôr do sol, luta em grupo)
   antes e depois de cada mudança visual. Guarde em `tests/screens/` e compare.
2. Lutas simuladas por bots (ver `tools/sim_bots_referencia.py`): "só ataca", "só defende",
   "habilidoso" e "humano com erro de ±120 ms". Metas atuais: só atacar e só defender perdem;
   o humano vence o recruta sempre, a dupla ~75%, o paciente ~50%, o duelista ~75%;
   nenhuma vitória sem pelo menos um aparo. Rode depois de qualquer mudança de combate.
Cuidado: no headless, `requestPointerLock` trava screenshots (faça stub) e áudio pesado
atrapalha em máquina fraca (use `?noaudio` nos testes).

## Performance

Alvo: 60 fps em PC médio, 30 fps estáveis em celular Android intermediário (o dono joga no
celular). O sistema de qualidade adaptativa (4 níveis) tem que continuar funcionando.
Todo efeito novo precisa de versão leve ou desligável no nível "baixa"/"mínima".

## Publicação

Build estático (Vite) que roda abertura direta e no GitHub Pages. Créditos de assets CC-BY em
`CREDITS.md` e numa tela de créditos no jogo.
