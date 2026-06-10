import { invalidateCache } from '@argus/cache';

async function main() {
    try {
        await invalidateCache('*');
        console.log("Cache cleared!");
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
main();
