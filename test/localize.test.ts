import { describe, expect, it } from 'vitest'
import { createTranslator, formatDuration, pickLanguage } from '../src/localize'

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
