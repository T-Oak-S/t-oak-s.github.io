const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function buildSingleFile(){
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets.js'),'utf8'),context);
 const badges=context.window.BADGE_ASSETS;
 for(const item of Object.values(badges)){
  const file=path.resolve(root,item.src);if(!file.startsWith(root+path.sep))throw new Error('Asset outside static directory');
  const mime=path.extname(file)==='.png'?'image/png':'image/jpeg';
  item.src=`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
 }
 let html=fs.readFileSync(path.join(root,'merge.html'),'utf8');
 const scriptBody=[];
 html=html.replace(/<script defer src="([^"]+)"><\/script>/g,(_,src)=>{
  const content=src==='assets.js'?'window.BADGE_ASSETS = '+JSON.stringify(badges)+';':fs.readFileSync(path.join(root,src),'utf8');
  scriptBody.push('<script>\n'+content.replace(/<\/script/gi,'<\\/script')+'\n</script>');return '';
 });
 html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>\n'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'\n</style>');
 html=html.replace('id="home-link" href="./"','id="home-link" href="https://t-oak-s.github.io/"');
 html=html.replace('</body>',()=>scriptBody.join('\n')+'\n</body>');
 return html;
}
if(require.main===module){const target=path.resolve(process.argv[2]||path.join(root,'合成东南大学.html'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buildSingleFile(),'utf8');console.log('Created '+target);}
module.exports={buildSingleFile};
