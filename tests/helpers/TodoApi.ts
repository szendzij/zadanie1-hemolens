import { APIRequestContext, APIResponse } from '@playwright/test'

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
  constructor(private readonly request: APIRequestContext) {}

  async list(): Promise<Todo[]> {
    const response = await this.request.get(TODOS_ENDPOINT)
    if (!response.ok()) {
      throw new Error(`GET ${TODOS_ENDPOINT} failed with status ${response.status()}`)
    }
    return response.json()
  }

  async byTitle(title: string): Promise<Todo[]> {
    const todos = await this.list()
    return todos.filter((todo) => todo.title === title)
  }

  async create(todo: TodoInput): Promise<Todo> {
    const payload = { completed: false, ...todo }
    const response = await this.post(payload)
    if (!response.ok()) {
      throw new Error(`POST ${TODOS_ENDPOINT} failed with status ${response.status()}`)
    }
    return response.json()
  }

  post(payload: unknown): Promise<APIResponse> {
    return this.request.post(TODOS_ENDPOINT, { data: payload })
  }

  async remove(id: string | number): Promise<APIResponse> {
    const url = `${TODOS_ENDPOINT}/${encodeURIComponent(String(id))}`
    return this.request.delete(url)
  }

  async reset(): Promise<void> {
    const todos = await this.list()
    if (todos.length === 0) {
      return
    }

    for (const todo of todos) {
      if (todo.id !== undefined) {
        await this.remove(todo.id)
      }
    }

    const leftovers = await this.list()
    if (leftovers.length > 0) {
      throw new Error('reset left records behind - non-id rows cannot be deleted over HTTP')
    }
  }
}
