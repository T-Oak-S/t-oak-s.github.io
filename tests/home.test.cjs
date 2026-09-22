const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');const root=path.resolve(__dirname,'..');
test('homepage is a script-free game directory with one playable game',()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'));const d=dom.window.document;
 assert.match(d.title,/东大小游园/);assert.equal(d.querySelectorAll('script').length,0);assert.equal(d.querySelectorAll('a[href="merge.html"]').length,1);
 assert.match(d.body.textContent,/更多游戏筹备中/);assert.equal(d.querySelector('.coming-card').querySelectorAll('a,button').length,0);
 assert.equal(d.querySelector('link[rel=stylesheet]').getAttribute('href'),'home.css');dom.window.close();
});
test('game route retains relative assets and has an explicit home link and current online fallback',()=>{
 const html=fs.readFileSync(path.join(root,'merge.html'),'utf8'),dom=new JSDOM(html);const d=dom.window.document;
 assert.equal(d.querySelector('#home-link').getAttribute('href'),'./');assert.equal(d.querySelector('.brand').tagName,'DIV');assert.ok(!html.includes('chatgpt.site'));assert.ok(!html.includes('登录有访问权限'));
 for(const el of d.querySelectorAll('script[src],link[rel=stylesheet]'))assert.ok(fs.existsSync(path.join(root,el.getAttribute('src')||el.getAttribute('href'))));dom.window.close();
});
