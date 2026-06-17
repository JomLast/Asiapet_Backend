// ─────────────────────────────────────────────────────────────────────────────
// AsiaPet — shared domain types
//
// Single source of truth for the data contract between the backend
// (Asiapet_Backend) and the frontend (Asiapet_Frontend).
//
// IMPORTANT: this file is intentionally duplicated in BOTH repos so each repo
// is self-contained (no monorepo / no external package needed). If you change a
// type here, copy the same change into the other repo's shared/types/index.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Generic API envelopes ───────────────────────────────────────────────────

/** Uniform error body returned by every failing endpoint. */
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
}

/** Paginated list payload. Pagination inputs travel as query params; the
 *  response only echoes the page of items and the total row count. */
export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  clinicId: string;
  role?: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ─── Visit sub-records ───────────────────────────────────────────────────────
// A Visit is stored as JSON inside Patient.visits. Every sub-record is optional
// and every leaf field is optional (the editors initialise from `{}` / `''`),
// except the array-of-rows containers which always carry their list.

/** OPD (out-patient) examination record. */
export interface OpdRecord {
  weight?: string;
  temp?: string;
  hr?: string;
  rr?: string;
  bp?: string;
  cc?: string;
  hx?: string;
  pe?: string;
  ddx?: string;
  dx?: string;
  plan?: string;
  vet?: string;
  savedAt?: string;
  recheckDate?: string;
  recheckTime?: string;
  recheckReason?: string;
}

/** IPD (in-patient) record. */
export interface IpdRecord {
  notes?: string;
  savedAt?: string;
}

/** A single laboratory result row. */
export interface LabValue {
  name: string;
  result?: string;
  unit?: string;
  normal_min?: string;
  normal_max?: string;
}

/** Laboratory record for a visit. */
export interface LabRecord {
  values: LabValue[];
  savedAt?: string;
  species?: string;
  smear?: string;
}

/** A single prescription line. */
export interface RxItem {
  name: string;
  instruction?: string;
  qty?: string;
}

/** Prescription record for a visit (wraps the list of Rx lines). */
export interface RxRecord {
  items: RxItem[];
  savedAt?: string;
}

/** A single vaccination entry (element of Visit.vaccines). */
export interface VaccineRecord {
  name: string;
  date?: string;
  vet?: string;
  route?: string;
  nextDue?: string;
}

/** One clinical visit. `date` is the upsert key — always required. */
export interface Visit {
  date: string;
  opd?: OpdRecord;
  ipd?: IpdRecord;
  lab?: LabRecord;
  rx?: RxRecord;
  vaccines?: VaccineRecord[];
  /** Imaging is an open bag (the UI reads imaging?.['notes'] defensively). */
  imaging?: Record<string, unknown>;
}

// ─── Entities ────────────────────────────────────────────────────────────────

/** Patient (keyed by hospital number `hn`, scoped per clinic on the server). */
export interface Patient {
  hn: string;
  name: string;
  species?: string;
  breed?: string;
  sex?: string;
  birthdate?: string;
  color?: string;
  owner?: string;
  ownerPhone?: string;
  ownerLine?: string;
  ownerFacebook?: string;
  ownerId?: string;
  mainDisease?: string;
  allergies?: string;
  deceased: boolean;
  moved: boolean;
  visits: Visit[];
  _importedAt?: string;
  _uid?: string;
}

export interface Owner {
  id: string;
  name: string;
  phone?: string;
  lineId?: string;
  facebook?: string;
  notes?: string;
  createdAt?: string;
}

/** Appointment. `status` is a free string — observed values are
 *  'pending' | 'confirmed' | 'done' | 'cancelled' but it is never constrained
 *  (the DB column is nullable text and the UI selects emit plain strings). */
export interface Appointment {
  id: string;
  patientHN?: string;
  date: string;
  time?: string;
  notes?: string;
  status?: string;
  createdAt?: string;
}

/** Online booking submitted from the public website form. */
export interface Booking {
  id: string;
  name?: string;
  phone?: string;
  petName?: string;
  species?: string;
  date?: string;
  time?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
}

// ─── Request payloads ────────────────────────────────────────────────────────

export interface CreatePatientRequest {
  hn: string;
  name: string;
  species?: string;
  breed?: string;
  sex?: string;
  birthdate?: string;
  color?: string;
  owner?: string;
  ownerPhone?: string;
  ownerLine?: string;
  ownerFacebook?: string;
  ownerId?: string;
  mainDisease?: string;
  allergies?: string;
  deceased?: boolean;
  moved?: boolean;
  visits?: Visit[];
  _importedAt?: string;
  _uid?: string;
}

/** Update is a partial patch; `hn` comes from the URL, not the body. */
export type UpdatePatientRequest = Partial<CreatePatientRequest>;

export interface CreateOwnerRequest {
  id?: string;
  name: string;
  phone?: string;
  lineId?: string;
  facebook?: string;
  notes?: string;
}

export type UpdateOwnerRequest = Partial<Omit<Owner, 'id'>>;

export interface CreateAppointmentRequest {
  id?: string;
  patientHN?: string;
  date: string;
  time?: string;
  notes?: string;
  status?: string;
}

export type UpdateAppointmentRequest = Partial<Omit<Appointment, 'id'>>;

export type UpdateBookingRequest = Partial<Omit<Booking, 'id'>>;

// ─── Legacy bulk import (admin) ──────────────────────────────────────────────
// Patients/owners arrive as maps keyed by hn/id; appointments as a flat array.

export interface LegacyImportRequest {
  patients?: Record<string, Patient>;
  owners?: Record<string, Owner>;
  appointments?: Appointment[];
}

export interface LegacyImportResponse {
  patients: number;
  owners: number;
  appointments: number;
}

// ─── Reference content (drugs / diseases) ────────────────────────────────────
// Served by the backend as opaque content and typed on the frontend.

export interface DrugDose {
  /** species */ sp: string;
  /** dose */ d: string;
  /** route */ r: string;
  /** frequency */ f: string;
  /** source */ src: string;
}

export interface Drug {
  name: string;
  cat: string;
  brand?: string;
  cls?: string;
  use?: string;
  warn?: string;
  verified?: string;
  contra?: string[];
  doses: DrugDose[];
}

export type DiseaseSeverity = 'emergency' | 'urgent' | 'chronic' | 'routine';

export interface Disease {
  name: string;
  cat: string;
  sev: DiseaseSeverity;
  species: string[];
  also?: string;
  preventable?: string;
  cause?: string;
  script?: string;
  prognosis?: string;
  prevention?: string;
  preventableNote?: string;
}
