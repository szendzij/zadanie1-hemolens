import { APIRequestContext, APIResponse, expect } from '@playwright/test'

const TODOS_ENDPOINT = '/todos'

export interface Todo {
  id: string | number
  title: string
  completed: boolean
  [key: string]: unknown
}

export type TodoInput = {
  title: string
  completed?: boolean
  id?: string | number
  [key: string]: unknown
}

export class TodoApi {
  constructor(private readonly request: APIRequestContext) { }

  async list(): Promise<Todo[]> {
    const response = await this.retryable(
      () => this.request.get(TODOS_ENDPOINT),
      `GET ${TODOS_ENDPOINT}`,
    )
    expect(response.status(), `GET ${TODOS_ENDPOINT} should answer 200`).toBe(
      200,
    )
    return response.json()
  }

  async byTitle(title: string): Promise<Todo[]> {
    const todos = await this.list()
    return todos.filter((todo) => todo.title === title)
  }

  async create(todo: TodoInput): Promise<Todo> {
    const payload = { completed: false, ...todo }
    const response = await this.post(payload)
    expect(response.status(), `POST ${TODOS_ENDPOINT} ${todo.title}`).toBe(201)
    return response.json()
  }

  post(payload: unknown): Promise<APIResponse> {
    return this.request.post(TODOS_ENDPOINT, { data: payload })
  }

  async remove(id: string | number): Promise<APIResponse> {
    const url = `${TODOS_ENDPOINT}/${encodeURIComponent(String(id))}`
    return this.retryable(() => this.request.delete(url), `DELETE ${url}`)
  }

  async reset(): Promise<void> {
    const todos = await this.list()
    if (todos.length === 0) {
      return
    }

    await Promise.all(
      todos
        .filter((todo) => todo.id !== undefined)
        .map((todo) => this.remove(todo.id)),
    )

    const leftovers = await this.list()
    expect(
      leftovers,
      'reset left records behind - non-id rows cannot be deleted over HTTP',
    ).toEqual([])
  }

  private async retryable<T>(operation: () => Promise<T>, label: string): Promise<T> {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        if (attempt >= maxAttempts) throw error
        console.log(
          `[todo-api] ${label} failed (${String(error).split('\n')[0]
          }), retry ${attempt}/${maxAttempts - 1}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
      }
    }
    throw new Error(`[todo-api] ${label} failed after ${maxAttempts} attempts`)
  }
}
