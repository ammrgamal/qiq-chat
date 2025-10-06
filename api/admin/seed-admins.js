// seed-admins.js - idempotent seeding of admin users based on env AUTO_ADMIN_EMAILS
import { userStorage, activityStorage } from '../storage/quotations.js';

export async function seedAdmins(logger = console){
  try {
    const raw = process.env.AUTO_ADMIN_EMAILS || '';
    if (!raw.trim()) return { seeded: 0, emails: [] };
    const emails = raw.split(/[,;\s]+/).map(e=>e.trim().toLowerCase()).filter(e=>/^[^@]+@[^@]+\.[^@]+$/.test(e));
    let seeded = 0;
    for (const email of emails){
      const existing = await userStorage.getByEmail(email);
      if (existing && existing.role === 'admin') continue;
      const record = existing ? { ...existing } : { email };
      record.role = 'admin';
      record.verified = true;
      record.systemSeeded = true;
      await userStorage.save(record);
      await activityStorage.log({ userEmail: email, action: 'admin_seed', details: { via: 'AUTO_ADMIN_EMAILS' } });
      seeded++;
    }
    if (seeded && logger.info) logger.info(`[admin-seed] Seeded/updated ${seeded} admin user(s)`);
    return { seeded, emails };
  } catch (e){
    if (logger.error) logger.error('[admin-seed] failed', e);
    return { seeded: 0, error: e.message };
  }
}

export default seedAdmins;