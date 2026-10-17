import { test as base } from '@playwright/test'
import { TodoApi } from '../helpers/TodoApi'
import { TodoPage } from '../pages/TodoPage'

export const test = base.extend<{
  todoPage: TodoPage
  todoApi: TodoApi
  cleanState: void
}>({
  todoPage: async ({ page }, use) => {
    await use(new TodoPage(page))
  },

  todoApi: async ({ request }, use) => {
    await use(new TodoApi(request))
  },

  cleanState: [
    async ({ todoApi }, use) => {
      await todoApi.reset()
      try {
        await use()
      } finally {
        await todoApi.reset()
      }
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
