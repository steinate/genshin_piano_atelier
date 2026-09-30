// Run with a local HTTP server and Playwright. BROWSER_CHANNEL=msedge is optional.
// PLAYWRIGHT_MODULE may point at a preinstalled Playwright package.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.PIANO_URL || 'http://127.0.0.1:8765/ORBIT_Raiden_Piano_Atelier.html');
    await page.waitForFunction(() => window.ORBIT_STAGE?.raidenRig?.ready && document.querySelector('#modelInfo').textContent.includes('新轨迹'), null, {timeout: 120000});
    await page.evaluate(() => { ORBIT_STAGE.state.external = true; document.querySelector('#intro').classList.add('hidden'); });
    const out = process.env.ARTIFACT_DIR || '/tmp/orbit-hand-validation';
    fs.mkdirSync(out, {recursive: true});
    for (const t of [5.878125, 53.15784375, 77.3953125]) {
      await page.evaluate(at => ORBIT_STAGE.renderAt(at, 'hands'), t);
      await page.screenshot({path: path.join(out, `genshin-${t}.png`)});
    }
    const result = await page.evaluate(fs.readFileSync(path.join(__dirname, 'hand-motion-eval.js'), 'utf8'));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({result, errors}, null, 2));
    for (const view of ['hands', 'side', 'hero']) {
      await page.evaluate(v => ORBIT_STAGE.renderAt(20, v), view);
      await page.screenshot({path: path.join(out, `cornfield-${view}.png`)});
    }
    for (const song of result) {
      assert.ok(song.seekDifferenceRadians < 1e-5, `${song.song}: seek-dependent pose`);
      assert.equal(song.orderViolations, 0, `${song.song}: within-hand fingering inversion`);
      assert.equal(song.handInversions, 0, `${song.song}: left/right ownership inversion`);
      assert.ok(song.sameHandGapMM >= 9.4, `${song.song}: finger capsule collision`);
      assert.ok(song.betweenHandGapMM >= 10, `${song.song}: inter-hand collision`);
      assert.ok(song.minSkinClearanceMM >= 0, `${song.song}: skinned hand penetrates a key`);
      assert.ok(song.maxBoneStretch < 1e-8, `${song.song}: rigid bone length changed`);
      assert.ok(song.transitionMaxDegrees < 6, `${song.song}: abrupt joint transition`);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(result, null, 2));
    // Contact accuracy is reported independently: these shape invariants do not
    // assert that an unreachable chord has been played or that it meets 2 mm.
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
