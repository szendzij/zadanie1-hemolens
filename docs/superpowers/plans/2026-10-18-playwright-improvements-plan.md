# Plan Wdrożenia Poprawek Playwright (Punkty 2, 3, 5, 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optymalizacja architektury testów Playwright pod kątem czyszczenia stanu, separacji asercji API, wsparcia wieloprzeglądarkowości (Firefox, WebKit) oraz diagnostyki lokalnej (tracing, reportery).

**Architecture:**
- Odchudzenie fixture'a `cleanState` w `tests/fixtures/base.ts` z podwójnego resetu do pojedynczego resetu przedtestowego oraz usunięcie race conditions przy usuwaniu rekordów poprzez sekwencyjne usuwanie bez sztucznych opóźnień.
- Oczyszczenie `TodoApi` w `tests/helpers/TodoApi.ts` z wbudowanych asercji statusów HTTP i przeniesienie asercji bezpośrednio do testów spec, co odblokuje testowanie scenariuszy negatywnych.
- Rozszerzenie konfiguracji projektów w `playwright.config.ts` oraz matrycy GitHub Actions w `.github/workflows/playwright.yml` o Firefoxa i WebKit (Safari).
- Przeprojektowanie sekcji `use.trace` na `retain-on-failure` oraz uproszczenie reporterów lokalnych w `playwright.config.ts`.

**Tech Stack:** Playwright Test, TypeScript, GitHub Actions, json-server.

---

## Global Constraints

- Wszystkie istniejące 18 testów (8 API + 10 E2E) muszą przechodzić na zielono bez regresji.
- Kod TypeScript musi kompilować się bezbłędnie (`tsc --noEmit`).
- Konfiguracja CI w `.github/workflows/playwright.yml` musi pozostać w pełni kompatybilna ze scalaniem raportów blob (`merge-reports`).

## Review Focus

1. **Współbieżność resetu danych:** Sprawdzenie, czy sekwencyjne usuwanie elementów w `TodoApi.reset()` nie powoduje timeoutów przy większej liczbie rekordów.
2. **Zachowanie kompatybilności API Helpera:** Zapewnienie, że testy E2E korzystające z `todoApi.create()` lub `todoApi.list()` nadal otrzymują właściwe typy obiektów.
3. **Specyfika WebKit / Safari:** Upewnienie się, że akcje `:hover` i kliknięcia przycisku `.destroy` w `TodoPage` działają stabilnie na silniku WebKit.
4. **Rozmiary artefaktów trace:** Weryfikacja, czy `retain-on-failure` nie generuje zbędnych plików trace dla pomyślnych testów.
5. **Działanie skryptów npm:** Zapewnienie, że `npm run test:e2e` poprawnie uruchamia testy E2E na wszystkich skonfigurowanych przeglądarkach.

---

### Task 1: Optymalizacja Tracingu i Reporterów Lokalnych (Punkt 6)

**Files:**
- Modify: `playwright.config.ts:13-28`

**Interfaces:**
- `playwright.config.ts` definiuje konfigurację reporterów oraz opcję `use.trace`.

- [ ] **Step 1: Zmiana konfiguracji reporterów i trace w `playwright.config.ts`**

Zaktualizuj konfigurację:
- Zmień `trace: 'on-first-retry'` na `trace: 'retain-on-failure'`, aby lokalnie (przy `retries: 0`) nieudany test zachowywał plik trace.zip.
- Uprość reportery lokalne: zamiast `html`, `list`, `json`, `junit` pozostaw `['list']` oraz `['html', { open: 'never' }]`.

- [ ] **Step 2: Weryfikacja poprawności TypeScript**

Uruchom: `node ./node_modules/typescript/bin/tsc --noEmit`
Oczekiwany wynik: kod wyjścia 0, brak błędów.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "fix(config): update trace to retain-on-failure and simplify local reporters"
```

---

### Task 2: Refaktoryzacja `TodoApi` – usunięcie zanieczyszczeń asercjami i naprawa retry (Punkt 3)

**Files:**
- Modify: `tests/helpers/TodoApi.ts`
- Modify: `tests/spec/api/todos.spec.ts`

**Interfaces:**
- `TodoApi`:
  - `list(): Promise<Todo[]>` (bez `expect`, ewentualnie rzuca błąd przy statusie != 200 z informacją o błędzie serwera).
  - `create(todo: TodoInput): Promise<Todo>` (zwraca utworzony obiekt bez wewnętrznej asercji `toBe(201)`).
  - `post(payload: unknown): Promise<APIResponse>` (czysta metoda transportowa).
  - `delete(id: string | number): Promise<APIResponse>` (czysta metoda transportowa).
  - `remove(id: string | number): Promise<APIResponse>`.
  - `reset(): Promise<void>` (sekwencyjne usuwanie bez race condition i bez `retryable`).

- [ ] **Step 1: Przygotowanie testu negatywnego API sprawdzającego scenariusz błędu**

W `tests/spec/api/todos.spec.ts` dodaj test walidujący usuwanie nieistniejącego rekordu lub pobieranie nieprawidłowej ścieżki za pomocą czystego wywołania API:
```typescript
test('returns 404 when attempting to delete a non-existent todo id directly', async ({ todoApi }) => {
  const response = await todoApi.remove('nieistniejacy-id-12345')
  expect(response.status()).toBe(404)
})
```

- [ ] **Step 2: Przebudowa `tests/helpers/TodoApi.ts`**

1. Usuń `expect(response.status()).toBe(200)` z metody `list()`. W zamian sprawdź `if (!response.ok()) throw new Error(...)`.
2. Usuń `expect(response.status()).toBe(201)` z metody `create()`. W zamian sprawdź `if (!response.ok()) throw new Error(...)`.
3. Usuń sztuczną metodę `retryable()` z uśpieniami `setTimeout` – sekwencyjne usuwanie w `reset()` eliminuje potrzebę retry.
4. Zaktualizuj `reset()` do postaci:
```typescript
async reset(): Promise<void> {
  const todos = await this.list()
  if (todos.length === 0) return

  for (const todo of todos) {
    if (todo.id !== undefined) {
      await this.remove(todo.id)
    }
  }

  const leftovers = await this.list()
  expect(leftovers).toEqual([])
}
```

- [ ] **Step 3: Dostosowanie asercji w `tests/spec/api/todos.spec.ts`**

Upewnij się, że testy specyfikacji API jawnie sprawdzają kody statusów HTTP tam, gdzie test tego wymaga (np. `expect(response.status()).toBe(201)`).

- [ ] **Step 4: Weryfikacja typowania i listy testów**

Uruchom: `node ./node_modules/typescript/bin/tsc --noEmit`
Uruchom: `node ./node_modules/@playwright/test/cli.js test --list`
Oczekiwany wynik: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/TodoApi.ts tests/spec/api/todos.spec.ts
git commit -m "refactor(api): decouple assertions from TodoApi helper and streamline reset"
```

