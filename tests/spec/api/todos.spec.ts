import { expect, test } from '../../fixtures/base'

test.describe('GET /todos', () => {
  test('answers an empty array when there is nothing stored', async ({ todoApi }) => {
    expect(await todoApi.list()).toEqual([])
  })

  test('returns every stored todo with the fields the UI reads', async ({ todoApi }) => {
    await todoApi.create({
      id: 'test-1',
      title: 'kup mleko',
      completed: false,
    })
    const [todo] = await todoApi.list()
    expect(todo.id).toBe('test-1')
    expect(todo.title).toBe('kup mleko')
    expect(todo.completed).toBe(false)
  })
})

test.describe('POST /todos', () => {
  test('creates a todo and echoes it back with an id', async ({ todoApi }) => {
    const response = await todoApi.post({
      id: 'test-post',
      title: 'nowe zadanie',
      completed: false,
    })
    expect(response.status()).toBe(201)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id: 'test-post',
        title: 'nowe zadanie',
        completed: false,
      }),
    )
    expect(await todoApi.byTitle('nowe zadanie')).toHaveLength(1)
  })

  test('auto-generates an id when the client does not provide one', async ({ todoApi }) => {
    const response = await todoApi.post({
      title: 'zadanie bez id',
      completed: false,
    })
    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.title).toBe('zadanie bez id')
    expect(body.completed).toBe(false)
    expect(body.id).toBeDefined()
    expect(typeof body.id === 'string' || typeof body.id === 'number').toBe(true)
    const found = await todoApi.byTitle('zadanie bez id')
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe(body.id)
  })

  test('keeps duplicates as separate rows when the ids differ', async ({ todoApi }) => {
    await todoApi.create({
      id: 'dup-1',
      title: 'ten sam tytul',
      completed: false,
    })
    await todoApi.create({
      id: 'dup-2',
      title: 'ten sam tytul',
      completed: false,
    })
    const rows = await todoApi.byTitle('ten sam tytul')
    expect(rows).toHaveLength(2)
    expect(rows[0].id).not.toBe(rows[1].id)
  })

  test('refuses a second create with the same id', async ({ todoApi }) => {
    await todoApi.create({
      id: 'staly-id',
      title: 'pierwszy',
      completed: false,
    })

    const second = await todoApi.post({
      id: 'staly-id',
      title: 'drugi',
      completed: false,
    })
    expect(second.status()).toBe(500)
    const rows = await todoApi.list()
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('pierwszy')
  })
})

test.describe('DELETE /todos/{id}', () => {
  test('removes the todo and answers 200', async ({ todoApi }) => {
    const created = await todoApi.create({
      id: 'do-usuniecia',
      title: 'do usuniecia',
      completed: false,
    })
    const response = await todoApi.remove(created.id!)
    expect(response.status()).toBe(200)
    expect(await todoApi.list()).toEqual([])
  })

  test('answers 404 when the id is already gone', async ({ todoApi }) => {
    const created = await todoApi.create({
      id: 'do-usuniecia',
      title: 'do usuniecia',
      completed: false,
    })
    await todoApi.remove(created.id!)
    expect((await todoApi.remove(created.id!)).status()).toBe(404)
  })

  test('returns 404 when attempting to delete a non-existent todo id directly', async ({ todoApi }) => {
    const response = await todoApi.remove('nieistniejacy-id-12345')
    expect(response.status()).toBe(404)
  })
})
