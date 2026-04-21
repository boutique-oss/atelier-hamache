const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../data/atelier.db'));
console.log('Migration v2...');
try { db.exec('ALTER TABLE dossiers ADD COLUMN heures_a_realiser REAL DEFAULT 0'); console.log('? heures_a_realiser ajouté'); } catch { console.log('??  heures_a_realiser existe déjà'); }
db.exec('CREATE TABLE IF NOT EXISTS heures (id INTEGER PRIMARY KEY AUTOINCREMENT, dossier_id INTEGER NOT NULL, operateur TEXT NOT NULL, date TEXT NOT NULL, heures_passees REAL NOT NULL, type_travail TEXT DEFAULT "Atelier", description TEXT DEFAULT "", created_at TEXT DEFAULT (datetime("now")))');
console.log('? table heures OK');
db.exec('CREATE TABLE IF NOT EXISTS fiches_atelier (id INTEGER PRIMARY KEY AUTOINCREMENT, dossier_id INTEGER NOT NULL, type_intervention TEXT NOT NULL, contenu_json TEXT NOT NULL DEFAULT "{}", notes_libres TEXT DEFAULT "", created_at TEXT DEFAULT (datetime("now")), updated_at TEXT DEFAULT (datetime("now")))');
console.log('? table fiches_atelier OK');
db.close();
console.log('? Migration v2 terminée');
