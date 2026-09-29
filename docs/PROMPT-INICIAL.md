# Prompt — Fio da Lâmina (sessão longa no Claude Code)

Cole tudo abaixo da linha no Claude Code, aberto dentro desta pasta.

---

Você vai continuar o desenvolvimento do protótipo "Fio da Lâmina", um jogo de combate com
espada em 3D feito em Three.js. Ele foi construído até aqui como um arquivo HTML único
(`index.html`) numa conversa com outra instância do Claude. Agora passa a ser um projeto de
verdade nesta pasta.

Vou deixar você trabalhando sozinho por muito tempo. Não pare para me perguntar nada: quando
houver uma decisão, escolha a opção mais coerente com `CLAUDE.md` e `PROJETO.md`, registre em
`DECISOES.md` e siga. Só deixe algo para mim se for impossível sem mim; nesse caso termine todo
o resto e descreva a pendência no relatório final.

## Regra sobre modelos 3D (leia com atenção)

Verifique o que existe em `assets/characters/` e `assets/animations/`.
- **Se houver modelos e animações**: integre-os (fase 3).
- **Se NÃO houver nenhum arquivo 3D**: NÃO tente criar modelos nesta sessão. Mantenha o boneco
  procedural atual, faça todas as outras fases, e deixe o código pronto para receber os
  arquivos depois (fase 3, item "arquitetura"). A criação de modelos será feita numa sessão
  separada, com o `PROMPT-CRIAR-MODELOS.md`.

## Passo 0 — entender antes de mexer

1. Leia `CLAUDE.md`, `PROJETO.md` e `assets/README.md` inteiros.
2. Leia `index.html` e mapeie cada sistema (estabilidade, sinais azul/vermelho, IA com leitura
   de hábitos, diretor de combate, impasse, hora do dia, grama, painel de ajustes, relatório).
3. Escreva `PLANO.md` com as fases abaixo quebradas em tarefas pequenas, cada uma com critério
   de pronto verificável (screenshot, teste de bot, medição de FPS).
4. Execute o plano do início ao fim sem esperar aprovação.

## Fase 1 — virar projeto de verdade, sem mudar nada

- Projeto Vite com módulos ES, separando o arquivo nos blocos que ele já tem.
- `git init`; o `index.html` original fica intacto em `legacy/`.
- Monte os testes do `CLAUDE.md` (screenshots e bots) e prove que o projeto novo é idêntico ao
  antigo: mesmas imagens nas mesmas posições, mesmos resultados dos bots. Só avance com tudo verde.

## Fase 2 — câmera

1. **Mais afastada.** Hoje: 3,6 m de distância, pivô a 1,52 m. Afaste uns 25% e suba um pouco,
   mantendo a sensação da referência (baixa, atrás do ombro).
2. **A grama nunca tapa a visão.** Afine/afaste as hastes no cone entre câmera e personagem e
   garanta altura mínima acima do topo da grama. Sem remover a grama do mundo.
3. **Travar a mira** num inimigo com um botão (PC: tecla/botão do meio; celular: toque no inimigo
   ou botão novo). Trocar de alvo arrastando para o lado.
4. **Enquadrar o grupo.** Em combate, a câmera recua e se orienta para caber todos os inimigos
   próximos, não só o mais perto.

## Fase 3 — personagens e animações

- **Arquitetura (sempre, com ou sem assets):** um `AnimationController` por lutador, com
  `AnimationMixer`, crossfades curtos e camadas (corpo inteiro / parte de cima, para golpear e
  defender andando). O boneco procedural vira só mais uma implementação dessa interface.
- O combate é guiado por DADOS (preparação, ativo e recuperação em `PLAYER_MOVES` e
  `ENEMY_LIB`). Mantenha: escolha o clipe de cada golpe e ajuste a velocidade para bater com os
  tempos. Os tempos mandam, a animação obedece.
- Katana presa ao osso da mão; o acerto passa a usar a lâmina animada, mantendo a varredura em
  sub-passos. O ângulo do golpe importa de verdade: um golpe de cima e um de lado podem ter
  resultados diferentes contra o mesmo inimigo, só pela geometria.
- Mantenha chapéu de palha, capa com física de pano (ancorada nos ombros), contorno de luz e
  sombra de contato. Cada tipo de inimigo com roupa/cor própria.
- Pacote preferido: Quaternius (Universal Base Characters + Universal Animation Library 1 e 2),
  que compartilha um único esqueleto e dispensa retargeting.

## Fase 4 — combate mais realista (aprovado pelo dono)

1. **Sem estabilidade é quase morte.** Quando a estabilidade do jogador zera, qualquer golpe de
   espada ou lança que acertar mata na hora (hoje só fere). Vale igual para os inimigos.
