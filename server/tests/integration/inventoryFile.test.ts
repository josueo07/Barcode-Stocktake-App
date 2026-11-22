import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../testApp';

async function pharmacyWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventario');
  ws.addRow(['Farmacia J&R - existencias']);
  ws.addRow(['UPC', 'Descripción', 'Existencia', 'Costo']);
  ws.addRow(['0300450123456', 'Acetaminofén 500mg', 10, 2.5]);
  ws.addRow([12345678905, 'Ibuprofeno 200mg', 4, '$1.25']);
  ws.addRow(['0300450123456', 'Acetaminofén 500mg', 2, 2.5]); // same UPC twice: adds up
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("Pharmacy's inventory file → count → discrepancy report", () => {
  let ctx: ReturnType<typeof createTestApp>;
  let id: number;

  const scan = (barcode: string, quantity: number, extra: Record<string, unknown> = {}) =>
    request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send({
        clientScanId: uuidv4(),
        scannedAt: new Date().toISOString(),
        barcode,
        quantity,
        ...extra,
      });

  beforeEach(async () => {
    ctx = createTestApp();
    const res = await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'Anual' });
    id = res.body.session.id;
  });

  it('imports an Excel file with Spanish headers, a title row, number UPCs and costs', async () => {
    const res = await request(ctx.app)
      .post(`/api/sessions/${id}/import-csv`)
      .set(ctx.auth)
      .attach('file', await pharmacyWorkbook(), 'inventario.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      productsCreated: 2,
      expectedQuantitiesWritten: 2,
      rowsSkipped: 0,
    });

    await request(ctx.app).patch(`/api/sessions/${id}`).set(ctx.auth).send({ status: 'active' });
    // Scanner reads the 12-digit UPC-A form of the first code (no leading zero).
    await scan('300450123456', 9);
    await scan('012345678905', 4, { unitCostCents: 150 });
    await scan('7777777777777', 1); // not in the file

    const report = (await request(ctx.app).get(`/api/sessions/${id}/variance-report`).set(ctx.auth))
      .body.report;
    expect(report.costEnabled).toBe(true);
    const byName = Object.fromEntries(
      report.rows.map((r: { name: string | null; barcode: string }) => [r.name ?? r.barcode, r]),
    );
    expect(byName['Acetaminofén 500mg']).toMatchObject({
      barcode: '0300450123456',
      expectedQty: 12,
      countedQty: 9,
      variance: -3,
      unitCostCents: 250,
      expectedValueCents: 3000,
      countedValueCents: 2250,
      valueVarianceCents: -750,
    });
    expect(byName['Ibuprofeno 200mg']).toMatchObject({
      expectedQty: 4,
      countedQty: 4,
      variance: 0,
      expectedValueCents: 500,
      countedValueCents: 600, // cost typed at scan time wins
      valueVarianceCents: 100,
    });
    expect(byName['7777777777777']).toMatchObject({
      expectedQty: 0,
      countedQty: 1,
      variance: 1,
      countedValueCents: null,
    });
    expect(report.totals).toMatchObject({
      expectedQty: 16,
      countedQty: 14,
      expectedValueCents: 3500,
      countedValueCents: 2850,
      valueVarianceCents: -650,
    });

    const csv = await request(ctx.app)
      .get(`/api/sessions/${id}/variance-report/export`)
      .set(ctx.auth);
    const lines = csv.text.split('\r\n');
    expect(lines[0]).toContain('Valor esperado,Valor contado,Diferencia en valor');
    expect(lines).toContain(
      '0300450123456,0300450123456,Acetaminofén 500mg,12,9,-3,2.50,30.00,22.50,-7.50',
    );
  });

  it('accepts a semicolon CSV without SKU or cost, and works with no file at all', async () => {
    const csv = 'Código;Nombre;Cantidad\n111;Alcohol 70%;3\n';
    const res = await request(ctx.app)
      .post(`/api/sessions/${id}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from(csv), 'inv.csv');
    expect(res.body.summary).toMatchObject({ productsCreated: 1, expectedQuantitiesWritten: 1 });

    const other = (
      await request(ctx.app).post('/api/sessions').set(ctx.auth).send({ name: 'Sin archivo' })
    ).body.session.id;
    await request(ctx.app).patch(`/api/sessions/${other}`).set(ctx.auth).send({ status: 'active' });
    await request(ctx.app).post(`/api/sessions/${other}/scans`).set(ctx.counter.header).send({
      clientScanId: uuidv4(),
      scannedAt: new Date().toISOString(),
      barcode: '111',
      quantity: 5,
    });
    const report = (
      await request(ctx.app).get(`/api/sessions/${other}/variance-report`).set(ctx.auth)
    ).body.report;
    expect(report.costEnabled).toBe(false);
    expect(report.rows).toEqual([
      expect.objectContaining({
        barcode: '111',
        name: 'Alcohol 70%',
        expectedQty: 0,
        countedQty: 5,
      }),
    ]);
  });

  it('imports the pharmacy CSV headings and retains the system quantity and unit cost', async () => {
    const csv = 'Inventario de prueba\nSKU\tcodigo_barras\tproducto\tcantidad_sistema\tcantidad_contada\tcosto_unitario_usd\n'
      + 'JR-001\t039079001108\tProducto de prueba\t12\t10\t5.50\n';
    const response = await request(ctx.app)
      .post(`/api/sessions/${id}/import-csv`)
      .set(ctx.auth)
      .field('requireQuantity', 'true')
      .attach('file', Buffer.from(csv), 'inventario.csv');
    expect(response.body.summary).toMatchObject({ expectedQuantitiesWritten: 1, errors: [] });
    const { report } = (await request(ctx.app).get(`/api/sessions/${id}/variance-report`).set(ctx.auth)).body;
    expect(report.rows).toEqual([expect.objectContaining({
      barcode: '039079001108', expectedQty: 12, unitCostCents: 550,
    })]);
  });

  it('asks for a quantity column before changing the catalog and applies the selected column', async () => {
    const csv = Buffer.from('UPC,Producto,Total\n111,Producto de prueba,8\n');
    const send = () => request(ctx.app).post(`/api/sessions/${id}/import-csv`).set(ctx.auth);
    const preview = await send().field('requireQuantity', 'true').attach('file', csv, 'prueba.csv');
    expect(preview.body.summary).toMatchObject({
      productsCreated: 0, expectedQuantitiesWritten: 0, quantityHeaders: ['UPC', 'Producto', 'Total'],
    });
    const applied = await send().field('requireQuantity', 'true').field('quantityColumn', '2')
      .attach('file', csv, 'prueba.csv');
    expect(applied.body.summary).toMatchObject({ productsCreated: 1, expectedQuantitiesWritten: 1 });
  });

  it('explains what is missing when the file has no barcode column', async () => {
    const res = await request(ctx.app)
      .post(`/api/sessions/${id}/import-csv`)
      .set(ctx.auth)
      .attach('file', Buffer.from('Producto,Cantidad\nAlgo,1\n'), 'malo.csv');
    expect(res.body.summary.errors[0].message).toMatch(/UPC/);
  });

  it('creates a product on the spot when a counter scans something not in the file', async () => {
    await request(ctx.app).patch(`/api/sessions/${id}`).set(ctx.auth).send({ status: 'active' });
    // First a scan with no name (e.g. offline), then one where the counter typed the name.
    await scan('7501234567890', 1);
    const lookup = await request(ctx.app)
      .get('/api/products/7501234567890')
      .set(ctx.counter.header);
    expect(lookup.status).toBe(404);
    expect(
      (await scan('7501234567890', 2, { newProductName: 'Vitamina C 500mg', unitCostCents: 425 }))
        .status,
    ).toBe(201);
    // A later name for the same code doesn't rename it.
    await scan('7501234567890', 1, { newProductName: 'Otro nombre' });

    const found = await request(ctx.app).get('/api/products/7501234567890').set(ctx.counter.header);
    expect(found.body.product).toMatchObject({ name: 'Vitamina C 500mg', sku: '7501234567890' });

    const report = (await request(ctx.app).get(`/api/sessions/${id}/variance-report`).set(ctx.auth))
      .body.report;
    expect(report.rows).toEqual([
      expect.objectContaining({
        barcode: '7501234567890',
        name: 'Vitamina C 500mg',
        expectedQty: 0,
        countedQty: 4,
        variance: 4,
        countedValueCents: 850,
      }),
    ]);
  });
});
