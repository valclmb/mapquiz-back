import { generateRandomTag } from "../../../src/lib/generateTag";

describe("generateTag - Tests de logique métier critique", () => {
  // ✅ TEST MÉTIER : Prévention des collisions de tags utilisateur
  describe("Unicité et prévention des collisions", () => {
    it("devrait générer des tags uniques sur 10000 itérations", () => {
      const tags = new Set<string>();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const tag = generateRandomTag();
        expect(tags.has(tag)).toBe(false); // Aucune collision
        tags.add(tag);
      }

      expect(tags.size).toBe(iterations);
    });

    it("devrait avoir une distribution statistique acceptable", () => {
      const charCounts = new Map<string, number>();
      const iterations = 1000;
      const expectedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

      for (let i = 0; i < iterations; i++) {
        const tag = generateRandomTag();
        for (const char of tag) {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        }
      }

      // Vérification que tous les caractères autorisés sont utilisés
      for (const char of expectedChars) {
        expect(charCounts.has(char)).toBe(true);
      }

      // Vérification distribution pas trop déséquilibrée (pas de biais évident)
      const counts = Array.from(charCounts.values());
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      const ratio = max / min;

      // Le ratio ne devrait pas être excessif (seuil empirique)
      expect(ratio).toBeLessThan(3);
    });
  });

  // ✅ TEST MÉTIER : Respect des contraintes UX (caractères non ambigus)
  describe("Prévention des caractères ambigus", () => {
    it("ne devrait jamais contenir de caractères ambigus (I, O, 0, 1)", () => {
      const ambiguousChars = ["I", "O", "0", "1", "i", "o"];

      for (let i = 0; i < 1000; i++) {
        const tag = generateRandomTag();

        for (const ambiguous of ambiguousChars) {
          expect(tag).not.toContain(ambiguous);
        }
      }
    });

    it("devrait utiliser uniquement les caractères de l'alphabet défini", () => {
      const allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

      for (let i = 0; i < 1000; i++) {
        const tag = generateRandomTag();

        for (const char of tag) {
          expect(allowedChars).toContain(char);
        }
      }
    });
  });

  // ✅ TEST MÉTIER : Respect des contraintes de longueur
  describe("Respect des spécifications de longueur", () => {
    it("devrait respecter la longueur par défaut (8 caractères)", () => {
      for (let i = 0; i < 100; i++) {
        const tag = generateRandomTag();
        expect(tag).toHaveLength(8);
      }
    });

    it("devrait respecter la longueur personnalisée", () => {
      const lengths = [1, 3, 5, 10, 15, 20];

      for (const length of lengths) {
        for (let i = 0; i < 50; i++) {
          const tag = generateRandomTag(length);
          expect(tag).toHaveLength(length);
        }
      }
    });

    it("devrait gérer les cas limites de longueur", () => {
      // Longueur minimale
      const tagMin = generateRandomTag(1);
      expect(tagMin).toHaveLength(1);

      // Longueur élevée (mais réaliste)
      const tagMax = generateRandomTag(50);
      expect(tagMax).toHaveLength(50);
    });
  });

  // ✅ TEST MÉTIER : Validation du format pour l'usage système
  describe("Format compatible avec le système", () => {
    it("devrait générer des tags compatibles avec les URLs", () => {
      for (let i = 0; i < 100; i++) {
        const tag = generateRandomTag();

        // Pas d'espaces, caractères spéciaux, accents
        expect(tag).toMatch(/^[A-Z2-9]+$/);

        // Compatible URL encoding
        expect(encodeURIComponent(tag)).toBe(tag);
      }
    });

    it("devrait générer des tags compatibles avec la base de données", () => {
      for (let i = 0; i < 100; i++) {
        const tag = generateRandomTag();

        // Pas de caractères d'échappement SQL
        expect(tag).not.toMatch(/['";\\]/);

        // Pas de caractères de contrôle
        expect(tag).not.toMatch(/[\x00-\x1F\x7F]/);
      }
    });
  });
});
