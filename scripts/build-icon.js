// Encode the generated artwork as a multi-resolution Windows ICO; no image generation here.
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('src/assets/brand'),source=nativeImage.createFromPath(path.join(root,'icon-artwork.png'));
if(source.isEmpty())throw Error('Icon artwork is missing.');
const sizes=[16,20,24,32,40,48,64,96,128,256],frames=sizes.map(size=>source.resize({width:size,height:size,quality:'best'}).toPNG());
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
sizes.forEach((size,i)=>{const at=6+16*i;header[at]=size===256?0:size;header[at+1]=header[at];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(frames[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=frames[i].length;});
fs.writeFileSync(path.join(root,'heartflow.ico'),Buffer.concat([header,...frames]));fs.writeFileSync(path.join(root,'heartflow.png'),source.resize({width:512,height:512,quality:'best'}).toPNG());fs.writeFileSync(path.join(root,'icon-preview-32.png'),frames[sizes.indexOf(32)]);console.log('Heartflow icon created: 10 Windows sizes, 16–256 px.');app.exit(0);
