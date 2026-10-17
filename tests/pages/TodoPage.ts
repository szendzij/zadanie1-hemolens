import { Locator, Page } from '@playwright/test'

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
    this.loading = page.locator('.loading')
  }

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
    await item.hover()
    await item.locator('.destroy').click()
  }
}
