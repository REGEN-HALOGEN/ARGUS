const { Client } = require('pg');

const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-east-1', 'ap-south-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ca-central-1',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'sa-east-1'
];

async function testAll() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.zizlxtsxinesdptpxamj:TronLegacy0123@${host}:6543/postgres`;
    console.log(`Trying ${region}...`);
    try {
      const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      await c.connect();
      console.log(`SUCCESS on ${region}!`);
      await c.end();
      process.exit(0);
    } catch (e: any) {
      if (!e.message.includes('Tenant or user not found')) {
         console.log(`Failed ${region} with:`, e.message);
      }
    }
  }
  console.log('Finished testing all regions.');
}
testAll();
