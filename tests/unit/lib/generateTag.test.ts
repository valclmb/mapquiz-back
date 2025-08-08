import { generateRandomTag } from "../../../src/lib/generateTag.js";

describe("generateTag", () => {
  describe("generateRandomTag", () => {
    it("devrait générer un tag de longueur par défaut (8)", () => {
      const tag = generateRandomTag();
      expect(tag).toHaveLength(8);
      expect(tag).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    });

    it("devrait générer un tag de longueur personnalisée", () => {
      const tag = generateRandomTag(12);
      expect(tag).toHaveLength(12);
      expect(tag).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    });

    it("devrait générer un tag de longueur 1", () => {
      const tag = generateRandomTag(1);
      expect(tag).toHaveLength(1);
      expect(tag).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/);
    });

    it("devrait générer des tags différents à chaque appel", () => {
      const tag1 = generateRandomTag();
      const tag2 = generateRandomTag();
      const tag3 = generateRandomTag();

      expect(tag1).not.toBe(tag2);
      expect(tag2).not.toBe(tag3);
      expect(tag1).not.toBe(tag3);
    });

    it("devrait ne contenir que des caractères autorisés", () => {
      const tag = generateRandomTag(20);
      const allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

      for (const char of tag) {
        expect(allowedChars).toContain(char);
      }
    });

    it("devrait gérer la longueur 0", () => {
      const tag = generateRandomTag(0);
      expect(tag).toHaveLength(0);
      expect(tag).toBe("");
    });

    it("devrait gérer les longueurs négatives", () => {
      const tag = generateRandomTag(-5);
      expect(tag).toHaveLength(0);
      expect(tag).toBe("");
    });
  });
});
