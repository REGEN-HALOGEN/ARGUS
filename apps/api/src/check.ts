import { getNeo4jDriver } from '@argus/graph';

async function main() {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        const res = await session.run('MATCH (n:Asset) RETURN n.type, n.name, n.tenantId LIMIT 50');
        console.log(JSON.stringify(res.records.map(r => ({ type: r.get(0), name: r.get(1), tenantId: r.get(2) })), null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        await session.close();
        process.exit(0);
    }
}
main();
