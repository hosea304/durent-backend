import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import {
  composeOrderCode,
  OrderCodeService,
  wibToday,
} from './order-code.service';

describe('wibToday — tanggal DDMMYY zona WIB (UTC+7)', () => {
  it('siang UTC = hari yang sama di WIB', () => {
    // 2026-07-03 05:00 UTC = 12:00 WIB
    const { datePart, isoDate } = wibToday(new Date('2026-07-03T05:00:00Z'));
    expect(datePart).toBe('030726');
    expect(isoDate).toBe('2026-07-03');
  });

  it('malam UTC sudah lewat tengah malam WIB → tanggal maju 1 hari', () => {
    // 2026-07-03 18:30 UTC = 2026-07-04 01:30 WIB
    const { datePart, isoDate } = wibToday(new Date('2026-07-03T18:30:00Z'));
    expect(datePart).toBe('040726');
    expect(isoDate).toBe('2026-07-04');
  });

  it('lintas tahun: 31 Des 17:00 UTC = 1 Jan WIB', () => {
    const { datePart } = wibToday(new Date('2026-12-31T17:30:00Z'));
    expect(datePart).toBe('010127');
  });
});

describe('composeOrderCode — format DR-DDMMYY-NNNN-W (D7/D30 website)', () => {
  it('pad 4 digit + suffix -W: DR-030726-0007-W', () => {
    expect(composeOrderCode('030726', 7)).toBe('DR-030726-0007-W');
  });

  it('nomor > 9999 tidak terpotong: DR-030726-12345-W', () => {
    expect(composeOrderCode('030726', 12345)).toBe('DR-030726-12345-W');
  });
});

describe('OrderCodeService — counter GLOBAL MAX+1 (tidak reset) + suffix -W', () => {
  const aggregate = jest.fn();
  let service: OrderCodeService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderCodeService,
        {
          provide: PrismaService,
          useValue: { order: { aggregate } },
        },
      ],
    }).compile();
    service = moduleRef.get(OrderCodeService);
    aggregate.mockReset();
  });

  it('DB kosong → order website pertama 0001 (independen dari sheet, D30)', async () => {
    aggregate.mockResolvedValue({ _max: { code_number: null } });
    const next = await service.nextOrderCode(new Date('2026-07-14T03:00:00Z'));
    expect(next.code).toBe('DR-140726-0001-W');
    expect(next.code_number).toBe(1);
    expect(next.invoice_date).toBe('2026-07-14');
  });

  it('lanjut MAX+1 walau tanggal berbeda (counter global, D7)', async () => {
    aggregate.mockResolvedValue({ _max: { code_number: 41 } });
    const next = await service.nextOrderCode(new Date('2026-07-14T03:00:00Z'));
    expect(next.code).toBe('DR-140726-0042-W');
    expect(next.code_number).toBe(42);
  });
});
