// Pone tus datos en el código. Uso:
// node scripts/personalizar.mjs --nombre "Tu nombre" --correo tu@cuenta.com --empresa "Tu empresa" --host tu-mac.tu-tailnet.ts.net
import fs from 'node:fs';
import path from 'node:path';
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const cambios = [['Alex', arg('nombre')], ['tu@correo.com', arg('correo')], ['Acme', arg('empresa')], ['tu-mac.tu-tailnet.ts.net', arg('host')]].filter(([, b]) => b);
if (!cambios.length) { console.log('Mira las opciones al principio de este archivo.'); process.exit(0); }
const recorre = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
	const r = path.join(d, e.name);
	if (e.isDirectory()) return ['node_modules', 'dist', 'marca', 'iconos'].includes(e.name) ? [] : recorre(r);
	return /\.(mjs|js|svelte|html|webmanifest|md|plist)$/.test(e.name) && e.name !== 'personalizar.mjs' ? [r] : [];
});
for (const f of ['server', 'scripts', 'test', 'web', 'docs', 'launchd'].flatMap(recorre)) {
	let t = fs.readFileSync(f, 'utf8');
	// Con límites de palabra: tu nombre no entra en los identificadores del código.
	for (const [a, b] of cambios) t = t.replace(new RegExp(`(?<![\\w])${a.replace(/[.]/g, '\\.')}(?![\\w])`, 'g'), b);
	fs.writeFileSync(f, t);
}
console.log('Hecho. Ahora npm test y npm run web.');
