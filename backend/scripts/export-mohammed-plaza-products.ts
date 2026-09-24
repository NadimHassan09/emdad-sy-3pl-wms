import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching company Mohammed Plaza...');
  
  // Find the company
  const company = await prisma.company.findFirst({
    where: {
      name: {
        contains: 'Mohammed Plaza',
        mode: 'insensitive'
      }
    }
  });

  if (!company) {
    console.error('Company Mohammed Plaza not found.');
    process.exit(1);
  }

  console.log(`Found company: ${company.name} (ID: ${company.id})`);
  
  console.log('Fetching products...');
  // Fetch products for this company
  const products = await prisma.product.findMany({
    where: {
      companyId: company.id
    },
    select: {
      name: true,
      sku: true,
      barcode: true,
      status: true
    }
  });

  console.log(`Found ${products.length} products.`);

  if (products.length === 0) {
    console.log('No products found to export.');
    process.exit(0);
  }

  // Create Excel file
  const worksheet = xlsx.utils.json_to_sheet(products);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');

  const fileName = `Mohammed_Plaza_Products_${new Date().toISOString().split('T')[0]}.xlsx`;
  const exportPath = path.join(process.cwd(), fileName);
  
  xlsx.writeFile(workbook, exportPath);
  
  console.log(`Successfully exported products to ${exportPath}`);
}

main()
  .catch((e) => {
    console.error('Error exporting products:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
