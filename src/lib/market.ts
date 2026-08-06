// Référentiel de prix au m² — ordres de grandeur indicatifs (courant 2025),
// à usage pédagogique uniquement. Ce n'est PAS un flux de données en temps réel :
// toujours le présenter comme une estimation à vérifier (DVF, notaire, agences locales).
//
// Trois niveaux de précision, du plus fin au plus large :
// 1. Arrondissement (Paris, Lyon, Marseille) — déduit directement du code postal
//    (75001-75020, 69001-69009, 13001-13016), qui encode l'arrondissement lui-même :
//    le prix peut varier du simple au triple d'un arrondissement à l'autre.
// 2. Ville précise — près de 300 communes référencées individuellement (toutes les
//    préfectures de département + les principales villes moyennes de chaque région).
// 3. Département (via le code postal) — filet de sécurité pour TOUTE commune française
//    non listée individuellement : garantit qu'une comparaison reste possible partout.

export interface CityMarket {
  city: string;
  pricePerSqm: number; // €/m², appartement ancien, ordre de grandeur
  tension: "faible" | "modérée" | "forte" | "très forte"; // tension locative estimée
}

const RAW_CITIES: [string, number, CityMarket["tension"]][] = [
  // Île-de-France
  ["Paris", 9600, "très forte"],
  ["Boulogne-Billancourt", 8600, "très forte"],
  ["Versailles", 6900, "forte"],
  ["Neuilly-sur-Seine", 10200, "très forte"],
  ["Levallois-Perret", 8300, "forte"],
  ["Montreuil", 5400, "forte"],
  ["Saint-Denis", 4100, "forte"],
  ["Nanterre", 4700, "forte"],
  ["Argenteuil", 3300, "modérée"],
  ["Cergy", 3300, "forte"],
  ["Pontoise", 2900, "modérée"],
  ["Évry-Courcouronnes", 2900, "forte"],
  ["Meaux", 2600, "modérée"],
  ["Melun", 2900, "modérée"],
  ["Fontainebleau", 3900, "modérée"],
  ["Rambouillet", 3600, "modérée"],
  ["Mantes-la-Jolie", 2500, "modérée"],
  ["Saint-Germain-en-Laye", 6700, "forte"],
  ["Sartrouville", 3900, "forte"],
  ["Poissy", 4000, "forte"],
  ["Créteil", 3900, "forte"],
  ["Vincennes", 8500, "très forte"],
  ["Fontenay-sous-Bois", 5700, "forte"],
  ["Antony", 5800, "forte"],
  ["Vitry-sur-Seine", 4400, "forte"],
  // Auvergne-Rhône-Alpes
  ["Chamonix-Mont-Blanc", 7000, "forte"],
  ["Megève", 9000, "modérée"],
  ["Annecy", 5500, "très forte"],
  ["Annemasse", 4700, "forte"],
  ["Thonon-les-Bains", 3900, "modérée"],
  ["Évian-les-Bains", 4700, "modérée"],
  ["Cluses", 2400, "modérée"],
  ["Sallanches", 3200, "modérée"],
  ["Aix-les-Bains", 3600, "modérée"],
  ["Albertville", 2600, "modérée"],
  ["Chambéry", 3200, "modérée"],
  ["Bourg-en-Bresse", 2000, "modérée"],
  ["Oyonnax", 1200, "faible"],
  ["Grenoble", 2900, "forte"],
  ["Voiron", 2100, "modérée"],
  ["Bourgoin-Jallieu", 2100, "modérée"],
  ["Vienne", 2200, "modérée"],
  ["Romans-sur-Isère", 1600, "faible"],
  ["Valence", 2100, "modérée"],
  ["Montélimar", 1900, "modérée"],
  ["Lyon", 4700, "très forte"],
  ["Villeurbanne", 4000, "forte"],
  ["Villefranche-sur-Saône", 2300, "modérée"],
  ["Chalon-sur-Saône", 1700, "modérée"],
  ["Mâcon", 1900, "modérée"],
  ["Roanne", 1300, "faible"],
  ["Saint-Étienne", 1300, "faible"],
  ["Issoire", 1500, "faible"],
  ["Riom", 1900, "modérée"],
  ["Thiers", 1100, "faible"],
  ["Montluçon", 1000, "faible"],
  ["Vichy", 1400, "faible"],
  ["Moulins", 1200, "faible"],
  ["Aurillac", 1300, "faible"],
  ["Le Puy-en-Velay", 1400, "faible"],
  ["Privas", 1500, "faible"],
  ["Annonay", 1300, "faible"],
  ["Aubenas", 1500, "modérée"],
  ["Clermont-Ferrand", 2200, "modérée"],
  ["Gap", 2300, "modérée"],
  ["Briançon", 3300, "modérée"],
  ["Digne-les-Bains", 1900, "modérée"],
  ["Manosque", 2400, "modérée"],
  ["Sisteron", 1800, "faible"],
  // Grand Est
  ["Strasbourg", 3100, "forte"],
  ["Mulhouse", 1300, "faible"],
  ["Colmar", 2600, "modérée"],
  ["Metz", 2000, "modérée"],
  ["Nancy", 2400, "modérée"],
  ["Épinal", 1300, "faible"],
  ["Reims", 2400, "modérée"],
  ["Châlons-en-Champagne", 1700, "faible"],
  ["Troyes", 1700, "faible"],
  ["Chaumont", 1100, "faible"],
  ["Charleville-Mézières", 1300, "faible"],
  ["Sedan", 1000, "faible"],
  ["Bar-le-Duc", 1000, "faible"],
  ["Verdun", 1100, "faible"],
  ["Thionville", 2200, "modérée"],
  ["Forbach", 1200, "faible"],
  ["Sarreguemines", 1300, "faible"],
  ["Saverne", 2100, "modérée"],
  ["Haguenau", 2400, "modérée"],
  ["Sélestat", 2300, "modérée"],
  ["Belfort", 1500, "faible"],
  ["Montbéliard", 1300, "faible"],
  // Hauts-de-France
  ["Lille", 3200, "forte"],
  ["Roubaix", 1900, "modérée"],
  ["Tourcoing", 2100, "modérée"],
  ["Villeneuve-d'Ascq", 3100, "forte"],
  ["Dunkerque", 1900, "faible"],
  ["Calais", 1500, "faible"],
  ["Boulogne-sur-Mer", 1800, "modérée"],
  ["Saint-Omer", 1900, "faible"],
  ["Arras", 2000, "modérée"],
  ["Béthune", 1500, "faible"],
  ["Douai", 1500, "faible"],
  ["Valenciennes", 1400, "faible"],
  ["Maubeuge", 1100, "faible"],
  ["Cambrai", 1500, "faible"],
  ["Amiens", 2100, "modérée"],
  ["Abbeville", 1400, "faible"],
  ["Beauvais", 1900, "faible"],
  ["Compiègne", 2300, "modérée"],
  ["Creil", 1800, "modérée"],
  ["Laon", 1300, "faible"],
  ["Saint-Quentin", 1200, "faible"],
  ["Soissons", 1500, "faible"],
  // Normandie
  ["Rouen", 2400, "modérée"],
  ["Le Havre", 1900, "modérée"],
  ["Évreux", 2000, "modérée"],
  ["Caen", 2700, "modérée"],
  ["Cherbourg-en-Cotentin", 1600, "faible"],
  ["Saint-Lô", 1500, "faible"],
  ["Avranches", 1450, "modérée"],
  ["Granville", 2400, "modérée"],
  ["Coutances", 1400, "faible"],
  ["Mortain-Bocage", 1000, "faible"],
  ["Villedieu-les-Poêles-Rouffigny", 1300, "faible"],
  ["Alençon", 1300, "faible"],
  ["Argentan", 1100, "faible"],
  ["Flers", 1200, "faible"],
  ["Lisieux", 1700, "modérée"],
  ["Bayeux", 3100, "modérée"],
  ["Dieppe", 2200, "modérée"],
  // Bretagne
  ["Rennes", 3400, "très forte"],
  ["Saint-Malo", 4300, "forte"],
  ["Fougères", 1500, "faible"],
  ["Saint-Brieuc", 1900, "modérée"],
  ["Lannion", 2200, "modérée"],
  ["Dinan", 2300, "modérée"],
  ["Brest", 2000, "modérée"],
  ["Quimper", 1900, "faible"],
  ["Concarneau", 2800, "modérée"],
  ["Morlaix", 1600, "faible"],
  ["Lorient", 2700, "modérée"],
  ["Vannes", 3400, "forte"],
  ["Pontivy", 1400, "faible"],
  ["Lanester", 2100, "modérée"],
  // Pays de la Loire
  ["Nantes", 3600, "très forte"],
  ["Saint-Nazaire", 2400, "modérée"],
  ["Angers", 2700, "forte"],
  ["Cholet", 1700, "faible"],
  ["Saumur", 1700, "modérée"],
  ["Le Mans", 1800, "faible"],
  ["Laval", 1500, "modérée"],
  ["La Roche-sur-Yon", 2100, "modérée"],
  ["Les Sables-d'Olonne", 4000, "modérée"],
  ["Challans", 2400, "modérée"],
  // Centre-Val de Loire
  ["Tours", 2600, "modérée"],
  ["Orléans", 2400, "modérée"],
  ["Chartres", 2100, "modérée"],
  ["Bourges", 1500, "faible"],
  ["Châteauroux", 1200, "faible"],
  ["Blois", 1700, "modérée"],
  ["Vierzon", 900, "faible"],
  // Bourgogne-Franche-Comté
  ["Dijon", 2600, "modérée"],
  ["Besançon", 2100, "modérée"],
  ["Nevers", 1100, "faible"],
  ["Auxerre", 1600, "modérée"],
  ["Sens", 1500, "faible"],
  ["Lons-le-Saunier", 1700, "modérée"],
  ["Dole", 1500, "faible"],
  ["Vesoul", 1200, "faible"],
  ["Beaune", 3100, "modérée"],
  // Nouvelle-Aquitaine
  ["Poitiers", 2100, "modérée"],
  ["Niort", 1900, "modérée"],
  ["La Rochelle", 4200, "forte"],
  ["Rochefort", 2400, "modérée"],
  ["Saintes", 1700, "faible"],
  ["Angoulême", 1600, "faible"],
  ["Cognac", 1500, "faible"],
  ["Limoges", 1500, "faible"],
  ["Brive-la-Gaillarde", 1500, "modérée"],
  ["Tulle", 1200, "faible"],
  ["Guéret", 900, "faible"],
  ["Périgueux", 1700, "modérée"],
  ["Bergerac", 1500, "modérée"],
  ["Bordeaux", 4300, "très forte"],
  ["Mérignac", 3600, "forte"],
  ["Pessac", 3900, "forte"],
  ["Talence", 4200, "forte"],
  ["Arcachon", 6500, "modérée"],
  ["Libourne", 2400, "modérée"],
  ["Pau", 2200, "modérée"],
  ["Bayonne", 4800, "forte"],
  ["Biarritz", 6500, "forte"],
  ["Anglet", 5300, "forte"],
  ["Saint-Jean-de-Luz", 6800, "modérée"],
  ["Agen", 1500, "faible"],
  ["Villeneuve-sur-Lot", 1400, "faible"],
  ["Mont-de-Marsan", 1700, "modérée"],
  ["Dax", 2400, "modérée"],
  // Occitanie
  ["Toulouse", 3400, "très forte"],
  ["Montauban", 1900, "modérée"],
  ["Albi", 1700, "faible"],
  ["Castres", 1500, "faible"],
  ["Carcassonne", 1500, "faible"],
  ["Narbonne", 2100, "modérée"],
  ["Perpignan", 1900, "modérée"],
  ["Foix", 1400, "faible"],
  ["Rodez", 1500, "faible"],
  ["Millau", 1300, "faible"],
  ["Auch", 1500, "faible"],
  ["Cahors", 1600, "faible"],
  ["Montpellier", 3300, "très forte"],
  ["Béziers", 1600, "faible"],
  ["Sète", 3300, "modérée"],
  ["Agde", 3100, "modérée"],
  ["Nîmes", 2200, "modérée"],
  ["Alès", 1400, "faible"],
  ["Bagnols-sur-Cèze", 1700, "faible"],
  ["Uzès", 3100, "modérée"],
  ["Mende", 1400, "faible"],
  ["Tarbes", 1500, "modérée"],
  ["Lourdes", 1600, "faible"],
  // Provence-Alpes-Côte d'Azur
  ["Avignon", 2500, "modérée"],
  ["Orange", 1900, "modérée"],
  ["Carpentras", 2000, "modérée"],
  ["Cavaillon", 1900, "modérée"],
  ["Apt", 2200, "modérée"],
  ["Arles", 2300, "modérée"],
  ["Aix-en-Provence", 4900, "forte"],
  ["Salon-de-Provence", 2400, "modérée"],
  ["Martigues", 2500, "modérée"],
  ["Istres", 2100, "modérée"],
  ["Fos-sur-Mer", 2200, "modérée"],
  ["Vitrolles", 2100, "modérée"],
  ["Marseille", 3300, "très forte"],
  ["Aubagne", 3200, "modérée"],
  ["La Ciotat", 4400, "modérée"],
  ["Toulon", 3100, "forte"],
  ["La Seyne-sur-Mer", 2800, "modérée"],
  ["Hyères", 3600, "modérée"],
  ["Six-Fours-les-Plages", 3700, "modérée"],
  ["Sanary-sur-Mer", 4600, "modérée"],
  ["Bandol", 5200, "modérée"],
  ["Brignoles", 2100, "modérée"],
  ["Draguignan", 2400, "modérée"],
  ["Fréjus", 3900, "modérée"],
  ["Saint-Raphaël", 4300, "modérée"],
  ["Cannes", 5500, "forte"],
  ["Antibes", 4900, "forte"],
  ["Grasse", 2900, "modérée"],
  ["Vence", 4300, "modérée"],
  ["Vallauris", 3700, "modérée"],
  ["Mandelieu-la-Napoule", 4700, "modérée"],
  ["Nice", 4700, "très forte"],
  ["Menton", 4500, "modérée"],
  // Corse
  ["Ajaccio", 4300, "modérée"],
  ["Bastia", 3200, "modérée"],
  ["Porto-Vecchio", 5200, "faible"],
  ["Calvi", 5800, "faible"],
  ["Corte", 2000, "faible"],
  // Normandie / villes balnéaires
  ["Deauville", 5500, "modérée"],
  ["Dinard", 3900, "modérée"],
  // DOM
  ["Pointe-à-Pitre", 2200, "modérée"],
  ["Fort-de-France", 2500, "modérée"],
  ["Cayenne", 1900, "modérée"],
  ["Saint-Denis (La Réunion)", 2700, "forte"],
  ["Saint-Pierre (La Réunion)", 2600, "modérée"],
  ["Mamoudzou", 1700, "modérée"],
];

