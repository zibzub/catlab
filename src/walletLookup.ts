import { isValidRescueOrder } from './mooncat-index/domain'

const CATMOON_WALLET_ENDPOINT = 'https://catmoon.zibzub.art/api/wallet-cats'
const MAX_INPUT_LENGTH = 80
const WALLET_LOOKUP_HISTORY_KEY = 'catlab.walletLookupHistory'
const WALLET_LOOKUP_HISTORY_LIMIT = 8
const ETHEREUM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const LOOKUP_INPUT_PATTERN = /^[a-z0-9._-]+$/i

export interface WalletLookupResult {
  input: string
  address: string
  resolvedName: string
  label: string
  ids: Set<number>
}

export type WalletLookupSource = 'manual' | 'connected'

export interface WalletFilter extends WalletLookupResult {
  source: WalletLookupSource
}

export interface WalletLookupHistoryEntry {
  input: string
  address: string
  resolvedName: string
}

export interface Eip1193Provider {
  request(args: { method: string }): Promise<unknown>
}

export function getWalletParamFromUrl(href?: string) {
  const currentHref = href ?? (typeof window === 'undefined' ? '' : window.location.href)
  if (!currentHref) return ''

  try {
    return new URL(currentHref).searchParams.get('wallet')?.trim() ?? ''
  } catch {
    return ''
  }
}

