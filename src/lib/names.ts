/**
 * Clerk's sign-up keeps a name exactly as typed, so "john smith" reaches every
 * roster as-is. This raises the first letter of each word and never lowers
 * anything, so "McDonald" survives — the dashboard's `formatName` lowercases
 * the rest and turns it into "Mcdonald".
 */
export function capitalizeName(name: string): string {
  return name.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => space + letter.toUpperCase());
}

export function personName({ firstName, lastName }: { firstName: string; lastName: string }): string {
  return capitalizeName(`${firstName} ${lastName}`.trim());
}
