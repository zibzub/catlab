import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getWalletParamFromUrl,
  lookupWalletCats,
  normalizeWalletLookupHistory,
  normalizeWalletRescueOrders,
  shortenWalletAddress,
  updateWalletUrl,
  walletHistoryDisplayLabel,
  walletLookupUrlValue,
} from '../walletLookup'

const ADDRESS = '0xAbCdEf0123456789aBCDef0123456789abCDef01'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wallet URL and rescue-order helpers', () => {
  it('reads, updates, and clears wallet query state without disturbing other URL state', () => {
    expect(getWalletParamFromUrl('https://catlab.example/collection?wallet=%200xabc%20#cats')).toBe('0xabc')
    expect(getWalletParamFromUrl('not a URL')).toBe('')
    expect(updateWalletUrl(' vitalik.eth ', 'https://catlab.example/collection?mode=list#cats'))
      .toBe('/collection?mode=list&wallet=vitalik.eth#cats')
    expect(updateWalletUrl('', 'https://catlab.example/collection?wallet=vitalik.eth&mode=list#cats'))
      .toBe('/collection?mode=list#cats')
  })

  it('normalizes valid ownership ids and rejects an invalid ids payload', () => {
    expect(normalizeWalletRescueOrders([25_439, 3, 3, 0, -1, 25_440, '4'])).toEqual([0, 3, 25_439])
    expect(() => normalizeWalletRescueOrders({ ids: [] })).toThrow('invalid ids list')
  })

  it('canonicalizes URL values and display labels for addresses and ENS lookups', () => {
    const result = { input: ADDRESS, address: ADDRESS, resolvedName: '', label: '', ids: new Set<number>() }
    expect(walletLookupUrlValue(result, 'manual')).toBe(ADDRESS.toLowerCase())
    expect(walletLookupUrlValue({ ...result, input: 'vitalik.eth', resolvedName: 'Vitalik.ETH' }, 'manual')).toBe('vitalik.eth')
    expect(shortenWalletAddress(ADDRESS)).toBe('0xAbCd…ef01')
    expect(walletHistoryDisplayLabel({ input: 'vitalik.eth', address: ADDRESS, resolvedName: 'name.eth' })).toBe('name.eth')
  })
})

describe('wallet lookup history', () => {
  it('normalizes, deduplicates, and limits stored history entries', () => {
    const entries = normalizeWalletLookupHistory([
      { input: '  Vitalik.ETH ', address: ADDRESS, resolvedName: 'Vitalik.ETH' },
      { input: 'duplicate', address: ADDRESS.toLowerCase(), resolvedName: '' },
      { input: 'invalid', address: 'not-an-address', resolvedName: '' },
      null,
      ...Array.from({ length: 10 }, (_, index) => ({ input: `wallet-${index}.eth`, address: '', resolvedName: '' })),
    ])
    expect(entries).toHaveLength(8)
    expect(entries[0]).toEqual({
      input: 'Vitalik.ETH',
      address: ADDRESS.toLowerCase(),
      resolvedName: 'vitalik.eth',
    })
    expect(entries[1]).toEqual({ input: 'invalid', address: '', resolvedName: '' })
  })
})

describe('wallet lookup response handling', () => {
  it('validates input and parses a successful API response at the network boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ids: [492, 492, -1, 25_440],
      address: ADDRESS,
      resolvedName: 'vitalik.eth',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupWalletCats(' Vitalik.ETH ')).resolves.toMatchObject({
      input: 'Vitalik.ETH',
      address: ADDRESS,
      resolvedName: 'vitalik.eth',
      label: 'vitalik.eth',
      ids: new Set([492]),
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expect(lookupWalletCats('0xnot-an-address')).rejects.toThrow('valid Ethereum address or ENS name')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns the documented error for malformed successful payloads and server failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ids: 'bad' }), { status: 200 })))
    await expect(lookupWalletCats('cat.eth')).rejects.toThrow('invalid ids list')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'ENS is unavailable' }), { status: 500 })))
    await expect(lookupWalletCats('cat.eth')).rejects.toThrow('ENS is unavailable')
  })
})