// Prix moyen indicatif au m² par département (appartement ancien), ordre de grandeur.
// Sert de repli quand la commune n'est ni une des ~300 villes ci-dessus ni un des
// arrondissements de Paris/Lyon/Marseille : garantit une comparaison pour TOUTE adresse
// française dès qu'un code postal est renseigné.
const DEPARTMENTS: Record<string, [string, number]> = {
  "01": ["Ain", 2600], "02": ["Aisne", 1300], "03": ["Allier", 1200], "04": ["Alpes-de-Haute-Provence", 2100],
  "05": ["Hautes-Alpes", 2600], "06": ["Alpes-Maritimes", 4900], "07": ["Ardèche", 1900], "08": ["Ardennes", 1300],
  "09": ["Ariège", 1300], "10": ["Aube", 1700], "11": ["Aude", 1700], "12": ["Aveyron", 1400],
  "13": ["Bouches-du-Rhône", 3300], "14": ["Calvados", 2600], "15": ["Cantal", 1100], "16": ["Charente", 1500],
  "17": ["Charente-Maritime", 3300], "18": ["Cher", 1300], "19": ["Corrèze", 1300], "21": ["Côte-d'Or", 2500],
  "22": ["Côtes-d'Armor", 2100], "23": ["Creuse", 800], "24": ["Dordogne", 1600], "25": ["Doubs", 2200],
  "26": ["Drôme", 2200], "27": ["Eure", 2100], "28": ["Eure-et-Loir", 1900], "29": ["Finistère", 2200],
  "2A": ["Corse-du-Sud", 3400], "2B": ["Haute-Corse", 2800],
  "30": ["Gard", 2200], "31": ["Haute-Garonne", 3300], "32": ["Gers", 1300], "33": ["Gironde", 3600],
  "34": ["Hérault", 3000], "35": ["Ille-et-Vilaine", 3300], "36": ["Indre", 1000], "37": ["Indre-et-Loire", 2400],
  "38": ["Isère", 2700], "39": ["Jura", 1500], "40": ["Landes", 2600], "41": ["Loir-et-Cher", 1500],
  "42": ["Loire", 1600], "43": ["Haute-Loire", 1400], "44": ["Loire-Atlantique", 3400], "45": ["Loiret", 2200],
  "46": ["Lot", 1500], "47": ["Lot-et-Garonne", 1500], "48": ["Lozère", 1100], "49": ["Maine-et-Loire", 2400],
  "50": ["Manche", 1500], "51": ["Marne", 2300], "52": ["Haute-Marne", 1100], "53": ["Mayenne", 1300],
  "54": ["Meurthe-et-Moselle", 2000], "55": ["Meuse", 1000], "56": ["Morbihan", 2800], "57": ["Moselle", 2000],
  "58": ["Nièvre", 1000], "59": ["Nord", 2600], "60": ["Oise", 2300], "61": ["Orne", 1200],
  "62": ["Pas-de-Calais", 1900], "63": ["Puy-de-Dôme", 2100], "64": ["Pyrénées-Atlantiques", 3200],
  "65": ["Hautes-Pyrénées", 1500], "66": ["Pyrénées-Orientales", 2000], "67": ["Bas-Rhin", 3000],
  "68": ["Haut-Rhin", 2400], "69": ["Rhône", 4200], "70": ["Haute-Saône", 1100], "71": ["Saône-et-Loire", 1500],
  "72": ["Sarthe", 1700], "73": ["Savoie", 3800], "74": ["Haute-Savoie", 4800], "75": ["Paris", 9600],
  "76": ["Seine-Maritime", 2300], "77": ["Seine-et-Marne", 2800], "78": ["Yvelines", 4200], "79": ["Deux-Sèvres", 1500],
  "80": ["Somme", 1900], "81": ["Tarn", 1600], "82": ["Tarn-et-Garonne", 1700], "83": ["Var", 3600],
  "84": ["Vaucluse", 2400], "85": ["Vendée", 2600], "86": ["Vienne", 1800], "87": ["Haute-Vienne", 1500],
  "88": ["Vosges", 1200], "89": ["Yonne", 1400], "90": ["Territoire de Belfort", 1500], "91": ["Essonne", 3000],
  "92": ["Hauts-de-Seine", 6800], "93": ["Seine-Saint-Denis", 3600], "94": ["Val-de-Marne", 4600],
  "95": ["Val-d'Oise", 2900],
  "971": ["Guadeloupe", 2200], "972": ["Martinique", 2400], "973": ["Guyane", 1900], "974": ["La Réunion", 2700],
  "976": ["Mayotte", 1600],
};

