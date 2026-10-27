import type { FinishedProduct, RawMaterial } from './types'

// Stocks MAG-MP au 26/10/2026 (après réception REC-014 et bons de sortie BS-041/042).
export const rawMaterials: RawMaterial[] = [
  { code: 'MP-01', name: 'Farine de blé type 55', unit: 'Sac de 50 kg', conversion: '1 sac = 50 kg', cmp: 28500, min: 10, reorder: 20, minLabel: '10 sacs', reorderLabel: '20 sacs', stock: 27, stockLabel: '27 sacs' },
  { code: 'MP-02', name: 'Levure boulangère', unit: 'Carton de 10 sachets de 500 g', conversion: '1 carton = 5 kg', cmp: 9000, min: 4, reorder: 6, minLabel: '4 cartons', reorderLabel: '6 cartons', stock: 3, stockLabel: '3 cartons' },
  { code: 'MP-03', name: 'Sel alimentaire', unit: 'Sac de 25 kg', conversion: '—', cmp: 8000, min: 2, reorder: 4, minLabel: '2 sacs', reorderLabel: '4 sacs', stock: 5, stockLabel: '5 sacs' },
  { code: 'MP-04', name: 'Sucre en poudre', unit: 'Sac de 50 kg', conversion: '—', cmp: 32000, min: 3, reorder: 5, minLabel: '3 sacs', reorderLabel: '5 sacs', stock: 6, stockLabel: '6 sacs' },
  { code: 'MP-05', name: 'Lait en poudre', unit: 'Carton de 25 kg', conversion: '—', cmp: 72000, min: 2, reorder: 4, minLabel: '2 cartons', reorderLabel: '4 cartons', stock: 4, stockLabel: '4 cartons' },
  { code: 'MP-06', name: 'Œufs frais', unit: 'Plateau de 30', conversion: '—', cmp: 3600, min: 10, reorder: 20, minLabel: '10 plateaux', reorderLabel: '20 plateaux', stock: 24, stockLabel: '24 plateaux' },
  { code: 'MP-07', name: 'Margarine / beurre', unit: 'Carton de 10 kg', conversion: '—', cmp: 18000, min: 3, reorder: 5, minLabel: '3 cartons', reorderLabel: '5 cartons', stock: 7, stockLabel: '7 cartons' },
  { code: 'MP-08', name: 'Glace (eau glacée)', unit: 'Bloc de 20 kg', conversion: '—', cmp: 1000, min: 5, reorder: 10, minLabel: '5 blocs', reorderLabel: '10 blocs', stock: 12, stockLabel: '12 blocs' },
  { code: 'MP-09', name: 'Arôme vanille / cacao', unit: 'Litre / kg', conversion: '—', cmp: 6500, min: 2, reorder: 5, minLabel: '2', reorderLabel: '5', stock: 6, stockLabel: '6' },
  { code: 'MP-10', name: 'Pots yaourt 125 ml + opercules', unit: 'Carton de 1 000', conversion: '—', cmp: 25000, min: 1, reorder: 3, minLabel: '1 carton', reorderLabel: '3 cartons', stock: 3, stockLabel: '3 cartons' },
  { code: 'MP-11', name: 'Cônes et pots glace', unit: 'Carton de 500', conversion: '—', cmp: 17500, min: 1, reorder: 3, minLabel: '1 carton', reorderLabel: '3 cartons', stock: 2, stockLabel: '2 cartons' },
  { code: 'MP-12', name: 'Sachets papier pain', unit: 'Paquet de 100', conversion: '—', cmp: 2000, min: 10, reorder: 20, minLabel: '10 paquets', reorderLabel: '20 paquets', stock: 35, stockLabel: '35 paquets' },
]

export const products: FinishedProduct[] = [
  { code: 'PF-01', name: 'Pain standard', category: 'Boulangerie', format: '150 g', retail: 150, wholesale: 130, recipe: 'R-BOUL-01', cost: 92, emoji: '🥖' },
  { code: 'PF-02', name: 'Pain standard', category: 'Boulangerie', format: '100 g', retail: 100, wholesale: 85, recipe: 'R-BOUL-01 (EPS)', cost: 63, emoji: '🥖' },
  { code: 'PF-03', name: 'Pain standard', category: 'Boulangerie', format: '50 g', retail: 50, wholesale: 45, recipe: 'R-BOUL-01 (EPS)', cost: 32, emoji: '🥖' },
  { code: 'PF-04', name: 'Pain découpé', category: 'Boulangerie', format: '115 g', retail: 115, wholesale: 100, recipe: 'R-BOUL-01 (EPS)', cost: 72, emoji: '🍞' },
  { code: 'PF-05', name: 'Croissant', category: 'Viennoiserie', format: '70 g', retail: 350, wholesale: 300, recipe: 'Pâte feuilletée (farine, margarine, sucre, œufs)', cost: 168, emoji: '🥐' },
  { code: 'PF-06', name: 'Pain au chocolat', category: 'Viennoiserie', format: '80 g', retail: 400, wholesale: 350, recipe: 'Idem + cacao', cost: 195, emoji: '🍫' },
  { code: 'PF-07', name: 'Éclair vanille', category: 'Pâtisserie', format: 'pièce', retail: 500, wholesale: 420, recipe: 'Pâte à choux, crème vanille', cost: 240, emoji: '🧁' },
  { code: 'PF-08', name: 'Beignet sucré', category: 'Pâtisserie', format: 'pièce', retail: 150, wholesale: 120, recipe: 'Farine, sucre, huile, levure', cost: 65, emoji: '🍩' },
  { code: 'PF-09', name: 'Gâteau moyen 20 cm', category: 'Pâtisserie', format: 'pièce', retail: 15000, wholesale: null, recipe: 'Sur commande', cost: 7800, emoji: '🎂' },
  { code: 'PF-10', name: 'Gâteau 2 étages', category: 'Pâtisserie', format: 'pièce', retail: 25000, wholesale: null, recipe: 'Sur commande, décoration personnalisable', cost: 13500, emoji: '🎂' },
  { code: 'PF-11', name: 'Yaourt vanille', category: 'Yaourt', format: 'pot 125 ml', retail: 200, wholesale: 170, recipe: 'Lait, sucre, arôme, pot', cost: 98, emoji: '🥛' },
  { code: 'PF-12', name: 'Yaourt nature', category: 'Yaourt', format: 'pot 125 ml', retail: 175, wholesale: 150, recipe: 'Lait, pot', cost: 82, emoji: '🥛' },
  { code: 'PF-13', name: 'Yaourt grand format', category: 'Yaourt', format: 'pot 500 ml', retail: 750, wholesale: 650, recipe: '—', cost: 360, emoji: '🥛' },
  { code: 'PF-14', name: 'Crème glacée cornet', category: 'Glace', format: 'cornet 100 ml', retail: 300, wholesale: 250, recipe: 'Lait, sucre, arôme, cône', cost: 140, emoji: '🍦' },
  { code: 'PF-15', name: 'Crème glacée pot', category: 'Glace', format: 'pot 125 ml', retail: 500, wholesale: 430, recipe: '—', cost: 225, emoji: '🍨' },
  { code: 'PF-16', name: 'Crème glacée bac familial', category: 'Glace', format: '1 L', retail: 3000, wholesale: 2600, recipe: '—', cost: 1350, emoji: '🍨' },
]

export const productLabel = (p: FinishedProduct) => `${p.name} ${p.format}`
