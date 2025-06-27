export function generateRandomTag(length: number = 6): string {
  // Caractères autorisés (lettres et chiffres, sans caractères ambigus)
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  // Génère une chaîne aléatoire de la longueur spécifiée
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}
