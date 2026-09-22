const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSingleFile}=require('../scripts/export-single.cjs');
test('single-file package embeds all eleven badges and executable game',()=>{
 const html=buildSingleFile();
 assert.match(html,/<title>合成东南大学/);
 assert.equal((html.match(/data:image\/(?:png|jpeg);base64,/g)||[]).length,11);
 assert.doesNotMatch(html,/<script[^>]+\bsrc=/i);
 assert.doesNotMatch(html,/<link[^>]+rel="stylesheet"/i);
 assert.match(html,/Matter/);assert.match(html,/南京大学/);assert.match(html,/东南大学/);
 assert.match(html,/<noscript/);assert.match(html,/GameBoot/);
 assert.match(html,/id="home-link" href="https:\/\/t-oak-s.github.io\/"/);
 assert.doesNotMatch(html,/chatgpt\.site/);
});
