# Relatório da sessão — Fio da Lâmina no Claude Code (2026-09-28)

Tudo o que o prompt pediu foi feito, com uma ressalva: a meta de 30 fps no celular foi medida numa
simulação (GPU integrada de notebook + CPU limitada 4×) e precisa ser confirmada no seu aparelho.
Cada fase tem commit próprio no git (`git log`). Decisões com o porquê e a alternativa descartada
estão em `DECISOES.md`; o plano, com critérios de pronto, em `PLANO.md`.

## 1. O que foi feito

**Fase 1 — projeto de verdade.** O `index.html` original está intacto em `legacy/`. O código foi
dividido automaticamente em 31 módulos ES (`src/`, projeto Vite). Prova de que nada mudou: screenshots
pixel a pixel idênticos nas 4 cenas e resultado idêntico dos bots, legado × novo.

**Fase 2 — câmera.** 25% mais afastada e um pouco mais alta, ainda baixa e atrás do ombro. A grama
baixa e se abre só no cone entre a câmera e o personagem (continua no resto do campo). Travar a mira:
Q ou botão do meio no PC; no celular, tocar no inimigo ou no botão "mira"; arrastar para o lado troca
de alvo. Em combate, a câmera recua e se orienta para caber o grupo todo.

**Fase 3 — personagem.** Arquitetura: `AnimationController` por lutador, com camadas corpo inteiro /
parte de cima, crossfade curto e os tempos dos golpes mandando (`movePhase`). O boneco procedural é
uma implementação; o personagem 3D é outra.
- **Modelo:** manequim da Universal Animation Library 2 (Quaternius, CC0), que você colocou em
  `assets/animations/`, otimizado de 8 MB para 1,8 MB.
- **O `Samurai.fbx` não foi usado.** Não tem licença identificável (o candidato mais provável no
  Sketchfab é CC BY-NC, proibido para uso comercial) e usa outro esqueleto.
- **Animação:** o pacote gratuito não tem andar com espada, correr, esquivas nem golpes de katana,
  então o corpo é híbrido:
  - pernas e corpo vêm dos clipes que servem;
  - braços por IK até a empunhadura;
  - a katana fica presa ao osso da mão (erro medido: até 4 cm; até 2,6 cm na fase ativa do golpe).
- **O combate não mudou com o modelo:** os bots dão exatamente o mesmo resultado com o modelo e com
  o boneco. Chapéu, capa com física, contorno de luz, sombra de contato e cor por tipo de inimigo
  foram mantidos.

**Fase 4 — combate.**
- Sem estabilidade, qualquer golpe de lâmina mata, para os dois lados.
- Janela de aparar por inimigo e por golpe, de 190 ms (recruta) a 90 ms (duelista).
- Maestria: ao vencer um encontro, você escolhe 1 de 2 melhorias.
- Foco: cada esquiva perfeita dá um pingo de tinta (até 3); F ou o botão "foco" gasta um numa
  respiração que devolve a estabilidade e deixa você exposto.
- Ataques simultâneos, sem sorteio:
  - golpe cedo demais bate na guarda;
  - golpe um pouco antes de o dele descer acerta primeiro;
  - golpes no mesmo instante travam as espadas (aperte o golpe sem parar; quem vence desequilibra
    o outro).
- Estocadas: só esquivando, ou com o "aparo absoluto" até 50 ms antes do contato, que quebra o
  equilíbrio dele.
- Três inimigos novos:
  - **Lanceiro:** alcance longo, estocada e varredura baixa; não defende de perto.
  - **Escudeiro:** o escudo segura golpes leves; empurrão de escudo.
  - **Esquivo:** foge e contra-ataca quem erra.
- Trilha com 6 encontros e o duelo, apresentando um tipo novo por vez, com grupos de até 3.
- Quem leva golpe é empurrado na direção do golpe. Ferido, o personagem respira pesado e a
  estabilidade volta mais devagar.
- Morte: os joelhos cedem, cai de joelhos e tomba; a espada cai da mão e o chapéu rola. Na morte do
  jogador, câmera lenta e imagem sem cor.

**Fase 5 — interface.**
- **Título cinematográfico:** câmera lenta pela trilha na hora dourada, com escolha de dificuldade
  (fácil / normal / difícil muda a janela de aparar e o ritmo dos ataques).
- **Menu de pausa:** continuar, controles, ajustes, reiniciar encontro e créditos.
- **Dicas com o desenho do botão:** mouse, tecla ou ícone do botão de toque.
- **Barras só em combate:** vitalidade em traço de pincel, foco em pingos de tinta.
- **Maestria em cartões de papel.**

**Fase 6 — assets opcionais.** Não havia sons nem HDRI em `assets/`. O código está pronto e foi
testado com arquivos temporários: basta colocar os arquivos (nomes em `assets/README.md`). Sem eles,
tudo continua sintetizado.

**Fase 7 — desempenho.** Medido na GPU real da máquina, em tela de celular, numa luta em grupo.
- **Maior culpado:** o título invisível continuava refazendo um desfoque a cada quadro. Corrigido.
- **Inimigos distantes "dormem":** longe e parados, quase não custam nada.
- **Nos níveis baixa e mínima:** sombra refeita a cada 2 quadros e capa a 30 Hz.

**Fase 8 — entrega.**
- **Builds:** `dist/` (GitHub Pages) e um arquivo HTML único (`dist-arquivo/index.html`, abre direto
  do disco), ambos testados carregando o modelo 3D.