// Précision maximale : prix par arrondissement pour Paris, Lyon et Marseille, déduit du
// code postal (qui encode directement l'arrondissement dans ces trois villes — pas une
// estimation, une lecture directe). L'écart intra-urbain y est considérable.
const ARRONDISSEMENTS: Record<string, [string, number, CityMarket["tension"]]> = {
  "75001": ["Paris 1er", 12800, "très forte"], "75002": ["Paris 2e", 11500, "très forte"],
  "75003": ["Paris 3e", 12300, "très forte"], "75004": ["Paris 4e", 12800, "très forte"],
  "75005": ["Paris 5e", 11900, "très forte"], "75006": ["Paris 6e", 13800, "très forte"],
  "75007": ["Paris 7e", 13600, "très forte"], "75008": ["Paris 8e", 11200, "très forte"],
  "75009": ["Paris 9e", 10600, "très forte"], "75010": ["Paris 10e", 9700, "très forte"],
  "75011": ["Paris 11e", 9800, "très forte"], "75012": ["Paris 12e", 9300, "très forte"],
  "75013": ["Paris 13e", 8900, "très forte"], "75014": ["Paris 14e", 9600, "très forte"],
  "75015": ["Paris 15e", 9800, "très forte"], "75016": ["Paris 16e", 10800, "très forte"],
  "75017": ["Paris 17e", 9800, "très forte"], "75018": ["Paris 18e", 8900, "très forte"],
  "75019": ["Paris 19e", 7900, "très forte"], "75020": ["Paris 20e", 8300, "très forte"],
  "69001": ["Lyon 1er", 5100, "très forte"], "69002": ["Lyon 2e", 5300, "très forte"],
  "69003": ["Lyon 3e", 4300, "forte"], "69004": ["Lyon 4e (Croix-Rousse)", 4900, "forte"],
  "69005": ["Lyon 5e (Vieux Lyon)", 4600, "forte"], "69006": ["Lyon 6e", 5600, "très forte"],
  "69007": ["Lyon 7e", 4200, "forte"], "69008": ["Lyon 8e", 3800, "forte"], "69009": ["Lyon 9e", 3900, "forte"],
  "13001": ["Marseille 1er", 2700, "modérée"], "13002": ["Marseille 2e", 2800, "modérée"],
  "13003": ["Marseille 3e", 1900, "faible"], "13004": ["Marseille 4e", 2900, "modérée"],
  "13005": ["Marseille 5e", 3100, "modérée"], "13006": ["Marseille 6e", 3900, "forte"],
  "13007": ["Marseille 7e", 4300, "forte"], "13008": ["Marseille 8e", 4900, "forte"],
  "13009": ["Marseille 9e", 3400, "modérée"], "13010": ["Marseille 10e", 2900, "modérée"],
  "13011": ["Marseille 11e", 2800, "modérée"], "13012": ["Marseille 12e", 3200, "modérée"],
  "13013": ["Marseille 13e", 2400, "modérée"], "13014": ["Marseille 14e", 2100, "faible"],
  "13015": ["Marseille 15e", 2000, "faible"], "13016": ["Marseille 16e", 2200, "faible"],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const INDEX = new Map<string, CityMarket>();
for (const [city, pricePerSqm, tension] of RAW_CITIES) {
  INDEX.set(normalize(city), { city, pricePerSqm, tension });
}

/** Recherche approximative (accents/casse/tirets ignorés). Retourne null si la ville n'est pas référencée précisément. */
export function findCityMarket(cityInput: string | undefined): CityMarket | null {
  if (!cityInput?.trim()) return null;
  const key = normalize(cityInput);
  const exact = INDEX.get(key);
  if (exact) return exact;
  const withSaint = key.replace(/^st/, "saint");
  return INDEX.get(withSaint) ?? null;
}

export interface DepartmentMarket {
  code: string;
  name: string;
  pricePerSqm: number;
}

/** Déduit le département à partir d'un code postal français (5 chiffres, DOM inclus). */
export function findDepartmentMarket(postalCode: string | undefined): DepartmentMarket | null {
  const digits = postalCode?.trim().replace(/\D/g, "");
  if (!digits || digits.length < 4) return null;
  if (digits.startsWith("97")) {
    const code3 = digits.slice(0, 3);
    const dep = DEPARTMENTS[code3];
    return dep ? { code: code3, name: dep[0], pricePerSqm: dep[1] } : null;
  }
  if (digits.startsWith("20")) {
    const code = Number(digits.slice(0, 3)) <= 201 ? "2A" : "2B";
    const dep = DEPARTMENTS[code];
    return dep ? { code, name: dep[0], pricePerSqm: dep[1] } : null;
  }
  const code2 = digits.slice(0, 2);
  const dep = DEPARTMENTS[code2];
  return dep ? { code: code2, name: dep[0], pricePerSqm: dep[1] } : null;
}

/** Paris/Lyon/Marseille : le code postal encode l'arrondissement — précision maximale. */
export function findArrondissementMarket(postalCode: string | undefined): CityMarket | null {
  const digits = postalCode?.trim().replace(/\D/g, "");
  if (!digits || digits.length !== 5) return null;
  const entry = ARRONDISSEMENTS[digits];
  if (!entry) return null;
  const [city, pricePerSqm, tension] = entry;
  return { city, pricePerSqm, tension };
}

export type MarketLabel =
  | "fortement sous-coté"
  | "sous-coté"
  | "dans le marché"
  | "au-dessus du marché"
  | "fortement sur-évalué";

export interface MarketComparison {
  place: string; // nom de la ville, de l'arrondissement ou du département utilisé
  precision: "arrondissement" | "ville" | "departement";
  refPricePerSqm: number;
  yourPricePerSqm: number;
  gapPct: number; // positif = plus cher que le marché
  label: MarketLabel;
  tension: CityMarket["tension"] | null; // non disponible au niveau département
}

function labelFor(gapPct: number): MarketLabel {
  return gapPct <= -15
    ? "fortement sous-coté"
    : gapPct <= -5
      ? "sous-coté"
      : gapPct <= 10
        ? "dans le marché"
        : gapPct <= 25
          ? "au-dessus du marché"
          : "fortement sur-évalué";
}

/**
 * Compare un prix au m² au marché local, au meilleur niveau de précision disponible :
 * 1. Arrondissement (Paris/Lyon/Marseille, via le code postal)
 * 2. Ville précise (~300 communes référencées)
 * 3. Département (repli via le code postal, pour toute commune française)
 * Retourne null seulement si aucune des trois n'est disponible (jamais de valeur inventée).
 */
export function compareToMarket(
  city: string | undefined,
  postalCode: string | undefined,
  yourPricePerSqm: number | null
): MarketComparison | null {
  if (!yourPricePerSqm || yourPricePerSqm <= 0) return null;

  const build = (
    place: string,
    precision: MarketComparison["precision"],
    refPricePerSqm: number,
    tension: CityMarket["tension"] | null
  ): MarketComparison => {
    const gapPct = ((yourPricePerSqm - refPricePerSqm) / refPricePerSqm) * 100;
    return { place, precision, refPricePerSqm, yourPricePerSqm, gapPct, label: labelFor(gapPct), tension };
  };

  const arr = findArrondissementMarket(postalCode);
  if (arr) return build(arr.city, "arrondissement", arr.pricePerSqm, arr.tension);

  const cityRef = findCityMarket(city);
  if (cityRef) return build(cityRef.city, "ville", cityRef.pricePerSqm, cityRef.tension);

  const depRef = findDepartmentMarket(postalCode);
  if (depRef) return build(depRef.name, "departement", depRef.pricePerSqm, null);

  return null;
}
