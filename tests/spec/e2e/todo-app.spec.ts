import { expect, test } from '../../fixtures/base'


test('shows nothing but the input on an empty backend', async ({ todoPage }) => {
  await todoPage.open()
  await expect(todoPage.items).toHaveCount(0)
  await expect(todoPage.main).toBeHidden()
  await expect(todoPage.loading).toBeHidden()
  await expect(todoPage.newTodo).toBeVisible()
  await expect(todoPage.newTodo).toBeEnabled()
  await expect(todoPage.newTodo).toHaveValue('')
})

test('adds a todo on Enter, clears the field and posts it', async ({ page, todoPage, todoApi }) => {
  await todoPage.open()
  const posted = page.waitForRequest(
    (request) =>
      request.url().endsWith('/todos') && request.method() === 'POST',
  )
  await todoPage.add('kup mleko')
  await expect(todoPage.items).toHaveCount(1)
  await expect(todoPage.titleOf(todoPage.items.first())).toHaveText('kup mleko')
  await expect(todoPage.newTodo).toHaveValue('')
  await expect(todoPage.main).toBeVisible()
  const request = await posted
  expect(request.postDataJSON()).toEqual({
    title: 'kup mleko',
    completed: false,
    id: expect.any(String),
  })
  expect(await todoApi.byTitle('kup mleko')).toHaveLength(1)
})

test('keeps the order of several todos', async ({ todoPage }) => {
  await todoPage.open()
  await todoPage.add('pierwsze')
  await expect(todoPage.items).toHaveCount(1)
  await todoPage.add('drugie')
  await expect(todoPage.items).toHaveCount(2)
  await todoPage.add('trzecie')
  await expect(todoPage.titles).toHaveText(['pierwsze', 'drugie', 'trzecie'])
})

test('ignores Enter on an empty field and sends no request', async ({ page, todoPage }) => {
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })
  await todoPage.open()
  await todoPage.submitEmpty()
  await todoPage.add('   ')
  await todoPage.submitEmpty()
  await expect(todoPage.items).toHaveCount(0)
  expect(posts).toEqual([])
})

test('renders a title as text, not as markup', async ({ todoPage }) => {
  await todoPage.open()
  await todoPage.add('<b>niepogrubione</b>')
  await expect(todoPage.titleOf(todoPage.items.first())).toHaveText(
    '<b>niepogrubione</b>',
  )
  await expect(todoPage.items.first().locator('b')).toHaveCount(0)
})

test('deletes a todo through the destroy button and hides the list after the last todo is deleted', async ({ todoPage, todoApi }) => {
  await todoApi.create({ title: 'do usuniecia', completed: false })
  await todoApi.create({ title: 'zostaje', completed: false })
  await todoPage.open()
  await todoPage.destroy(todoPage.item('do usuniecia'))
  await expect(todoPage.item('do usuniecia')).toHaveCount(0)
  await expect(todoPage.item('zostaje')).toHaveCount(1)
  await expect
    .poll(async () => (await todoApi.list()).map((todo) => todo.title))
    .toEqual(['zostaje'])
  await todoPage.destroy(todoPage.item('zostaje'))
  await expect(todoPage.items).toHaveCount(0)
  await expect(todoPage.main).toBeHidden()
})

test('renders the state stored on the backend', async ({ todoPage, todoApi }) => {
  await todoApi.create({ title: 'zapisane', completed: true })
  await todoPage.open()
  await expect(todoPage.titleOf(todoPage.items.first())).toHaveText('zapisane')
  await expect(todoPage.items.first()).toHaveClass(/completed/)
  await expect(todoPage.items.first().locator('.toggle')).toBeChecked()
})

//
test('marks a todo done locally but never persists the toggle', async ({ todoPage, todoApi }) => {
  await todoApi.create({ title: 'przelacz mnie', completed: false })
  await todoPage.open()
  await todoPage.toggle(todoPage.items.first())
  await expect(todoPage.items.first()).toHaveClass(/completed/)
  await expect(todoPage.items.first().locator('.toggle')).toBeChecked()
  await expect.poll(async () => (await todoApi.list())[0].completed).toBe(false)
  await todoPage.open()
  await expect(todoPage.items.first()).not.toHaveClass(/completed/)
})

test.describe('loading and error states', () => {
  test('shows the loading hint while the fetch is in flight', async ({ page, todoPage }) => {
    await page.route('**/todos', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.continue()
    })
    await page.goto('/')
    await expect(todoPage.loading).toBeVisible()
    await expect(todoPage.loading).toBeHidden()
    await expect(todoPage.main).toBeHidden()
  })

  test('leaves the loading hint on screen when the list cannot be loaded', async ({ page, todoPage }) => {
    await page.route('**/todos', (route) =>
      route.fulfill({ status: 500, body: 'kaboom' }),
    )
    await todoPage.open()
    await expect(todoPage.items).toHaveCount(0)
    await expect(todoPage.main).toBeHidden()
    await expect(todoPage.loading).toBeVisible()
  })
})
