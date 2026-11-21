import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendanceEvents,
  auditLogs,
  contracts,
  drivers,
  guardians,
  guardianStudentLinks,
  handoverCredentials,
  incidents,
  invoices,
  pricingConfigs,
  schoolContractRequests,
  schools,
  students,
  transportChangeRequests,
  trips,
  vehicleOwners,
  vehicles,
} from './schema.ts';
import { hashPin } from '../middleware/auth.ts';
import crypto from 'node:crypto';

let seedPromise: Promise<void> | null = null;

export function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runStagingSeed().catch((err) => {
      seedPromise = null;
      console.error('Staging seed check failed:', err);
      throw err;
    });
  }
  return seedPromise;
}

async function runStagingSeed() {
  // Check pricing_configs as fast marker
  const existingPricing = await db.select({ total: count() }).from(pricingConfigs);
  if (Number(existingPricing[0]?.total ?? 0) === 0) {
    await db.insert(pricingConfigs).values({
      studentMonthlyFeeAoa: 45000,
      schoolBusSingleShiftAoa: 250000,
      schoolBusDoubleShiftAoa: 350000,
      ivaPercent: 14,
      companyName: 'MôBuss Angola Transporte Escolar Lda.',
      companyNif: '5417209418',
      fiscalIntegrationStatus: 'sandbox_pending_agt_certification',
    });
  }

  const existingSchools = await db.select({ total: count() }).from(schools);
  if (Number(existingSchools[0]?.total ?? 0) > 0) {
    return;
  }

  // 1. Seed synthetic staging schools (Luanda)
  const insertedSchools = await db
    .insert(schools)
    .values([
      {
        name: 'Escola Primária do Morro Bento',
        nif: '5001829104',
        municipality: 'Belas / Morro Bento',
        address: 'Rua Comandante Valódia, Morro Bento, Luanda',
        contactName: 'Director Pedagógico Alberto',
        contactPhone: '+244 923 111 222',
        contactEmail: 'secretaria@morrobento.edu.ao',
        status: 'active',
      },
      {
        name: 'Colégio São Paulo (Maianga)',
        nif: '5001928374',
        municipality: 'Maianga',
        address: 'Av. Ho Chi Minh, Maianga, Luanda',
        contactName: 'Irmã Graça (Secretaria)',
        contactPhone: '+244 912 333 444',
        contactEmail: 'direcao@saopaulo.edu.ao',
        status: 'active',
      },
      {
        name: 'Escola Internacional de Talatona',
        nif: '5002837465',
        municipality: 'Talatona',
        address: 'Talatona Sul, Luanda',
        contactName: 'Dra. Nicole Santos',
        contactPhone: '+244 928 999 000',
        contactEmail: 'transporte@eit.edu.ao',
        status: 'active',
      },
    ])
    .returning();

  const schoolMorroBento = insertedSchools[0]!;
  const schoolSaoPaulo = insertedSchools[1]!;
  const schoolTalatona = insertedSchools[2]!;

  // 2. Seed contracts with configurable payerModel & dual PIN policy (boarding + dropoff)
  const insertedContracts = await db
    .insert(contracts)
    .values([
      {
        contractNumber: 'CT-MOB-2026-001',
        schoolId: schoolMorroBento.id,
        payerModel: 'parent',
        pinPolicy: 'both',
        busesAllocated: 4,
        studentsCovered: 90,
        monthlyValueAoa: 1400000,
        shiftRegime: 'both',
        status: 'active',
        notes: 'Encarregados pagam diretamente via Multicaixa Express; PIN obrigatório no embarque e desembarque.',
      },
      {
        contractNumber: 'CT-MOB-2026-002',
        schoolId: schoolSaoPaulo.id,
        payerModel: 'school',
        pinPolicy: 'both',
        busesAllocated: 2,
        studentsCovered: 45,
        monthlyValueAoa: 700000,
        shiftRegime: 'both',
        status: 'active',
        notes: 'Faturação mensal institucional à escola; PIN obrigatório no embarque e desembarque.',
      },
      {
        contractNumber: 'CT-MOB-2026-003',
        schoolId: schoolTalatona.id,
        payerModel: 'mixed',
        pinPolicy: 'both',
        busesAllocated: 5,
        studentsCovered: 120,
        monthlyValueAoa: 1750000,
        shiftRegime: 'both',
        status: 'active',
        notes: 'Modelo misto: escola comparticipa 40% e encarregados 60%.',
      },
    ])
    .returning();

  // 3. Seed contract requests (public lead queue)
  await db.insert(schoolContractRequests).values([
    {
      referenceCode: 'REQ-2026-1041',
      schoolName: 'Colégio São Francisco de Assis',
      municipality: 'Talatona',
      shiftRegime: 'both',
      busesRequested: 3,
      studentsEstimate: 75,
      estimatedMonthlyAoa: 1050000,
      payerPreference: 'configurable',
      contactName: 'Dr. Manuel Ferreira',
      contactPhone: '+244 934 555 666',
      contactEmail: 'contato@csfa.edu.ao',
      notes: 'Solicita cobertura na zona do Benfica e Talatona Sul.',
      status: 'request_received',
    },
    {
      referenceCode: 'REQ-2026-1042',
      schoolName: 'Complexo Escolar do Kilamba',
      municipality: 'Kilamba',
      shiftRegime: 'both',
      busesRequested: 3,
      studentsEstimate: 80,
      estimatedMonthlyAoa: 1050000,
      payerPreference: 'school',
      contactName: 'Prof. António Luvualu',
      contactPhone: '+244 945 777 888',
      contactEmail: 'secretaria@cekilamba.ao',
      notes: 'Quarteirões K, L e R.',
      status: 'under_review',
    },
  ]);

  // 4. Seed vehicle owners (MôBuss fleet vs Independent Partner Owners)
  const insertedOwners = await db
    .insert(vehicleOwners)
    .values([
      {
        fullName: 'MôBuss Angola Frota Própria Lda.',
        ownerType: 'mobuss',
        nif: '5417209418',
        phone: '+244 923 000 001',
        email: 'frota@mobuss.ao',
        settlementModel: 'monthly_fixed',
        monthlySettlementAoa: 0,
        verificationStatus: 'verified',
      },
      {
        fullName: 'Transportes Kizomba & Filhos (Parceiro)',
        ownerType: 'independent',
        nif: '5418890122',
        phone: '+244 924 102 304',
        email: 'kizomba.parceiro@ao.mail',
        settlementModel: 'monthly_fixed',
        monthlySettlementAoa: 420000,
        verificationStatus: 'verified',
      },
      {
        fullName: 'Sr. Domingos Mavungo (Proprietário Parceiro)',
        ownerType: 'independent',
        nif: '004918273LA041',
        phone: '+244 912 778 899',
        email: 'mavungo.frota@ao.mail',
        settlementModel: 'per_trip',
        monthlySettlementAoa: 380000,
        verificationStatus: 'verified',
      },
    ])
    .returning();

  // 5. Seed drivers
  const insertedDrivers = await db
    .insert(drivers)
    .values([
      {
        fullName: 'João Mateus',
        phone: '+244 923 112 233',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2022-8841',
        licenceExpiry: '2028-04-15',
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.9',
        tripsCompleted: 44,
        monthlyCompensationAoa: 220000,
        lastCheckInTime: '06:45',
      },
      {
        fullName: 'Paulo Cassoma',
        phone: '+244 912 334 455',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2021-4410',
        licenceExpiry: '2027-09-20',
        engagementType: 'contractor',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.8',
        tripsCompleted: 42,
        monthlyCompensationAoa: 210000,
        lastCheckInTime: '06:50',
      },
      {
        fullName: 'Teresa Lunda',
        phone: '+244 945 667 788',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2023-1920',
        licenceExpiry: '2028-11-30',
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.9',
        tripsCompleted: 45,
        monthlyCompensationAoa: 225000,
        lastCheckInTime: '06:40',
      },
      {
        fullName: 'Adão Bento',
        phone: '+244 934 889 900',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2020-7712',
        licenceExpiry: '2027-02-10',
        engagementType: 'owner_driver',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.7',
        tripsCompleted: 40,
        monthlyCompensationAoa: 200000,
        lastCheckInTime: '06:55',
      },
      {
        fullName: 'Rosa Tchissola',
        phone: '+244 928 445 566',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2023-9901',
        licenceExpiry: '2028-06-18',
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'available',
        ratingAvg: '4.8',
        tripsCompleted: 38,
        monthlyCompensationAoa: 190000,
        lastCheckInTime: '07:00',
      },
    ])
    .returning();

  // 6. Seed vehicles (separated into mobuss_owned and partner_owned)
  const insertedVehicles = await db
    .insert(vehicles)
    .values([
      {
        fleetNumber: 12,
        plate: 'LD-24-61-AB',
        ownershipType: 'mobuss_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[0]!.id,
        routeCode: 'ROTA-A',
        routeName: 'Rota A · Mutamba → Morro Bento',
        capacity: 22,
        status: 'on_trip',
        fuelPercent: 78,
        dnvtExpiry: '2027-03-31',
        dnvtStatus: 'valid',
        insuranceProvider: 'ENSA Seguros de Angola',
        insuranceStatus: 'valid',
        verificationStatus: 'verified',
      },
      {
        fleetNumber: 7,
        plate: 'LD-31-02-CK',
        ownershipType: 'partner_owned',
        ownerId: insertedOwners[1]!.id,
        assignedDriverId: insertedDrivers[1]!.id,
        routeCode: 'ROTA-B',
        routeName: 'Rota B · Talatona Express',
        capacity: 25,
        status: 'on_trip',
        fuelPercent: 64,
        dnvtExpiry: '2027-07-15',
        dnvtStatus: 'valid',
        insuranceProvider: 'Fidelidade Angola',
        insuranceStatus: 'valid',
        verificationStatus: 'verified',
      },
      {
        fleetNumber: 9,
        plate: 'LD-05-49-HM',
        ownershipType: 'partner_owned',
        ownerId: insertedOwners[2]!.id,
        assignedDriverId: insertedDrivers[3]!.id,
        routeCode: 'ROTA-C',
        routeName: 'Rota C · Viana Sul',
        capacity: 25,
        status: 'on_trip',
        fuelPercent: 42,
        dnvtExpiry: '2026-12-10',
        dnvtStatus: 'expiring_soon',
        insuranceProvider: 'ENSA Seguros de Angola',
        insuranceStatus: 'valid',
        verificationStatus: 'verified',
      },
      {
        fleetNumber: 4,
        plate: 'LD-22-88-PL',
        ownershipType: 'mobuss_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[2]!.id,
        routeCode: 'ROTA-D',
        routeName: 'Rota D · Baixa & Miramar',
        capacity: 20,
        status: 'assigned',
        fuelPercent: 82,
        dnvtExpiry: '2027-08-22',
        dnvtStatus: 'valid',
        insuranceProvider: 'Nossa Seguros',
        insuranceStatus: 'valid',
        verificationStatus: 'verified',
      },
      {
        fleetNumber: 3,
        plate: 'LD-18-77-FE',
        ownershipType: 'mobuss_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[4]!.id,
        routeCode: 'RESERVA',
        routeName: 'Reserva Central · Morro Bento',
        capacity: 22,
        status: 'reserve',
        fuelPercent: 95,
        dnvtExpiry: '2027-01-30',
        dnvtStatus: 'valid',
        insuranceProvider: 'ENSA Seguros de Angola',
        insuranceStatus: 'valid',
        verificationStatus: 'verified',
      },
    ])
    .returning();

  // 7. Seed students, guardians, links & hashed handover credentials
  const insertedStudents = await db
    .insert(students)
    .values([
      {
        fullName: 'Maria Domingos',
        schoolId: schoolMorroBento.id,
        contractId: insertedContracts[0]!.id,
        routeCode: 'ROTA-A',
        stopName: 'Largo do Kinaxixi',
        stopIndex: 1,
        shift: 'both',
        enrollmentStatus: 'active',
        currentJourneyState: 'expected',
        pinPolicy: 'both',
      },
      {
        fullName: 'Edson Manuel',
        schoolId: schoolMorroBento.id,
        contractId: insertedContracts[0]!.id,
        routeCode: 'ROTA-A',
        stopName: 'Largo do Kinaxixi',
        stopIndex: 1,
        shift: 'both',
        enrollmentStatus: 'active',
        currentJourneyState: 'boarded',
        pinPolicy: 'both',
      },
      {
        fullName: 'Ana Kiala',
        schoolId: schoolMorroBento.id,
        contractId: insertedContracts[0]!.id,
        routeCode: 'ROTA-A',
        stopName: 'Maianga',
        stopIndex: 2,
        shift: 'both',
        enrollmentStatus: 'active',
        currentJourneyState: 'expected',
        pinPolicy: 'both',
      },
      {
        fullName: 'Bruno Neto',
        schoolId: schoolMorroBento.id,
        contractId: insertedContracts[0]!.id,
        routeCode: 'ROTA-A',
        stopName: 'Alvalade',
        stopIndex: 3,
        shift: 'both',
        enrollmentStatus: 'active',
        currentJourneyState: 'expected',
        pinPolicy: 'both',
      },
      {
        fullName: 'Sofia Pedro',
        schoolId: schoolSaoPaulo.id,
        contractId: insertedContracts[1]!.id,
        routeCode: 'ROTA-B',
        stopName: 'Belas Shopping',
        stopIndex: 2,
        shift: 'both',
        enrollmentStatus: 'active',
        currentJourneyState: 'boarded',
        pinPolicy: 'both',
      },
    ])
    .returning();

  const insertedGuardians = await db
    .insert(guardians)
    .values([
      {
        fullName: 'Sra. Luísa Domingos',
        phone: '+244 923 456 789',
        email: 'luisa.domingos@ao.mail',
        verificationStatus: 'verified',
      },
      {
        fullName: 'Sr. Manuel Neto',
        phone: '+244 912 345 678',
        email: 'manuel.neto@ao.mail',
        verificationStatus: 'verified',
      },
      {
        fullName: 'Sra. Joana Kiala',
        phone: '+244 934 567 890',
        verificationStatus: 'verified',
      },
      {
        fullName: 'Sr. Carlos Neto',
        phone: '+244 945 678 901',
        verificationStatus: 'verified',
      },
      {
        fullName: 'Sra. Isabel Pedro',
        phone: '+244 923 888 777',
        verificationStatus: 'verified',
      },
    ])
    .returning();

  for (let i = 0; i < insertedStudents.length; i++) {
    await db.insert(guardianStudentLinks).values({
      guardianId: insertedGuardians[i]!.id,
      studentId: insertedStudents[i]!.id,
      relationship: 'Encarregado(a)',
      isPrimary: true,
      canViewPin: true,
      active: true,
    });

    const salt = crypto.randomBytes(16).toString('hex');
    const pin = String(4820 + i * 111); // staging only, stored ONLY as salted/peppered hash
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(handoverCredentials).values({
      studentId: insertedStudents[i]!.id,
      tripScope: 'both',
      pinHash: hashPin(pin, salt),
      pinSalt: salt,
      maskedDisplay: '••••',
      status: 'active',
      failedAttempts: 0,
      expiresAt,
    });
  }

  // 8. Seed distinct Morning & Afternoon Trips
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(new Date());
  const insertedTrips = await db
    .insert(trips)
    .values([
      {
        tripCode: `TRP-${today}-A-AM`,
        routeCode: 'ROTA-A',
        routeName: 'Rota A · Morro Bento (Manhã)',
        legType: 'morning',
        serviceDate: today,
        schoolId: schoolMorroBento.id,
        vehicleId: insertedVehicles[0]!.id,
        driverId: insertedDrivers[0]!.id,
        state: 'in_progress',
        lastLat: '-8.82493',
        lastLng: '13.23764',
        lastLocationAt: new Date(),
        gpsStatus: 'live',
      },
      {
        tripCode: `TRP-${today}-A-PM`,
        routeCode: 'ROTA-A',
        routeName: 'Rota A · Morro Bento (Regresso)',
        legType: 'afternoon',
        serviceDate: today,
        schoolId: schoolMorroBento.id,
        vehicleId: insertedVehicles[0]!.id,
        driverId: insertedDrivers[0]!.id,
        state: 'scheduled',
        gpsStatus: 'unavailable',
      },
      {
        tripCode: `TRP-${today}-B-AM`,
        routeCode: 'ROTA-B',
        routeName: 'Rota B · Talatona Express (Manhã)',
        legType: 'morning',
        serviceDate: today,
        schoolId: schoolSaoPaulo.id,
        vehicleId: insertedVehicles[1]!.id,
        driverId: insertedDrivers[1]!.id,
        state: 'in_progress',
        lastLat: '-8.92750',
        lastLng: '13.19500',
        lastLocationAt: new Date(),
        gpsStatus: 'live',
      },
    ])
    .returning();

  // 9. Append-only Attendance Events
  await db.insert(attendanceEvents).values([
    {
      eventId: `seed-ev-${today}-1`,
      tripId: insertedTrips[0]!.id,
      studentId: insertedStudents[1]!.id,
      actorUid: 'seed-driver-1',
      eventType: 'boarded',
      pinPhase: 'boarding',
      occurredAt: new Date(),
      latitude: '-8.81885',
      longitude: '13.24275',
      verificationResult: 'accepted',
      notes: 'Embarque com PIN validado na paragem Largo do Kinaxixi.',
    },
    {
      eventId: `seed-ev-${today}-2`,
      tripId: insertedTrips[2]!.id,
      studentId: insertedStudents[4]!.id,
      actorUid: 'seed-driver-2',
      eventType: 'boarded',
      pinPhase: 'boarding',
      occurredAt: new Date(),
      latitude: '-8.92750',
      longitude: '13.19500',
      verificationResult: 'accepted',
      notes: 'Embarque em Belas Shopping.',
    },
  ]);

  // 10. School Portal Transport Change Requests
  await db.insert(transportChangeRequests).values([
    {
      schoolId: schoolMorroBento.id,
      requestedByUid: 'seed-school-1',
      requestedByName: 'Director Pedagógico Alberto',
      requestType: 'stop_change',
      title: 'Alteração temporária de paragem · Aluna Ana Kiala',
      details: 'Encarregado solicitou recolha na paragem do Alvalade às terças e quintas.',
      status: 'pending',
    },
  ]);

  // 11. Incidents
  await db.insert(incidents).values([
    {
      tripId: insertedTrips[2]!.id,
      schoolId: schoolSaoPaulo.id,
      busNumber: 7,
      routeCode: 'ROTA-B',
      category: 'breakdown',
      severity: 'medium',
      description: 'Furo de pneu ligeiro junto ao Belas Shopping; sem feridos.',
      reporterName: 'Paulo Cassoma',
      reporterRole: 'driver',
      status: 'acknowledged',
      assignedToName: 'Equipa Técnica Luanda',
      resolutionNotes: 'Autocarro de reserva em prontidão caso necessário.',
    },
  ]);

  // 12. Provisional Invoices (NEVER labelled as AGT-certified until verified!)
  await db.insert(invoices).values([
    {
      invoiceNumber: 'PRO-MOB-2026/8192',
      schoolId: schoolMorroBento.id,
      studentName: 'Maria Domingos',
      guardianName: 'Sra. Luísa Domingos',
      payerType: 'guardian',
      phone: '+244 923 456 789',
      amountAoa: 45000,
      paymentMethod: 'multicaixa_express',
      status: 'confirmed',
      providerReference: 'MCX-SANDBOX-8192',
      fiscalStatus: 'proforma_unverified',
      confirmedAt: new Date(),
    },
    {
      invoiceNumber: 'PRO-MOB-2026/8195',
      schoolId: schoolMorroBento.id,
      studentName: 'Bruno Neto',
      guardianName: 'Sr. Carlos Neto',
      payerType: 'guardian',
      phone: '+244 945 678 901',
      amountAoa: 45000,
      paymentMethod: 'multicaixa_express',
      status: 'pending_provider',
      providerReference: 'MCX-PENDING-8195',
      fiscalStatus: 'proforma_unverified',
    },
  ]);

  await db.insert(auditLogs).values({
    actorUid: 'system-seed',
    actorEmail: 'ops@mobuss.ao',
    actorRole: 'mobuss_super_admin',
    action: 'system.seed_staging',
    targetEntity: 'database',
    targetId: 'staging',
    summary: 'Dados sintéticos de homologação (Luanda) inicializados em Cloud SQL PostgreSQL.',
  });
}
