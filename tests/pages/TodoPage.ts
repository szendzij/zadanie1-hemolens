import { Locator, Page } from '@playwright/test'

/**
 * The single route of the app (`/`) renders TodoMVC markup with no `data-test`
 * attributes, so every selector here is a TodoMVC class name. If the markup is
 * ever touched, add test ids and shrink this file - do not add CSS fallbacks.
 */
export class TodoPage {
  readonly newTodo: Locator
  readonly main: Locator
  readonly items: Locator
  readonly titles: Locator
  readonly loading: Locator

  constructor(private readonly page: Page) {
    this.newTodo = page.getByPlaceholder('What needs to be done?')
    this.main = page.locator('.main')
    this.items = page.locator('.todo')
    this.titles = page.locator('.todo label')
    // `.loading` is only observable while a delayed GET /todos is in flight -
    // state flips true/false inside a single Vue flush, so it never paints on a fast server.
    this.loading = page.locator('.loading')
  }

  /**
   * Navigation is the only public entry point. `?delay=<ms>` postpones the
   * initial GET /todos; the SPA has no landmark on the empty state, so the wait
   * is on the response itself rather than on `domcontentloaded` (which fires
   * before Vue renders and would make counts read 0).
   */
  async open(query = '') {
    const loaded = this.page.waitForResponse(
      (response) =>
        response.url().includes('/todos') &&
        response.request().method() === 'GET',
    )
    await this.page.goto(`/${query}`)
    await loaded
  }

  async add(title: string) {
    await this.newTodo.fill(title)
    await this.newTodo.press('Enter')
  }

  /** Presses Enter with whatever is currently in the field (including nothing). */
  async submitEmpty() {
    await this.newTodo.press('Enter')
  }

  item(title: string): Locator {
    return this.items.filter({ hasText: title })
  }

  titleOf(item: Locator): Locator {
    return item.locator('label')
  }

  async toggle(item: Locator) {
    await item.locator('.toggle').click()
  }

  async destroy(item: Locator) {
    // `li .destroy` is display:none until the row is hovered (vendor/index.css),
    // so clicking it without hovering just waits for actionability and times out.
    await item.hover()
    await item.locator('.destroy').click()
  }
}
