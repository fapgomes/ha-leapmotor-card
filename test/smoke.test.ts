import { describe, expect, it } from 'vitest'
import pkg from '../package.json'
import cardSource from '../src/leapmotor-card.ts?raw'

/**
 * O `1 + 1 === 2` que aqui estava não distinguia implementação nenhuma. Isto
 * distingue: a versão que o card anuncia na consola e no seletor de cards é uma
 * constante em `src/`, e a que o HACS instala vem do `package.json`. Se as duas
 * se separarem — e separam-se sempre que um bump esquece um dos lados — o
 * utilizador vê uma versão e recebe outra.
 */
describe('versão', () => {
  it('o CARD_VERSION é igual à versão do package.json', () => {
    expect(cardSource).toContain(`export const CARD_VERSION = '${pkg.version}'`)
  })

  it('a versão tem a forma de uma versão semântica', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