export function updateWalletUrl(value: string, href: string) {
  try {
    const url = new URL(href)
    const trimmedValue = value.trim()
    if (trimmedValue) url.searchParams.set('wallet', trimmedValue)
    else url.searchParams.delete('wallet')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

export function setWalletUrl(value: string) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return

  const nextUrl = updateWalletUrl(value, window.location.href)
  if (!nextUrl) return

  try {
    window.history.replaceState(null, '', nextUrl)
  } catch {
    // URL sharing is optional; keep the lookup usable when history is unavailable.
  }
}

export function walletLookupUrlValue(result: WalletLookupResult, source: WalletLookupSource) {
  const input = result.input.trim()
  if (source === 'connected' || ETHEREUM_ADDRESS_PATTERN.test(input)) {
    return (result.address.trim() || input).toLowerCase()
  }
  return input || result.resolvedName.trim() || result.address.trim().toLowerCase()
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export function normalizeWalletRescueOrders(ids: unknown) {
  if (!Array.isArray(ids)) {
    throw new Error('Wallet lookup returned an invalid ids list.')
  }

  return Array.from(new Set(ids.filter((id): id is number => (
    isValidRescueOrder(id)
  )))).sort((first, second) => first - second)
}

export function shortenWalletAddress(address: string) {
  return ETHEREUM_ADDRESS_PATTERN.test(address)
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address
}

export function walletHistoryDisplayLabel(entry: WalletLookupHistoryEntry) {
  if (entry.resolvedName) return entry.resolvedName
  if (entry.address) return shortenWalletAddress(entry.address)
  return entry.input
}

function normalizeHistoryEntry(record: unknown): WalletLookupHistoryEntry | null {
  if (!record || typeof record !== 'object') return null

  const input = 'input' in record && typeof record.input === 'string' ? record.input.trim() : ''
  const addressValue = 'address' in record && typeof record.address === 'string' ? record.address.trim() : ''
  const address = ETHEREUM_ADDRESS_PATTERN.test(addressValue) ? addressValue.toLowerCase() : ''
  const resolvedName = 'resolvedName' in record && typeof record.resolvedName === 'string'
    ? record.resolvedName.trim().toLowerCase()
    : ''
  if (!input && !address && !resolvedName) return null

  return {
    input: input || resolvedName || address,
    address,
    resolvedName,
  }
}

function walletHistoryKey(entry: WalletLookupHistoryEntry) {
  return entry.address || entry.resolvedName || entry.input.toLowerCase()
}

export function normalizeWalletLookupHistory(value: unknown) {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const history: WalletLookupHistoryEntry[] = []
  for (const record of value) {
    const entry = normalizeHistoryEntry(record)
    if (!entry) continue
    const key = walletHistoryKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    history.push(entry)
    if (history.length === WALLET_LOOKUP_HISTORY_LIMIT) break
  }
  return history
}

export function loadWalletLookupHistory() {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(WALLET_LOOKUP_HISTORY_KEY)
    return normalizeWalletLookupHistory(stored ? JSON.parse(stored) : [])
  } catch {
    return []
  }
}

export function rememberWalletLookup(result: WalletLookupResult) {
  if (typeof window === 'undefined') return

  const entry: WalletLookupHistoryEntry = {
    input: result.input,
    address: ETHEREUM_ADDRESS_PATTERN.test(result.address) ? result.address.toLowerCase() : '',
    resolvedName: result.resolvedName.toLowerCase(),
  }
  const history = normalizeWalletLookupHistory([entry, ...loadWalletLookupHistory()])

  try {
    window.localStorage.setItem(WALLET_LOOKUP_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // History is optional; keep lookups usable when storage is unavailable.
  }
}

export function getInjectedWalletProvider() {
  if (typeof window === 'undefined') return null
  const provider = window.ethereum
  return provider && typeof provider.request === 'function' ? provider : null
}

export async function requestConnectedWalletAddress(
  provider: Eip1193Provider | null = getInjectedWalletProvider(),
) {
  if (!provider) throw new Error('No browser wallet was detected.')

  let accounts: unknown
  try {
    accounts = await provider.request({ method: 'eth_requestAccounts' })
  } catch {
    throw new Error('Wallet connection was cancelled or rejected.')
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('The connected wallet returned no account.')
  }

  const address = accounts[0]
  if (typeof address !== 'string' || !ETHEREUM_ADDRESS_PATTERN.test(address)) {
    throw new Error('The connected wallet returned an invalid account.')
  }

  return address
}

function validateLookupInput(input: string) {
  if (
    input.length === 0
    || input.length > MAX_INPUT_LENGTH
    || !LOOKUP_INPUT_PATTERN.test(input)
    || (/^0x/i.test(input) && !ETHEREUM_ADDRESS_PATTERN.test(input))
  ) {
    throw new Error('Enter a valid Ethereum address or ENS name.')
  }
}

function displayLabel(input: string, address: string, resolvedName: string) {
  if (resolvedName) return resolvedName
  if (ETHEREUM_ADDRESS_PATTERN.test(address)) return address.toLowerCase()
  return input.toLowerCase()
}

function responseError(status: number) {
  if (status === 400) return 'Enter a valid Ethereum address or ENS name.'
  if (status === 404) return 'ENS name was not found.'
  if (status === 500) return 'ENS lookup is not available right now.'
  return 'Wallet ownership lookup is unavailable right now.'
}

export async function lookupWalletCats(input: string): Promise<WalletLookupResult> {
  const normalizedInput = input.trim()
  validateLookupInput(normalizedInput)

  let response: Response
  try {
    response = await fetch(`${CATMOON_WALLET_ENDPOINT}?address=${encodeURIComponent(normalizedInput)}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new Error('Could not reach the wallet ownership service.')
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error(responseError(response.status))
    throw new Error('Wallet ownership lookup returned invalid JSON.')
  }

  if (!response.ok) {
    const serverMessage = payload && typeof payload === 'object' && 'error' in payload
      && typeof payload.error === 'string'
      ? payload.error
      : ''
    throw new Error(serverMessage || responseError(response.status))
  }

  if (!payload || typeof payload !== 'object' || !('ids' in payload)) {
    throw new Error('Wallet ownership lookup returned an invalid response.')
  }

  const ids = normalizeWalletRescueOrders(payload.ids)
  const address = 'address' in payload && typeof payload.address === 'string'
    ? payload.address.trim()
    : ''
  const resolvedName = 'resolvedName' in payload && typeof payload.resolvedName === 'string'
    ? payload.resolvedName.trim()
    : ''

  return {
    input: normalizedInput,
    address,
    resolvedName,
    label: displayLabel(normalizedInput, address, resolvedName),
    ids: new Set(ids),
  }
}
