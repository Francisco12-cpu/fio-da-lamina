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
