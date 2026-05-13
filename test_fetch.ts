async function run() {
  try {
    const res = await fetch('http://localhost:4000/api/v1/threat-actors/APT28');
    const text = await res.text();
    console.log(res.status, text);
  } catch(e) { console.error(e); }
}
run();
