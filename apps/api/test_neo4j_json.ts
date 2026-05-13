import neo4j from 'neo4j-driver';
console.log(JSON.stringify({ criticality: neo4j.int(100) }));
