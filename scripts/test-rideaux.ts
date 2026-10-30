// Tests unitaires du calcul rideaux (sans dépendance) : npx tsx scripts/test-rideaux.ts
import assert from "node:assert/strict";
import { calc, clone, newLigne, PARAMS_DEF, type LigneRideau } from "../lib/rideaux/calcul";

const P = { ...clone(PARAMS_DEF), demiLe: false };
const base = (): LigneRideau => ({
  ...newLigne(1, P), panneaux: 2, tringle: 180, debord: 10, hauteur: 225, tombe: "libre",
  laize: 138, raccord: 64, ampleur: 2, doublure: "aucune",
});
let ok = 0;
const t = (nom: string, f: () => void) => { f(); ok++; console.log("✓ " + nom); };

t("base", () => {
  const r = calc(base(), P);
  assert.equal(r.hCoupe, 320);
  assert.equal(r.lTot, 420);
  assert.equal(r.lesBrut.toFixed(3), "3.043");
  assert.equal(r.nLes, 3);
  assert.equal(r.metrage, 960);
  assert.equal(r.ampReelle.toFixed(2), "1.97");
  assert.equal(r.warn.length, 2);
});
t("raccord simple", () => {
  const r = calc(base(), { ...P, raccordM: "simple" });
  assert.equal(r.metrageBrut, 981);
  assert.equal(r.metrage, 990);
});
t("coupe en travers", () => {
  const r = calc({ ...base(), travers: true, laize: 300, raccord: 0 }, P);
  assert.equal(r.mode, "travers");
  assert.equal(r.metrage, 420);
});
t("champs vides", () => assert.equal(calc({ ...base(), tringle: "", hauteur: "" }, P).invalid, true));
t("laize 0", () => assert.equal(calc({ ...base(), laize: 0 }, P).invalid, true));
t("fenêtre très étroite", () => {
  const r = calc({ ...base(), tringle: 5, debord: 0, panneaux: 1 }, P);
  assert.equal(r.nLes, 1);
  assert.ok(r.ht > 0);
});
console.log(`${ok} tests OK`);