---

### Task 3: Optymalizacja Fixture'a `cleanState` (Punkt 2)

**Files:**
- Modify: `tests/fixtures/base.ts:18-28`

**Interfaces:**
- Fixture `cleanState: void` w `tests/fixtures/base.ts`.

- [ ] **Step 1: Usunięcie podwójnego czyszczenia stanu w `cleanState`**

W `tests/fixtures/base.ts`:
Zastąp podwójne czyszczenie (`before` + `finally`) pojedynczym czyszczeniem przed wykonaniem testu (`beforeEach`):
```typescript
cleanState: [
  async ({ todoApi }, use) => {
    await todoApi.reset()
    await use()
  },
  { auto: true },
],
```
Dzięki temu każdy test nadal startuje z gwarantowanym czystym stanem, ale eliminujemy 50% niepotrzebnych zapytań HTTP po zakończeniu testu (ponieważ następny test i tak zresetuje stan przed swoim startem).

- [ ] **Step 2: Weryfikacja poprawności TypeScript**

Uruchom: `node ./node_modules/typescript/bin/tsc --noEmit`
Oczekiwany wynik: kod wyjścia 0.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/base.ts
git commit -m "perf(fixtures): eliminate redundant post-test reset in cleanState"
```

---

### Task 4: Rozszerzenie o Wsparcie dla Firefox i WebKit / Safari (Punkt 5)

**Files:**
- Modify: `playwright.config.ts:43-50`
- Modify: `package.json:12-14`
- Modify: `.github/workflows/playwright.yml:84-88`

**Interfaces:**
- Projekty E2E w `playwright.config.ts`: `e2e-chromium`, `e2e-firefox`, `e2e-webkit`.
- Skrypt w `package.json`: `"test:e2e"` dopasowujący projekty E2E.
- Krok instalacji i uruchamiania przeglądarek w workflow GitHub Actions.

- [ ] **Step 1: Dodanie projektów Firefox i WebKit w `playwright.config.ts`**

Zastąp pojedynczy projekt `e2e` trzema projektami ze wspólnym katalogiem `./tests/spec/e2e` i zależnością od `setup`:
```typescript
{
  name: 'e2e-chromium',
  testDir: './tests/spec/e2e',
  dependencies: ['setup'],
  use: { ...devices['Desktop Chrome'] },
},
{
  name: 'e2e-firefox',
  testDir: './tests/spec/e2e',
  dependencies: ['setup'],
  use: { ...devices['Desktop Firefox'] },
},
{
  name: 'e2e-webkit',
  testDir: './tests/spec/e2e',
  dependencies: ['setup'],
  use: { ...devices['Desktop Safari'] },
},
```

- [ ] **Step 2: Aktualizacja skryptów w `package.json`**

Zaktualizuj `"test:e2e"` tak, aby domyślnie odpalał projekty E2E (`playwright test --project=/e2e-/`), oraz dodaj granularne skrypty opcjonalne (np. `test:e2e:chrome`, `test:e2e:firefox`, `test:e2e:webkit`).

- [ ] **Step 3: Aktualizacja pipeline w `.github/workflows/playwright.yml`**

W sekcji `e2e-tests`:
1. Zmień instalację przeglądarek:
   `run: npx playwright install --with-deps chromium firefox webkit`
2. W podsumowaniu `merge-reports` zaktualizuj opis matrycy testowej (uwzględnienie Firefox i WebKit).

- [ ] **Step 4: Weryfikacja poprawności rejestracji projektów**

Uruchom: `node ./node_modules/@playwright/test/cli.js test --list`
Oczekiwany wynik:
Wypisanie testów dla projektów `setup`, `api`, `e2e-chromium`, `e2e-firefox`, `e2e-webkit`.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts package.json .github/workflows/playwright.yml
git commit -m "feat(cross-browser): add Firefox and WebKit e2e projects and update CI workflow"
```
