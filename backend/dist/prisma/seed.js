"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const COMPANIES = [
    {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Acme Imports',
        contactEmail: 'ops@acme.example',
        contactPhone: '+966500000000',
        city: 'Riyadh',
        country: 'SA',
    },
    {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Nahdi Pharma',
        contactEmail: 'logistics@nahdi.example',
        contactPhone: '+966512345678',
        city: 'Jeddah',
        country: 'SA',
    },
    {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Falcon Foods',
        contactEmail: 'supply@falconfoods.example',
        contactPhone: '+971501234567',
        city: 'Dubai',
        country: 'AE',
    },
    {
        id: '00000000-0000-4000-8000-000000000004',
        name: 'Desert Tech Co',
        contactEmail: 'orders@deserttech.example',
        contactPhone: '+966555000111',
        city: 'Riyadh',
        country: 'SA',
    },
    {
        id: '00000000-0000-4000-8000-000000000005',
        name: 'Riyadh Textiles',
        contactEmail: 'shipping@riyadhtextiles.example',
        contactPhone: '+966590000222',
        city: 'Riyadh',
        country: 'SA',
    },
];
const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const SUPER_ADMIN_ID = '00000000-0000-4000-8000-0000000000ab';
const CLIENT_ADMIN_ID = '00000000-0000-4000-8000-0000000000cd';
async function main() {
    for (const c of COMPANIES) {
        await prisma.company.upsert({
            where: { id: c.id },
            update: {
                name: c.name,
                contactEmail: c.contactEmail,
                contactPhone: c.contactPhone,
                city: c.city,
                country: c.country,
            },
            create: c,
        });
    }
    const defaultCompany = COMPANIES[0];
    const demoPasswordHash = '$2b$10$PB7FJt86zYMFtd1AzqVXh.rPfLkoWrUnaN6chSKbWa.8/NG0Yqcji';
    await prisma.user.upsert({
        where: { email: 'superadmin@emdad.example' },
        update: {
            id: SUPER_ADMIN_ID,
            fullName: 'Demo Super Admin',
            role: 'super_admin',
            passwordHash: demoPasswordHash,
            companyId: null,
        },
        create: {
            id: SUPER_ADMIN_ID,
            email: 'superadmin@emdad.example',
            passwordHash: demoPasswordHash,
            fullName: 'Demo Super Admin',
            role: 'super_admin',
            companyId: null,
        },
    });
    await prisma.user.upsert({
        where: { email: 'manager@emdad.example' },
        update: {
            id: USER_ID,
            fullName: 'Demo WH Manager',
            role: 'wh_manager',
            passwordHash: demoPasswordHash,
            companyId: null,
        },
        create: {
            id: USER_ID,
            email: 'manager@emdad.example',
            passwordHash: demoPasswordHash,
            fullName: 'Demo WH Manager',
            role: 'wh_manager',
            companyId: null,
        },
    });
    await prisma.user.upsert({
        where: { email: 'client@acme.example' },
        update: {
            id: CLIENT_ADMIN_ID,
            fullName: 'Acme Client Admin',
            role: 'client_admin',
            passwordHash: demoPasswordHash,
            companyId: defaultCompany.id,
            status: 'active',
        },
        create: {
            id: CLIENT_ADMIN_ID,
            email: 'client@acme.example',
            passwordHash: demoPasswordHash,
            fullName: 'Acme Client Admin',
            role: 'client_admin',
            companyId: defaultCompany.id,
            status: 'active',
        },
    });
    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'WH-001' },
        update: { name: 'Main Warehouse', city: 'Riyadh', country: 'SA' },
        create: {
            id: '00000000-0000-4000-8000-000000000010',
            name: 'Main Warehouse',
            code: 'WH-001',
            city: 'Riyadh',
            country: 'SA',
        },
    });
    const aisle = await prisma.location.upsert({
        where: { barcode: 'WH-001-A' },
        update: { type: 'iss' },
        create: {
            id: '00000000-0000-4000-8000-000000000020',
            warehouseId: warehouse.id,
            name: 'Aisle A',
            fullPath: 'WH-001/A',
            type: 'iss',
            barcode: 'WH-001-A',
        },
    });
    await prisma.location.upsert({
        where: { barcode: 'WH-001-A-01' },
        update: {},
        create: {
            id: '00000000-0000-4000-8000-000000000021',
            warehouseId: warehouse.id,
            parentId: aisle.id,
            name: 'A-01',
            fullPath: 'WH-001/A/A-01',
            type: 'internal',
            barcode: 'WH-001-A-01',
        },
    });
    console.log('\n  Seed complete.\n');
    console.log('  Internal logins (password demo123, users.company_id is always null):');
    console.log('    - superadmin@emdad.example (super_admin)');
    console.log('    - manager@emdad.example (wh_manager)');
    console.log('  Client portal (password demo123, use client-frontend app):');
    console.log('    - client@acme.example (client_admin, company: Acme Imports)');
    console.log('  Optional API tenant header: X-Company-Id=' + defaultCompany.id);
    console.log('  --------------------------------------------------');
    console.log('  Companies seeded:');
    for (const c of COMPANIES)
        console.log('   - ' + c.name + ' (' + c.id + ')');
    console.log('  Warehouse: ' + warehouse.code + ' — ' + warehouse.name);
    console.log('  Locations: WH-001/A, WH-001/A/A-01\n');
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map