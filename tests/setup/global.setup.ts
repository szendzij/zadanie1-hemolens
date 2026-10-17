import { expect, test } from '@playwright/test'

test('app under test is reachable', async ({ request }) => {
  const [spaResponse, apiResponse] = await Promise.all([
    request.get('/'),
    request.get('/todos'),
  ])
  await expect(spaResponse).toBeOK()
  await expect(apiResponse).toBeOK()
})
