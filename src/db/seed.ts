/**
 * Demo seed — run with: npm run seed
 * Creates the demo clinic, demo user, and a rich set of sample patients whose
 * records exercise every feature of the EHR (full OPD exam + vitals + PE, labs
 * with abnormal flags, prescriptions, vaccines, imaging, IPD, multi-visit
 * history, recheck/follow-up, allergies, and an exotic case).
 * Safe to run multiple times (INSERT OR IGNORE / INSERT OR REPLACE).
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Bootstrap env before anything else
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

import bcrypt from 'bcryptjs';
import { getDb } from './connection';
import { runMigrations } from './schema';
import type { Visit } from '@shared/types';

async function seed(): Promise<void> {
  runMigrations();
  const db = getDb();

  const today = new Date();
  const iso = (d: Date) => d.toISOString();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  // ── Clinics ──────────────────────────────────────────────────────────────────
  db.prepare(`INSERT OR IGNORE INTO clinics (id, name, active, expires_at) VALUES ('clinic-1', 'AsiaPet Demo Clinic', 1, NULL)`).run();
  db.prepare(`INSERT OR IGNORE INTO clinics (id, name, active, expires_at) VALUES ('demo', 'Demo Clinic', 1, NULL)`).run();
  console.log('[seed] Clinics ready: clinic-1, demo');

  // ── Users ────────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('asiapet123', 10);
  db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, clinic_id, role, display_name) VALUES ('user-1', 'vet@asiapet.local', ?, 'clinic-1', 'vet', 'Demo Vet')`).run(passwordHash);
  console.log('[seed] User ready: vet@asiapet.local / asiapet123');

  const adminHash = await bcrypt.hash('admin123', 10);
  db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, clinic_id, role, display_name) VALUES ('user-admin', 'admin@asiapet.com', ?, 'demo', 'admin', 'Admin')`).run(adminHash);
  console.log('[seed] Admin ready: admin@asiapet.com / admin123');

  // ── Owners ───────────────────────────────────────────────────────────────────
  const owners = [
    { id: 'owner-1', name: 'สมชาย ใจดี', phone: '081-111-1111', line_id: 'somchai_jd', facebook: '', notes: 'ลูกค้าประจำ มีสัตว์เลี้ยง 2 ตัว', created_at: iso(today) },
    { id: 'owner-2', name: 'วิภา รักสัตว์', phone: '089-222-2222', line_id: 'vipa_rs', facebook: '', notes: 'แมวสูงวัย ต้องติดตามค่าไตสม่ำเสมอ', created_at: iso(today) },
    { id: 'owner-3', name: 'ธนกร พิทักษ์', phone: '082-333-3333', line_id: 'thanakorn_p', facebook: '', notes: 'เลี้ยงสัตว์ exotic (กระต่าย)', created_at: iso(today) },
    { id: 'owner-4', name: 'ณัฐริกา แสงทอง', phone: '085-444-4444', line_id: 'nattarika_s', facebook: '', notes: '', created_at: iso(today) },
  ];
  const insertOwner = db.prepare(`INSERT OR IGNORE INTO owners (id, clinic_id, name, phone, line_id, facebook, notes, created_at) VALUES (@id, 'clinic-1', @name, @phone, @line_id, @facebook, @notes, @created_at)`);
  for (const o of owners) insertOwner.run(o);
  console.log('[seed] Owners ready:', owners.map((o) => o.name).join(', '));

  // ── Visits ───────────────────────────────────────────────────────────────────

  // Patient 1 (Buddy) — acute GI, two visits showing history + recheck + labs
  const buddyV1: Visit = {
    date: '2024-11-18',
    opd: {
      weight: '28.5', temp: '39.2', hr: '110', rr: '32', bp: '145/92',
      cc: 'อาเจียน 3 ครั้ง ถ่ายเหลว 2 วัน เบื่ออาหาร',
      hx: 'กินเศษอาหารจากถังขยะเมื่อ 3 วันก่อน วัคซีนครบตามโปรแกรม ไม่เคยมีโรคประจำตัว',
      pe: 'General: ซึมเล็กน้อย BCS 5/9\nMucous membrane: ชมพู CRT < 2 วินาที\nAbdomen: กดเจ็บช่วงท้องส่วนหน้า ลำไส้มีแก๊ส\nHydration: ขาดน้ำประมาณ 5%\nLymph nodes / Heart / Lung: ปกติ',
      ddx: 'Dietary indiscretion, Gastroenteritis, Foreign body, Pancreatitis',
      dx: 'Acute gastroenteritis (dietary indiscretion)',
      plan: 'งดอาหาร 12 ชม. → ค่อย ๆ ให้ bland diet, สารน้ำ IV (LRS) 60 ml/kg/วัน, ยาแก้อาเจียน + ปฏิชีวนะ + ยาเคลือบกระเพาะ, นัด recheck 3 วัน',
      vet: 'Demo Vet',
      recheckDate: '2024-11-21', recheckTime: '10:00', recheckReason: 'ติดตามอาการระบบทางเดินอาหาร',
      savedAt: '2024-11-18T09:30:00.000Z',
    },
    rx: {
      items: [
        { name: 'Metronidazole 250 mg', instruction: '1 เม็ด PO BID หลังอาหาร x 5 วัน', qty: '10 เม็ด' },
        { name: 'Maropitant (Cerenia) 16 mg', instruction: '1 เม็ด PO SID x 3 วัน', qty: '3 เม็ด' },
        { name: 'Omeprazole 20 mg', instruction: '1 แคปซูล PO SID ก่อนอาหารเช้า x 7 วัน', qty: '7 แคปซูล' },
      ],
      savedAt: '2024-11-18T09:45:00.000Z',
    },
  };
  const buddyV2: Visit = {
    date: '2024-11-21',
    opd: {
      weight: '28.9', temp: '38.6', hr: '96', rr: '24', bp: '138/85',
      cc: 'Recheck — อาการดีขึ้น กินได้ ไม่อาเจียน อุจจาระเริ่มเป็นก้อน',
      pe: 'General: สดใส ตอบสนองดี\nAbdomen: ไม่กดเจ็บ ลำไส้เคลื่อนไหวปกติ\nHydration: ปกติ',
      dx: 'Resolving gastroenteritis',
      plan: 'ค่อย ๆ เปลี่ยนกลับอาหารปกติภายใน 3 วัน, ให้ยาครบคอร์ส, งดเศษอาหารคน',
      vet: 'Demo Vet',
      savedAt: '2024-11-21T10:15:00.000Z',
    },
    lab: {
      species: 'Dog',
      values: [
        { name: 'WBC', result: '15.8', unit: 'K/µL', normal_min: '6', normal_max: '17' },
        { name: 'Hct', result: '46', unit: '%', normal_min: '37', normal_max: '55' },
        { name: 'Platelet', result: '320', unit: 'K/µL', normal_min: '200', normal_max: '500' },
        { name: 'ALT', result: '72', unit: 'U/L', normal_min: '10', normal_max: '100' },
        { name: 'BUN', result: '22', unit: 'mg/dL', normal_min: '7', normal_max: '27' },
        { name: 'Creatinine', result: '1.1', unit: 'mg/dL', normal_min: '0.5', normal_max: '1.8' },
        { name: 'Glucose', result: '95', unit: 'mg/dL', normal_min: '70', normal_max: '143' },
      ],
      smear: 'RBC morphology ปกติ ไม่พบ blood parasite, WBC สูงเล็กน้อยตามภาวะอักเสบที่กำลังหาย',
      savedAt: '2024-11-21T10:40:00.000Z',
    },
  };

  // Patient 2 (Miew) — feline CKD, labs with multiple abnormal values
  const miewV1: Visit = {
    date: '2025-02-14',
    opd: {
      weight: '3.6', temp: '38.1', hr: '180', rr: '28', bp: '170/95',
      cc: 'ซึม กินน้อย ดื่มน้ำเยอะ ปัสสาวะบ่อย น้ำหนักลดต่อเนื่อง',
      hx: 'อายุ 12 ปี ทำหมันแล้ว เลี้ยงในบ้าน เริ่มกินน้อยลงช่วง 2 เดือน',
      pe: 'General: ผอม BCS 3/9 ขนหยาบ\nOral: มี ulcer เล็กน้อยที่เหงือก กลิ่นปาก uremic\nKidney: คลำได้ขนาดเล็ก ผิวขรุขระทั้งสองข้าง\nHydration: ขาดน้ำประมาณ 6%',
      ddx: 'Chronic Kidney Disease, Hyperthyroidism, Diabetes mellitus',
      dx: 'Chronic Kidney Disease — IRIS Stage 2',
      plan: 'สารน้ำ SC (LRS) 100 ml ทุก 2-3 วัน, อาหารโรคไต, ยาลดความดัน/ฟอสเฟต, กระตุ้นการกิน, ตรวจค่าไตซ้ำใน 1 เดือน',
      vet: 'Demo Vet',
      recheckDate: '2025-03-14', recheckTime: '11:00', recheckReason: 'ติดตามค่าไต (BUN/Crea/Phos) และน้ำหนัก',
      savedAt: '2025-02-14T13:20:00.000Z',
    },
    lab: {
      species: 'Cat',
      values: [
        { name: 'BUN', result: '48', unit: 'mg/dL', normal_min: '16', normal_max: '36' },
        { name: 'Creatinine', result: '3.2', unit: 'mg/dL', normal_min: '0.8', normal_max: '2.4' },
        { name: 'Phosphorus', result: '6.8', unit: 'mg/dL', normal_min: '3.0', normal_max: '6.0' },
        { name: 'Potassium', result: '3.4', unit: 'mmol/L', normal_min: '3.5', normal_max: '5.8' },
        { name: 'Total protein', result: '7.8', unit: 'g/dL', normal_min: '6.0', normal_max: '8.4' },
        { name: 'Hct', result: '27', unit: '%', normal_min: '30', normal_max: '45' },
        { name: 'USG', result: '1.018', unit: '', normal_min: '1.035', normal_max: '1.060' },
      ],
      smear: 'Non-regenerative anemia, ไม่พบ blood parasite',
      savedAt: '2025-02-14T13:55:00.000Z',
    },
    rx: {
      items: [
        { name: 'Benazepril 5 mg', instruction: '1/2 เม็ด PO SID', qty: '15 เม็ด' },
        { name: 'อาหารโรคไต (Hill\'s k/d)', instruction: 'ให้ตามน้ำหนักตัว แบ่ง 3-4 มื้อ', qty: '1 ถุง' },
        { name: 'Potassium gluconate', instruction: '1/4 ช้อนตวง ผสมอาหาร BID', qty: '1 กระปุก' },
        { name: 'Mirtazapine 2 mg', instruction: '1/4 เม็ด PO ทุก 48 ชม. กระตุ้นการกิน', qty: 'ครึ่งแผง' },
      ],
      savedAt: '2025-02-14T14:00:00.000Z',
    },
  };

  // Patient 3 (Gold) — hypothyroidism + chicken/penicillin allergy
  const goldV1: Visit = {
    date: '2025-01-10',
    opd: {
      weight: '34.2', temp: '37.9', hr: '70', rr: '18', bp: '135/80',
      cc: 'ขนร่วงเป็นหย่อม ผิวแห้ง เฉื่อยชา น้ำหนักขึ้นทั้งที่กินเท่าเดิม',
      hx: 'อาการค่อยเป็นค่อยไป 3 เดือน แพ้ไก่ (ผื่นคัน) และเคยแพ้ penicillin (หน้าบวม)',
      pe: 'Skin: ขนร่วงสมมาตรสองข้างลำตัว ผิวหนา hyperpigmentation ไม่คัน\nGeneral: อ้วน BCS 7/9 เฉื่อยชา\nHeart rate: ช้ากว่าปกติเล็กน้อย\nอื่น ๆ: ปกติ',
      ddx: 'Hypothyroidism, Hyperadrenocorticism (Cushing), Allergic dermatitis',
      dx: 'Hypothyroidism (ยืนยันจาก Total T4 ต่ำ)',
      plan: 'Levothyroxine ตลอดชีวิต, ตรวจ T4 ซ้ำ 4-6 สัปดาห์เพื่อปรับขนาด, เลี่ยงอาหารที่มีไก่, ห้ามใช้ยากลุ่ม penicillin',
      vet: 'Demo Vet',
      savedAt: '2025-01-10T11:00:00.000Z',
    },
    lab: {
      species: 'Dog',
      values: [
        { name: 'Total T4', result: '0.6', unit: 'µg/dL', normal_min: '1.0', normal_max: '4.0' },
        { name: 'Cholesterol', result: '420', unit: 'mg/dL', normal_min: '110', normal_max: '320' },
        { name: 'ALT', result: '78', unit: 'U/L', normal_min: '10', normal_max: '100' },
        { name: 'Hct', result: '40', unit: '%', normal_min: '37', normal_max: '55' },
      ],
      savedAt: '2025-01-10T11:30:00.000Z',
    },
    rx: {
      items: [
        { name: 'Levothyroxine 0.4 mg', instruction: '1 เม็ด PO BID (ขณะท้องว่าง)', qty: '60 เม็ด (1 เดือน)' },
      ],
      savedAt: '2025-01-10T11:35:00.000Z',
    },
    vaccines: [
      { name: 'Rabies', date: '2025-01-10', vet: 'Demo Vet', route: 'SC', nextDue: '2026-01-10' },
      { name: 'DHPP', date: '2025-01-10', vet: 'Demo Vet', route: 'SC', nextDue: '2026-01-10' },
    ],
  };

  // Patient 4 (Khonpui) — exotic rabbit, GI stasis + dental: imaging + IPD
  const bunnyV1: Visit = {
    date: '2025-03-01',
    opd: {
      weight: '1.8', temp: '39.5', hr: '220', rr: '60', bp: '',
      cc: 'ไม่กินอาหาร ไม่ถ่ายอุจจาระมา 24 ชั่วโมง ซึม นั่งหลังค่อม',
      hx: 'เคยมีปัญหาฟันกรามยาว กินหญ้าแห้งน้อย ชอบกินอาหารเม็ด',
      pe: 'General: ซึม นั่งหลังค่อม ไม่ขยับ\nGI: ลำไส้เงียบ ไม่ได้ยิน gut sounds ท้องอืดแน่น\nDental: ฟันกรามล่างคม มี spur บาดกระพุ้งแก้ม\nHydration: ขาดน้ำประมาณ 7%',
      ddx: 'GI stasis (ileus), Dental malocclusion, Intestinal obstruction',
      dx: 'GI stasis ร่วมกับ dental malocclusion',
      plan: 'รับไว้ในโรงพยาบาล (IPD), สารน้ำ, syringe feeding (Critical Care), ยากระตุ้นการเคลื่อนไหวลำไส้, ตะไบฟันใต้ยาสลบ, X-ray ช่องท้อง',
      vet: 'Demo Vet',
      recheckDate: '2025-03-03', recheckTime: '09:30', recheckReason: 'ประเมินการกินและการถ่ายหลังออกจาก IPD',
      savedAt: '2025-03-01T15:10:00.000Z',
    },
    imaging: {
      notes: 'X-ray ช่องท้อง (lateral + VD): พบ gas distension ในกระเพาะและ cecum ไม่พบ foreign body หรือ obstruction ชัดเจน\nDental: ฟันกราม root elongation เล็กน้อย ปลายฟันคม',
    },
    ipd: {
      notes: 'Admit 2 วัน:\n- LRS SC 50 ml q12h\n- Critical Care (Oxbow) syringe feed 50 ml/kg/วัน แบ่ง 4 มื้อ\n- ตะไบฟันกรามใต้ยาสลบ isoflurane (mask)\n- วันที่ 2 เริ่มถ่ายอุจจาระเม็ดเล็ก กินหญ้าแห้งเองได้บางส่วน → จำหน่ายกลับบ้าน',
      savedAt: '2025-03-02T18:00:00.000Z',
    },
    rx: {
      items: [
        { name: 'Meloxicam 0.5 mg/ml', instruction: '0.3 mg/kg PO SID x 5 วัน', qty: '5 ml' },
        { name: 'Metoclopramide', instruction: '0.5 mg/kg PO TID x 5 วัน', qty: '1 ขวด' },
        { name: 'Critical Care (Oxbow)', instruction: 'ป้อน 50 ml/kg/วัน จนกินหญ้าเองได้', qty: '1 ถุง' },
        { name: 'Simethicone', instruction: '1 ml PO ทุก 1 ชม. 3 ครั้ง เมื่อท้องอืด', qty: '1 ขวด' },
      ],
      savedAt: '2025-03-01T15:30:00.000Z',
    },
  };

  // ── Patients ─────────────────────────────────────────────────────────────────
  const patients = [
    { hn: 'HN-0001', name: 'บัดดี้', species: 'Dog', breed: 'Golden Retriever', sex: 'M', birthdate: '2020-05-01', color: 'ทอง', owner: 'สมชาย ใจดี', owner_phone: '081-111-1111', owner_line: 'somchai_jd', owner_facebook: '', owner_id: 'owner-1', main_disease: '', allergies: '', deceased: 0, moved: 0, visits: JSON.stringify([buddyV2, buddyV1]), imported_at: null, uid: null },
    { hn: 'HN-0002', name: 'มิ้ว', species: 'Cat', breed: 'Domestic Shorthair', sex: 'F', birthdate: '2013-03-20', color: 'ลายสลิด', owner: 'วิภา รักสัตว์', owner_phone: '089-222-2222', owner_line: 'vipa_rs', owner_facebook: '', owner_id: 'owner-2', main_disease: 'Chronic Kidney Disease (IRIS II)', allergies: '', deceased: 0, moved: 0, visits: JSON.stringify([miewV1]), imported_at: null, uid: null },
    { hn: 'HN-0003', name: 'โกลด์', species: 'Dog', breed: 'Labrador Retriever', sex: 'M', birthdate: '2018-08-15', color: 'ดำ', owner: 'สมชาย ใจดี', owner_phone: '081-111-1111', owner_line: 'somchai_jd', owner_facebook: '', owner_id: 'owner-1', main_disease: 'Hypothyroidism', allergies: 'ไก่ (Chicken), Penicillin', deceased: 0, moved: 0, visits: JSON.stringify([goldV1]), imported_at: null, uid: null },
    { hn: 'HN-0004', name: 'ขนปุย', species: 'Rabbit', breed: 'Holland Lop', sex: 'F', birthdate: '2022-06-10', color: 'น้ำตาลขาว', owner: 'ธนกร พิทักษ์', owner_phone: '082-333-3333', owner_line: 'thanakorn_p', owner_facebook: '', owner_id: 'owner-3', main_disease: '', allergies: '', deceased: 0, moved: 0, visits: JSON.stringify([bunnyV1]), imported_at: null, uid: null },
  ];

  const insertPatient = db.prepare(`
    INSERT OR IGNORE INTO patients
      (hn, clinic_id, name, species, breed, sex, birthdate, color,
       owner, owner_phone, owner_line, owner_facebook, owner_id,
       main_disease, allergies, deceased, moved, visits, imported_at, uid)
    VALUES
      (@hn, 'clinic-1', @name, @species, @breed, @sex, @birthdate, @color,
       @owner, @owner_phone, @owner_line, @owner_facebook, @owner_id,
       @main_disease, @allergies, @deceased, @moved, @visits, @imported_at, @uid)
  `);
  for (const p of patients) insertPatient.run(p);
  console.log('[seed] Patients ready:', patients.map((p) => `${p.hn} (${p.name})`).join(', '));

  // ── Appointments (varied statuses) ───────────────────────────────────────────
  const appts = [
    { id: 'appt-1', hn: 'HN-0001', date: day(0), time: '09:00', notes: 'Recheck อาการ GI', status: 'confirmed' },
    { id: 'appt-2', hn: 'HN-0002', date: day(1), time: '10:30', notes: 'ติดตามค่าไต + สารน้ำ SC', status: 'pending' },
    { id: 'appt-3', hn: 'HN-0004', date: day(2), time: '14:00', notes: 'ตรวจฟัน follow-up หลัง GI stasis', status: 'confirmed' },
    { id: 'appt-4', hn: 'HN-0003', date: day(5), time: '11:00', notes: 'ตรวจ Total T4 ซ้ำ ปรับยา', status: 'pending' },
  ];
  const insertAppt = db.prepare(`INSERT OR IGNORE INTO appointments (id, clinic_id, patient_hn, date, time, notes, status, created_at) VALUES (@id, 'clinic-1', @hn, @date, @time, @notes, @status, @created_at)`);
  for (const a of appts) insertAppt.run({ ...a, created_at: iso(today) });
  console.log('[seed] Appointments ready:', appts.length);

  // ── Online bookings (from public website form) ───────────────────────────────
  const bookings = [
    { id: 'booking-1', name: 'มานี ดวงดี', phone: '086-555-5555', pet_name: 'ด่าง', species: 'Dog', date: day(3), time: 'บ่าย', reason: 'ฉีดวัคซีนประจำปี + ตรวจสุขภาพ', status: 'pending' },
    { id: 'booking-2', name: 'ปิติ สุขใจ', phone: '087-666-6666', pet_name: 'เหมียว', species: 'Cat', date: day(4), time: 'เช้า', reason: 'ทำหมัน', status: 'confirmed' },
  ];
  const insertBooking = db.prepare(`INSERT OR IGNORE INTO bookings (id, clinic_id, name, phone, pet_name, species, date, time, reason, status, created_at) VALUES (@id, 'clinic-1', @name, @phone, @pet_name, @species, @date, @time, @reason, @status, @created_at)`);
  for (const b of bookings) insertBooking.run({ ...b, created_at: iso(today) });
  console.log('[seed] Bookings ready:', bookings.length);

  console.log('[seed] Done. Login: vet@asiapet.local / asiapet123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
