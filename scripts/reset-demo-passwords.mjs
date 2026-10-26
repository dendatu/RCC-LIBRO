import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
const envLines = envContent.split('\n');
const env = {};
for (const line of envLines) {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = valueParts.join('=').trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
  },
});

const demoEmails = [
  'admin@rcc.edu.ph',
  'librarian@rcc.edu.ph',
  'circ@rcc.edu.ph',
  'student@rcc.edu.ph',
  'grade6@rcc.edu.ph',
  'shs@rcc.edu.ph',
  'grad@rcc.edu.ph',
];

const newPassword = 'RccLibrary#2026';

console.log('Resetting passwords for demo accounts...\n');

// First, get all users
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

for (const email of demoEmails) {
  try {
    const user = users.find(u => u.email === email);

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      continue;
    }

    // Update the password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.log(`❌ Failed to update password for ${email}:`, updateError.message);
    } else {
      console.log(`✅ Password reset for ${email}`);
    }
  } catch (err) {
    console.log(`❌ Error processing ${email}:`, err.message);
  }
}

console.log('\nDone! You can now log in with:');
console.log('Email: any of the demo accounts above');
console.log(`Password: ${newPassword}`);
