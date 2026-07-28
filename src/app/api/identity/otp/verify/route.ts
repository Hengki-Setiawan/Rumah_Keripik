import { NextRequest, NextResponse } from 'next/server';
import { db, otpRequests, customerProfile, customerIdentity, customerAddress, deviceIdentityLinks } from '@/lib/db';
import { eq, and, isNull, gt, desc } from 'drizzle-orm';
import crypto from 'crypto';

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62') && cleaned.length >= 9) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, code, deviceTokenId, displayName, addressData } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json({ success: false, error: 'Nomor WhatsApp dan kode OTP wajib diisi' }, { status: 400 });
    }

    const formattedPhone = normalizePhoneNumber(phoneNumber);
    const nowIso = new Date().toISOString();

    const [activeOtp] = await db
      .select()
      .from(otpRequests)
      .where(
        and(
          eq(otpRequests.phoneNumber, formattedPhone),
          isNull(otpRequests.consumedAt),
          gt(otpRequests.expiresAt, nowIso)
        )
      )
      .orderBy(desc(otpRequests.createdAt))
      .limit(1);

    if (!activeOtp) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP tidak ditemukan atau telah kadaluarsa. Silakan minta kode baru.' },
        { status: 400 }
      );
    }

    if (activeOtp.attempts >= activeOtp.maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'Batas percobaan OTP telah terlampaui. Silakan minta kode baru.' },
        { status: 400 }
      );
    }

    const incomingHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (incomingHash !== activeOtp.codeHash) {
      await db
        .update(otpRequests)
        .set({ attempts: activeOtp.attempts + 1 })
        .where(eq(otpRequests.id, activeOtp.id));

      return NextResponse.json(
        { success: false, error: `Kode OTP salah (sisa percobaan: ${activeOtp.maxAttempts - (activeOtp.attempts + 1)})` },
        { status: 400 }
      );
    }

    // OTP Valid! Mark as consumed
    await db
      .update(otpRequests)
      .set({ consumedAt: nowIso })
      .where(eq(otpRequests.id, activeOtp.id));

    // ── IDENTITY RESOLUTION ──────────────────────────────────────────────────
    let isReturningUser = false;
    let customer: any = null;

    const [existingCustomer] = await db
      .select()
      .from(customerProfile)
      .where(eq(customerProfile.phone, formattedPhone))
      .limit(1);

    if (existingCustomer) {
      isReturningUser = true;
      customer = existingCustomer;

      if (displayName && (!customer.nama || customer.nama !== displayName)) {
        await db
          .update(customerProfile)
          .set({ nama: displayName, last_active_at: nowIso })
          .where(eq(customerProfile.id_customer, customer.id_customer));
        customer.nama = displayName;
      }
    } else {
      const newCustomerId = `CUST-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`;
      await db.insert(customerProfile).values({
        id_customer: newCustomerId,
        nama: displayName || `Pelanggan WA ${formattedPhone.slice(-4)}`,
        phone: formattedPhone,
        email: null,
        notes: 'Created via Progressive Identity OTP Verification',
        tags_json: JSON.stringify(['OTP_Verified']),
        created_at: nowIso,
        last_active_at: nowIso,
      });

      await db.insert(customerIdentity).values({
        id_customer: newCustomerId,
        provider: 'wa',
        external_id: formattedPhone,
        verified_at: nowIso,
        created_at: nowIso,
      });

      const [newCust] = await db
        .select()
        .from(customerProfile)
        .where(eq(customerProfile.id_customer, newCustomerId))
        .limit(1);
      customer = newCust;
    }

    // Link device_token to customer if deviceTokenId is present
    const deviceToken = deviceTokenId || req.cookies.get('rk_device_token')?.value;
    if (deviceToken && customer) {
      try {
        await db.insert(deviceIdentityLinks).values({
          id: `LINK-${crypto.randomUUID().slice(0, 8)}`,
          deviceTokenId: deviceToken,
          customerId: customer.id_customer,
          linkedAt: nowIso,
        });
      } catch (linkErr) {
        // Link might already exist, update link date
      }
    }

    // Save optional address if passed during Stage 2 -> Stage 3 transition
    if (addressData && addressData.addressText && customer) {
      await db.insert(customerAddress).values({
        id_customer: customer.id_customer,
        label: addressData.label || 'Utama',
        recipient_name: displayName || customer.nama || 'Pelanggan',
        phone: formattedPhone,
        address_text: addressData.addressText,
        latitude: addressData.lat ? String(addressData.lat) : null,
        longitude: addressData.lng ? String(addressData.lng) : null,
        location_source: addressData.source || 'manual',
        landmark: addressData.landmark || null,
        is_default: 1,
        last_used_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    // Retrieve all customer addresses
    const addresses = await db
      .select()
      .from(customerAddress)
      .where(eq(customerAddress.id_customer, customer.id_customer))
      .orderBy(desc(customerAddress.last_used_at));

    return NextResponse.json({
      success: true,
      isReturningUser,
      customer,
      addresses,
    });
  } catch (error: any) {
    console.error('[OTP Verify Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