- **Screenshots finais:** `tests/screens/final/` (PC) e `tests/screens/final/celular/`.

## 2. Números

**Bots** (6 lutas por combinação; duelo com 24; o bot "humano" erra o tempo em até ±120 ms e ganha as
melhorias que um jogador teria até aquele encontro):

| Encontro | Só ataca | Só defende | Humano ±120 ms | Trava (binder) |
|---|---|---|---|---|
| Recruta | 0/6, morre 6 | 0/6, morre 1 | 6/6 | 6/6 |
| Recruta + Agressivo | 0/6, morre 6 | 0/6, morre 6 | 6/6 | 5/6 |
| Paciente + Recruta | 0/6, morre 6 | 0/6, morre 6 | 6/6 | 5/6 |
| Lanceiro + Agressivo | 1/6, morre 5 | 0/6, morre 6 | 5/6 | 6/6 |
| Escudeiro + Lanceiro + Recruta | 0/6, morre 6 | 0/6, morre 6 | 6/6 | 6/6 |
| Esquivo + Escudeiro + Agressivo | 0/6, morre 6 | 0/6, morre 6 | 5/6 | 5/6 |
| **Duelo** (24 lutas) | 0/6, morre 6 | 0/6, morre 6 | **15/24 (62,5%)** | 2/6 |

(Há um quinto bot, "dodger": só esquiva e usa foco, nunca ataca — serve para testar a esquiva
perfeita e o foco isoladamente, por isso perde ou empata em todo lugar; não entra na meta de vitória.)

- **Só ataca e só defende perdem em todos os encontros**, com uma exceção pequena: o "só ataca" às
  vezes vence a dupla com o lanceiro, que é fraco de perto por projeto.
- **Humano:** vence os primeiros seis quase sempre (25/36 = ~86% no total, a maior parte 6/6) e o
  duelo em 62,5%. A meta era ~50% no duelo; o bot lê todo golpe sem hesitar e nunca se distrai, então
  um humano de verdade deve ficar mais perto de metade — tratar como teto, não como medida exata.
- **Nenhuma vitória sem aparo ou trava vencida.** Considerei a trava vencida uma defesa habilidosa:
  é uma janela de tempo de ±60 ms, do mesmo jeito que o aparo.

**FPS** (luta em grupo, tela de celular, GPU Intel UHD integrada):

| nível | CPU normal | CPU 4× mais lenta (~Android médio) |
|---|---|---|
| mínima | ~100 | ~31 |
| baixa | ~70 | ~31 |
| média | ~56 | ~23 |
| alta | ~33 | ~20 |

## 3. O que testar no celular

1. **FPS:** o contador no canto (toque nele para o painel). Na trilha e nas lutas em grupo, o nível
   deve ficar em "baixa" com uns 30 fps. Se cair para "mínima" o tempo todo, me mande o relatório
   ("Copiar relatório" no painel).
2. **Toques:**
   - tocar num inimigo trava a mira; tocar de novo solta;
   - arrastar o dedo direito para o lado troca de alvo;
   - o botão "mira" trava no mais próximo do centro.
3. **Botão "foco" (pingo):** só funciona com um pingo cheio (esquiva perfeita no último instante contra
   golpe vermelho ou azul). Veja se a respiração fica clara.
4. **Trava de espadas:** consegue tocar rápido o bastante? Contra o duelista precisa de uns 10
   toques por segundo; contra os primeiros, uns 6–7.
5. **Aparo absoluto na estocada** (lanceiro, recruta): a janela é de 50 ms; diga se ficou impossível.
6. **Título e pausa:** a escolha de dificuldade e o botão ☰ (pausa).
7. **Legibilidade:** as dicas com o desenho do botão, com o sol de frente.

## 4. Pendências (precisam de você)

- Confirmar FPS e toques no aparelho (itens acima).
- `Samurai.fbx`: se você souber a origem e a licença, dá para reavaliar (precisaria redirecionar as
  animações para o esqueleto dele).
- Roupas e animações próprias de katana: sessão separada (`PROMPT-CRIAR-MODELOS.md`). O código já
  aceita qualquer modelo com o esqueleto da Quaternius.
- Sons gravados e HDRI: só colocar os arquivos (nomes em `assets/README.md`) e anotar em `CREDITS.md`.

## 5. Como rodar, testar e publicar

```bash
npm install            # uma vez
npm run dev            # jogo em http://localhost:5173
npm run test:logica    # testes de lógica (23 verificações)
npm run test:bots      # lutas por bots (demora ~15 min)
npm run test:telas     # screenshots das cenas fixas
npm run build          # gera dist/ (site)
npm run build:arquivo  # gera dist-arquivo/index.html (um arquivo só, abre direto do disco)
```

**GitHub Pages** (o workflow já está em `.github/workflows/pages.yml`):
1. Crie um repositório no GitHub e envie esta pasta:
   `git remote add origin https://github.com/SEU_USUARIO/fio-da-lamina.git` e `git push -u origin main`
   (a branch local se chama `master`; use `git branch -M main` antes do push).
2. No GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. A cada push na `main`, o jogo é publicado em `https://SEU_USUARIO.github.io/fio-da-lamina/`.

Sem GitHub, a pasta `dist/` funciona em qualquer hospedagem estática. Para mandar o jogo por arquivo,
use `dist-arquivo/index.html`.

**Parâmetros de URL úteis:**
- `?q=0..3` fixa a qualidade;
- `?boneco` usa o boneco de cápsulas em vez do modelo;
- `?noaudio` desliga o som;
- `?test` é o modo de teste.
