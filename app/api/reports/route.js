import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const TAUX_HORAIRE = 55;

export async function GET() {
  const [{ rows: dossiers }, { rows: heures }, { rows: commandes }] = await Promise.all([
    sql`SELECT * FROM dossiers`,
    sql`SELECT * FROM heures`,
    sql`SELECT fournisseur, montant FROM commandes`,
  ]);

  const parseFlags = f => { try { return JSON.parse(f || '[]'); } catch { return []; } };

  const dossiersActifs = dossiers.filter(x => x.statut !== 'Clos');
  const kpi = {
    total_dossiers: dossiers.length,
    dossiers_actifs: dossiersActifs.length,
    ca_pipeline: Math.round(dossiersActifs.reduce((s, x) => s + (x.heures_a_realiser || 0), 0) * TAUX_HORAIRE),
    ca_clos: Math.round(dossiers.filter(x => x.statut === 'Clos').reduce((s, x) => s + (x.heures_a_realiser || 0), 0) * TAUX_HORAIRE),
    total_heures_prevues: Math.round(dossiers.reduce((s, x) => s + (x.heures_a_realiser || 0), 0) * 10) / 10,
    nb_urgent: dossiers.filter(x => parseFlags(x.flags).includes('Urgent')).length,
    nb_sav: dossiers.filter(x => parseFlags(x.flags).includes('SAV')).length,
    total_heures_reelles: Math.round(heures.reduce((s, x) => s + (x.heures_passees || 0), 0) * 10) / 10,
    ca_realise: Math.round(heures.reduce((s, x) => s + (x.heures_passees || 0), 0) * TAUX_HORAIRE),
    nb_operateurs: new Set(heures.map(x => x.operateur)).size,
    dossiers_avec_heures: new Set(heures.map(x => x.dossier_id)).size,
  };

  const statutOrder = ['Nouveau','Devis envoyé','Validé','En atelier','Prêt à poser','Clos'];
  const parStatutMap = {};
  dossiers.forEach(x => {
    if (!parStatutMap[x.statut]) parStatutMap[x.statut] = { statut: x.statut, nb: 0, heures_prevues: 0 };
    parStatutMap[x.statut].nb++;
    parStatutMap[x.statut].heures_prevues += x.heures_a_realiser || 0;
  });
  const parStatut = Object.values(parStatutMap)
    .map(s => ({ ...s, heures_prevues: Math.round(s.heures_prevues * 10) / 10 }))
    .sort((a, b) => (statutOrder.indexOf(a.statut) + 1 || 99) - (statutOrder.indexOf(b.statut) + 1 || 99));

  const parTypeMap = {};
  dossiers.forEach(x => {
    const t = x.type_intervention || 'Autre';
    if (!parTypeMap[t]) parTypeMap[t] = { type_intervention: t, nb: 0 };
    parTypeMap[t].nb++;
  });
  const parType = Object.values(parTypeMap).sort((a, b) => b.nb - a.nb);

  const heuresByDossier = {};
  heures.forEach(x => {
    heuresByDossier[x.dossier_id] = (heuresByDossier[x.dossier_id] || 0) + (x.heures_passees || 0);
  });
  const heuresComparaison = dossiers.filter(x => x.statut !== 'Clos').map(x => {
    const prevues = x.heures_a_realiser || 0;
    const reelles = Math.round((heuresByDossier[x.id] || 0) * 100) / 100;
    return { id: x.id, ref_dossier: x.nom_dossier, nom_client: x.client_nom, statut: x.statut, type_intervention: x.type_intervention, prevues, reelles, ecart: Math.round((reelles - prevues) * 100) / 100, ca_prevu: Math.round(prevues * TAUX_HORAIRE), ca_reel: Math.round(reelles * TAUX_HORAIRE) };
  }).filter(x => x.prevues > 0 || x.reelles > 0).sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart)).slice(0, 20);

  const opsMap = {};
  heures.forEach(x => {
    if (!opsMap[x.operateur]) opsMap[x.operateur] = { operateur: x.operateur, total: 0, nb_saisies: 0, nb_dossiers: new Set(), derniere_saisie: '' };
    opsMap[x.operateur].total += x.heures_passees || 0;
    opsMap[x.operateur].nb_saisies++;
    opsMap[x.operateur].nb_dossiers.add(x.dossier_id);
    if (x.date > opsMap[x.operateur].derniere_saisie) opsMap[x.operateur].derniere_saisie = x.date;
  });
  const heuresParOp = Object.values(opsMap).map(o => ({ operateur: o.operateur, total: Math.round(o.total * 10) / 10, nb_saisies: o.nb_saisies, nb_dossiers: o.nb_dossiers.size, derniere_saisie: o.derniere_saisie })).sort((a, b) => b.total - a.total);

  const fournMap = {};
  commandes.forEach(x => {
    if (!fournMap[x.fournisseur]) fournMap[x.fournisseur] = { fournisseur: x.fournisseur, nb_cmd: 0, total_ht: 0 };
    fournMap[x.fournisseur].nb_cmd++;
    fournMap[x.fournisseur].total_ht += x.montant || 0;
  });
  const topFournisseurs = Object.values(fournMap).sort((a, b) => b.nb_cmd - a.nb_cmd).slice(0, 10).map(f => ({ ...f, total_ht: Math.round(f.total_ht * 100) / 100 }));

  const moisMap = {};
  dossiers.filter(x => x.date_ouverture).forEach(x => {
    const mois = x.date_ouverture.slice(0, 7);
    if (!moisMap[mois]) moisMap[mois] = { mois, nb: 0 };
    moisMap[mois].nb++;
  });
  const caMensuel = Object.values(moisMap).sort((a, b) => b.mois.localeCompare(a.mois)).slice(0, 12);

  return NextResponse.json({ kpi, parStatut, parType, heuresComparaison, heuresParOp, topFournisseurs, caMensuel });
}
