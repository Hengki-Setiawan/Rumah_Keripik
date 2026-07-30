import { NextRequest, NextResponse } from 'next/server';
import { db, customerProfile, customerIdentity, customerAddress, deviceIdentityLinks } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function DELETE(req: NextRequest) {
  try {
    const deviceToken = req.cookies.get('rk_device_token')?.value;

    if (!deviceToken) {
      return NextResponse.json({ success: false, error: 'Sesi pelanggan tidak ditemukan' }, { status: 400 });
    }

    // Find linked customer identity via deviceToken
    const [link] = await db
      .select()
      .from(deviceIdentityLinks)
      .where(eq(deviceIdentityLinks.deviceTokenId, deviceToken))
      .limit(1);

    if (link) {
      const customerId = link.customerId;

      // Anonymize/Delete customer profile data for UU PDP compliance
      await db.delete(customerAddress).where(eq(customerAddress.id_customer, customerId));
      await db.delete(customerIdentity).where(eq(customerIdentity.id_customer, customerId));
      await db.delete(deviceIdentityLinks).where(eq(deviceIdentityLinks.customerId, customerId));

      await db
        .update(customerProfile)
        .set({
          nama: 'Pelanggan Dihapus (UU PDP)',
          phone: null,
          email: null,
          notes: 'Data dihapus atas permintaan pelanggan',
          tags_json: JSON.stringify(['DELETED_UU_PDP']),
        })
        .where(eq(customerProfile.id_customer, customerId));
    }

    const res = NextResponse.json({
      success: true,
      message: 'Data pribadi Anda telah berhasil dihapus sesuai kebijakan UU PDP.',
    });

    // Clear rk_device_token cookie
    res.cookies.set('rk_device_token', '', { path: '/', maxAge: 0 });

    return res;
  } catch (error: any) {
    console.error('[Identity Delete Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
