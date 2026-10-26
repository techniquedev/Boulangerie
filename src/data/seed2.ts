import type { CashSession, SaleTicket } from './state'

const P = (code: string, label: string, qty: number, unit: number) => ({ code, label, qty, unit })

export const ticketsA: SaleTicket[] = [
  { id: 'TK-A-0101', at: '26/10/2026 07:20', lines: [P('PF-01', 'Pain standard 150 g', 300, 150)],
    payments: [{ mode: 'Espèces', amount: 45000 }] },
  { id: 'TK-A-0102', at: '26/10/2026 09:10', lines: [P('PF-02', 'Pain standard 100 g', 200, 100)],
    payments: [{ mode: 'Espèces', amount: 20000 }] },
  { id: 'TK-A-0103', at: '26/10/2026 10:45', lines: [P('PF-05', 'Croissant', 40, 350)],
    payments: [{ mode: 'MTN MoMo', amount: 14000, ref: 'MOMO2610A014' }] },
  { id: 'TK-A-0104', at: '26/10/2026 12:30', lines: [P('PF-11', 'Yaourt vanille', 25, 200), P('PF-14', 'Crème glacée cornet', 20, 300)],
    payments: [{ mode: 'Moov Money', amount: 8000, ref: 'MOOV2610B007' }, { mode: 'Espèces', amount: 3000 }] },
  { id: 'TK-A-0105', at: '26/10/2026 15:05', lines: [P('PF-09', 'Gâteau moyen 20 cm', 1, 15000)],
    payments: [{ mode: 'Celtiis Cash', amount: 8000, ref: 'CELT2610C003' }, { mode: 'Espèces', amount: 7000 }] },
  { id: 'TK-A-0106', at: '26/10/2026 16:15', lines: [P('PF-08', 'Beignet sucré', 2, 150)],
    payments: [{ mode: 'Espèces', amount: 300 }],
    cancelled: { by: 'Paul HOUNSA', reason: 'Erreur de saisie', at: '26/10/2026 16:22' } },
]

export const sessionA: CashSession = {
  id: 'CAISSE-A-20261026', site: 'SIT-02', caisse: 'CAISSE-A', openedBy: 'Junior AHOUANVOEDO', openedAt: '26/10/2026 06:45',
  fond: 10000, status: 'Ouverte', tickets: ticketsA,
}

// Boutique B : clôturée sans écart ; seules les valeurs consolidées du document sont connues.
export const sessionB: CashSession = {
  id: 'CAISSE-B-20261026', site: 'SIT-03', caisse: 'CAISSE-B', openedBy: 'Mariam TOURÉ', openedAt: '26/10/2026 06:50',
  fond: null, status: 'Clôturée (comptée)', tickets: [], closedBy: 'Mariam TOURÉ', closedAt: '26/10/2026 19:00',
  summary: { ca: 143500, cash: 113500, momo: 30000 },
}

export const sale = (t: SaleTicket) => (t.cancelled ? 0 : t.lines.reduce((s, l) => s + l.qty * l.unit, 0))
export const paid = (t: SaleTicket, mode?: 'Espèces' | 'momo') =>
  t.cancelled ? 0 : t.payments.filter(p => (mode === 'Espèces' ? p.mode === 'Espèces' : mode === 'momo' ? p.mode !== 'Espèces' : true)).reduce((s, p) => s + p.amount, 0)
