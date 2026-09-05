import { expect, test, type Page } from '@playwright/test'

const FULL_COUNT = '25,440'

function captureRuntimeErrors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  return () => {
    expect(consoleErrors, 'unexpected console errors').toEqual([])
    expect(pageErrors, 'uncaught page errors').toEqual([])
  }
}

async function openCollection(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'MoonCat collection' })).toBeVisible()
  await expect(page.locator('.result-count strong')).toHaveText(FULL_COUNT)
}

async function clearFilters(page: Page) {
  const clear = page.locator('.active-filter-row__clear')
  if (await clear.isVisible().catch(() => false)) await clear.click()
  await expect(page.locator('.result-count strong')).toHaveText(FULL_COUNT)
}

test.describe('@desktop Collection smoke', () => {
  test('loads a bounded virtualized collection and supports search', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)

    const tiles = page.locator('.cat-tile')
    await expect(tiles.first()).toBeVisible()
    expect(await tiles.count()).toBeLessThan(250)

    const search = page.getByRole('searchbox')
    await search.fill('25439')
    await expect(page.locator('.result-count strong')).toHaveText('1')
    await expect(page.locator('[data-rescue-order="25439"]')).toBeVisible()

    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.locator('.result-count strong')).toHaveText(FULL_COUNT)

    await search.fill('mister moo')
    await expect(page.locator('.result-count strong')).toHaveText('1')
    await expect(page.getByRole('button', { name: /mister moo/i })).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.locator('.result-count strong')).toHaveText(FULL_COUNT)
    assertRuntime()
  })

  test('applies filters, switches views, and changes display controls', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)

    await page.getByRole('button', { name: 'Filters' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filter MoonCats' })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Rescue' }).click()
    await drawer.getByLabel('Day 1').check()
    await drawer.getByLabel('Sub-100').check()
    await drawer.getByRole('button', { name: /^Apply/ }).click()
    await expect(page.locator('.result-count strong')).not.toHaveText(FULL_COUNT)
    await clearFilters(page)

    const details = page.getByRole('button', { name: 'Details view' })
    const list = page.getByRole('button', { name: 'List view' })
    await details.click()
    await expect(page.locator('.cat-grid-row--detailed').first()).toBeVisible()
    await list.click()
    await expect(page.getByRole('table', { name: 'MoonCat list' })).toBeVisible()
    await page.getByRole('button', { name: 'Medium compact grid' }).click()
    await expect(page.locator('.cat-grid-row--compact').first()).toBeVisible()

    await page.getByRole('button', { name: 'Small compact grid' }).click()
    await expect(page.getByRole('button', { name: 'Small compact grid' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Large compact grid' }).click()
    await expect(page.getByRole('button', { name: 'Large compact grid' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Face art' }).click()
    await expect(page.getByRole('button', { name: 'Face art' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Full body art' }).click()
    await expect(page.getByRole('button', { name: 'Full body art' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Display effects' }).click()
    await expect(page.getByRole('dialog', { name: 'Visual effects' })).toBeVisible()
    await page.getByRole('button', { name: 'Close Fx options' }).click()
    assertRuntime()
  })

  test('scrolls the virtualized grid and reaches the final rescue order', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)
    const scroll = page.locator('.cat-grid-scroll')
    const tiles = page.locator('.cat-tile')
    const initialOrders = await tiles.evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-rescue-order'))))
    await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight * 0.55 }))
    await expect.poll(async () => {
      const orders = await tiles.evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-rescue-order'))))
      return Math.max(...orders)
    }).toBeGreaterThan(Math.max(...initialOrders))
    expect(await tiles.count()).toBeLessThan(250)

    await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(page.locator('[data-rescue-order="25439"]')).toBeVisible()
    expect(await tiles.count()).toBeLessThan(250)

    const down = page.getByRole('button', { name: 'Scroll down' })
    await expect(down).toBeDisabled()
    assertRuntime()
  })

  test('custom scrollbar arrow advances by a page', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)
    const scroll = page.locator('.cat-grid-scroll')
    const before = await scroll.evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight }))
    await page.getByRole('button', { name: 'Scroll down' }).click()
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(before.top)
    const after = await scroll.evaluate((element) => element.scrollTop)
    expect(after - before.top).toBeGreaterThan(before.height * 0.5)
    expect(after - before.top).toBeLessThan(before.height * 1.1)
    assertRuntime()
  })

  test('opens ColorLab and exposes its deterministic built-in sampler', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)
    await page.getByRole('button', { name: 'ColorLab' }).click()
    const panel = page.locator('#colorlab-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Load Hue wheel' })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: 'Load Coat chart' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Load Coat chart' })).toBeEnabled()
    assertRuntime()
  })
})

test.describe('@mobile Collection smoke', () => {
  test('loads without document overflow and keeps mobile controls usable', async ({ page }) => {
    const assertRuntime = captureRuntimeErrors(page)
    await openCollection(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('searchbox').fill('25439')
    await expect(page.locator('.result-count strong')).toHaveText('1')
    await page.getByRole('button', { name: 'Clear search' }).click()

    await page.getByRole('button', { name: 'Filters' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filter MoonCats' })
    await expect(drawer).toBeVisible()
    const drawerBox = await drawer.boundingBox()
    expect(drawerBox).not.toBeNull()
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0)
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(390)
    await drawer.getByRole('button', { name: 'Close filters' }).click()
    await expect(drawer).toBeHidden()

    await page.getByRole('button', { name: 'Display effects' }).click()
    const effects = page.getByRole('dialog', { name: 'Visual effects' })
    await expect(effects).toBeVisible()
    const effectsBox = await effects.boundingBox()
    expect(effectsBox).not.toBeNull()
    expect(effectsBox!.x).toBeGreaterThanOrEqual(0)
    expect(effectsBox!.x + effectsBox!.width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Close Fx options' }).click()

    await page.getByRole('button', { name: 'List view' }).click()
    await expect(page.getByRole('table', { name: 'MoonCat list' })).toBeVisible()
    await page.getByRole('button', { name: 'Medium compact grid' }).click()
    await expect(page.locator('.cat-grid-row--compact').first()).toBeVisible()
    await page.locator('.cat-grid-scroll').evaluate((element) => element.scrollTo({ top: element.scrollHeight * 0.4 }))
    await expect.poll(() => page.locator('.cat-grid-scroll').evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    assertRuntime()
  })
})
