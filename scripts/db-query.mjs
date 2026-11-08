import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  limit as firestoreLimit,
  where as firestoreWhere
} from 'firebase/firestore';
import { CLI_FIREBASE_CONFIG, CLI_COLLECTIONS } from './load-env.mjs';

const app = getApps().length === 0 ? initializeApp(CLI_FIREBASE_CONFIG) : getApp();
const db = getFirestore(app);

const [,, cmdArg, extraArg] = process.argv;

if (!cmdArg) {
  console.log(`
Usage:
  node scripts/db-query.mjs "<SQL/Query>"
  node scripts/db-query.mjs list
  node scripts/db-query.mjs seed <collection> <json-string-or-file>

Examples:
  node scripts/db-query.mjs "SELECT * FROM study_rooms LIMIT 10"
  node scripts/db-query.mjs "INSERT INTO study_rooms { room: '301호', seats: 24, status: 'open' }"
  node scripts/db-query.mjs "DELETE FROM study_rooms WHERE id = 'doc_xxx'"
`);
  process.exit(0);
}

async function runCli() {
  const start = Date.now();
  const trimmed = cmdArg.trim();

  if (trimmed === 'list') {
    console.log('\n=== FIRESTORE COLLECTIONS ===');
    for (const c of CLI_COLLECTIONS.KNOWN_LIST) {
      const snap = await getDocs(query(collection(db, c), firestoreLimit(1)));
      console.log(` - ${c} (hasData: ${!snap.empty})`);
    }
    return;
  }

  if (trimmed === 'seed' && extraArg) {
    const colName = extraArg;
    const jsonInput = process.argv[4];
    console.log(`> Seeding into '${colName}'...`);
    const data = Function(`"use strict"; return (${jsonInput})`)();
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const id = item._id || item.id || `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, colName, id), item, { merge: true });
      console.log(`  + [${colName}] Added ${id}`);
    }
    console.log(`✓ Seeded ${items.length} items (${Date.now() - start}ms)`);
    return;
  }

  // 1. SELECT
  const selectMatch = trimmed.match(/^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_-]+)(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
  if (selectMatch) {
    const [, , colName, wherePart, limitPart] = selectMatch;
    let q = query(collection(db, colName), firestoreLimit(limitPart ? parseInt(limitPart, 10) : 50));
    if (wherePart) {
      const cond = wherePart.match(/([a-zA-Z0-9_]+)\s*(=|==|!=|>|<|>=|<=)\s*(.+)/);
      if (cond) {
        let cleanVal = cond[3].trim().replace(/^['"]|['"]$/g, '');
        if (!isNaN(Number(cleanVal))) cleanVal = Number(cleanVal);
        q = query(collection(db, colName), firestoreWhere(cond[1], '==', cleanVal), firestoreLimit(50));
      }
    }
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ _id: d.id, ...d.data() }));
    console.log(`\n✓ Result (${rows.length} rows, ${Date.now() - start}ms):`);
    console.table(rows);
    return;
  }

  // 2. INSERT
  const insertMatch = trimmed.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_-]+)\s+(\{[\s\S]*\})$/i);
  if (insertMatch) {
    const [, colName, jsonStr] = insertMatch;
    const data = Function(`"use strict"; return (${jsonStr})`)();
    const id = data._id || data.id || `doc_${Date.now().toString(36)}`;
    await setDoc(doc(db, colName, id), data, { merge: true });
    console.log(`\n✓ Inserted into '${colName}/${id}' (${Date.now() - start}ms)`);
    return;
  }

  // 3. DELETE
  const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_-]+)\s+WHERE\s+(?:id|_id)\s*=\s*['"]?([a-zA-Z0-9_-]+)['"]?$/i);
  if (deleteMatch) {
    const [, colName, docId] = deleteMatch;
    await deleteDoc(doc(db, colName, docId));
    console.log(`\n✓ Deleted '${colName}/${docId}' (${Date.now() - start}ms)`);
    return;
  }

  // 4. CREATE
  const createMatch = trimmed.match(/^CREATE\s+(?:COLLECTION|TABLE)\s+([a-zA-Z0-9_-]+)$/i);
  if (createMatch) {
    const colName = createMatch[1];
    await setDoc(doc(db, colName, '_init'), { created: true, createdAt: Date.now() });
    console.log(`\n✓ Created collection '${colName}' (${Date.now() - start}ms)`);
    return;
  }

  console.error('Unknown query format. Supported: SELECT, INSERT, DELETE, CREATE, seed, list');
}

runCli().then(() => process.exit(0)).catch(err => {
  console.error('Query execution error:', err);
  process.exit(1);
});
