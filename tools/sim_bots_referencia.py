import asyncio, json, sys
from playwright.async_api import async_playwright
SETUP = """HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();
window.g=window.__game; g.start(); g.rig.intro=0;
window.fight = (encIdx, bot, secs) => {
  const E=g.Encounters.list[encIdx];
  g.Encounters.list.forEach((x,i)=>{ if(i!==encIdx){ x.cleared=true; x.enemies.forEach(e=>{e.reset(); e.die(0);}); } });
  E.enemies.forEach(e=>e.reset()); E.active=false; E.cleared=false; g.Director.reset();
  g.player.respawn({x:E.center.x, z:E.center.z+6}, 0); g.rig.snap(g.player.pos); g.rig.yaw=0;
  g.Stats.parries=0; g.Stats.decisive=0;
  const log={playerHits:0, enemyDeaths:0, parries:0, broken:0, blockedByEnemy:0, enemyParried:0, time:0, result:'timeout'};
  let lastH=g.player.health, pState='';
  const P=g.player; const I=g.Input;
  for(let f=0; f<secs*60; f++){
    I.keys.clear(); I.blockKey=false; I.atkKey=false;
    bot(P, E.enemies.filter(e=>e.alive), I, f);
    g.update(1/60);
    if (P.health<lastH) log.playerHits++; lastH=P.health;
    if (P.state==='broken' && pState!=='broken') log.broken++;
    if (P.state==='stagger' && pState!=='stagger') log.enemyParried++;
    if (P.state==='recoil' && pState!=='recoil') log.blockedByEnemy++;
    pState=P.state;
    if (!P.alive){ log.result='player died'; log.time=(f/60).toFixed(1); break; }
    if (E.enemies.every(e=>!e.alive)){ log.result='won'; log.time=(f/60).toFixed(1); break; }
  }
  log.parries=g.Stats.parries; log.decisive=g.Stats.decisive; log.enemyStab=E.enemies.map(e=>Math.round(e.stab)+'/'+e.health+(e.alive?'':'x'));
  return log;
};
// bots
window.spammer = (P, en, I, f) => { const e=en[0]; if(!e) return; const d=P.pos.distanceTo(e.pos); if (d>2.0){ I.keys.add('KeyW'); } if (d<2.6 && f%9===0) I.press('attack'); };
window.turtle = (P, en, I, f) => { const e=en[0]; if(!e) return; const d=P.pos.distanceTo(e.pos); if (d>2.4) I.keys.add('KeyW'); I.blockKey=true; if(f===0) I.press('blockPress'); };
window.skilled = (P, en, I, f) => {
  const d0 = en.map(e=>P.pos.distanceTo(e.pos)); const e = en[d0.indexOf(Math.min(...d0))]; if(!e) return;
  const d=P.pos.distanceTo(e.pos);
  const att = en.find(x=>x.state==='attack' && P.pos.distanceTo(x.pos)<4);
  window._pp = window._pp || {};
  if (att){
    const m=att.move, k=att.attackId+':'+att.combo;
    if (m.sig==='red'){ if(att.st>=m.w-0.1 && !_pp[k]){ _pp[k]=1; I.press('dodge'); I.keys.add('KeyA'); } }
    else { I.blockKey=true; if(att.st>=m.w-0.07 && !_pp[k]){ _pp[k]=1; I.press('blockPress'); } }
    return;
  }
  const open = en.find(x=>['stagger','broken','recoil','hurt'].includes(x.state) || (x.state==='attack' && x.st>x.move.w+x.move.a));
  if (open && P.pos.distanceTo(open.pos)<2.6){ if(f%8===0) I.press('attack'); return; }
  I.blockKey=true; if (d>2.6) I.keys.add('KeyW');
};
0;
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':320,'height':180})
        logs=[]; pg.on('pageerror', lambda e: logs.append('ERR: '+str(e)))
        await pg.goto('http://localhost:8765/test.html?test&noaudio&q=0'); await pg.wait_for_timeout(1200)
        await pg.evaluate(SETUP)
        for enc, name in [(0,'recruta'),(1,'recruta+agressivo'),(2,'paciente'),(3,'duelista')]:
            for bot in ['spammer','turtle','skilled']:
                r = await pg.evaluate(f"JSON.stringify(fight({enc}, {bot}, 40))")
                print(f"{name:18s} {bot:8s} {r}", flush=True)
        print(logs[:5])
        await b.close()
asyncio.run(main())