2. **Janela de aparar por inimigo.** Cada tipo (e cada golpe) tem sua própria janela: inimigos
   mais fortes atacam tão rápido que a janela contra eles é menor. É assim que a dificuldade
   sobe, não com vida extra.
3. **Progressão por maestria.** Ao vencer cada encontro, o jogador escolhe 1 entre 2 melhorias
   pequenas: janela de aparar maior (+15 ms), estabilidade volta mais rápido, mais foco (item 4),
   contra-golpe mais forte etc. Quanto mais inimigos à frente, mais o jogador precisa ter
   melhorado de verdade (e de habilidade).
4. **Foco (pontos de esquiva).** Cada esquiva perfeita dá 1 ponto de foco (máximo 3). Gastar 1
   ponto recupera boa parte da estabilidade, com uma respiração curta que deixa você exposto por
   um instante. Mostrar como 3 pingos de tinta perto da vitalidade.
5. **Ataques simultâneos.** Se os dois atacam juntos: vence quem acerta primeiro (a geometria e o
   tempo decidem, sem sorteio). Se as lâminas se cruzarem, as espadas **travam**: os dois ficam
   parados empurrando, o jogador aperta o ataque repetidamente, quem vencer desequilibra o outro.
6. **Estocadas.** Não dá para defender. Dá para aparar só com um "aparo absoluto", numa janela
   minúscula (~50 ms), que quebra a estabilidade do inimigo na hora. Fora isso, só esquivando.
7. **Três inimigos novos:**
   - *Lanceiro*: alcance bem maior, estocadas e uma varredura baixa (vermelha, só esquiva); fraco
     de perto.
   - *Escudeiro*: o escudo anula golpes leves de frente sem gastar estabilidade dele; só golpe
     forte, flanco ou aparo abrem; ataca com empurrão de escudo.
   - *Esquivo*: foca em esquivar e contra-atacar quem erra; pouca estabilidade; vence-se aparando
     os contra-ataques dele e sem atacar à toa.
8. **Mais encontros, grupos maiores.** Reorganize a trilha para uns 5 encontros + duelo, com grupos
   crescendo até 3 inimigos, apresentando um tipo novo de cada vez. Diretor de combate continua:
   um ataca por vez, os outros cercam.
9. **Impacto físico.** Quem leva golpe é empurrado na direção do golpe.
10. **Ferimento visível.** Ferido, o personagem respira pesado e a estabilidade volta mais devagar.
11. **Morte melhor.** Joelhos cedem, cai de joelhos, depois tomba; a espada cai da mão; o chapéu
    rola. Na morte do jogador, câmera lenta e imagem dessaturando.
12. **Rebalanceie com os bots.** Crie bots para as mecânicas novas (esquiva perfeita + foco, travar
    espadas). Metas: quem só ataca ou só defende perde; um humano com erro de ±120 ms vence os
    primeiros encontros quase sempre e o duelo cerca de metade das vezes.

## Fase 5 — interface

1. **Menu de pausa** de verdade: continuar, controles, ajustes (o painel atual), reiniciar encontro.
2. **Dicas com o desenho do botão**, não só texto.
3. **Barras só aparecem em combate** e somem explorando; vitalidade desenhada como traço de pincel.
4. **Tela de título cinematográfica** (câmera lenta sobre o campo) com escolha de dificuldade:
   fácil / normal / difícil mudando a janela de aparar e a agressividade.
5. UI do foco e da escolha de melhoria no mesmo estilo (tinta, papel, dourado discreto).

## Fase 6 — assets opcionais

- Sons gravados (`assets/sounds/`) no lugar dos sintetizados, com os sintetizados de reserva.
- Céu em HDRI (`assets/hdri/`) para luz ambiente e reflexos, mantendo tarde → pôr do sol.

## Fase 7 — performance e celular

- Meça FPS nos 4 níveis. Meta: 30 fps estáveis no nível "baixa" num Android intermediário
  (simule com limitação de CPU no Chromium). Nada novo pode derrubar isso.
- GLB com Draco/Meshopt, texturas KTX2, tela de carregamento com progresso.

## Fase 8 — polimento e entrega

- Todos os testes verdes; screenshots finais das posições padrão em `tests/screens/`.
- Atualize `PROJETO.md` e escreva `RELATORIO.md`: o que foi feito, decisões, pendências, o que eu
  devo testar no celular e como publicar no GitHub Pages. Build de produção funcionando.

## Fora desta sessão (não implementar, só registrar em "Ideias futuras")

Posturas no estilo do Ghost, golpe em cadeia, vento guia, aviso de ataque fora da tela, técnicas
de espada (ver `PROJETO.md`) e criação de modelos 3D (sessão própria).
