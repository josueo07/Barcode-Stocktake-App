import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../testApp';
import { safeCell, toCsv } from '../../src/services/varianceReport.service';

describe('Quantity, lot, expiry and cost at scan time', () => {
  let ctx: ReturnType<typeof createTestApp>;
  let id: number;

  const scan = (extra: Record<string, unknown>) =>
    request(ctx.app)
      .post(`/api/sessions/${id}/scans`)
      .set(ctx.counter.header)
      .send({ clientScanId: uuidv4(), scannedAt: new Date().toISOString(), ...extra });

  beforeEach(async () => {
    ctx = createTestApp();
    const res = await request(ctx.app)
      .post('/api/sessions')
      .set(ctx.auth)
      .send({ name: 'Anual', costEnabled: true });
    id = res.body.session.id;
    expect(res.body.session.costEnabled).toBe(true);
    await request(ctx.app).post(`/api/sessions/${id}/expected-quantities`).set(ctx.auth).send({
      barcode: '0300450123456',
      expectedQty: 10,
      sku: 'ACE-500',
      name: 'Acetaminofén 500mg',
    });
    await request(ctx.app).patch(`/api/sessions/${id}`).set(ctx.auth).send({ status: 'active' });
  });

  it('stores quantity, lot, expiry and cost, and values the count', async () => {
    expect(
      (
        await scan({
          barcode: '0300450123456',
          quantity: 6,
          lot: 'L123',
          expiryDate: '2027-03',
          unitCostCents: 250,
        })
      ).status,
    ).toBe(201);
    await scan({ barcode: '0300450123456', quantity: 2, unitCostCents: 300 });

    const scans = await request(ctx.app).get(`/api/sessions/${id}/scans`).set(ctx.auth);
    expect(scans.body.scans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantity: 6,
          lot: 'L123',
          expiryDate: '2027-03',
          unitCostCents: 250,
        }),
      ]),
    );

    const report = await request(ctx.app).get(`/api/sessions/${id}/variance-report`).set(ctx.auth);
    expect(report.body.report.costEnabled).toBe(true);
    expect(report.body.report.rows[0]).toMatchObject({
      countedQty: 8,
      variance: -2,
      countedValueCents: 2100,
    });
    expect(report.body.report.totals.countedValueCents).toBe(2100);
  });

  it('rejects a badly formatted expiry date', async () => {
    expect((await scan({ barcode: '1', expiryDate: '03/2027' })).status).toBe(400);
  });

  it('lets a supervisor turn cost tracking off', async () => {
    const res = await request(ctx.app)
      .patch(`/api/sessions/${id}`)
      .set(ctx.auth)
      .send({ costEnabled: false });
    expect(res.body.session.costEnabled).toBe(false);
    const forbidden = await request(ctx.app)
      .patch(`/api/sessions/${id}`)
      .set(ctx.counter.header)
      .send({ costEnabled: true });
    expect(forbidden.status).toBe(403);
  });

  it('exports an Excel file with a summary and a scan detail sheet', async () => {
    await scan({
      barcode: '0300450123456',
      quantity: 3,
      lot: 'L9',
      expiryDate: '2027-01-31',
      unitCostCents: 199,
    });
    const res = await request(ctx.app)
      .get(`/api/sessions/${id}/variance-report/export.xlsx`)
      .set(ctx.auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    const body = res.body as Buffer;
    await wb.xlsx.load(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Diferencias', 'Detalle de escaneos']);
    const summary = wb.getWorksheet('Diferencias')!;
    expect(summary.getRow(2).getCell(2).value).toBe('0300450123456');
    expect(summary.getRow(2).getCell(9).value).toBeCloseTo(5.97);
    const detail = wb.getWorksheet('Detalle de escaneos')!;
    expect(detail.getRow(2).values).toEqual(
      expect.arrayContaining(['L9', '2027-01-31', 'counter', 'Contado']),
    );

    expect(
      (
        await request(ctx.app)
          .get(`/api/sessions/${id}/variance-report/export.xlsx`)
          .set(ctx.counter.header)
      ).status,
    ).toBe(403);
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(safeCell('Acetaminofén')).toBe('Acetaminofén');
    const csv = toCsv({
      sessionId: 1,
      generatedAt: '',
      costEnabled: false,
      rows: [
        {
          productId: 1,
          sku: '@SUM(A1)',
          barcode: '1',
          name: 'Jarabe, 120 ml',
          expectedQty: 1,
          countedQty: 1,
          variance: 0,
          unitCostCents: null,
          expectedValueCents: null,
          countedValueCents: null,
          valueVarianceCents: null,
        },
      ],
      totals: {
        expectedQty: 1,
        countedQty: 1,
        variance: 0,
        expectedValueCents: null,
        countedValueCents: null,
        valueVarianceCents: null,
      },
    });
    expect(csv.split('\r\n')[1]).toBe('\'@SUM(A1),1,"Jarabe, 120 ml",1,1,0');
  });
});
