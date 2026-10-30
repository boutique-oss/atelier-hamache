// Couleur stable dérivée de l'id du dossier — « aléatoire » à l'œil mais
// toujours identique pour un même dossier, ce qui permet de distinguer les
// chantiers qui se chevauchent sur le planning.
//
// On répartit les teintes avec l'angle d'or (137.508°) pour que des ids
// proches donnent des couleurs bien différentes. Styles inline car Tailwind
// ne peut pas générer des classes de couleur dynamiques au build.
export function dossierColor(id: number): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const hue = Math.round((id * 137.508) % 360);
  return {
    backgroundColor: `hsl(${hue} 70% 90%)`,
    borderColor: `hsl(${hue} 55% 52%)`,
    color: `hsl(${hue} 65% 27%)`,
  };
}
