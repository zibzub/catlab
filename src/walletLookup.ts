const CATMOON_WALLET_ENDPOINT = 'https://catmoon.zibzub.art/api/wallet-cats'
const MAX_RESCUE_ORDER = 25439
const MAX_INPUT_LENGTH = 80
const ETHEREUM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const LOOKUP_INPUT_PATTERN = /^[a-z0-9._-]+$/i

export interface WalletLookupResult {
  input: string
  address: string
  label: string
  ids: Set<number>
}

export interface Eip1193Provider {
  request(args: { method: string }): Promise<unknown>
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
    Number.isInteger(id)
    && id >= 0
    && id <= MAX_RESCUE_ORDER
  )))).sort((first, second) => first - second)
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
    label: displayLabel(normalizedInput, address, resolvedName),
    ids: new Set(ids),
  }
}
