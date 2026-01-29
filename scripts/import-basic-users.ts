import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { eq } from 'drizzle-orm';

async function importUsers() {
  console.log('Starting user import...');
  
  const fileContent = fs.readFileSync('/tmp/users_to_import.txt', 'utf-8');
  const lines = fileContent.trim().split('\n');
  
  console.log(`Found ${lines.length} users to import`);
  
  const defaultPassword = 'lowfy2024';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const line of lines) {
    const [email, name, phone, cpf] = line.split('|');
    
    if (!email || !name) {
      console.log(`Skipping invalid line: ${line}`);
      skipped++;
      continue;
    }
    
    try {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);
      
      if (existing) {
        console.log(`User already exists: ${email}`);
        skipped++;
        continue;
      }
      
      const cleanPhone = phone?.replace(/\D/g, '') || null;
      const cleanCpf = cpf?.replace(/\D/g, '') || null;
      
      await db.insert(users).values({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phone: cleanPhone,
        cpf: cleanCpf,
        passwordHash,
        accountStatus: 'active',
        subscriptionStatus: 'none',
        accessPlan: 'basic',
      });
      
      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} users...`);
      }
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        console.log(`Duplicate: ${email}`);
        skipped++;
      } else {
        console.error(`Error importing ${email}:`, error.message);
        errors++;
      }
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (existing/duplicate): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Default password: ${defaultPassword}`);
  
  process.exit(0);
}

importUsers().catch(console.error);
