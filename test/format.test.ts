import { describe, expect, it } from 'vitest'
import {
  areDoorsUnknown, areOpeningsUnknown, areWindowsUnknown, formatAgo, formatNumber, formatUpdated,
} from '../src/format'
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

describe('areOpeningsUnknown', () => {
  const closed = {
    doors: { driver: false, passenger: false, rearLeft: false, rearRight: false },
    windows: { fl: { open: false }, fr: { open: false }, rl: { open: false }, rr: { open: false } },
    trunk: false,
    roof: false,
    openCount: 0,
  }
  const nothing = {
    doors: { driver: undefined, passenger: undefined, rearLeft: undefined, rearRight: undefined },
    windows: { fl: {}, fr: {}, rl: {}, rr: {} },
    trunk: undefined,
    roof: undefined,
    openCount: 0,
  }

  it('um carro que reportou tudo fechado é conhecido', () => {
    expect(areOpeningsUnknown(closed)).toBe(false)
    expect(areDoorsUnknown(closed.doors)).toBe(false)
    expect(areWindowsUnknown(closed.windows)).toBe(false)
  })

  it('um carro que não reportou nada é desconhecido', () => {
    expect(areOpeningsUnknown(nothing)).toBe(true)
    expect(areDoorsUnknown(nothing.doors)).toBe(true)
    expect(areWindowsUnknown(nothing.windows)).toBe(true)
  })

  it('uma única leitura basta para deixar de ser desconhecido', () => {
    expect(areOpeningsUnknown({ ...nothing, roof: false })).toBe(false)
    // A posição do vidro conta como leitura, mesmo sem o booleano de aberto.
    expect(areWindowsUnknown({ ...nothing.windows, fl: { position: 0 } })).toBe(false)
  })
})
