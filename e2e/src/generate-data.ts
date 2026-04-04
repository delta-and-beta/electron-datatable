import { writeFileSync } from 'fs'
import { join } from 'path'

// ── MCC categories with merchants and amount ranges ──

interface MCCCategory {
  code: string
  name: string
  merchants: string[]
  amountMin: number
  amountMax: number
  weight: number
}

const MCC_CATEGORIES: MCCCategory[] = [
  { code: '5411', name: 'Grocery Stores', merchants: ['Whole Foods', "Trader Joe's", 'Safeway', 'Kroger', 'Aldi', 'Costco', 'Publix'], amountMin: 5, amountMax: 200, weight: 20 },
  { code: '5812', name: 'Restaurants', merchants: ['Olive Garden', 'Chipotle', 'Cheesecake Factory', "Applebee's", 'Panera Bread', 'Red Lobster'], amountMin: 8, amountMax: 150, weight: 18 },
  { code: '5541', name: 'Gas Stations', merchants: ['Shell', 'Chevron', 'ExxonMobil', 'BP', 'Costco Gas', 'Circle K'], amountMin: 20, amountMax: 80, weight: 15 },
  { code: '5999', name: 'Online Shopping', merchants: ['Amazon', 'eBay', 'Etsy', 'Walmart.com', 'Target.com', 'Best Buy Online'], amountMin: 10, amountMax: 500, weight: 14 },
  { code: '5912', name: 'Drug Stores', merchants: ['CVS Pharmacy', 'Walgreens', 'Rite Aid', 'Duane Reade'], amountMin: 5, amountMax: 80, weight: 8 },
  { code: '5814', name: 'Fast Food', merchants: ["McDonald's", 'Starbucks', 'Chick-fil-A', 'Subway', 'Taco Bell', "Dunkin'"], amountMin: 3, amountMax: 30, weight: 12 },
  { code: '5651', name: 'Clothing Stores', merchants: ['Zara', 'H&M', 'Nike Store', 'Gap', 'Nordstrom', 'Uniqlo'], amountMin: 15, amountMax: 300, weight: 5 },
  { code: '5311', name: 'Department Stores', merchants: ["Macy's", 'Target', 'Walmart', "Kohl's", 'TJ Maxx'], amountMin: 10, amountMax: 250, weight: 5 },
  { code: '3000', name: 'Airlines', merchants: ['United Airlines', 'Delta Air Lines', 'American Airlines', 'Southwest Airlines', 'JetBlue'], amountMin: 100, amountMax: 2000, weight: 2 },
  { code: '7011', name: 'Hotels', merchants: ['Marriott', 'Hilton', 'Hyatt', 'Holiday Inn', 'Airbnb'], amountMin: 80, amountMax: 500, weight: 2 },
  { code: '7512', name: 'Car Rental', merchants: ['Hertz', 'Enterprise', 'Avis', 'Budget', 'National'], amountMin: 40, amountMax: 300, weight: 1 },
  { code: '4900', name: 'Utilities', merchants: ['Con Edison', 'PG&E', 'Duke Energy', 'Water Authority', 'National Grid'], amountMin: 50, amountMax: 300, weight: 3 },
  { code: '6300', name: 'Insurance', merchants: ['State Farm', 'GEICO', 'Progressive', 'Allstate', 'USAA'], amountMin: 80, amountMax: 400, weight: 2 },
  { code: '4814', name: 'Telecom', merchants: ['Verizon', 'AT&T', 'T-Mobile', 'Comcast', 'Spectrum'], amountMin: 30, amountMax: 150, weight: 3 },
  { code: '8211', name: 'Education', merchants: ['Coursera', 'Udemy', 'University Bookstore', 'Pearson', 'Chegg'], amountMin: 10, amountMax: 500, weight: 1 },
  { code: '8011', name: 'Medical', merchants: ['Dr. Smith Office', 'LabCorp', 'Quest Diagnostics', 'CVS MinuteClinic', 'Kaiser Permanente'], amountMin: 20, amountMax: 800, weight: 2 },
  { code: '7922', name: 'Entertainment', merchants: ['AMC Theatres', 'Netflix', 'Spotify', 'Disney+', 'Live Nation'], amountMin: 5, amountMax: 200, weight: 3 },
  { code: '5968', name: 'Subscription Services', merchants: ['Adobe Creative Cloud', 'Microsoft 365', 'Dropbox', 'iCloud', 'YouTube Premium'], amountMin: 5, amountMax: 60, weight: 3 },
  { code: '5251', name: 'Hardware Stores', merchants: ['Home Depot', "Lowe's", 'Ace Hardware', 'Menards', 'True Value'], amountMin: 10, amountMax: 500, weight: 2 },
  { code: '5941', name: 'Sporting Goods', merchants: ["Dick's Sporting Goods", 'REI', 'Academy Sports', 'Bass Pro Shops', 'Nike.com'], amountMin: 15, amountMax: 400, weight: 1 },
]

// ── Seeded random for reproducibility ──

let seed = 42
function random(): number {
  seed = (seed * 16807 + 0) % 2147483647
  return (seed - 1) / 2147483646
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)]
}

// ── Build weighted category pool ──

const categoryPool: MCCCategory[] = []
for (const cat of MCC_CATEGORIES) {
  for (let i = 0; i < cat.weight; i++) {
    categoryPool.push(cat)
  }
}

// ── Generate transactions ──

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  mccCode: string
  mccCategory: string
  status: 'settled' | 'pending' | 'declined'
  cardLast4: string
}

const CARD_NUMBERS = ['4829', '7731', '0156', '9284']
const ANCHOR = new Date('2026-03-15')
const ONE_DAY = 86400000

const transactions: Transaction[] = []

for (let i = 0; i < 10000; i++) {
  const category = pick(categoryPool)
  const merchant = pick(category.merchants)

  let amount = +(category.amountMin + random() * (category.amountMax - category.amountMin)).toFixed(2)
  if (random() < 0.05) amount = -amount

  const daysAgo = randomInt(0, 365)
  const date = new Date(ANCHOR.getTime() - daysAgo * ONE_DAY)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const statusRoll = random()
  const status: Transaction['status'] = statusRoll < 0.85 ? 'settled' : statusRoll < 0.95 ? 'pending' : 'declined'

  transactions.push({
    id: `txn-${String(i + 1).padStart(5, '0')}`,
    date: dateStr,
    merchant,
    amount,
    mccCode: category.code,
    mccCategory: category.name,
    status,
    cardLast4: pick(CARD_NUMBERS),
  })
}

// ── Write output ──

const outPath = join(__dirname, 'data.json')
writeFileSync(outPath, JSON.stringify(transactions, null, 2))
console.log(`Generated ${transactions.length} transactions → ${outPath}`)
