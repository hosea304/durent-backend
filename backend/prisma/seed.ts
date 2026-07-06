// Seed idempotent: code_segments (Master Data Item) + akun staff pertama.
// Jalankan: npx prisma db seed
// Sumber daftar kode: docs/CURRENT_SPREADSHEET_STRUCTURE.md §3.
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SegmentType } from '../src/generated/prisma/client';

const SEGMENTS: Array<{
  segment_type: SegmentType;
  code: string;
  description: string;
}> = [
  // Brand
  { segment_type: 'brand', code: 'DS', description: 'DuRent Support' },
  // Universal Category
  { segment_type: 'universal', code: 'RT', description: 'Rental' },
  { segment_type: 'universal', code: 'ED', description: 'Expendable' },
  { segment_type: 'universal', code: 'FB', description: 'Food & Beverage' },
  { segment_type: 'universal', code: 'CW', description: 'Crew' },
  { segment_type: 'universal', code: 'LC', description: 'Location' },
  { segment_type: 'universal', code: 'BI', description: 'Bundling Items' },
  // Category Utama
  { segment_type: 'category_utama', code: 'CM', description: 'Communication' },
  { segment_type: 'category_utama', code: 'MD', description: 'Medic' },
  { segment_type: 'category_utama', code: 'ET', description: 'Electrical' },
  { segment_type: 'category_utama', code: 'PW', description: 'Power' },
  { segment_type: 'category_utama', code: 'SF', description: 'Safety' },
  { segment_type: 'category_utama', code: 'OT', description: 'Others' },
  { segment_type: 'category_utama', code: 'EP', description: 'Expandables' },
  { segment_type: 'category_utama', code: 'TP', description: 'Transport' },
  { segment_type: 'category_utama', code: 'SB', description: 'Snack & Beverage' },
  { segment_type: 'category_utama', code: 'CT', description: 'Catering' },
  { segment_type: 'category_utama', code: 'UPM', description: 'Unit Production Manager' },
  { segment_type: 'category_utama', code: 'RN', description: 'Runner' },
  { segment_type: 'category_utama', code: 'PU', description: 'Production Unit' },
  { segment_type: 'category_utama', code: 'AO', description: 'Addon' },
  // Sub Category (barang)
  { segment_type: 'sub_category', code: 'HT', description: 'Handy Talky' },
  { segment_type: 'sub_category', code: 'SC', description: 'Solidcom' },
  { segment_type: 'sub_category', code: 'SN', description: 'Snacks' },
  { segment_type: 'sub_category', code: 'BV', description: 'Beverages' },
  { segment_type: 'sub_category', code: 'PC', description: 'Paket Catering' },
  { segment_type: 'sub_category', code: 'PP', description: 'P3K' },
  { segment_type: 'sub_category', code: 'MJ', description: 'Meja' },
  { segment_type: 'sub_category', code: 'KS', description: 'Kursi' },
  { segment_type: 'sub_category', code: 'TD', description: 'Tenda' },
  { segment_type: 'sub_category', code: 'TC', description: 'Table Cover' },
  { segment_type: 'sub_category', code: 'LP', description: 'Lampu' },
  { segment_type: 'sub_category', code: 'KA', description: 'Kipas Angin' },
  { segment_type: 'sub_category', code: 'CB', description: 'Cooler Box' },
  { segment_type: 'sub_category', code: 'WB', description: 'Water Boiler' },
  { segment_type: 'sub_category', code: 'WJ', description: 'Water Tank Jug' },
  { segment_type: 'sub_category', code: 'TP', description: 'Termos' },
  { segment_type: 'sub_category', code: 'DG', description: 'Dispenser Galon' },
  { segment_type: 'sub_category', code: 'NP', description: 'Nespresso Coffee Machine Capsule' },
  { segment_type: 'sub_category', code: 'RB', description: 'Rice/Ice Bucket' },
  { segment_type: 'sub_category', code: 'TB', description: 'Troli Barang' },
  { segment_type: 'sub_category', code: 'KR', description: 'Kabel Roll' },
  { segment_type: 'sub_category', code: 'KT', description: 'Kabel Terminal' },
  { segment_type: 'sub_category', code: 'PB', description: 'Panel Box + Power Cable' },
  { segment_type: 'sub_category', code: 'GS', description: 'Genset' },
  { segment_type: 'sub_category', code: 'TK', description: 'Tangki/Jerigen' },
  { segment_type: 'sub_category', code: 'GC', description: 'Ground Cable Protectors' },
  { segment_type: 'sub_category', code: 'ST', description: 'Safety Traffic Cone' },
  { segment_type: 'sub_category', code: 'TL', description: 'Traffic Light' },
  { segment_type: 'sub_category', code: 'TM', description: 'Toa Megaphone' },
  { segment_type: 'sub_category', code: 'SG', description: 'Smoke Gun / Fog Machine' },
  { segment_type: 'sub_category', code: 'SB', description: 'Speaker Bluetooth' },
  { segment_type: 'sub_category', code: 'BT', description: 'Black Tape' },
  { segment_type: 'sub_category', code: 'MT', description: 'Masking Tape' },
  { segment_type: 'sub_category', code: 'PI', description: 'Plastik Ikan' },
  { segment_type: 'sub_category', code: 'CW', description: 'Cling Wrap' },
  { segment_type: 'sub_category', code: 'BC', description: 'Binder Clips' },
  { segment_type: 'sub_category', code: 'KK', description: 'Kertas Karton' },
  { segment_type: 'sub_category', code: 'PS', description: 'Pelindung Sepatu' },
  { segment_type: 'sub_category', code: 'PT', description: 'Pickup Truck' },
  { segment_type: 'sub_category', code: 'BF', description: 'Bye Bye Fever' },
  { segment_type: 'sub_category', code: 'PL', description: 'Plastik Sampah' },
  { segment_type: 'sub_category', code: 'GL', description: 'Gelas' },
  { segment_type: 'sub_category', code: 'SD', description: 'Sendok' },
  { segment_type: 'sub_category', code: 'JH', description: 'Jas Hujan' },
  { segment_type: 'sub_category', code: 'TR', description: 'Terpal' },
  { segment_type: 'sub_category', code: 'TT', description: 'Transparent Tape' },
  { segment_type: 'sub_category', code: 'AT', description: 'Anti Slip Tape' },
  { segment_type: 'sub_category', code: 'KB', description: 'Kawat Bendrat' },
  { segment_type: 'sub_category', code: 'BA', description: 'Baterai' },
  { segment_type: 'sub_category', code: 'SP', description: 'Shooting Package' },
  { segment_type: 'sub_category', code: 'DC', description: 'Documentation' },
];

async function main(): Promise<void> {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  });
  const prisma = new PrismaClient({ adapter });

  for (const s of SEGMENTS) {
    await prisma.codeSegment.upsert({
      where: {
        segment_type_code: { segment_type: s.segment_type, code: s.code },
      },
      update: { description: s.description },
      create: s,
    });
  }

  const total = await prisma.codeSegment.count();
  console.log(`Seed selesai — ${total} code_segments di database.`);

  // Akun staff pertama (role owner) dari env — password TIDAK ditimpa saat
  // re-seed (upsert update kosong) agar penggantian password tak tereset.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: process.env.ADMIN_NAME ?? 'Owner DuRent',
        email,
        password_hash: await argon2.hash(password),
        role: 'owner',
      },
    });
    console.log(`Akun staff '${email}' siap (role owner).`);
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD tidak di-set — seed akun dilewati.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
