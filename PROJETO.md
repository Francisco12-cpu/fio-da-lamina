# Fio da Lâmina — protótipo de combate 3D

Demonstração técnica jogável de combate com espada em terceira pessoa, inspirada na
sensação de combate de *Ghost of Tsushima* (sem copiar seus assets). Three.js, build estático
(Vite). Roda no navegador, PC ou celular.

**Projeto:** Vite + módulos ES em `src/` (a versão de arquivo único original está intacta em `legacy/index.html`).
**Rodar:** `npm install` e `npm run dev`. **Publicar:** `npm run build` (pasta `dist/`, GitHub Pages) ou
`npm run build:arquivo` (um HTML só em `dist-arquivo/`, abre direto do disco). Ver `RELATORIO.md`.
**Artifact antigo (versão do chat):** https://claude.ai/artifact/NccAKGcGM4jLJSPjGjGt2y
**Ambiente de dev:** Claude Code nesta pasta desde 2026-09-28 (antes: no chat).

---

## Objetivo do projeto

Não é um jogo completo. É uma demonstração pequena e muito bem acabada: 1 personagem,
1 sistema de combate, 1 inimigo, 1 cenário pequeno — priorizando sensação de combate,
responsividade, animação e clareza visual acima de quantidade de conteúdo.

Documento original do usuário com todas as regras de escopo, filosofia e "o que não
fazer" está na conversa (mensagem inicial). Resumo das regras que mais importam para
decisões futuras:
- 1–3 golpes matam; time-to-kill baixo dos dois lados.
- Parry recompensa timing exato, não é invulnerabilidade genérica.
- IA por máquina de estados simples, nunca "trapaça" (só acerta se a lâmina física tocar).
- Regra de ouro: entre adicionar conteúdo e polir o que existe, polir. Entre complexo e
  simples-que-funciona-igual, o simples. Entre tech impressionante e tech confiável, a confiável.

---

## Decisões já tomadas (aprovadas pelo usuário)

| Tema | Decisão |
|---|---|
| Direção visual | Realista/enevoado (metade "Claude Opus 5.5" das referências), não a versão estilizada colorida |
| Ambiente de dev | Aqui no chat, arquivo HTML único publicado como Artifact — não Claude Code |
| Animações do corpo | Mixamo (aguardando o usuário enviar os arquivos) + camadas procedurais por cima (capa, chapéu, olhar) |
| Dano | 2 golpes matam o jogador; 1 golpe limpo mata o inimigo, mas inimigos defendem ataque frontal — precisa abrir a guarda |
| Stamina | Não existe |
| Parry | Botão de defesa apertado dentro de ~150ms antes do impacto = parry perfeito |
| Golpe pesado | Indefensável, só esquiva; tem aviso visual (brilho na lâmina) antes de acertar |
| Esquiva | Passo curto na direção do input (não é rolamento) |
| Mira | Suave/soft-lock no inimigo mais próximo, sem lock-on rígido |
| Estrutura | Clareira de treino → 3 encontros crescentes → tela final |
| Controles PC | WASD anda, Shift corre, mouse olha, botão esq. ataca, botão dir. defende/apara, Espaço esquiva |
| Controles mobile | Joystick virtual (esquerda) anda, arraste (direita) olha, botões de espada/escudo/esquiva |
| Áudio | 100% sintetizado via Web Audio, sem arquivos de som |

---

## Arquitetura (módulos em `src/`)

Os blocos do arquivo único viraram módulos (divisão automática, ver `DECISOES.md`, Fase 1).
Instâncias do topo (jogador, boneco, câmera, encontros) ficam no registro `G` (`core/time.js`).

