import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  commandes,
  devisSignes,
  dossiers,
  fichesAtelier,
  fournisseurs,
  heures,
  operateurs,
} from "@/db/schema";
import { parseFlags, STATUTS_DOSSIER, TYPES_INTERVENTION } from "@/lib/dossiers";
import { HeuresForm } from "@/components/heures-form";
import { FicheAffectation } from "@/components/fiche-affectation";
import { affectationDe, contenuDe } from "@/lib/fiches-dossier";
import { deleteHeure } from "@/app/heures/actions";
import { CommandeForm } from "@/components/commande-form";
import { CommandeEditDialog } from "@/components/commande-edit-dialog";
import { ToggleCheck } from "@/components/commande-checks";
import { articlesRecents, toggleCommandeFlag } from "@/app/commandes/actions";
import { FicheForm } from "@/components/fiche-form";
import { deleteFiche } from "@/app/fiches/actions";
import { DevisSignesSection } from "@/components/devis-signes-section";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { BlocEditable, RecapDossier } from "@/components/dossier-editable";
import { mondayIsoOf, weekLabel } from "@/lib/weeks";
import { SOUS_TYPES_BASE } from "@/lib/sous-types";
import { listerSousTypes, lireSousType } from "@/lib/sous-types-db";
import { lirePriseCotes } from "@/lib/prise-cotes-db";
import { FicheRecoupeeBouton } from "@/components/fiche-recoupee";
import { DocumentsDossier } from "@/components/documents-dossier";

