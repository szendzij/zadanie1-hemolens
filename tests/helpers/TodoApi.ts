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

/**
 * REST client for the app's backend - an API helper, not a page object: it never
 * touches the DOM and takes no `page`.
 *
 * The backend is a json-server instance whose whole state is one `todos`
 * array (see data.json). It has no reset endpoint and accepts every request
 * without auth, so cleaning up means deleting what is addressable by id.
 */
export class TodoApi {
  constructor(private readonly request: APIRequestContext) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Returns all stored todos. */
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

  /** Finds todos matching the given title. */
  async byTitle(title: string): Promise<Todo[]> {
    const todos = await this.list()
    return todos.filter((todo) => todo.title === title)
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * Creates a new todo record and verifies status 201.
   * Defaults `completed` to `false` if omitted.
   */
  async create(todo: TodoInput): Promise<Todo> {
    const payload = { completed: false, ...todo }
    const response = await this.post(payload)
    expect(response.status(), `POST ${TODOS_ENDPOINT} ${todo.title}`).toBe(201)
    return response.json()
  }

  /** Raw POST, for specs that need to assert on status codes or send arbitrary payloads. */
  post(payload: unknown): Promise<APIResponse> {
    return this.request.post(TODOS_ENDPOINT, { data: payload })
  }

  /** Sends DELETE for the given todo id. Returns raw response for status asserting. */
  async remove(id: string | number): Promise<APIResponse> {
    const url = `${TODOS_ENDPOINT}/${encodeURIComponent(String(id))}`
    return this.retryable(() => this.request.delete(url), `DELETE ${url}`)
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Wipes the backend. Every spec starts from an empty list: one data.json is
   * shared by all workers, so a test may only trust rows it created itself.
   */
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

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * json-server closes idle keep-alive sockets after 5s, so a pooled connection
   * can be reaped exactly as the next request goes out and surface as a
   * `socket hang up (ECONNRESET)`. Only idempotent calls are retried, and only
   * when the request threw (a 4xx/5xx answer is a result, not a hiccup).
   */
  private async retryable<T>(
    operation: () => Promise<T>,
    label: string,
  ): Promise<T> {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        if (attempt >= maxAttempts) throw error
        console.log(
          `[todo-api] ${label} failed (${
            String(error).split('\n')[0]
          }), retry ${attempt}/${maxAttempts - 1}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
      }
    }
    throw new Error(`[todo-api] ${label} failed after ${maxAttempts} attempts`)
  }
}