```
main.js              → carrega o personagem (await), cria mundo/lutadores, loop update()/render(), __game (testes)
core/  config.js       CFG, sol, ATMO, trilha e clareira, URLP, IS_TOUCH
       util.js         clamp/lerp/noise/rand (mulberry32)/segSeg
       time.js         Time (hitstop, câmera lenta), clock, simT, Later (agendador), G (registro)
       input.js        teclado/mouse/toque, buffer de ações (atk, defesa, esquiva, foco, mira)
       quality.js      4 níveis, auto-ajuste por FPS (também: pano, sombra alternada, HDRI)
render/ atmosphere.js  céu/neblina GLSL e tone mapping próprio · renderer.js: renderer, composer, raios, bloom
world/ terrain.js · world.js (céu, sol, terreno, withRim/withBacklight) · grass.js (LOD contínuo + cone de visão)
       props.js (pedras, árvores, lanternas, cordilheiras, pólen) · tod.js (hora do dia, ofuscamento, grão)
       hdri.js (reflexos opcionais)
fx/fx.js             faíscas, lascas, sangue, poeira, folhas, rastro da lâmina
audio/ sound.js      síntese Web Audio · samples.js: sons gravados opcionais
combat/ moves.js     POSE, keyframes, PLAYER_MOVES, ENEMY_LIB, WEAPONS
        rules.js     dificuldade, maestria, janelas (aparar, aparo absoluto, esquiva perfeita)
        combat.js    Combat.resolve (um lugar só decide o efeito de cada contato)
        bind.js      espadas travadas · director.js: um ataca por vez · state.js: Report, Stats, Habits
fighters/ fighter.js (estados, estabilidade, varredura da lâmina, trava) · player.js · enemy.js (ETYPES, IA)
          cloak.js (capa verlet) · dummy.js (boneco de treino)
anim/  controller.js  AnimationController (camadas full/upper, crossfade, movePhase)
       procedural.js  boneco de cápsulas + equipamento comum (chapéu, armas, escudo, capa, quedas)
       skinned.js     manequim com esqueleto (clipes + IK dos braços + katana na mão)
       index.js       fábrica: modelo 3D se carregou, senão boneco
game/  camera.js (terceira pessoa, grupo, cortes) · lockon.js (mira travada) · encounters.js (6 + duelo)
       standoff.js (impasse) · game.js (morte, maestria, fim) · training.js · title.js (câmera do título)
ui/    ui.js (dicas, HUD, tags, trava, maestria) · glyphs.js (desenho dos botões) · pause.js · panel.js
```

### Por que virou um shader custom em cima de `MeshLambertMaterial`

Em vez de `ShaderMaterial` puro para o terreno, usamos `onBeforeCompile` sobre um
material padrão do Three — assim ganhamos sombra/iluminação padrão de graça e só
injetamos a lógica de cor (trilha vs relva vs "thatch" sob a grama) e o brilho de
contraluz. O mesmo padrão (`withBacklight()`) é reusado nas folhas das árvores e no
chapéu de palha.

### Neblina

