// La empresa inventada de la simulación. Todo es ficticio: proveedores, cifras y plazos.
// Uso: OFICINA_SIMULACION=1 node scripts/crear-mundo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../server/config.mjs';
import { DEPARTAMENTOS } from '../server/departamentos.mjs';

if (!CONFIG.SIMULACION) { console.error('Esto solo se ejecuta en simulación.'); process.exit(1); }

const dentro = n => { const d = new Date(Date.now() + n * 86_400_000); return `${d.getDate()}-${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`; };

const MUNDO = {
	produccion: `# Producción (simulación)
## Ahora mismo
- Pedido PO-100 a Fábrica Norte: 3.000 unidades, entrega prevista el ${dentro(25)}. Fecha sin confirmar por escrito.
- Pago pendiente a Fábrica Norte: 42.000 € al confirmar fecha.
- Transitario: Mar Azul Logística. Plazo en barco, 28 días.
## Espera a Alex
- **Fecha de Fábrica Norte:** pedirla por escrito antes del ${dentro(6)}.
- **Segundo pedido:** decidir si se lanza, depende de ventas.
`,
	marketing: `# Marketing (simulación)
## Ahora mismo
- Campaña Otoño en Meta: 80 €/día, 3 compras la última semana, coste por compra 186 €.
- Tienda: 410 unidades en stock, se venden unas 60 a la semana.
- Plan: subir a 300 €/día en dos semanas si hay stock.
## Espera a Alex
- **Agencia Luz:** pide subir su cuota de 2.000 a 3.500 € al mes; decidir antes del ${dentro(9)}.
`,
	finanzas: `# Finanzas (simulación)
## Ahora mismo
- Caja: 96.400 €. Gastos fijos: 31.000 € al mes.
- Póliza con Banco Sur: 100.000 €, dispuestos 60.000 €, vence el ${dentro(40)}. Sin confirmar la renovación.
- Cuentas de proveedores verificadas: Fábrica Norte termina en 4471.
## Espera a Alex
- **Banco Sur:** llamar a Pablo Rey, el gestor, para hablar de la renovación.
`,
	fiscal: `# Fiscal (simulación)
## Ahora mismo
- Asesoría: Gestoría Centro. Contacto, Marisa.
- Modelo 303 del trimestre presentado.
## Espera a Alex
- **Datos de ventas UK:** confirmar a la gestoría antes del ${dentro(3)}.
`,
	legal: `# Legal (simulación)
## Ahora mismo
- Contrato con Agencia Luz: permanencia hasta el ${dentro(120)}. Cláusula de subida de cuota: requiere acuerdo de las dos partes.
- Abogados: Bufete Olmo.
## Espera a Alex
- **Términos de la tienda:** actualizar plazo de entrega si cambia la fecha del pedido.
`,
};

for (const d of DEPARTAMENTOS) {
	const c = d.carpeta;
	fs.mkdirSync(c, { recursive: true });
	if (d.general) { fs.writeFileSync(path.join(c, 'CLAUDE.md'), 'Empresa de la simulación. Cada departamento tiene su carpeta y su ESTADO.md.\n'); continue; }
	fs.writeFileSync(path.join(c, 'ESTADO.md'), MUNDO[d.id]);
}
console.log(`Mundo inventado en ${CONFIG.EMPRESA}`);
