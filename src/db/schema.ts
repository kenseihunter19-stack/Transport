import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. IDENTITY, ROLES & ACCESS CONTROL
// ============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or cred:<id> for admin-created credentials
  username: text('username'), // Optional short sign-in identifier (e.g. 'admin')
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default('Utilizador MôBuss'),
  phone: text('phone'),
  passwordHash: text('password_hash'), // Salted scrypt hash for admin-provisioned accounts
  passwordSalt: text('password_salt'),
  primaryRole: text('primary_role').notNull().default('parent_guardian'),
  // Roles: mobuss_super_admin | operations_manager | fleet_manager | school_account_manager | finance_officer | safety_support_agent | school_admin | driver | vehicle_owner | parent_guardian
  active: boolean('active').notNull().default(true),
  schoolId: integer('school_id'),
  driverId: integer('driver_id'),
  ownerId: integer('owner_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userRoleAssignments = pgTable('user_role_assignments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  scopeType: text('scope_type').notNull().default('global'), // global | school | fleet
  scopeId: integer('scope_id'),
  grantedByUid: text('granted_by_uid'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 2. CLIENTS, SCHOOLS & CONTRACTS (Configurable Payer & Dual PIN Policy)
// ============================================================================

export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nif: text('nif'),
  province: text('province').notNull().default('Luanda'),
  municipality: text('municipality').notNull(),
  address: text('address'),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactEmail: text('contact_email'),
  operatingCalendar: text('operating_calendar').notNull().default('Seg–Sex · 06:30–18:00'),
  status: text('status').notNull().default('active'), // active | onboarding | suspended
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolContractRequests = pgTable('school_contract_requests', {
  id: serial('id').primaryKey(),
  referenceCode: text('reference_code').notNull().unique(),
  schoolName: text('school_name').notNull(),
  municipality: text('municipality').notNull(),
  shiftRegime: text('shift_regime').notNull().default('both'), // morning | afternoon | both
  busesRequested: integer('buses_requested').notNull(),
  studentsEstimate: integer('students_estimate').notNull(),
  estimatedMonthlyAoa: integer('estimated_monthly_aoa').notNull(),
  payerPreference: text('payer_preference').notNull().default('configurable'), // school | parent | mixed | configurable
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactEmail: text('contact_email'),
  notes: text('notes'),
  status: text('status').notNull().default('request_received'), // request_received | under_review | proposal_sent | accepted | rejected
  reviewedByUid: text('reviewed_by_uid'),
  convertedContractId: integer('converted_contract_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  contractNumber: text('contract_number').notNull().unique(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  payerModel: text('payer_model').notNull().default('school'), // school | parent | mixed
  pinPolicy: text('pin_policy').notNull().default('both'), // boarding | dropoff | both
  busesAllocated: integer('buses_allocated').notNull(),
  studentsCovered: integer('students_covered').notNull(),
  monthlyValueAoa: integer('monthly_value_aoa').notNull(),
  shiftRegime: text('shift_regime').notNull().default('both'),
  status: text('status').notNull().default('active'), // request_received | under_review | proposal_sent | accepted | active | suspended | expired | rejected
  startDate: text('start_date').notNull().default('2026-09-01'),
  endDate: text('end_date').notNull().default('2027-07-31'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 3. FLEET: INDEPENDENT VEHICLE OWNERS, VEHICLES & DRIVERS (Separated!)
// ============================================================================

export const vehicleOwners = pgTable('vehicle_owners', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  ownerType: text('owner_type').notNull().default('independent'), // mobuss | independent
  nif: text('nif'),
  phone: text('phone').notNull(),
  email: text('email'),
  settlementModel: text('settlement_model').notNull().default('monthly_fixed'), // monthly_fixed | per_trip
  monthlySettlementAoa: integer('monthly_settlement_aoa').notNull().default(0),
  verificationStatus: text('verification_status').notNull().default('verified'), // pending | verified | suspended
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const drivers = pgTable('drivers', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  licenceCategory: text('licence_category').notNull().default('Pesados Profissional D'),
  licenceNumber: text('licence_number').notNull(),
  licenceExpiry: text('licence_expiry').notNull(),
  engagementType: text('engagement_type').notNull().default('employed'), // employed | contractor | owner_driver
  verificationStatus: text('verification_status').notNull().default('verified'), // pending | verified | suspended
  availabilityStatus: text('availability_status').notNull().default('in_service'), // in_service | available | off_duty
  ratingAvg: text('rating_avg').notNull().default('4.9'),
  tripsCompleted: integer('trips_completed').notNull().default(0),
  monthlyCompensationAoa: integer('monthly_compensation_aoa').notNull().default(210000),
  lastCheckInTime: text('last_check_in_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  fleetNumber: integer('fleet_number').notNull().unique(),
  plate: text('plate').notNull().unique(),
  ownershipType: text('ownership_type').notNull().default('mobuss_owned'), // mobuss_owned | partner_owned
  ownerId: integer('owner_id')
    .references(() => vehicleOwners.id)
    .notNull(),
  assignedDriverId: integer('assigned_driver_id').references(() => drivers.id),
  routeCode: text('route_code'),
  routeName: text('route_name'),
  capacity: integer('capacity').notNull().default(22),
  status: text('status').notNull().default('available'), // available | assigned | on_trip | reserve | maintenance | out_of_service | suspended
  fuelPercent: integer('fuel_percent').notNull().default(80),
  dnvtExpiry: text('dnvt_expiry').notNull(),
  dnvtStatus: text('dnvt_status').notNull().default('valid'), // valid | expiring_soon | expired
  insuranceProvider: text('insurance_provider').notNull().default('ENSA Seguros de Angola'),
  insuranceStatus: text('insurance_status').notNull().default('valid'),
  verificationStatus: text('verification_status').notNull().default('verified'), // pending | verified | blocked
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 4. PEOPLE: STUDENTS, GUARDIANS & HASHED SINGLE-USE HANDOVER PINS
// ============================================================================

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  contractId: integer('contract_id').references(() => contracts.id),
  routeCode: text('route_code').notNull(),
  stopName: text('stop_name').notNull(),
  stopIndex: integer('stop_index').notNull().default(0),
  shift: text('shift').notNull().default('both'),
  enrollmentStatus: text('enrollment_status').notNull().default('active'), // active | pending_approval | suspended
  currentJourneyState: text('current_journey_state').notNull().default('expected'),
  // expected | present | absent | boarded | in_transit | at_destination | handover_pending | handed_over | verification_failed
  pinPolicy: text('pin_policy').notNull().default('both'), // boarding | dropoff | both
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guardians = pgTable('guardians', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  verificationStatus: text('verification_status').notNull().default('verified'), // invited | verified | revoked
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guardianStudentLinks = pgTable('guardian_student_links', {
  id: serial('id').primaryKey(),
  guardianId: integer('guardian_id')
    .references(() => guardians.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  relationship: text('relationship').notNull().default('Encarregado(a)'),
  isPrimary: boolean('is_primary').notNull().default(true),
  canViewPin: boolean('can_view_pin').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const handoverCredentials = pgTable('handover_credentials', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id')
    .references(() => students.id, { onDelete: 'cascade' })
    .notNull(),
  tripScope: text('trip_scope').notNull().default('both'), // boarding | dropoff | both
  pinHash: text('pin_hash').notNull(), // Salted + peppered SHA-256 hash — NEVER plaintext!
  pinSalt: text('pin_salt').notNull(),
  maskedDisplay: text('masked_display').notNull().default('••••'),
  status: text('status').notNull().default('active'), // active | used | revoked | expired
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 5. OPERATIONS: TRIPS (State Machine), APPEND-ONLY ATTENDANCE & SCHOOL PORTAL REQUESTS
// ============================================================================

export const trips = pgTable('trips', {
  id: serial('id').primaryKey(),
  tripCode: text('trip_code').notNull().unique(),
  routeCode: text('route_code').notNull(),
  routeName: text('route_name').notNull(),
  legType: text('leg_type').notNull().default('morning'), // morning | afternoon
  serviceDate: text('service_date').notNull(),
  schoolId: integer('school_id').references(() => schools.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  driverId: integer('driver_id').references(() => drivers.id),
  state: text('state').notNull().default('scheduled'),
  // scheduled | driver_checked_in | in_progress | at_stop | boarding | at_school | return_in_progress | handover_pending | completed | delayed | cancelled | incident
  lastLat: text('last_lat'),
  lastLng: text('last_lng'),
  lastLocationAt: timestamp('last_location_at'),
  gpsStatus: text('gps_status').notNull().default('unavailable'), // live | stale | unavailable
  emptyBusSweepVerified: boolean('empty_bus_sweep_verified').notNull().default(false),
  emptyBusSweepAt: timestamp('empty_bus_sweep_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceEvents = pgTable('attendance_events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(), // Client idempotency UUID
  tripId: integer('trip_id').references(() => trips.id),
  studentId: integer('student_id')
    .references(() => students.id)
    .notNull(),
  actorUid: text('actor_uid'),
  eventType: text('event_type').notNull(), // present | absent | boarded | in_transit | at_destination | handover_pending | handed_over | pin_failed | correction
  pinPhase: text('pin_phase'), // boarding | dropoff
  occurredAt: timestamp('occurred_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  offlineSequence: integer('offline_sequence'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  verificationResult: text('verification_result'), // valid | invalid | exception | accepted
  notes: text('notes'),
});

export const transportChangeRequests = pgTable('transport_change_requests', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .references(() => schools.id)
    .notNull(),
  requestedByUid: text('requested_by_uid').notNull(),
  requestedByName: text('requested_by_name').notNull(),
  requestType: text('request_type').notNull(), // new_student | stop_change | schedule_change | roster_correction | suspension
  title: text('title').notNull(),
  details: text('details').notNull(),
  status: text('status').notNull().default('pending'), // pending | under_review | approved | rejected
  reviewedByUid: text('reviewed_by_uid'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 6. SAFETY, INCIDENTS, PRICING, INVOICES & AUDIT LOGS
// ============================================================================

export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id'),
  schoolId: integer('school_id'),
  busNumber: integer('bus_number'),
  routeCode: text('route_code'),
  category: text('category').notNull(), // breakdown | traffic_delay | medical | pin_failure | general_sos | hazard
  severity: text('severity').notNull().default('high'), // low | medium | high | critical
  description: text('description').notNull(),
  reporterName: text('reporter_name').notNull(),
  reporterRole: text('reporter_role').notNull(),
  status: text('status').notNull().default('new'), // new | acknowledged | assigned | in_progress | resolved | closed
  assignedToName: text('assigned_to_name'),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pricingConfigs = pgTable('pricing_configs', {
  id: serial('id').primaryKey(),
  studentMonthlyFeeAoa: integer('student_monthly_aoa').notNull().default(45000),
  schoolBusSingleShiftAoa: integer('school_bus_single_shift_aoa').notNull().default(250000),
  schoolBusDoubleShiftAoa: integer('school_bus_double_shift_aoa').notNull().default(350000),
  ivaPercent: integer('iva_percent').notNull().default(14),
  companyName: text('company_name').notNull().default('MôBuss Angola Transporte Escolar Lda.'),
  companyNif: text('company_nif').notNull().default('5417209418'),
  multicaixaEntityCode: text('multicaixa_entity_code').notNull().default('00845'),
  fiscalIntegrationStatus: text('fiscal_integration_status')
    .notNull()
    .default('sandbox_pending_agt_certification'),
  updatedByUid: text('updated_by_uid'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  schoolId: integer('school_id'),
  studentName: text('student_name').notNull(),
  guardianName: text('guardian_name').notNull(),
  payerType: text('payer_type').notNull().default('guardian'), // school | guardian
  phone: text('phone').notNull(),
  amountAoa: integer('amount_aoa').notNull(),
  paymentMethod: text('payment_method').notNull().default('multicaixa_express_entity'),
  paymentEntity: text('payment_entity'),
  paymentReferencePin: text('payment_reference_pin'),
  status: text('status').notNull().default('pending_provider'), // draft | initiated | pending_provider | confirmed | failed | refunded
  providerReference: text('provider_reference'),
  fiscalStatus: text('fiscal_status').notNull().default('proforma_unverified'), // proforma_unverified | verified_fiscal
  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorEmail: text('actor_email'),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  targetEntity: text('target_entity').notNull(),
  targetId: text('target_id'),
  summary: text('summary').notNull(),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const devicePushTokens = pgTable('device_push_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  platform: text('platform').notNull(), // ios | android | web
  appTarget: text('app_target').notNull(), // client | driver | hub
  token: text('token').notNull().unique(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const schoolsRelations = relations(schools, ({ many }) => ({
  contracts: many(contracts),
  students: many(students),
  changeRequests: many(transportChangeRequests),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  school: one(schools, {
    fields: [contracts.schoolId],
    references: [schools.id],
  }),
}));

export const vehicleOwnersRelations = relations(vehicleOwners, ({ many }) => ({
  vehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  owner: one(vehicleOwners, {
    fields: [vehicles.ownerId],
    references: [vehicleOwners.id],
  }),
  driver: one(drivers, {
    fields: [vehicles.assignedDriverId],
    references: [drivers.id],
  }),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  contract: one(contracts, {
    fields: [students.contractId],
    references: [contracts.id],
  }),
  guardianLinks: many(guardianStudentLinks),
  handoverCredentials: many(handoverCredentials),
  attendanceEvents: many(attendanceEvents),
}));

export const guardianStudentLinksRelations = relations(guardianStudentLinks, ({ one }) => ({
  guardian: one(guardians, {
    fields: [guardianStudentLinks.guardianId],
    references: [guardians.id],
  }),
  student: one(students, {
    fields: [guardianStudentLinks.studentId],
    references: [students.id],
  }),
}));
