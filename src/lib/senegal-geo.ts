/**
 * Données géographiques du Sénégal
 * 14 régions avec leurs communes / villes principales
 */

export interface RegionData {
  label: string;
  communes: string[];
}

export const SENEGAL_REGIONS: RegionData[] = [
  {
    label: "Dakar",
    communes: [
      "Dakar Plateau", "Médina", "Gueule Tapée-Fass-Colobane", "Biscuiterie",
      "Grand Dakar", "HLM", "Sicap-Liberté", "Dieuppeul-Derklé", "Fann-Point E-Amitié",
      "Mermoz-Sacré Cœur", "Ouakam", "Yoff", "Ngor", "Almadies",
      "Parcelles Assainies", "Patte d'Oie", "Cambérène", "Grand Yoff",
      "Pikine", "Guédiawaye", "Rufisque", "Bargny", "Diamniadio",
      "Sébikotane", "Sangalkam", "Tivaouane Peulh", "Malika",
      "Thiaroye-sur-Mer", "Mbao", "Keur Massar",
    ],
  },
  {
    label: "Thiès",
    communes: [
      "Thiès", "Mbour", "Tivaouane", "Joal-Fadiouth", "Popenguine",
      "Saly Portudal", "Ngaparou", "Somone", "Sindia", "Mboro",
      "Mékhé", "Pout", "Khombole", "Kayar", "Thiadiaye",
      "Ndiaganiao", "Ngéniène", "Fissel", "Ndiayène Pendao",
    ],
  },
  {
    label: "Diourbel",
    communes: [
      "Diourbel", "Touba", "Mbacké", "Bambey", "Ndoulo",
      "Ndindy", "Baba Garage", "Gawane", "Gossas",
    ],
  },
  {
    label: "Fatick",
    communes: [
      "Fatick", "Foundiougne", "Sokone", "Kaolack (frontière)", "Passy",
      "Dioffior", "Gossas", "Ndiosmone", "Toubacouta",
    ],
  },
  {
    label: "Kaolack",
    communes: [
      "Kaolack", "Nioro du Rip", "Guinguinéo", "Ndofane",
      "Kaffrine (frontière)", "Médina Baye", "Kahone", "Dya",
    ],
  },
  {
    label: "Kaffrine",
    communes: [
      "Kaffrine", "Birkelane", "Koungheul", "Malem Hodar",
      "Dinguiraye", "Gniby", "Kathiotte",
    ],
  },
  {
    label: "Louga",
    communes: [
      "Louga", "Linguère", "Kébémer", "Dahra", "Coki",
      "Thiamène", "Sakal", "Guet Ndar (frontière)",
    ],
  },
  {
    label: "Saint-Louis",
    communes: [
      "Saint-Louis", "Richard-Toll", "Dagana", "Podor",
      "Ndioum", "Rosso-Sénégal", "Galoya", "Ross-Béthio",
      "Fanaye", "Khor", "Pété",
    ],
  },
  {
    label: "Matam",
    communes: [
      "Matam", "Kanel", "Ranérou", "Ourossogui",
      "Thilogne", "Agnam-Civol", "Orkadière",
    ],
  },
  {
    label: "Tambacounda",
    communes: [
      "Tambacounda", "Bakel", "Goudiry", "Koumpentoum",
      "Kidira", "Missirah", "Sinthian",
    ],
  },
  {
    label: "Kédougou",
    communes: [
      "Kédougou", "Salémata", "Saraya", "Bandafassi",
      "Fongolimbi", "Tomboronkoto",
    ],
  },
  {
    label: "Kolda",
    communes: [
      "Kolda", "Vélingara", "Médina Yoro Foulah",
      "Pata", "Diaobé-Kabendou", "Salikégné",
    ],
  },
  {
    label: "Sédhiou",
    communes: [
      "Sédhiou", "Bounkiling", "Goudomp",
      "Bambali", "Diagné", "Marsassoum",
    ],
  },
  {
    label: "Ziguinchor",
    communes: [
      "Ziguinchor", "Bignona", "Oussouye",
      "Niaguiss", "Adéane", "Diouloulou", "Sindian",
    ],
  },
];

/** Retourne la liste des communes pour une région donnée */
export function getCommunesByRegion(regionLabel: string): string[] {
  return SENEGAL_REGIONS.find(r => r.label === regionLabel)?.communes ?? [];
}
