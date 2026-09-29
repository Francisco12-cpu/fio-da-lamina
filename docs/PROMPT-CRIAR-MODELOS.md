# Prompt — criar modelos 3D (sessão separada, só se não houver assets)

Use este prompt numa sessão própria, depois da sessão principal, apenas se a pasta
`assets/characters/` continuar sem modelos. Cole tudo abaixo da linha no Claude Code.

---

O jogo "Fio da Lâmina" já está funcionando com um boneco procedural e com um
`AnimationController` preparado para receber personagens de verdade (ver `PROJETO.md`,
`DECISOES.md` e `RELATORIO.md`). Nesta sessão o objetivo é só um: criar os personagens 3D e as
animações que faltam, sem mexer nas regras de combate.

1. **Primeiro, procure alternativas prontas e livres (CC0)** antes de modelar do zero: veja
   `assets/README.md`. Se conseguir baixar pela rede, use e registre em `CREDITS.md`.
2. **Se precisar criar**, gere por código (Blender em modo headless com Python, se estiver
   instalado; senão, geometria do Three.js exportada com `GLTFExporter` em Node):
   - Um corpo humanoide de proporção realista-estilizada (~8 a 15 mil triângulos), com quimono,
     hakama e faixa; o chapéu de palha, a capa e a katana do jogo continuam sendo os atuais.
   - Esqueleto humanoide padrão (de preferência os mesmos nomes do esqueleto da Quaternius /
     Mixamo, para aceitar animações baixadas depois).
   - Pintura de vértices ou texturas simples, com variações de cor por tipo de inimigo.
3. **Animações** por quadros-chave em código, reaproveitando as poses de espada que já existem
   em `PLAYER_MOVES` / `ENEMY_LIB`: parado em guarda, andar, andar de lado e para trás, correr,
   golpes, defesa, esquiva, reação, desequilíbrio, morte, sacar e guardar a espada.
4. Valide com screenshots lado a lado (antes/depois) e rode os bots de combate: nada pode mudar
   no balanceamento.
5. Atualize `PROJETO.md` e `RELATORIO.md`.
