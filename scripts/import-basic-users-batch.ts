import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { eq, inArray } from 'drizzle-orm';

async function importUsersBatch() {
  console.log('Starting batch user import...');
  
  const fileContent = fs.readFileSync('/tmp/users_to_import.txt', 'utf-8');
  const lines = fileContent.trim().split('\n').filter(l => l.trim());
  
  console.log(`Found ${lines.length} users to import`);
  
  const defaultPassword = 'lowfy2024';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  
  // Extrair todos os emails para verificar de uma vez
  const allEmails = lines.map(line => {
    const [email] = line.split('|');
    return email?.toLowerCase().trim();
  }).filter(Boolean);
  
  console.log(`Checking ${allEmails.length} emails against database...`);
  
  // Buscar todos os emails existentes de uma vez (em lotes de 500)
  const existingEmails = new Set<string>();
  for (let i = 0; i < allEmails.length; i += 500) {
    const batch = allEmails.slice(i, i + 500);
    const existing = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.email, batch));
    existing.forEach(e => existingEmails.add(e.email.toLowerCase()));
  }
  
  console.log(`Found ${existingEmails.size} existing emails`);
  
  // Preparar usuários para inserir
  const usersToInsert: any[] = [];
  const seenEmails = new Set<string>();
  
  for (const line of lines) {
    const [email, name, phone, cpf] = line.split('|');
    
    if (!email || !name) continue;
    
    const cleanEmail = email.toLowerCase().trim();
    
    // Pular se já existe ou já vimos
    if (existingEmails.has(cleanEmail) || seenEmails.has(cleanEmail)) {
      continue;
    }
    
    seenEmails.add(cleanEmail);
    
    const cleanPhone = phone?.replace(/\D/g, '') || null;
    const cleanCpf = cpf?.replace(/\D/g, '') || null;
    
    usersToInsert.push({
      email: cleanEmail,
      name: name.trim(),
      phone: cleanPhone,
      cpf: cleanCpf,
      passwordHash,
      accountStatus: 'active',
      subscriptionStatus: 'none',
      accessPlan: 'basic',
    });
  }
  
  console.log(`Inserting ${usersToInsert.length} new users...`);
  
  // Inserir em lotes de 100
  let imported = 0;
  let errors = 0;
  
  for (let i = 0; i < usersToInsert.length; i += 100) {
    const batch = usersToInsert.slice(i, i + 100);
    try {
      await db.insert(users).values(batch).onConflictDoNothing();
      imported += batch.length;
      console.log(`Imported ${imported}/${usersToInsert.length} users...`);
    } catch (error: any) {
      console.error(`Batch error at ${i}:`, error.message);
      errors += batch.length;
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Total emails in file: ${allEmails.length}`);
  console.log(`Already existed: ${existingEmails.size}`);
  console.log(`Imported: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log(`Default password: ${defaultPassword}`);
  
  process.exit(0);
}

importUsersBatch().catch(console.error);