Neblina de altura (mais densa perto do chão) calculada analiticamente
(`fogCalc()` no GLSL compartilhado), não a neblina linear/exp padrão do Three. A cor da
neblina é a cor do céu na mesma direção — por isso o horizonte "funde" sem costura.
Curva de mistura ajustada (`amt = 1.55 * pow(amt, 1.55)`) para limpar a meia-distância e
concentrar a neblina mais perto do horizonte (pedido do usuário: "não carregar tanto de
perto").

### Grama — LOD contínuo (correção do "anel de grama falha")

**Problema original:** a densidade da grama caía abruptamente numa borda fixa ao redor
da câmera → transição visível "grama boa / grama ruim".

**Solução atual:** cada haste tem um número pseudo-aleatório fixo (`aOffset.w` combinado
com posição). Perto da borda do raio de desenho, a chance de a haste "sumir" sobe
gradualmente (`smoothstep` + `step` contra esse número aleatório) em vez de todas
sumirem juntas na mesma distância. As hastes que sobrevivem ficam mais largas
(`uWiden`) para compensar visualmente a rarefação. A camada `grassMid` (mais rala, mais
larga, alcance maior) nasce exatamente onde `grassNear` começa a rarear, usando o mesmo
tipo de máscara probabilística (`uIsMid`) para não criar uma segunda borda.

**Compensação de baixo nível:** o chão sob a grama deixou de ser terra escura e virou
"thatch" (palha seca clara) — então onde a grama rarear (por LOD ou por densidade baixa
do heightmap), o chão não aparece como um buraco escuro.

**Trade-off conhecido (feedback do usuário 2026-09-27, parcialmente corrigido na 3ª rodada):** em qualidade "baixa"/"mínima"
(a que o celular está usando), os parâmetros de raio e contagem de instância são bem
mais conservadores — grama visivelmente mais esparsa/curta que em "alta". O anel sumiu,
mas a qualidade geral da grama no celular ficou abaixo do que se via nos prints
"média/alta" do PC. **Pendente:** revisar se dá para subir um pouco os parâmetros da
qualidade "baixa" sem derrubar o FPS, ou se vale adicionar um nível intermediário entre
"baixa" e "média".

### Combate

- **Poses da espada são dados, não animação-arquivo.** `POSE.*` e `MOVES[3]` guardam
  posição da mão + rotação da lâmina em keyframes. Isso é proposital: quando o Mixamo
  entrar, essas poses viram *offsets* aplicados sobre o esqueleto animado (a mão segue
  o osso, a espada é filha do osso da mão), então o sistema de combate não muda.
- **Hit detection:** segmento de reta (base→ponta da lâmina) varrido em sub-passos
  (`sampleBlade`) e testado contra segmento vertical do alvo (`segSeg`, distância
  mínima entre dois segmentos 3D). Independe de FPS porque os sub-passos são calculados
  por tempo de simulação, não por frame.
- **Parry:** `Input.buf.blockPress` guarda o timestamp do aperto; `parryOpen` é
  verdadeiro se o aperto anterior foi há mais de `parryRearm` (anti-spam). O dummy
  registra `armA` (ângulo do braço) e compara com o ângulo até o jogador (`rel`) pra
  saber o instante exato de contato dentro do arco de swing.
- **Hitstop/câmera lenta:** `Time.freeze(s)` e `Time.slow(scale, dur)` — o `dt` da
  simulação (`simT`) é diferente do `dt` real (`clock.elapsed`), então UI e câmera-shake
  usam tempo real e a física/animação usa tempo de jogo.

### Testes automatizados (histórico: como era no chat)

Durante o desenvolvimento, cada mudança visual/de combate foi validada com Chromium
headless (`swiftshader`) tirando screenshots em pontos determinísticos da simulação. O
jogo expõe `window.__game` com `step(n, dt)` e `update`/`render` separados exatamente
para permitir isso — **não remover essa exposição**, ela não afeta o jogo real (só é
usada se `?test` estiver na URL) e é o jeito mais rápido de verificar uma mudança sem
depender do usuário testar no celular a cada iteração.

---

## Sistema de combate: Estabilidade (aprovado em 2026-09-28)

Modelo escolhido pelo usuário entre três opções (Estabilidade / guardas alta-média-baixa /
stamina clássica). Base: barra de postura do Sekiro + sinais coloridos do Ghost of Tsushima.
Barra visível (estilo do vídeo de referência) e quatro tipos de inimigo.

**Regras centrais**
- Cada lutador tem estabilidade (jogador 100; recruta 70, agressivo 60, paciente 110,
  duelista 100). Inimigos defendem automaticamente golpes de frente quando estão parados,
  circulando, preparando golpe ou ricocheteando de uma defesa. Não morrem com golpe comum.
- Custos: defender golpe leve −14 a −24 (depende do golpe), golpe forte −42; ter o golpe
  aparado −45 (×1,4 se foi corte apressado); ser ferido −30; errar golpe −6 (jogador) /
  −10 (inimigo); esquivar duas vezes seguidas (menos de 0,55 s) −12; atacar correndo −22.
- Aparar não custa nada e devolve +10.
- Recuperação (jogador): parado ou defendendo 32/s, em guarda andando 24/s, andando 14/s,
  correndo 0. Começa 0,9 s depois da última perda. Inimigos: taxa própria do tipo.
- Estabilidade zerada = "desequilibrado" (jogador 1,0 s; inimigos 1,1–1,5 s): não defende;
  golpe em inimigo desequilibrado é **golpe decisivo** (mata, câmera lenta, gongo suave).
- Inimigos têm 2 de vida: golpe que acerta sem guarda (depois de aparar, no flanco, na
  recuperação de um golpe errado) fere e tira 30 de estabilidade; o segundo mata.

**Ações do jogador**
- Clique: golpe leve (encadeia 3). Segurar: golpe forte (converte o leve após 0,09 s).
- Atacar correndo: "corte apressado" — lento, gasta estabilidade, inimigos aparam 3× mais.
- Defesa (segurar): bloqueia golpes sem sinal; drena estabilidade.
- Aparar (apertar ≤0,16 s antes do contato): funciona em golpes sem sinal e azuis.
- Esquiva: sem custo; esquiva perfeita (contato até 0,26 s após iniciar) dá câmera lenta,
  tira 25 do inimigo e o deixa cambaleando (abertura).

**Sinais dos golpes inimigos**
- Sem brilho: defender ou aparar. Azul: segurar a defesa não adianta, só aparar ou esquivar.
  Vermelho (estocada e agarrão): só esquiva. Som de aviso diferente para azul e vermelho.

**Biblioteca de golpes (`ENEMY_LIB`)**: A corte horizontal; B descendente atrasado (segura
no alto); Q diagonal azul rápido; O golpe alto azul; T estocada vermelha; G agarrão vermelho
(alcance do corpo, derruba); F finta (treme mais forte e troca para A).

**Tipos (`ETYPES`)**
- Recruta: lento, previsível, apara 5%. Golpes A, B, T.
- Agressivo (laranja): combos, intervalo curto, não ricocheteia ao ser defendido. A, Q, T.
- Paciente (azul): apara 45%, contra-ataca 60% após defender, agarra quem só defende. A, O, G.
- Duelista (branco): tudo, com fintas; apara 30%; totalmente adaptativo.

**Leitura de hábitos (`Habits`)** — só reage ao que o jogador já fez:
aparar cedo → mais golpes atrasados e fintas; ficar só na defesa → mais agarrões e
estocadas; esquivar muito → mais combos; golpear em sequência → inimigos aparam mais.

**Encontros**: recruta (z 108) → recruta + agressivo (z 38) → paciente (z −35) → duelo (z −100).

**Balanceamento verificado por simulação** (bots headless, 60 s por luta):
- "Só ataca" morre em ~4–6 s contra qualquer tipo.
- "Só defende" morre contra agressivo, paciente e duelista; contra o recruta sobrevive mas não vence.
- Bot com erro de tempo de ±120 ms: vence o recruta sempre (4–12 s), ~75% contra a dupla,
  ~50% contra o paciente, ~75% contra o duelista. Toda vitória exigiu pelo menos um aparo.
- Correção feita no processo: ricochete após defesa não abre mais a guarda do inimigo
  (antes dava para vencer o recruta sem aparar nunca).

---

## Luz, pôr do sol e cinema (2026-09-28)

Decisões do usuário: a tarde vira pôr do sol ao longo da trilha; estilo "realista
estilizado, tipo Ghost"; continuar no chat (migração para Claude Code fica para depois).

- **Hora do dia (`TOD`)**: o sol desce de 14° (clareira) a 3,2° (duelo) conforme o avanço
  na trilha (nunca volta atrás). Três quadros-chave (tarde, hora dourada, pôr do sol)
  interpolam céu, neblina, cor e força do sol, luz ambiente, contorno de luz e tamanho do
  disco solar. Céu e neblina agora vêm de uniforms (`ATMO`) injetados em todos os
  materiais via `THREE.Material.prototype.onBeforeCompile`.
- **Vão nas montanhas**: terreno e as três cordilheiras baixam na direção do sol
  (`SUN_AZ`), para o sol se pôr visível atrás do fim da trilha.
- **Ofuscamento (`Glare`)**: raios de luz em pós-processamento a partir do disco do sol
  (ocluídos por grama, árvores e personagens), bloom mais forte ao olhar para o sol,
  véu quente (CSS, funciona até sem pós) e adaptação do olho (exposição cai devagar).
  Tudo mais intenso no fim da tarde.
- **Contorno de luz (`withRim`)** nos personagens e capas: bordas acendem com o sol atrás.
- **Cor de cinema**: tone mapping próprio (ACES + sombras frias, luzes quentes, contraste
  suave), igual com e sem pós-processamento; granulação fina de filme.
- **Qualidade**: "baixa" agora usa pós-processamento leve (raios com 12 amostras, sem bloom);
  "mínima" desliga o pós.

## Combate cinematográfico

- **Impasse antes do duelo (`Standoff`)**: faixas de cinema, câmera lateral, o jogador
  segura o ataque e solta quando o duelista avança (ele pode fingir 1–2 vezes com um
  passo e som). Acertar: câmera lenta e o duelista começa ferido e sem metade da
  estabilidade. Soltar cedo ou tarde: você leva o golpe. Testado nos três casos.
- **Golpe decisivo** corta para um plano baixo lateral por ~1 s.
- **Limpeza da espada** (sacudir e guardar) ao vencer cada encontro.
- **Vibração no celular**: aparar, ser aparado, levar golpe, golpe decisivo, impasse.

## Painel de ajustes e relatório (processo)

- Toque no contador de FPS (ou tecla P): qualidade, hora do dia, neblina, brilho do sol,
  raios, exposição e janela de aparar. Salvo no navegador (localStorage).
- **Copiar relatório**: aparelho, FPS, golpes recebidos por tipo de inimigo, quantos ms
  antes do golpe você apertou nos aparos, quantas vezes apertou cedo/tarde demais e por
  quanto. Serve para calibrar a janela de aparar com dados.

---

## Acabamento final no chat (2026-09-28)

- **Grama:** mais alta (1,12–1,15 m), 30% com espiga, touceiras (62% das hastes nascem
  agrupadas), um lado de cada lâmina mais claro (volume), hastes finas perto da câmera,
  até 90 mil hastes na qualidade alta. Tufos baixos sobrevivem no meio da trilha.
- **Terra:** trilha com centro batido mais claro, bordas úmidas mais escuras, granulado fino
  e 1.400 pedrinhas instanciadas.
- **Luz:** sombra de contato (mancha suave) sob cada personagem, que alonga quando cai.
- **Interface:** botões de toque redesenhados com rótulos; anel que enche ao segurar o
  golpe (golpe forte); escudo brilha no aparo perfeito; esquiva apaga no tempo de recarga;
  barras de estabilidade com rastro de dano; botão de menu (☰) abre os ajustes; dica com
  fundo suave para ler sobre o sol.
- **Mecânica:** contra-golpe rápido (golpe até 0,65 s depois de aparar: preparação de 0,07 s
  e −35 de estabilidade extra); aviso de "corte apressado" nas duas primeiras vezes.
- **Som:** cordas dedilhadas (síntese Karplus-Strong) numa escala japonesa (In) enquanto
  explora; taiko a 88 bpm em combate; batida de coração no impasse; cigarras à tarde,
  grilos no pôr do sol.

## Lista de assets para procurar (para a fase no Claude Code)

**Personagem** — critérios: humanoide, rigado ou em T/A-pose, até ~20 mil triângulos,
textura incluída, licença CC0 ou CC-BY (guardar o crédito), roupa que combine com
quimono/hakama (o chapéu e a capa podem continuar os nossos).
Onde: Sketchfab (filtro "Downloadable", licença CC0/CC-BY; buscar "samurai", "ronin",
"kimono", "hakama", "japanese warrior"), Quaternius (CC0), Poly Pizza, Mixamo (personagens
prontos). Se o modelo não vier rigado: enviar ao Mixamo, que faz o rig automático.

**Animações (Mixamo, sempre no esqueleto do personagem escolhido, FBX, 30 fps, "In Place"
quando houver)** — nomes aproximados, buscar pelo termo:
idle com espada de duas mãos; andar; correr; andar de lado (esquerda e direita, em guarda);
andar para trás em guarda; 3 cortes diferentes (horizontal, diagonal, vertical); golpe forte
com preparação longa; estocada; defesa segurando (loop) e reação de defesa atingida;
esquiva curta para trás e para os lados; reação a golpe (hit); cambalear/atordoado;
cair e levantar; morte; sacar a espada; guardar a espada. Opcional: chute ou empurrão.

**Sons (Freesound, filtro CC0)** — "katana clash", "sword parry", "sword unsheathe",
"sword sheath", "sword swoosh", "footsteps grass", "wind field", "cicada", "cricket night",
"taiko", "koto pluck".

**Céu (Poly Haven, CC0)** — HDRIs de pôr do sol em campo aberto para iluminação e reflexos.

Quando encontrar, mandar links ou prints: eu avalio proporção, contagem de polígonos, rig,
licença e se o estilo combina antes de baixar.

---

## Direção aprovada para a sessão no Claude Code (2026-09-28)

Respostas do dono às sugestões:
- **Sim:** travar a mira; câmera enquadrar o grupo; espadas travadas; lanceiro e escudeiro;
  impacto físico; ferimento visível; menu de pausa; dicas com desenho do botão; barras só em
  combate com vitalidade em traço de pincel; tela de título cinematográfica com dificuldade.
- **Não agora:** posturas estilo Ghost, golpe em cadeia, aviso de ataque fora da tela, vento guia.
- **Pedidos novos do dono:** combate realista; sem estabilidade qualquer golpe mata; janela de
  aparar diferente por inimigo (inimigos mais fortes = janela menor); progressão ganhando
  melhorias (ex.: janela de aparar maior); pontos de foco ganhos com esquiva perfeita e gastos
  para recuperar estabilidade; ataques simultâneos (vence o mais rápido, ou as espadas travam);
  estocada só esquivável ou com um aparo absoluto (~50 ms); inimigo focado em esquivar; mais
  encontros com grupos maiores; morte mais bem animada; câmera mais afastada; grama não pode tapar
  a visão.
- **Modelos 3D:** se não houver arquivos em `assets/`, a sessão principal não cria modelos; eles
  serão criados depois, numa sessão própria (`PROMPT-CRIAR-MODELOS.md`).

## Ideias futuras

- **Técnicas de espada (ideia do dono):** em vez das quatro posturas do Ghost, estilos que mudam
  os golpes. Ex.: uma técnica rápida, que vence quase sempre quando os dois atacam juntos mas tira
  pouca estabilidade, e uma pesada, com o oposto. Golpes de cima e de lado se comportam diferente
  pela geometria da lâmina.
- Posturas no estilo do Ghost; golpe em cadeia após golpe decisivo; vento guia apontando o
  próximo encontro; aviso de ataque vindo de fora da tela.
- **Criação/troca de modelos 3D** (sessão própria, `PROMPT-CRIAR-MODELOS.md`): corpo com quimono e
  hakama no esqueleto da Quaternius (mesmos nomes de ossos → as animações e o IK continuam valendo);
  clipes próprios de andar em guarda, correr, esquivas laterais e golpes a duas mãos (hoje as pernas
  vêm de clipes genéricos e os braços são IK). Universal Animation Library 1 (locomoção) resolveria parte.
- Hakama/roupa com física leve (como a capa) para esconder o manequim.
- Nível de qualidade intermediário entre "baixa" e "média" (pendência antiga da grama no celular).
- Bot que lê o golpe com atraso de reação humano, para calibrar o duelo mais perto de 50%.

## Sessão no Claude Code (2026-09-28) — o que mudou

Detalhes, números e alternativas descartadas em `DECISOES.md`; plano em `PLANO.md`; resumo em `RELATORIO.md`.
- **Projeto Vite** com módulos, testes automáticos (lógica, bots, telas, poses, desempenho, build).
- **Câmera**: 25% mais longe e mais alta; grama baixa e se abre no cone câmera→personagem; mira travada
  (Q / botão do meio / toque / botão "mira", troca arrastando); enquadra o grupo inteiro.
- **Combate**: sem estabilidade qualquer golpe de lâmina mata (os dois lados); janela de aparar por inimigo
  e por golpe (recruta 190 ms … duelista 90 ms); maestria (1 de 2 melhorias por encontro); foco (esquiva
  perfeita → pingo de tinta → respirar); ataques simultâneos (acerta primeiro quem chegar; golpes no mesmo
  instante travam as espadas: apertar o golpe); estocadas com aparo absoluto (50 ms); lanceiro, escudeiro e
  esquivo; 6 encontros + duelo com grupos até 3; empurrão na direção do golpe; ferido respira pesado;
  morte com joelhos, queda, espada e chapéu caindo; câmera lenta e imagem sem cor na morte do jogador.
- **Interface**: título cinematográfico com dificuldade; menu de pausa; dicas com o desenho do botão;
  barras só em combate; vitalidade em traço de pincel; maestria em cartões de papel.
- **Personagem 3D**: manequim CC0 da Quaternius com clipes + IK; katana presa à mão; boneco de reserva.
- **Assets opcionais**: sons gravados e HDRI entram sozinhos se forem colocados em `assets/`.
- **Desempenho**: medido na GPU real; ~31 fps no nível "baixa" com CPU 4× mais lenta (luta em grupo).

## Estado atual (o que já funciona)

- Mundo: terreno, trilha, neblina, céu, grama em 2 camadas, ~90 rochas, ~24 árvores,
  cordilheiras, pólen no ar.
- Câmera 3ª pessoa com colisão contra `colliders[]`, reenquadramento automático em
  combate (desloca o alvo para o lado, puxa a distância).
- Movimento: andar/correr, com aceleração/desaceleração e virada suavizada.
- Combate completo contra o **boneco de treino** (`Dummy`): 3 golpes encadeáveis,
  bloqueio, parry perfeito com feedback completo (faíscas, hitstop, câmera lenta, som),
  contra-ataque após parry, esquiva, golpe pesado indefensável com aviso visual.
- **Inimigos reais** (`Enemy`, mesma classe-base `Fighter` do jogador): IA por estados
  (idle → approach → circle com guarda → attack → reposition), 3 padrões legíveis
  (A corte rápido, B corte atrasado que segura no alto, H estocada pesada com brilho),
  guarda frontal com 3 marcadores sobre a cabeça que quebra com golpes seguidos,
  chance de contragolpe depois de defender, e um `Director` que só deixa um atacar por vez.
- **Três encontros na trilha** (1 inimigo, 2 inimigos, duelo contra um espadachim mais
  rápido que também apara), cada um com checkpoint; morte → volta ao checkpoint com o
  encontro reiniciado; tela final com tempo, aparos, inimigos vencidos e quedas.
- **Capa com física de pano** (`Cloak`) em todos os personagens: 98 partículas (verlet)
  presas nos ombros, com gravidade, vento, colisão com tronco, pernas e chão; congela
  junto com o hitstop.
- **Cenário do duelo:** árvore vermelha solitária com folhas caindo ao vento, luz de
  entardecer que chega aos poucos quando o duelo começa (cor do sol, grama e exposição)
  e gongo. Três pares de lanternas de pedra marcam a trilha (saída da clareira, meio do
  caminho e entrada do duelo).
- **Zoom de impacto** (`rig.punch`) no aparar e no golpe final, além do tremor.
- Vida do jogador: 2 hits, regenera sozinha fora de combate, tela "derrubado" com
  respawn automático (só no treino).
- Tutorial (`Training`) que avança sozinho por objetivo cumprido, não por texto genérico.
- Áudio sintetizado: vento ambiente contínuo, passos, swoosh, clangor normal/parry,
  impacto, dor, desembainhar/guardar espada, rangido do boneco, glint do golpe pesado.
- Qualidade adaptativa: 4 níveis (mínima/baixa/média/alta), desce rápido se o FPS cair,
  sobe devagar e com cautela.
- Controles PC e mobile (joystick + botões de toque) funcionando lado a lado no mesmo código.

## Ainda não implementado / pendente

1. Confirmar no celular do dono: FPS (a GPU do celular não é simulada), toques (mira por toque, foco,
   arrastar para trocar de alvo), leitura das dicas com desenho do botão.
2. Roupas de verdade para o manequim e animações próprias de katana (ver "Ideias futuras").
3. Sons gravados e HDRI: o código está pronto; faltam os arquivos (`assets/README.md`).
4. Polimento com base no feedback de quem jogar os seis encontros e o duelo.

## Lista do Mixamo (histórico; o projeto usa a Universal Animation Library 2 da Quaternius)

Personagem "Y Bot" (ou humano de proporção normal, T-pose, FBX Binary, com skin) +
animações "Without Skin", 30fps, "In Place" quando disponível, pacote de espada de duas
mãos: idle, walk, run, 3 ataques diferentes, blocking + hit-block, hit reaction, death,
2 esquivas curtas (trás e lateral).

## Feedback registrado (para não perder o histórico de ajustes)

- **2026-09-28:** capa estava "desengonçada" (vai-e-volta) → pano mais pesado, com mola de
  forma e amortecimento alto. Combate fácil demais ("ela leva o primeiro golpe e morre",
  não tenta se defender) → reforma completa para o modelo de Estabilidade (acima).
- **2026-09-27, 1ª rodada:** vibe aprovada (pode exagerar); FPS baixíssimo (2) → causa:
  qualidade "alta" padrão em mobile; grama só ficava boa num raio fixo ao redor da
  câmera, depois falhava visivelmente → corrigido com LOD probabilístico; árvores
  feias → refeitas com tronco curvo + copas em "almofadas"; câmera aprovada sem
  alterações.
- **2026-09-27, 2ª rodada:** FPS ~32 parado, ~48–50 em outros momentos. Anel de grama:
  resolvido. Grama e sol/iluminação: **pioraram** no celular (na primeira leitura
  entendi "melhorou" por engano). Causa: o ajuste automático descia a qualidade sempre
  que o FPS ficava abaixo de 44, então o celular a 32 fps caía para "mínima", que
  desligava sombras e o brilho do sol.
- **Correção (3ª rodada):** no celular o limite para baixar a qualidade agora é 26 fps
  (30 é aceitável em celular); "mínima" voltou a ter sombra; quando o bloom está
  desligado, o próprio céu desenha o halo do sol (`uGlow`); contagem de grama da
  "baixa" subiu de 24k para 28k. Pendente: confirmar no celular do usuário.

## Como testar (headless, sem depender do celular)

Tudo em Node + Playwright (Chromium já instalado na máquina, ver `tests/lib/harness.mjs`):

```bash
npm run test:logica      # 23 verificações: mira, estabilidade letal, estocada, foco, trava, maestria, morte, pausa
npm run test:bots        # lutas por bots em todos os encontros (só ataca, só defende, humano ±120 ms, trava, esquiva)
npm run test:telas       # screenshots das cenas fixas (clareira, trilha, duelo, grupo, mira, inimigos novos, trava, morte, título, pausa)
node tests/diff.mjs A B  # compara duas pastas de screenshots pixel a pixel
node tests/screens.mjs --touch --q 1 --dir tests/screens/x   # mesma coisa em tela de celular
node tests/pose.mjs [--nocloak] [--boneco]                    # poses do personagem de perto
npm run test:desempenho  # FPS por nível na GPU real, CPU 1×/4× (Android médio aprox.)
node tests/build.mjs     # os dois builds de produção abrem e carregam o modelo
```
`?test` expõe `window.__game` (loop parado; `step(n)`), `?noaudio`, `?q=0..3`, `?boneco` (sem modelo 3D),
`?perf` (mede simulação/desenho por quadro).
