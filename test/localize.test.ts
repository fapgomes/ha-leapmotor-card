import { describe, expect, it } from 'vitest'
import { createTranslator, formatDuration, pickLanguage } from '../src/localize'
import en from '../src/translations/en.json'
import pt from '../src/translations/pt.json'

describe('pickLanguage', () => {
  it('a config ganha ao idioma do hass', () => {
    expect(pickLanguage('pt', 'en')).toBe('pt')
  })
  it('usa o idioma do hass quando a config não define', () => {
    expect(pickLanguage(undefined, 'pt')).toBe('pt')
  })
  it('reduz uma etiqueta regional à língua base', () => {
    expect(pickLanguage(undefined, 'pt-PT')).toBe('pt')
  })
  it('cai para inglês num idioma sem catálogo', () => {
    expect(pickLanguage(undefined, 'de')).toBe('en')
  })
  it('cai para inglês sem informação nenhuma', () => {
    expect(pickLanguage(undefined, undefined)).toBe('en')
  })
})

describe('createTranslator', () => {
  it('traduz para português', () => {
    expect(createTranslator('pt')('tiles.all_closed')).toBe('Todos fechados')
  })
  it('traduz para inglês', () => {
    expect(createTranslator('en')('tiles.all_closed')).toBe('All closed')
  })
  it('interpola variáveis', () => {
    expect(createTranslator('pt')('charging.title', { percent: 60 })).toBe('Carregado a 60%')
  })
  it('deixa o marcador literal quando falta a variável', () => {
    expect(createTranslator('pt')('charging.title')).toBe('Carregado a {percent}%')
  })
  it('devolve a própria chave quando não existe tradução em nenhum catálogo', () => {
    expect(createTranslator('pt')('nao.existe')).toBe('nao.existe')
  })
})

describe('formatDuration', () => {
  const pt = createTranslator('pt')
  const en = createTranslator('en')

  it('formata horas e minutos como na app', () => {
    // 835 min = 13h 55min, o valor da captura
    expect(formatDuration(835, pt)).toBe('13h e 55min')
    expect(formatDuration(835, en)).toBe('13h 55min')
  })
  it('formata só horas quando os minutos são zero', () => {
    expect(formatDuration(120, pt)).toBe('2h')
  })
  it('formata só minutos abaixo de uma hora', () => {
    expect(formatDuration(45, pt)).toBe('45min')
  })
  it('formata zero como 0min', () => {
    expect(formatDuration(0, pt)).toBe('0min')
  })
})

/**
 * Achata um catálogo em caminhos completos separados por pontos.
 *
 * As chaves de hoje já são planas (`"comfort.mirrors"` é uma chave só, não dois
 * níveis), mas o formato que o Home Assistant usa é aninhado e basta alguém
 * aninhar um ramo para uma comparação de chaves de topo passar a mentir:
 * `comfort` existiria dos dois lados e a falta de `comfort.mirrors` num deles
 * não dava por nada. Por isso anda-se a árvore toda, e é o caminho completo que
 * se compara.
 */
function flattenKeys(node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('catálogos de tradução', () => {
  /*
   * Não havia teste nenhum a comparar os dois catálogos. Os 115 nomes batiam
   * certo só porque toda a gente que lhes mexeu teve cuidado: uma chave nova
   * escrita só num dos ficheiros compilava, passava nos testes, e o utilizador
   * da outra língua via o texto inglês — ou, se a chave faltasse no `en`, via a
   * própria chave, porque é isso que o `createTranslator` devolve quando nem o
   * catálogo primário nem o de recurso a têm.
   */
  it('pt e en têm exactamente as mesmas chaves', () => {
    const ptKeys = new Set(flattenKeys(pt))
    const enKeys = new Set(flattenKeys(en))
    const missingInEn = [...ptKeys].filter(key => !enKeys.has(key)).sort()
    const missingInPt = [...enKeys].filter(key => !ptKeys.has(key)).sort()
    // A mensagem NOMEIA as chaves em falta de cada lado. Quem partir a paridade
    // precisa de saber quais são, não só que as contagens não batem certo.
    expect({ missingInEn, missingInPt }, [
      `faltam em en.json: ${missingInEn.join(', ') || '(nenhuma)'}`,
      `faltam em pt.json: ${missingInPt.join(', ') || '(nenhuma)'}`,
    ].join('\n')).toEqual({ missingInEn: [], missingInPt: [] })
  })

  /*
   * Dois catálogos vazios têm as mesmas chaves — nenhuma — e passavam no teste
   * de cima sem dizer nada. Este fecha esse buraco.
   */
  it('nenhum dos dois catálogos está vazio', () => {
    expect(flattenKeys(pt).length).toBeGreaterThan(0)
    expect(flattenKeys(en).length).toBe(flattenKeys(pt).length)
  })
})
