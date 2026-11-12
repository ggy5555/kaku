'use strict';
// KAKU UI smoke: browser simulation is NOT a real Android S Pen validation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const CSS=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const URL='http://127.0.0.1:8765/';
const screenshotDir=path.join(__dirname,'screenshots');
fs.mkdirSync(screenshotDir,{recursive:true});

function staticChecks() {
  const script=HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'inline script exists');
  new vm.Script(script,{filename:'index.html'});
  const ids=[...HTML.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'no duplicate IDs');
  for(const match of script.matchAll(/\$\('([^']+)'\)/g)) {
    assert.ok(ids.includes(match[1]),'selector target exists: '+match[1]);
  }
  for(const required of [
    'const CELL_W = 80, CELL_COUNT = 14, CANVAS_W = CELL_W * CELL_COUNT, CANVAS_H = 183;',
    "const STORAGE_EDITOR = 'kaku.editor.v1', STORAGE_ARCHIVE = 'kaku.archive.v1';",
    "const ORT_ROOT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';",
    "function canvasPosition(e){", "function penTipIsDown(e){",
    "(e.buttons & 1)!==0 && (e.pointerType!=='pen' || e.pressure>0)",
    "canvas.addEventListener('pointermove'",
    "canvas.addEventListener('pointercancel'",
    "canvas.addEventListener('lostpointercapture'",
    "function drawCellToTensor(strokes){",
    "async function loadModel(){",
    "const LEXICON = {",
    "const CONFUSABLE_PAIRS = ["
  ]) assert.ok(script.includes(required),'protected functionality: '+required);
  assert.match(HTML,/href="\.\/styles\.css"/);
  assert.match(CSS,/#ink-canvas\s*\{[^}]*width:1120px;height:183px;touch-action:none/);
  assert.ok(!/#ink-canvas\s*\{[^}]*transform:/.test(CSS),'canvas is not transformed');
  console.log('PASS static HTML/JS/style invariants');
}

async function drawWithMouse(page,xOffset=25) {
  const rect=await page.locator('#ink-canvas').boundingBox();
  assert.ok(rect,'canvas bounding box exists');
  await page.mouse.move(rect.x+xOffset,rect.y+70);
  await page.mouse.down();
  await page.mouse.move(rect.x+xOffset+15,rect.y+87,{steps:5});
  await page.mouse.up();
}
async function strokeCount(page) {
  const t=await page.locator('#stroke-count').textContent();
  return Number(t.trim().split(' ')[0]);
}
async function main(){
  staticChecks();
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
    page.setDefaultTimeout(12000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(URL,{waitUntil:'domcontentloaded'});
    await page.locator('#ink-canvas').waitFor();
    const geometry=await page.locator('#ink-canvas').evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {width:r.width,height:r.height,touchAction:s.touchAction,canvasWidth:el.width};
    });
    assert.equal(geometry.width,1120);assert.equal(geometry.height,183);
    assert.equal(geometry.touchAction,'none');
    assert.ok(geometry.canvasWidth>=1120);
    assert.equal(await strokeCount(page),0);

    // Pen hover, including barrel hover, never creates a stroke.
    await page.evaluate(()=>{
      const el=document.getElementById('ink-canvas');
      const r=el.getBoundingClientRect();
      const send=(type,ptr,buttons,pressure,x)=>el.dispatchEvent(new PointerEvent(type,{
        bubbles:true,cancelable:true,pointerType:'pen',pointerId:ptr,
        isPrimary:true,button:buttons===2?2:0,buttons,pressure,
        clientX:r.left+x,clientY:r.top+70
      }));
      send('pointerdown',19,0,0,26);send('pointermove',19,0,0,30);
      send('pointerdown',20,2,0,35);send('pointermove',20,2,0,41);
    });
    assert.equal(await strokeCount(page),0,'hover/barrel hover do not create stroke');
    // Simulated pen tip contact can start a stroke. First hover move ends it.
    await page.evaluate(()=>{
      const el=document.getElementById('ink-canvas');
      const r=el.getBoundingClientRect();
      const send=(type,buttons,pressure,x)=>el.dispatchEvent(new PointerEvent(type,{
        bubbles:true,cancelable:true,pointerType:'pen',pointerId:22,
        isPrimary:true,button:0,buttons,pressure,clientX:r.left+x,clientY:r.top+70
      }));
      send('pointerdown',1,.55,24);
      send('pointermove',1,.55,34);
      send('pointermove',0,0,90);
    });
    assert.equal(await strokeCount(page),1,'synthetic pen contact and hover termination');
    await page.locator('#undo').click();assert.equal(await strokeCount(page),0);
    await page.locator('#redo').click();assert.equal(await strokeCount(page),1);

    // Pen-only option gates real mouse input; normal mode accepts mouse.
    await page.locator('#clear-ink').click();assert.equal(await strokeCount(page),0);
    await page.locator('#pen-only').check();await drawWithMouse(page);
    assert.equal(await strokeCount(page),0,'pen-only filters mouse');
    await page.locator('#pen-only').uncheck();await drawWithMouse(page);
    assert.equal(await strokeCount(page),1,'mouse draws');
    await page.locator('#clear-ink').click();
    // Synthetic touch verifies that the non-pen pointer path is still accepted.
    await page.evaluate(()=>{
      const el=document.getElementById('ink-canvas'),r=el.getBoundingClientRect();
      const send=(type,buttons)=>el.dispatchEvent(new PointerEvent(type,{
        bubbles:true,cancelable:true,pointerId:66,pointerType:'touch',isPrimary:true,
        button:0,buttons,pressure:buttons?.5:0,clientX:r.left+28,clientY:r.top+80
      }));
      send('pointerdown',1);send('pointerup',0);
    });
    assert.equal(await strokeCount(page),1,'touch pointer draws');
    await page.locator('#clear-ink').click();
    await drawWithMouse(page);
    await page.locator('#tool-erase').click();
    assert.equal(await page.locator('#tool-erase').getAttribute('aria-pressed'),'true');
    await drawWithMouse(page);
    assert.equal(await strokeCount(page),0,'eraser removes stroke');
    await page.locator('#tool-pen').click();
    assert.equal(await page.locator('#tool-pen').getAttribute('aria-pressed'),'true');
    await page.screenshot({path:path.join(screenshotDir,'desktop.png'),fullPage:true});

    // Candidate grouping, split/join, selected override, document commit.
    await page.locator('#demo-weather').click();
    const composer=page.locator('#composition');
    const initial=await composer.locator('.phrase').count();
    assert.ok(initial>=2,'example groups into phrases');
    await page.locator('#split-phrase').click();
    await page.locator('#candidates .candidate').first().click();
    assert.equal(await composer.locator('.phrase').count(),initial+1,'phrase split');
    await composer.locator('.phrase-join').first().click();
    assert.equal(await composer.locator('.phrase').count(),initial,'phrase join');
    await composer.locator('.phrase').first().click();
    await page.locator('#candidate-manual').fill('今日');
    await page.locator('#apply-manual').click();
    assert.match(await composer.locator('.phrase').first().textContent(),/今日/,'manual correction');
    const suggested=page.locator('#candidates .candidate').filter({hasText:'今日は'}).first();
    await suggested.click();
    assert.equal(await suggested.getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#selected-phrase-status').textContent(),/문서 확정 전/);
    await page.locator('#commit-text').click();
    assert.match(await page.locator('#text-editor').inputValue(),/今日は/);
    assert.equal(await strokeCount(page),0);
    assert.match(await page.locator('#autosave-status').textContent(),/자동 저장됨/);
    await page.reload();
    assert.match(await page.locator('#text-editor').inputValue(),/今日は/,'draft reload');
    await page.locator('#save-note').click();
    assert.ok((await page.locator('#archive-list .archive-entry').count())>=1,'saved snapshot');
    await page.locator('#archive-list .archive-entry .actions button').first().click();
    assert.match(await page.locator('#text-editor').inputValue(),/今日は/,'load snapshot');
    const dl=page.waitForEvent('download');
    await page.locator('#export-txt').click();
    const download=await dl;
    assert.match(download.suggestedFilename(),/^KAKU_.+\.txt$/);
    await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:URL});
    await page.locator('#copy-text').click();
    assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/今日は/);
    console.log('PASS editor, snapshot, copy and TXT');

    // Narrow viewport keeps the grid native-sized and scrollable, nav visible.
    for(const width of [768,390]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.locator('.navgroup').isVisible(),true);
      const actual=await page.locator('#ink-canvas').evaluate(e=>e.getBoundingClientRect().width);
      assert.equal(actual,1120,'native Canvas width at '+width);
      const overflow=await page.evaluate(()=>({
        body:document.documentElement.scrollWidth,viewport:window.innerWidth,
        grid:document.getElementById('canvas-window').scrollWidth,
        client:document.getElementById('canvas-window').clientWidth
      }));
      assert.ok(overflow.grid>overflow.client,'grid scrolls at '+width);
      assert.ok(overflow.body<=overflow.viewport+1,'no horizontal page overflow at '+width);
      const prev=await page.locator('#grid-progress').textContent();
      await page.locator('#scroll-grid').click();
      await page.waitForFunction(old=>document.getElementById('grid-progress').textContent!==old,prev);
      await page.screenshot({path:path.join(screenshotDir,'width-'+width+'.png'),fullPage:true});
    }
    console.log('PASS tablet/mobile layout and scroll navigation');

    // Controlled ONNX network failure falls back to manual dialog.
    await page.setViewportSize({width:1440,height:900});
    // Width changes retain horizontal scroll state: reset before a pointer test.
    await page.locator('#canvas-window').evaluate(el=>{el.scrollLeft=0;});
    await page.route('**/onnxruntime-web@1.20.1/dist/ort.min.js',r=>r.abort());
    await drawWithMouse(page);
    assert.equal(await strokeCount(page),1,'model error scenario has one ink stroke');
    await page.locator('#recognize').click();
    await page.locator('#manual-dialog:not(.hide)').waitFor();
    assert.match(await page.locator('#status-text').textContent(),/모델을 불러오지 못했습니다/);
    await page.locator('#manual-compose').fill('にほんご');
    await page.locator('#confirm-dialog').click();
    assert.match(await page.locator('#composition').textContent(),/にほんご/,'manual input fallback');
    console.log('PASS model error and manual fallback');
    assert.deepEqual(errors,[],'no uncaught browser errors');

    // A separate mock checks the ONNX recognition wiring; it is NOT a real model test.
    const mocked=await browser.newPage({viewport:{width:1024,height:768}});
    mocked.setDefaultTimeout(12000);
    mocked.on('pageerror',e=>errors.push('mock:'+e.message));
    await mocked.addInitScript(()=>{
      window.ort={env:{wasm:{}},InferenceSession:{create:async()=>({
        run:async()=>{const data=new Float32Array(3082);data.fill(-100);data[0]=100;return {logits:{data}};}
      })}};
    });
    await mocked.route('**/labels.json',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify(Array.from({length:3082},(_,i)=>({char:i===0?'あ':'カ'})))
    }));
    await mocked.goto(URL,{waitUntil:'domcontentloaded'});
    await drawWithMouse(mocked);
    await mocked.locator('#recognize').click();
    await mocked.getByText('1글자 인식 완료',{exact:false}).waitFor();
    assert.match(await mocked.locator('#composition').textContent(),/あ/);
    assert.deepEqual(errors,[],'no uncaught browser errors');
    console.log('PASS mocked ONNX pipeline');
    await mocked.close();
    await page.close();
    console.log('ALL KAKU BROWSER SMOKE CHECKS PASSED (hardware S Pen and live OCR not verified)');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
