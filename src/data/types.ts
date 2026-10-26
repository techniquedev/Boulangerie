export type Role =
  | 'direction' | 'magasinierCentral' | 'controleur' | 'achats'
  | 'boulanger' | 'enfourneur' | 'magasinier' | 'boutiquier' | 'caissiere' | 'patissier' | 'livreur'

export type SiteCode = 'SIT-01' | 'SIT-02' | 'SIT-03' | 'SIT-04'

export type Site = { code: SiteCode; name: string; status: 'Actif' | 'Désactivé'; locations: string[]; note?: string }

export type User = {
  n: number; email: string; name: string; title: string; role: Role
  siteLabel: string; sites: SiteCode[]; pin: string /* affiché à titre d'information */; note: string
  group: string; active: boolean
}

export type RawMaterial = {
  code: string; name: string; unit: string; conversion: string
  cmp: number; min: number; reorder: number; minLabel: string; reorderLabel: string
  stock: number; stockLabel: string
}

export type FinishedProduct = {
  code: string; name: string; category: string; format: string
  retail: number; wholesale: number | null; recipe: string; cost: number; emoji: string
}

export type Supplier = { code: string; name: string; specialty: string; terms: string }
export type WholesaleClient = { code: string; name: string; ceiling: number; outstanding: number; statement: string }

export type Param = { label: string; value: string; override: string }

export type AlertStatus = 'Nouvelle' | 'En investigation' | 'Justifiée' | 'Imputée' | 'Clôturée'
export type AlertItem = {
  id: string; type: string; severity: 'Haute' | 'Moyenne' | 'Basse'; value: number | null
  detail: string; people: string; status: AlertStatus
  history: { at: string; by: string; text: string }[]
}

export type BdlLine = { label: string; sent: number; counted?: number }
export type Bdl = {
  id: string; to: string; toSite: SiteCode | null; status: string; lines: BdlLine[]; note?: string
}

export type Payment = { mode: 'Espèces' | 'MTN MoMo' | 'Moov Money' | 'Celtiis Cash'; amount: number; ref?: string }

export type Expense = {
  id: string; label: string; amount: number; by: string; status: string
  flow: string[]; photo?: boolean
}

export type AuditEntry = { at: string; localAt: string; author: string; device: string; site: string; action: string; detail: string }
export type Device = { id: string; label: string; site: string; status: 'Actif' | 'Révoqué'; note?: string }
export type Notification = { id: string; text: string; roles: Role[]; at: string }
