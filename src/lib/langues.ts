/** Langues nationales d'enseignement — liste de repli.
 *
 * Les écrans qui filtrent du contenu par langue (ressources, sujets
 * d'évaluation) construisent de préférence leur sélecteur à partir des langues
 * réellement enseignées dans les écoles : proposer une langue inutilisée
 * produirait du contenu invisible pour tout le monde.
 *
 * L'orthographe doit suivre celle des écoles en base ("seereer", pas "sereer").
 * Côté serveur, la comparaison passe de toute façon par `canonical_langue`,
 * qui neutralise casse, accents et variantes connues. */
export const LANGUES_NATIONALES = [
  "pulaar", "wolof", "seereer", "joola", "mandinka", "soninke", "hassaniya",
];
