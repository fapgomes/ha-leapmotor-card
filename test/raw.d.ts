/**
 * Importar um ficheiro como texto (`?raw`) é uma funcionalidade do Vite, que o
 * Vitest usa. É assim que dois testes leem o README e o `leapmotor-card.ts` sem
 * `node:fs`: o projeto não tem `@types/node` e não vai passar a ter só por isto.
 */
declare module '*?raw' {
  const content: string
  export default content
}