// Contenu complet d'une fiche dossier (récap, blocs, travaux, devis,
// commandes, fiches, heures). Composant serveur partagé entre la page
// /dossiers/[id] et la fenêtre ouverte depuis la liste des dossiers.
export async function DossierFiche({ id }: { id: number }) {
  const [d] = await db.select().from(dossiers).where(eq(dossiers.id, id));
  if (!d) notFound();

  // Tout ce qui est rattaché au dossier, en parallèle.
  const st = await lireSousType(id).catch(() => ({
    sousType: null,
    placesAssises: null,
  }));
  const [
    cmds,
    fiches,
    hrs,
    opsRows,
    devis,
    fournRows,
    dossiersRows,
    recents,
    sousTypes,
  ] = await Promise.all([
    db.select().from(commandes).where(eq(commandes.dossierId, id)),
    db.select().from(fichesAtelier).where(eq(fichesAtelier.dossierId, id)),
    db.select().from(heures).where(eq(heures.dossierId, id)),
    db
      .select({ id: operateurs.id, nom: operateurs.nom })
      .from(operateurs)
      .where(eq(operateurs.actif, true))
      .orderBy(operateurs.nom),
    db
      .select()
      .from(devisSignes)
      .where(eq(devisSignes.dossierId, id))
      .orderBy(desc(devisSignes.id)),
    // Fournisseurs connus (annuaire catalogue) pour la liste déroulante.
    db
      .select({ nom: fournisseurs.nom })
      .from(fournisseurs)
      .orderBy(asc(fournisseurs.nom)),
    // Dossiers pour réaffecter une commande à un autre client (fenêtre modif).
    db
      .select({ id: dossiers.id, nom: dossiers.nomDossier, client: dossiers.clientNom })
      .from(dossiers)
      .orderBy(asc(dossiers.nomDossier)),
    articlesRecents(),
    listerSousTypes().catch(() => SOUS_TYPES_BASE),
  ]);
  // Prise de cotes rideaux saisie sur tablette (compteur de pièces).
  const priseCotes = await lirePriseCotes(id).catch(() => ({ pieces: [] as unknown[] }));
  const dossiersOptions = dossiersRows.map((r) => ({
    id: r.id,
    nom: r.nom.trim(),
    client: r.client?.trim() || null,
  }));

  const listeFournisseurs = fournRows.map((r) => r.nom).filter(Boolean);

  // Affectation calculée depuis les fiches atelier : total + heures par opérateur.
  const nomOp = new Map(opsRows.map((o) => [o.id, o.nom]));
  let totalPrevu = 0;
  const heuresOp = new Map<string, number>();
  for (const f of fiches) {
    const a = affectationDe(contenuDe(f.contenuJson));
    totalPrevu += a.heures;
    if (a.operateurId) {
      const nom = nomOp.get(a.operateurId) ?? `Opérateur #${a.operateurId}`;
      heuresOp.set(nom, (heuresOp.get(nom) ?? 0) + a.heures);
    }
  }
  totalPrevu = Math.round(totalPrevu * 100) / 100;
  const parOperateur = [...heuresOp.entries()];

  // Opérateurs actifs (pour la saisie) + total d'heures.
  const opsListe = opsRows.map((r) => r.nom).filter(Boolean);
  const totalHeures = hrs.reduce((s, h) => s + (h.heuresPassees ?? 0), 0);
  const totalCmd = cmds.reduce((s, c) => s + (c.montant ?? 0), 0);

  const flags = parseFlags(d.flags);
  const etapes: [string, boolean | null][] = [
    ["Devis", d.etapeDevis],
    ["Commande", d.etapeCmde],
    ["Atelier", d.etapeAtelier],
    ["Réalisé", d.etapeRealise],
  ];

  return (
    <>

      {/* Récap modifiable au clic (nom, client, tél., type) + statut / flags */}
      <div className="mt-3 flex justify-end">
        <Link
          href={`/dossiers/${d.id}/modifier`}
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          title="Formulaire complet : dates de chantier, rendez-vous, rappels"
        >
          Dates &amp; planning…
        </Link>
      </div>
      <RecapDossier
        id={d.id}
        nomDossier={d.nomDossier}
        clientNom={d.clientNom}
        telephone={d.telephone}
        typeIntervention={d.typeIntervention}
        statut={d.statut}
        flags={flags}
        statutOptions={STATUTS_DOSSIER}
      />

      {/* Infos client + dossier : un clic sur un bloc le rend modifiable */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BlocEditable
          titre="Client"
          dossierId={d.id}
          valeurs={{
            clientNom: d.clientNom ?? "",
            telephone: d.telephone ?? "",
            email: d.email ?? "",
            adresse: d.adresse ?? "",
          }}
          champs={[
            { name: "clientNom", label: "Nom" },
            { name: "telephone", label: "Téléphone", type: "tel" },
            { name: "email", label: "Email", type: "email" },
            { name: "adresse", label: "Adresse", type: "textarea", pleineLargeur: true },
          ]}
        />
        <BlocEditable
          titre="Dossier"
          dossierId={d.id}
          valeurs={{
            typeIntervention: d.typeIntervention ?? "Autre",
            sousType: st.sousType ?? "",
            placesAssises: st.placesAssises ? String(st.placesAssises) : "",
            commentaires: d.commentaires ?? "",
          }}
          champs={[
            {
              name: "typeIntervention",
              label: "Type",
              type: "select",
              options: TYPES_INTERVENTION,
            },
            { name: "sousType", label: "Réalisation", suggestions: sousTypes },
            { name: "placesAssises", label: "Places assises", type: "number" },
            {
              name: "commentaires",
              label: "Commentaires",
              type: "textarea",
              pleineLargeur: true,
            },
          ]}
          extra={
            <>
            <Info label="Ouverture" value={d.dateOuverture} />
            <Info label="Planifié" value={d.datePlanifiee} />
            <Info
              label="Semaine chantier"
              value={
                d.dateDebutChantier
                  ? weekLabel(mondayIsoOf(d.dateDebutChantier))
                  : null
              }
            />
            {d.googleEventId ? (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Agenda</dt>
                <dd className="text-emerald-700">✓ Synchronisé Google</dd>
              </div>
            ) : null}
            <Info
              label="Heures à réaliser"
              value={d.heuresARealiser ? `${d.heuresARealiser} h` : null}
            />
            </>
          }
        />
      </div>

      {/* Affectation : calculée depuis les fiches atelier (saisie sur chaque fiche) */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/20 px-4 py-2.5 text-sm">
        <span className="font-semibold">Affectation</span>
        <span>
          <strong className="tabular-nums">{String(totalPrevu).replace(".", ",")} h</strong>{" "}
          <span className="text-muted-foreground">prévues ({fiches.length} fiche{fiches.length > 1 ? "s" : ""})</span>
        </span>
        {parOperateur.length > 0 ? (
          parOperateur.map(([nom, h]) => (
            <span key={nom} className="rounded bg-background px-2 py-0.5 text-xs">
              {nom} · {String(h).replace(".", ",")} h
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Aucun opérateur affecté</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Se règle sur chaque fiche ci-dessous
        </span>
      </div>

      {/* Étapes workflow */}
      <div className="mt-4 flex flex-wrap gap-2">
        {etapes.map(([label, ok]) => (
          <span
            key={label}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              ok
                ? "bg-emerald-100 text-emerald-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {ok ? "✓" : "○"} {label}
          </span>
        ))}
      </div>

      {/* Sections rattachées */}
      <div className="mt-6 space-y-4">
        <DevisSignesSection
          dossierId={id}
          actuel={{
            clientNom: d.clientNom ?? "",
            adresse: d.adresse ?? "",
            telephone: d.telephone ?? "",
            email: d.email ?? "",
            dateDevis: d.dateDevis ?? "",
          }}
          devis={devis.map((v) => ({
            id: v.id,
            nomFichier: v.nomFichier,
            url: v.url,
            taille: v.taille,
            contentType: v.contentType,
            createdAt: v.createdAt,
          }))}
        />

        {/* Documents du dossier (module Documents) : même explorateur que la
            page /documents. */}
        <section id="documents" className="rounded-lg border">
          <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
            <span>Documents</span>
            <Link
              href={`/documents?dossier=${id}`}
              className="text-xs font-normal text-muted-foreground hover:underline"
            >
              Ouvrir dans Documents
            </Link>
          </h2>
          <div className="p-3 sm:p-4">
            <DocumentsDossier dossierId={id} />
          </div>
        </section>

        <section className="rounded-lg border">
          <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
            <span>
              Commandes fournisseur{" "}
              <span className="text-muted-foreground">({cmds.length})</span>
            </span>
            {totalCmd > 0 && (
              <span className="tabular-nums">
                {totalCmd.toFixed(2)} € au total
              </span>
            )}
          </h2>

          {/* Saisie */}
          <CommandeForm
            dossierId={id}
            defaultClient={d.clientNom}
            fournisseurs={listeFournisseurs}
            recents={recents}
          />

          {/* Lignes existantes */}
          {cmds.length === 0 ? (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              Aucune commande.
            </p>
          ) : (
            <div className="divide-y border-t">
              {cmds.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {c.designation || c.reference || "—"}
                    {c.fournisseur ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {c.fournisseur}
                      </span>
                    ) : null}
                    {c.coloris ? (
                      <span className="text-muted-foreground"> · {c.coloris}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <ToggleCheck
                      key={`cmd-${c.id}-${c.estCommande}`}
                      checked={!!c.estCommande}
                      label="Commandé"
                      onToggle={toggleCommandeFlag.bind(
                        null,
                        c.id,
                        id,
                        "estCommande"
                      )}
                    />
                    <ToggleCheck
                      key={`recu-${c.id}-${c.estRecu}`}
                      checked={!!c.estRecu}
                      label="Reçu"
                      onToggle={toggleCommandeFlag.bind(
                        null,
                        c.id,
                        id,
                        "estRecu"
                      )}
                    />
                    <span className="tabular-nums text-muted-foreground">
                      {c.qte ? `${c.qte} ${c.unite ?? ""}` : ""}
                      {c.montant ? ` · ${c.montant} €` : ""}
                    </span>
                    {/* Modifier / supprimer : fenêtre de correction */}
                    <CommandeEditDialog
                      commande={c}
                      fournisseurs={listeFournisseurs}
                      dossiers={dossiersOptions}
                      articles={recents}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border">
          <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
            <span>
              Fiches atelier{" "}
              <span className="text-muted-foreground">({fiches.length})</span>
            </span>
            <span className="flex flex-wrap items-center gap-3 text-xs font-medium">
              {/* Rideaux : cotes saisies sur tablette, puis recoupées avec le devis */}
              <Link
                href={`/dossiers/${id}/prise-cotes`}
                className="text-primary hover:underline"
                title="Saisir la prise de cotes rideaux sur tablette"
              >
                📐 Prise de cotes{priseCotes.pieces.length ? ` (${priseCotes.pieces.length})` : ""}
              </Link>
              <FicheRecoupeeBouton dossierId={id} operateurs={opsRows} />
              {fiches.length > 0 && (
                <a
                  href={`/fiche-impression/dossier/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  title="Toutes les fiches de travail du dossier, une par page"
                >
                  🖨 Imprimer toutes les fiches ↗
                </a>
              )}
            </span>
          </h2>

          {/* Saisie */}
          <FicheForm dossierId={id} defaultClient={d.clientNom} />

          {/* Lignes existantes */}
          {fiches.length === 0 ? (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              Aucune fiche.
            </p>
          ) : (
            <div className="divide-y border-t">
              {fiches.map((f) => {
                const c = contenuDe(f.contenuJson);
                const a = affectationDe(c);
                const ouvrage = c.realisation
                  ? `${c.realisation}${c.quantite && String(c.quantite) !== "1" ? ` ×${c.quantite}` : ""}`
                  : "";
                return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{f.typeIntervention}</span>
                    {ouvrage ? <span> · {ouvrage}</span> : null}
                    {f.notesLibres && !ouvrage ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {f.notesLibres}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <FicheAffectation
                      key={`${f.id}-${a.operateurId}-${a.heures}`}
                      ficheId={f.id}
                      dossierId={id}
                      operateurId={a.operateurId}
                      heures={a.heures ? String(a.heures).replace(".", ",") : ""}
                      operateurs={opsRows}
                    />
                    <Link
                      href={`/dossiers/${id}/fiche/${f.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Modifier
                    </Link>
                    <a
                      href={`/fiche-impression/${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Imprimer ↗
                    </a>
                    <form action={deleteFiche.bind(null, f.id, id)}>
                      <ConfirmDeleteButton
                        label={`Supprimer la fiche ${f.typeIntervention}`}
                        confirmation={`Supprimer la fiche « ${f.typeIntervention}${ouvrage ? ` · ${ouvrage}` : ""} » ? Son contenu sera perdu.`}
                      />
                    </form>
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border">
          <h2 className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
            <span>
              Heures <span className="text-muted-foreground">({hrs.length})</span>
            </span>
            {totalHeures > 0 && (
              <span className="tabular-nums">{totalHeures} h au total</span>
            )}
          </h2>

          {/* Saisie */}
          <HeuresForm
            dossierId={id}
            operateurs={opsListe}
            typeIntervention={d.typeIntervention}
          />

          {/* Lignes existantes */}
          {hrs.length === 0 ? (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              Aucune heure saisie.
            </p>
          ) : (
            <div className="divide-y border-t">
              {hrs.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {h.operateur}
                    {h.typeRealisation ? (
                      <span className="font-medium">
                        {" "}
                        · {h.typeRealisation}
                        {h.nombre && h.nombre > 1 ? ` ×${h.nombre}` : ""}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">
                      {" "}
                      · {h.typeTravail}
                      {h.description ? ` · ${h.description}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">
                      {dateFr(h.date)} · {h.heuresPassees} h
                    </span>
                    <form action={deleteHeure.bind(null, h.id, id)}>
                      <ConfirmDeleteButton
                        label={`Supprimer les heures de ${h.operateur} du ${dateFr(h.date)}`}
                        confirmation={`Supprimer ${h.heuresPassees} h de ${h.operateur} du ${dateFr(h.date)} ? Elles disparaîtront du rapport d'heures.`}
                      />
                    </form>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </>
  );
}

// « 2026-10-12 » → « 12/10/2026 ».
function dateFr(iso: string) {
  return iso.split("-").reverse().join("/");
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </div>
  );
}
