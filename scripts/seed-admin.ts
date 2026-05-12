import { auth } from '../apps/api/src/auth';

async function seedAdmin() {
  try {
    const existingUser = await auth.api.getSession({ headers: new Headers() }).catch(() => null); // Doesn't matter, just need to check if user exists in DB

    const res = await auth.api.signUpEmail({
      body: {
        email: 'admin@argus.local',
        password: 'AdminPassword123!',
        name: 'ARGUS Admin',
      }
    });
    
    if (res?.user) {
      console.log('✅ Admin user created successfully:');
      console.log('Email: admin@argus.local');
      console.log('Password: AdminPassword123!');
    }
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Admin user already exists.');
    } else {
      console.error('Failed to create admin:', error.message);
    }
  }
}

seedAdmin();
