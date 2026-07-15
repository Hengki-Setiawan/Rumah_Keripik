import { and, eq, sql } from 'drizzle-orm';
import { customerIdentity, customerProfile } from '@/lib/schema';
import { generateIdCustomer } from '@/lib/id-generator';
import { normalizePhoneNumber } from '@/lib/utils';

type DbLike = Pick<typeof import('@/lib/db').db, 'select' | 'insert' | 'update'>;

export async function resolveCustomerByPhone(
  tx: DbLike,
  input: { name: string; phone: string; source: 'web' | 'telegram'; chatId?: string; tags?: string[]; notes?: string | null; pin?: string },
) {
  const phone = normalizePhoneNumber(input.phone);
  const identityProvider = input.source === 'telegram' ? 'telegram' : 'web';
  const identityExternalId = input.source === 'telegram' && input.chatId ? `tg_${input.chatId.replace(/^tg_/, '')}` : phone;

  const [existingIdentity] = await tx
    .select({ id_customer: customerIdentity.id_customer })
    .from(customerIdentity)
    .where(and(eq(customerIdentity.provider, identityProvider), eq(customerIdentity.external_id, identityExternalId)))
    .limit(1);

  if (existingIdentity?.id_customer) {
    const updateData: Record<string, any> = { nama: input.name, phone, notes: input.notes ?? null, last_active_at: sql`(datetime('now', 'utc'))` };
    if (input.pin) updateData.pin = input.pin;
    
    await tx
      .update(customerProfile)
      .set(updateData)
      .where(eq(customerProfile.id_customer, existingIdentity.id_customer));
    return { idCustomer: existingIdentity.id_customer, phone, isNew: false };
  }

  const [existingByPhone] = await tx
    .select({ id_customer: customerProfile.id_customer })
    .from(customerProfile)
    .where(eq(customerProfile.phone, phone))
    .limit(1);

  const idCustomer = existingByPhone?.id_customer || generateIdCustomer();
  if (existingByPhone?.id_customer) {
    const updateData: Record<string, any> = { nama: input.name, phone, notes: input.notes ?? null, last_active_at: sql`(datetime('now', 'utc'))` };
    if (input.pin) updateData.pin = input.pin;

    await tx
      .update(customerProfile)
      .set(updateData)
      .where(eq(customerProfile.id_customer, idCustomer));
  } else {
    await tx.insert(customerProfile).values({
      id_customer: idCustomer,
      nama: input.name,
      phone,
      pin: input.pin || null,
      notes: input.notes ?? null,
      tags_json: JSON.stringify(input.tags || ['web-order']),
    });
  }

  await tx.insert(customerIdentity).values({
    id_customer: idCustomer,
    provider: identityProvider,
    external_id: identityExternalId,
  }).onConflictDoNothing();

  return { idCustomer, phone, isNew: !existingByPhone?.id_customer };
}
