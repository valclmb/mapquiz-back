import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Types pour les données de pays
export interface CountryProperties {
  name: string;
  capital: string;
  continent: string;
  code: string;
}

export interface CountryGeometry {
  type: string;
  coordinates: number[][][];
}

export interface Country {
  _id: {
    $oid: string;
  };
  type: string;
  properties: CountryProperties;
  geometry: CountryGeometry;
}

export type CountriesData = Country[];

// Cache pour éviter de relire le fichier à chaque requête
let countriesCache: CountriesData | null = null;

/**
 * Récupère tous les pays ou filtre par continents
 * @param selectedRegions - Liste des continents à inclure (si vide, tous les pays sont retournés)
 * @returns Liste des pays filtrée
 */
export const getCountries = async (
  selectedRegions?: string[]
): Promise<CountriesData> => {
  try {
    // Utiliser le cache si disponible
    if (!countriesCache) {
      // Chemin vers le fichier JSON du frontend
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const backendPath = path.resolve(__dirname, "../../data/countries.json");

      // Lire le fichier JSON
      const countriesData = fs.readFileSync(backendPath, "utf8");
      countriesCache = JSON.parse(countriesData) as CountriesData;
    }

    // Si aucun filtre n'est spécifié ou si le tableau est vide, retourner tous les pays
    if (!selectedRegions || selectedRegions.length === 0) {
      return countriesCache;
    }

    // Filtrer les pays par continent sélectionné
    return countriesCache.filter((country: Country) =>
      selectedRegions.includes(country.properties.continent)
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des données de pays:", error);
    return [];
  }
};
