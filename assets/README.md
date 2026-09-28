# Assets — o que baixar e onde colocar

## Opção recomendada: pacote Quaternius (tudo CC0, mesmo esqueleto, sem retargeting)

Os quatro pacotes abaixo usam o MESMO esqueleto de 65 ossos, com os mesmos nomes e pose.
Qualquer animação roda em qualquer corpo direto no `AnimationMixer` do Three.js. Todos CC0
(uso livre, inclusive comercial, sem precisar de crédito). Baixe a versão em glTF/GLB.

| Pacote | Link | Pasta |
|---|---|---|
| Universal Base Characters (corpos, cabelos) | https://quaternius.itch.io/universal-base-characters | `assets/characters/` |
| Modular Character Outfits (roupas modulares, capuz) | procurar em https://quaternius.com | `assets/characters/outfits/` |
| Universal Animation Library 1 (locomoção 8 direções, mortes, reações) | https://quaternius.itch.io/universal-animation-library | `assets/animations/ual1/` |
| Universal Animation Library 2 (combos corpo a corpo e com arma) | https://opengameart.org/content/universal-animation-library-2 | `assets/animations/ual2/` |

Pré-visualizar todas as animações antes de baixar: https://quaternius.com/animviewer.html
A versão gratuita ("Standard") tem parte das animações; a paga ("Source") tem todas.
Comece pela gratuita e só pague se faltar alguma animação essencial.

Chapéu de palha, capa (com física de pano) e katana continuam sendo os do jogo: a katana vai
presa ao osso da mão direita.

## Opção B: Mixamo + modelo genérico do Sketchfab

- Mixamo (grátis, conta Adobe): https://www.mixamo.com — buscar "great sword" (idle, walk,
  run, slash, blocking, impact, death), "sword and shield" (block, impact), "dodge",
  "stunned", "knocked down", "getting up", "draw sword", "sheath sword".
  Baixar: FBX, 30 fps, "Without Skin" para animações, "In Place" quando houver.
- Modelo genérico sem rig (enviar ao Mixamo para rigar): "Samurai" de Eduardo92, CC-BY
  (exige crédito), 7,9 mil triângulos:
  https://sketchfab.com/3d-models/samurai-6b7e3daf8c784b4faec2d13b732e23a8
- Evitar modelos de personagens de outros jogos (ex.: "Low-Poly Sekiro"), mesmo gratuitos:
  são personagens proprietários, contra a regra do projeto.

Atenção: os modelos de exemplo do próprio Three.js (Soldier, Xbot, RobotExpressive) só têm
andar/correr/gestos, nenhuma animação de espada. Servem só para teste.

## Como baixar (passo a passo)

**itch.io (Quaternius):** abrir o link → "Download Now" → na janela de preço, clicar em
"No thanks, just take me to the downloads" → baixar o arquivo "[Standard].zip" → descompactar
e copiar a pasta **glTF** para a pasta indicada na tabela.

**OpenGameArt (Animation Library 2):** abrir o link → rolar até "File(s)" → clicar no .zip →
descompactar e copiar a pasta **glTF**.

**Sketchfab:** criar conta grátis e entrar → abrir o modelo → o botão "Download 3D Model" fica
logo abaixo do visualizador 3D (só aparece com login, e só em modelos marcados como
"Downloadable"; no celular às vezes some, use o computador) → escolher **glTF** ou **GLB** →
descompactar em `assets/characters/<nome>/` → anotar autor, licença e link em `CREDITS.md`.

**Se nada disso for baixado:** tudo bem. A sessão principal do Claude Code mantém o boneco
atual e deixa o código pronto; os modelos são criados depois numa sessão separada com
`PROMPT-CRIAR-MODELOS.md`.

## Sons (Freesound, filtro de licença CC0) — `assets/sounds/`

https://freesound.org — buscar: "katana clash", "sword parry", "sword unsheathe",
"sword sheath", "sword swoosh", "footsteps grass", "wind field", "cicada", "crickets",
"taiko", "koto". Guarde o link de cada som em `CREDITS.md` mesmo sendo CC0.

## Céu (Poly Haven, CC0) — `assets/hdri/`

https://polyhaven.com/hdris — categoria "sunrise-sunset", resolução 2K, formato .hdr.
Um HDRI de tarde e um de pôr do sol em campo aberto.
