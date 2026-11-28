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
  recurringRouteSchedules,
  routes,
  routeStops,
  schoolContractRequests,
  schools,
  students,
  transportChangeRequests,
  trips,
  vehicleOwners,
  vehicles,
} from './schema.ts';
import { LUANDA_ROUTES, pointAtRoute } from '../lib/route-luanda.ts';
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
      studentMonthlyFeeAoa: 3000,
      driverMonthlyFeeAoa: 33000,
      schoolBusSingleShiftAoa: 33000,
      schoolBusDoubleShiftAoa: 33000,
      ivaPercent: 14,
      companyName: 'MôBuss Angola Transporte Escolar Lda.',
      companyNif: '5417209418',
      companyAddress: 'Av. Comandante Valódia, Luanda, Angola',
      fiscalIntegrationStatus: 'sandbox_pending_agt_certification',
    });
  }

  async function ensureInitialRoutesSeeded() {
    const existingRoutes = await db.select({ total: count() }).from(routes);
    if (Number(existingRoutes[0]?.total ?? 0) > 0) {
      return;
    }

    const allSchools = await db.select().from(schools);
    const schoolByName = new Map(allSchools.map((s) => [s.name.trim().toLowerCase(), s]));

    const formatStopTime = (offsetMinutes: number) => {
      const totalMins = 6 * 60 + 30 + Math.max(0, Math.round(offsetMinutes));
      const hh = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
      const mm = String(totalMins % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    for (const cfg of Object.values(LUANDA_ROUTES)) {
      const matchedSchool = schoolByName.get(cfg.school.trim().toLowerCase()) ?? null;
      const insertedRouteRows = await db
        .insert(routes)
        .values({
          code: cfg.code.trim().toUpperCase(),
          name: cfg.name,
          corridor: cfg.corridor,
          schoolId: matchedSchool?.id ?? null,
          pathCoordinates: cfg.path,
          active: true,
        })
        .onConflictDoNothing()
        .returning();

      const insertedRoute = insertedRouteRows[0];
      if (!insertedRoute) continue;

      if (cfg.stops.length > 0) {
        await db.insert(routeStops).values(
          cfg.stops.map((st, idx) => {
            const [lat, lng] = pointAtRoute(cfg.path, st.at);
            return {
              routeId: insertedRoute.id,
              position: idx,
              name: st.name,
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lng.toFixed(6)),
              scheduledTime: formatStopTime(st.etaMinutes),
              geofenceRadiusM: 500,
            };
          })
        );
      }
    }
  }

  const existingSchools = await db.select({ total: count() }).from(schools);
  if (Number(existingSchools[0]?.total ?? 0) > 0) {
    await ensureInitialRoutesSeeded();
    // Ensure idempotent backfill for newly added recurring_route_schedules & vehicle school link on existing staging DBs
    const existingSchedules = await db.select({ total: count() }).from(recurringRouteSchedules);
    if (Number(existingSchedules[0]?.total ?? 0) === 0) {
      const existingVehicles = await db.select().from(vehicles);
      const existingTrips = await db.select().from(trips);

      for (const v of existingVehicles) {
        if (v.assignedSchoolId == null) {
          const matchedTrip = existingTrips.find((t) => t.vehicleId === v.id && t.schoolId != null);
          if (matchedTrip?.schoolId) {
            await db
              .update(vehicles)
              .set({ assignedSchoolId: matchedTrip.schoolId })
              .where(eq(vehicles.id, v.id));
          }
        }
      }

      const busA = existingVehicles.find((v) => v.routeCode === 'ROTA-A');
      const busB = existingVehicles.find((v) => v.routeCode === 'ROTA-B');
      const tripA = existingTrips.find((t) => t.routeCode === 'ROTA-A' && t.schoolId != null);
      const tripB = existingTrips.find((t) => t.routeCode === 'ROTA-B' && t.schoolId != null);

      const initialSchedules: Array<typeof recurringRouteSchedules.$inferInsert> = [];
      if (tripA?.schoolId && busA) {
        initialSchedules.push(
          {
            schoolId: tripA.schoolId,
            vehicleId: busA.id,
            driverId: busA.assignedDriverId,
            routeCode: 'ROTA-A',
            routeName: 'Rota A · Mutamba → Morro Bento',
            daysOfWeek: 'mon,tue,wed,thu,fri',
            shiftType: 'morning',
            departureTime: '06:30',
            arrivalTime: '07:30',
            active: true,
            notes: 'Recolha matinal corredor Mutamba–Kinaxixi–Morro Bento.',
            createdByUid: 'system-seed',
          },
          {
            schoolId: tripA.schoolId,
            vehicleId: busA.id,
            driverId: busA.assignedDriverId,
            routeCode: 'ROTA-A',
            routeName: 'Rota A · Morro Bento → Mutamba (Regresso)',
            daysOfWeek: 'mon,tue,wed,thu,fri',
            shiftType: 'afternoon',
            departureTime: '12:45',
            arrivalTime: '13:45',
            active: true,
            notes: 'Regresso vespertino com entrega via PIN obrigatório.',
            createdByUid: 'system-seed',
          }
        );
      }
      if (tripB?.schoolId && busB) {
        initialSchedules.push({
          schoolId: tripB.schoolId,
          vehicleId: busB.id,
          driverId: busB.assignedDriverId,
          routeCode: 'ROTA-B',
          routeName: 'Rota B · Talatona Express',
          daysOfWeek: 'mon,tue,wed,thu,fri',
          shiftType: 'morning',
          departureTime: '06:45',
          arrivalTime: '07:45',
          active: true,
          notes: 'Recolha corredor Kilamba–Belas–Maianga.',
          createdByUid: 'system-seed',
        });
      }
      if (initialSchedules.length > 0) {
        await db.insert(recurringRouteSchedules).values(initialSchedules);
      }
    }

    // One-time safe backfill so already-seeded drivers and vehicles belong to their school without overwriting later edits
    const backfillMarker = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.action, 'system.backfill_school_ownership_v1'))
      .limit(1);

    if (!backfillMarker[0]) {
      const allSchools = await db.select().from(schools).orderBy(schools.id);
      const morroBento =
        allSchools.find((s) => s.name.toLowerCase().includes('morro bento')) ?? allSchools[0] ?? null;
      const saoPaulo =
        allSchools.find((s) => s.name.toLowerCase().includes('são paulo') || s.name.toLowerCase().includes('sao paulo')) ??
        allSchools[1] ??
        morroBento;
      const talatona =
        allSchools.find((s) => s.name.toLowerCase().includes('talatona')) ?? allSchools[2] ?? morroBento;

      const plateSchoolMap = new Map<string, number | undefined>([
        ['LD-24-61-AB', morroBento?.id],
        ['LD-31-02-CK', saoPaulo?.id],
        ['LD-05-49-HM', talatona?.id],
        ['LD-22-88-PL', talatona?.id],
        ['LD-18-77-FE', morroBento?.id],
      ]);

      const driverSchoolMap = new Map<string, number | undefined>([
        ['João Mateus', morroBento?.id],
        ['Paulo Cassoma', saoPaulo?.id],
        ['Teresa Lunda', talatona?.id],
        ['Adão Bento', talatona?.id],
        ['Rosa Tchissola', morroBento?.id],
      ]);

      const existingVehicles = await db.select().from(vehicles);
      for (const v of existingVehicles) {
        const mappedSchoolId = plateSchoolMap.get(v.plate);
        if (mappedSchoolId) {
          await db
            .update(vehicles)
            .set({
              ownershipType: 'school_owned',
              assignedSchoolId: v.assignedSchoolId ?? mappedSchoolId,
            })
            .where(eq(vehicles.id, v.id));
        }
      }

      const existingDrivers = await db.select().from(drivers);
      for (const d of existingDrivers) {
        const mappedSchoolId = driverSchoolMap.get(d.fullName);
        if (mappedSchoolId && d.employerSchoolId == null) {
          await db
            .update(drivers)
            .set({
              employerType: 'school',
              employerSchoolId: mappedSchoolId,
            })
            .where(eq(drivers.id, d.id));
        }
      }

      if (talatona) {
        const rotaC = await db.select().from(routes).where(eq(routes.code, 'ROTA-C')).limit(1);
        if (rotaC[0] && rotaC[0].schoolId == null) {
          await db.update(routes).set({ schoolId: talatona.id }).where(eq(routes.id, rotaC[0].id));
        }
      }

      await db.insert(auditLogs).values({
        actorUid: 'system-migration',
        actorEmail: 'ops@mobuss.ao',
        actorRole: 'mobuss_super_admin',
        action: 'system.backfill_school_ownership_v1',
        targetEntity: 'database',
        targetId: 'drivers_vehicles',
        summary: 'Motoristas e viaturas iniciais associados às respetivas escolas.',
      });
    }
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

  await ensureInitialRoutesSeeded();
  await db.update(routes).set({ schoolId: schoolTalatona.id }).where(eq(routes.code, 'ROTA-C'));

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
        monthlyValueAoa: 402000,
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
        monthlyValueAoa: 201000,
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
        monthlyValueAoa: 525000,
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
      estimatedMonthlyAoa: 324000,
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
      estimatedMonthlyAoa: 339000,
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

  // 5. Seed drivers (linked to their employer schools)
  const insertedDrivers = await db
    .insert(drivers)
    .values([
      {
        fullName: 'João Mateus',
        phone: '+244 923 112 233',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2022-8841',
        licenceExpiry: '2028-04-15',
        employerType: 'school',
        employerSchoolId: schoolMorroBento.id,
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.9',
        tripsCompleted: 44,
        monthlyCompensationAoa: 33000,
        lastCheckInTime: '06:45',
      },
      {
        fullName: 'Paulo Cassoma',
        phone: '+244 912 334 455',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2021-4410',
        licenceExpiry: '2027-09-20',
        employerType: 'school',
        employerSchoolId: schoolSaoPaulo.id,
        engagementType: 'contractor',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.8',
        tripsCompleted: 42,
        monthlyCompensationAoa: 33000,
        lastCheckInTime: '06:50',
      },
      {
        fullName: 'Teresa Lunda',
        phone: '+244 945 667 788',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2023-1920',
        licenceExpiry: '2028-11-30',
        employerType: 'school',
        employerSchoolId: schoolTalatona.id,
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.9',
        tripsCompleted: 45,
        monthlyCompensationAoa: 33000,
        lastCheckInTime: '06:40',
      },
      {
        fullName: 'Adão Bento',
        phone: '+244 934 889 900',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2020-7712',
        licenceExpiry: '2027-02-10',
        employerType: 'school',
        employerSchoolId: schoolTalatona.id,
        engagementType: 'owner_driver',
        verificationStatus: 'verified',
        availabilityStatus: 'in_service',
        ratingAvg: '4.7',
        tripsCompleted: 40,
        monthlyCompensationAoa: 33000,
        lastCheckInTime: '06:55',
      },
      {
        fullName: 'Rosa Tchissola',
        phone: '+244 928 445 566',
        licenceCategory: 'Pesados Profissional D',
        licenceNumber: 'LD-DRV-2023-9901',
        licenceExpiry: '2028-06-18',
        employerType: 'school',
        employerSchoolId: schoolMorroBento.id,
        engagementType: 'employed',
        verificationStatus: 'verified',
        availabilityStatus: 'available',
        ratingAvg: '4.8',
        tripsCompleted: 38,
        monthlyCompensationAoa: 33000,
        lastCheckInTime: '07:00',
      },
    ])
    .returning();

  // 6. Seed vehicles (assigned & owned by their respective schools)
  const insertedVehicles = await db
    .insert(vehicles)
    .values([
      {
        fleetNumber: 12,
        plate: 'LD-24-61-AB',
        ownershipType: 'school_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[0]!.id,
        assignedSchoolId: schoolMorroBento.id,
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
        ownershipType: 'school_owned',
        ownerId: insertedOwners[1]!.id,
        assignedDriverId: insertedDrivers[1]!.id,
        assignedSchoolId: schoolSaoPaulo.id,
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
        ownershipType: 'school_owned',
        ownerId: insertedOwners[2]!.id,
        assignedDriverId: insertedDrivers[3]!.id,
        assignedSchoolId: schoolTalatona.id,
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
        ownershipType: 'school_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[2]!.id,
        assignedSchoolId: schoolTalatona.id,
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
        ownershipType: 'school_owned',
        ownerId: insertedOwners[0]!.id,
        assignedDriverId: insertedDrivers[4]!.id,
        assignedSchoolId: schoolMorroBento.id,
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

  // 8b. Seed initial recurring route schedules linked to actual schools & vehicles
  await db.insert(recurringRouteSchedules).values([
    {
      schoolId: schoolMorroBento.id,
      vehicleId: insertedVehicles[0]!.id,
      driverId: insertedDrivers[0]!.id,
      routeCode: 'ROTA-A',
      routeName: 'Rota A · Mutamba → Morro Bento',
      daysOfWeek: 'mon,tue,wed,thu,fri',
      shiftType: 'morning',
      departureTime: '06:30',
      arrivalTime: '07:30',
      active: true,
      notes: 'Recolha matinal corredor Mutamba–Kinaxixi–Morro Bento.',
      createdByUid: 'system-seed',
    },
    {
      schoolId: schoolMorroBento.id,
      vehicleId: insertedVehicles[0]!.id,
      driverId: insertedDrivers[0]!.id,
      routeCode: 'ROTA-A',
      routeName: 'Rota A · Morro Bento → Mutamba (Regresso)',
      daysOfWeek: 'mon,tue,wed,thu,fri',
      shiftType: 'afternoon',
      departureTime: '12:45',
      arrivalTime: '13:45',
      active: true,
      notes: 'Regresso vespertino com entrega via PIN obrigatório.',
      createdByUid: 'system-seed',
    },
    {
      schoolId: schoolSaoPaulo.id,
      vehicleId: insertedVehicles[1]!.id,
      driverId: insertedDrivers[1]!.id,
      routeCode: 'ROTA-B',
      routeName: 'Rota B · Talatona Express',
      daysOfWeek: 'mon,tue,wed,thu,fri',
      shiftType: 'morning',
      departureTime: '06:45',
      arrivalTime: '07:45',
      active: true,
      notes: 'Recolha corredor Kilamba–Belas–Maianga.',
      createdByUid: 'system-seed',
    },
  ]);

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
  const seedDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(invoices).values([
    {
      invoiceNumber: 'PRO-MOB-2026/8192',
      schoolId: schoolMorroBento.id,
      guardianId: insertedGuardians[0]!.id,
      studentId: insertedStudents[0]!.id,
      studentName: 'Maria Domingos',
      guardianName: 'Sra. Luísa Domingos',
      payerType: 'guardian',
      phone: '+244 923 456 789',
      description: 'Transporte escolar – mês de novembro de 2026',
      amountAoa: 3000,
      ivaPercent: 14,
      paymentMethod: 'multicaixa_express_entity',
      paymentEntity: '00845',
      paymentReferencePin: '819 204 511',
      status: 'confirmed',
      providerReference: 'CONC-00845-8192',
      fiscalStatus: 'proforma_unverified',
      dueDate: seedDueDate,
      confirmedAt: new Date(),
    },
    {
      invoiceNumber: 'PRO-MOB-2026/8195',
      schoolId: schoolMorroBento.id,
      guardianId: insertedGuardians[3]!.id,
      studentId: insertedStudents[3]!.id,
      studentName: 'Bruno Neto',
      guardianName: 'Sr. Carlos Neto',
      payerType: 'guardian',
      phone: '+244 945 678 901',
      description: 'Transporte escolar – mês de novembro de 2026',
      amountAoa: 3000,
      ivaPercent: 14,
      paymentMethod: 'multicaixa_express_entity',
      paymentEntity: '00845',
      paymentReferencePin: '819 502 330',
      status: 'pending_provider',
      providerReference: null,
      fiscalStatus: 'proforma_unverified',
      dueDate: seedDueDate,
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
