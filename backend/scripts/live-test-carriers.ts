import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ShippingService } from '../src/modules/shipping/shipping.service';
import { ShippingProviderRegistry } from '../src/modules/shipping/shipping-provider.registry';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EncryptionService } from '../src/common/crypto/encryption.service';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE, SENA_EXPRESS_CODE } from '../src/modules/shipping/shipping.constants';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const shippingService = app.get(ShippingService);
  const registry = app.get(ShippingProviderRegistry);
  const prisma = app.get(PrismaService);
  const encryption = app.get(EncryptionService);

  console.log('=== TESTING CARRIER CONNECTIONS & LIVE APIS ===');

  // 1. Babel Express
  try {
    console.log('\n--- 1. Testing Babel Express ---');
    const babelTest = await shippingService.testProvider(BABEL_EXPRESS_CODE);
    console.log('Babel testConnection result:', babelTest);

    // Live query trackShipment with a real AWB from DB
    const babelConn = await prisma.shippingProviderConnection.findFirst({
      where: { provider: { code: BABEL_EXPRESS_CODE } }
    });
    if (babelConn?.encryptedUsername) {
      const creds = {
        username: encryption.decrypt(babelConn.encryptedUsername),
        password: babelConn.encryptedPassword ? encryption.decrypt(babelConn.encryptedPassword) : ''
      };
      const babelAdapter = registry.get(BABEL_EXPRESS_CODE) as any;
      const awb = '260303938248'; // from recent webhook
      console.log(`Calling Babel trackShipment for AWB: ${awb}...`);
      const trackRes = await babelAdapter.http.post('trackShipment', creds, { awb });
      console.log('Babel trackShipment response keys:', Object.keys(trackRes || {}));
      if (trackRes?.tracking) {
        console.log('Tracking status:', trackRes.tracking.shipmentStatus);
        console.log('Tracking updates sample count:', trackRes.tracking.updates?.length);
        console.log('Tracking updates sample (first 3):', JSON.stringify(trackRes.tracking.updates?.slice(0, 3), null, 2));
      } else {
        console.log('trackShipment raw result:', JSON.stringify(trackRes, null, 2));
      }

      console.log('\nCalling Babel getTrackingHistory via adapter...');
      const history = await babelAdapter.getTrackingHistory(creds, awb);
      console.log('Babel getTrackingHistory summary:', {
        providerCode: history?.providerCode,
        lookupState: history?.lookupState,
        eventsCount: history?.events?.length,
        eventsSample: history?.events?.slice(0, 3)
      });
    }
  } catch (err: any) {
    console.error('Babel Express error:', err?.message || err);
  }

  // 2. Sila-SY
  try {
    console.log('\n--- 2. Testing Sila-SY ---');
    const silaTest = await shippingService.testProvider(SILA_SY_CODE);
    console.log('Sila testConnection result:', silaTest);

    const silaConn = await prisma.shippingProviderConnection.findFirst({
      where: { provider: { code: SILA_SY_CODE } }
    });
    if (silaConn?.encryptedUsername) {
      const creds = {
        username: encryption.decrypt(silaConn.encryptedUsername),
        password: silaConn.encryptedPassword ? encryption.decrypt(silaConn.encryptedPassword) : ''
      };
      const silaAdapter = registry.get(SILA_SY_CODE) as any;
      
      // Let's test GET /cargos with limit=2
      console.log('Calling Sila GET /cargos?limit=2...');
      const cargosRes = await silaAdapter.http.get('cargos?limit=2', creds.username);
      console.log('Sila cargos response data count:', cargosRes?.data?.length || (Array.isArray(cargosRes) ? cargosRes.length : 'non-array'));
      
      const sampleCargoId = cargosRes?.data?.[0]?.id || '9e4ac1c4-e4e6-41d9-8122-c066588c6cea';
      console.log(`Testing Sila GET /cargos/${sampleCargoId}...`);
      try {
        const cargoDetail = await silaAdapter.fetchCargo(creds, sampleCargoId);
        console.log('Sila cargo detail status:', cargoDetail?.status);
        console.log('Sila cargo fields:', Object.keys(cargoDetail || {}));
      } catch (e: any) {
        console.log('Sila fetchCargo error:', e?.message);
      }

      console.log(`Testing Sila GET /cargos/${sampleCargoId}/tracking...`);
      try {
        const cargoTracking = await silaAdapter.fetchCargoTracking(creds, sampleCargoId);
        console.log('Sila cargo tracking result:', JSON.stringify(cargoTracking, null, 2));
      } catch (e: any) {
        console.log('Sila fetchCargoTracking error:', e?.message);
      }

      console.log(`Testing Sila GET /cargos?updated_since=...`);
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const updated = await silaAdapter.listCargosUpdatedSince(creds, oneDayAgo, 1, 5);
        console.log('Sila listCargosUpdatedSince count:', updated?.cargos?.length);
      } catch (e: any) {
        console.log('Sila listCargosUpdatedSince error:', e?.message);
      }

      console.log('Testing Sila getTrackingHistory via adapter...');
      const silaHistory = await silaAdapter.getTrackingHistory(creds, sampleCargoId);
      console.log('Sila getTrackingHistory summary:', {
        providerCode: silaHistory?.providerCode,
        providerName: silaHistory?.providerName,
        statusLabel: silaHistory?.statusLabel,
        eventsCount: silaHistory?.events?.length,
        eventsSample: silaHistory?.events?.slice(0, 3)
      });
    }
  } catch (err: any) {
    console.error('Sila-SY error:', err?.message || err);
  }

  // 3. SENA Express
  try {
    console.log('\n--- 3. Testing SENA Express ---');
    const senaConn = await prisma.shippingProviderConnection.findFirst({
      where: { provider: { code: SENA_EXPRESS_CODE } }
    });
    console.log('SENA connection in DB:', senaConn ? { status: senaConn.status, hasUser: !!senaConn.encryptedUsername } : 'None');
    
    // Check if SENA has public or accessible status endpoints without auth or with test key
    const senaAdapter = registry.get(SENA_EXPRESS_CODE) as any;
    console.log('Checking SENA HTTP client baseURL:', senaAdapter?.http);
    
    // Test if GET /shipment-statuses works
    const apiKeyCandidates = [
      process.env.SENA_EXPRESS_API_KEY,
      process.env.SENA_API_KEY,
      'test_key'
    ].filter(Boolean);
    console.log('API key candidates available:', apiKeyCandidates.length > 0 ? 'yes' : 'none');
  } catch (err: any) {
    console.error('SENA Express error:', err?.message || err);
  }

  await app.close();
}

main().catch(console.error);
