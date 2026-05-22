import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// Datos esperados según los planes de entrenamiento
// ─────────────────────────────────────────────────────────────

const FEDE_DAYS = ['LUNES', 'MARTES', 'JUEVES', 'VIERNES'];
const BELEN_DAYS = ['LUNES', 'MARTES', 'JUEVES', 'VIERNES'];

const FEDE_LUNES_EXERCISES = [
  'Máquina Presa de Pecho',
  'Máquina Flyes de Pecho',
  'Máquina Fondos Asistida',
  'Extensión Tríceps en Máquina',
  'Press Militar Mancuerna',
];

const BELEN_MARTES_EXERCISES = [
  'Máquina Prensa de Piernas',
  'Máquina Hip Thrust / Glute Press',
  'Máquina Leg Curl (Isquios)',
  'Máquina Extensoras Cuádriceps',
  'Máquina Abductores (Glúteos)',
];

// ─────────────────────────────────────────────────────────────
// Navegación: tabs de persona
// ─────────────────────────────────────────────────────────────

test.describe('Tabs de persona', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('muestra la pestaña Fede activa por defecto', async ({ page }) => {
    const fedeTab = page.getByRole('tab', { name: 'Fede' });
    await expect(fedeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('muestra la pestaña Belén inactiva por defecto', async ({ page }) => {
    const belenTab = page.getByRole('tab', { name: 'Belén' });
    await expect(belenTab).toHaveAttribute('aria-selected', 'false');
  });

  test('al pulsar Belén se activa su panel', async ({ page }) => {
    await page.getByRole('tab', { name: 'Belén' }).click();
    await expect(page.locator('[data-person="belen"]')).toHaveClass(/active/);
    await expect(page.locator('[data-person="fede"]')).not.toHaveClass(/active/);
  });

  test('al pulsar Fede después de Belén se restaura el panel de Fede', async ({ page }) => {
    await page.getByRole('tab', { name: 'Belén' }).click();
    await page.getByRole('tab', { name: 'Fede' }).click();
    await expect(page.locator('[data-person="fede"]')).toHaveClass(/active/);
    await expect(page.locator('[data-person="belen"]')).not.toHaveClass(/active/);
  });
});

// ─────────────────────────────────────────────────────────────
// Datos: días de entrenamiento
// ─────────────────────────────────────────────────────────────

test.describe('Días de entrenamiento — Fede', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const day of FEDE_DAYS) {
    test(`muestra el día ${day}`, async ({ page }) => {
      const panel = page.locator('[data-person="fede"]');
      // Usamos .day-name para evitar coincidir con notas de ejercicios
      await expect(panel.locator('.day-name', { hasText: day }).first()).toBeVisible();
    });
  }
});

test.describe('Días de entrenamiento — Belén', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Belén' }).click();
  });

  for (const day of BELEN_DAYS) {
    test(`muestra el día ${day}`, async ({ page }) => {
      const panel = page.locator('[data-person="belen"]');
      await expect(panel.locator('.day-name', { hasText: day }).first()).toBeVisible();
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Datos: ejercicios correctos por día
// ─────────────────────────────────────────────────────────────

test.describe('Ejercicios Fede — Lunes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const exercise of FEDE_LUNES_EXERCISES) {
    test(`contiene "${exercise}"`, async ({ page }) => {
      const panel = page.locator('[data-person="fede"]');
      await expect(panel.getByText(exercise, { exact: false })).toBeVisible();
    });
  }
});

test.describe('Ejercicios Belén — Martes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Belén' }).click();
  });

  for (const exercise of BELEN_MARTES_EXERCISES) {
    test(`contiene "${exercise}"`, async ({ page }) => {
      const panel = page.locator('[data-person="belen"]');
      // Usamos .exercise-name para evitar coincidir con el mismo ejercicio en otro día
      await expect(panel.locator('.exercise-name', { hasText: exercise }).first()).toBeVisible();
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Acordeón: expandir y colapsar ejercicios
// ─────────────────────────────────────────────────────────────

test.describe('Acordeón de ejercicios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('el detalle del ejercicio está oculto por defecto', async ({ page }) => {
    const firstDetail = page.locator('[data-person="fede"] .exercise-detail').first();
    await expect(firstDetail).toBeHidden();
  });

  test('al pulsar un ejercicio se expande el detalle', async ({ page }) => {
    const firstSummary = page.locator('[data-person="fede"] .exercise-summary').first();
    await firstSummary.click();
    const firstDetail = page.locator('[data-person="fede"] .exercise-detail').first();
    await expect(firstDetail).toBeVisible();
  });

  test('al pulsar de nuevo se colapsa el detalle', async ({ page }) => {
    const firstSummary = page.locator('[data-person="fede"] .exercise-summary').first();
    await firstSummary.click();
    await firstSummary.click();
    const firstDetail = page.locator('[data-person="fede"] .exercise-detail').first();
    await expect(firstDetail).toBeHidden();
  });

  test('el detalle expandido muestra series, reps y descanso', async ({ page }) => {
    const firstSummary = page.locator('[data-person="fede"] .exercise-summary').first();
    await firstSummary.click();
    const detail = page.locator('[data-person="fede"] .exercise-detail').first();
    await expect(detail.getByText('Series')).toBeVisible();
    await expect(detail.getByText('Reps')).toBeVisible();
    await expect(detail.getByText('Descanso')).toBeVisible();
  });

  test('se pueden abrir dos ejercicios simultáneamente', async ({ page }) => {
    const summaries = page.locator('[data-person="fede"] .exercise-summary');
    await summaries.nth(0).click();
    await summaries.nth(1).click();
    const details = page.locator('[data-person="fede"] .exercise-detail');
    await expect(details.nth(0)).toBeVisible();
    await expect(details.nth(1)).toBeVisible();
  });

  test('aria-expanded se actualiza al abrir/cerrar', async ({ page }) => {
    const firstSummary = page.locator('[data-person="fede"] .exercise-summary').first();
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
    await firstSummary.click();
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'true');
    await firstSummary.click();
    await expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
// Mobile: tap targets mínimos 48px
// ─────────────────────────────────────────────────────────────

test.describe('Mobile — tap targets', () => {
  test('los botones de tab tienen altura mínima 48px', async ({ page }) => {
    await page.goto('/');
    const tabs = page.getByRole('tab');
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('los botones de ejercicio tienen altura mínima 48px', async ({ page }) => {
    await page.goto('/');
    const summaries = page.locator('[data-person="fede"] .exercise-summary');
    for (const summary of await summaries.all()) {
      const box = await summary.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
  });
});
