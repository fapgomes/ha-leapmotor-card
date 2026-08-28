import { describe, expect, it } from 'vitest'
import { formatAgo, formatNumber, formatUpdated } from '../src/format'
import { createTranslator } from '../src/localize'

const pt = createTranslator('pt')
const NOW = new Date('2026-08-27T19:50:00+00:00')

describe('formatUpdated', () => {
  it('mostra hora e "Hoje" para o mesmo dia', () => {
    expect(formatUpdated(new Date('2026-08-27T19:49:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 19:49 Hoje')
  })
  it('mostra "Ontem" para o dia anterior', () => {
    expect(formatUpdated(new Date('2026-08-26T08:05:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 08:05 Ontem')
  })
  it('mostra a data para dias mais antigos', () => {
    expect(formatUpdated(new Date('2026-08-20T08:05:00+00:00'), NOW, pt, 'pt'))
      .toContain('08:05')
  })
  it('devolve travessão sem data', () => {
    expect(formatUpdated(undefined, NOW, pt, 'pt')).toBe('—')
  })
})

describe('formatAgo', () => {
  it('formata segundos em horas e minutos', () => {
    // 11930 s = 198.83 min, que formatDuration arredonda para 199 = 3h 19min
    expect(formatAgo(11930, pt)).toBe('há 3h e 19min')
  })
  it('formata menos de uma hora', () => {
    expect(formatAgo(300, pt)).toBe('há 5min')
  })
})

describe('formatNumber', () => {
  it('devolve travessão para undefined', () => {
    expect(formatNumber(undefined)).toBe('—')
  })
  it('arredonda para inteiro por defeito', () => {
    expect(formatNumber(60.3)).toBe('60')
  })
  it('respeita as casas decimais pedidas', () => {
    expect(formatNumber(2.174, 2)).toBe('2.17')
  })
})
