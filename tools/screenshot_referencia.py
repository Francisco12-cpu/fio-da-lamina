import asyncio, sys, re, json
from playwright.async_api import async_playwright
src = open('/mnt/user-data/outputs/fio-da-lamina.html').read()
src = src.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/', '/node_modules/three/')
src = re.sub(r'<link href="https://fonts.googleapis[^>]*>', '', src)
open('/home/claude/game/test.html','w').write(src)
steps = json.loads(sys.argv[1]) if len(sys.argv)>1 else []
W,H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv)>3 else (960,540)
Q = sys.argv[4] if len(sys.argv)>4 else '2'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':W,'height':H})
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text))
        pg.on('pageerror', lambda e: logs.append('ERR: '+str(e)))
        await pg.goto(f'http://localhost:8765/test.html?test&q={Q}')
        await pg.wait_for_timeout(1500)
        for i,(js,name) in enumerate(steps):
            await pg.evaluate(js)
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=name, timeout=120000)
        print('\n'.join(logs[:20]))
        await b.close()
asyncio.run(main())
