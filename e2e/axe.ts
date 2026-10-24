import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// Escaneo con axe-core compartido por las specs (WCAG 2.0/2.1/2.2, niveles A y AA).

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function expectNoViolations(page: Page, label: string, include?: string) {
  // Escanear con la página quieta: a mitad de una animación (p. ej. el giro de
  // la tarjeta) los tamaños y colores son transitorios y axe da falsos positivos.
  // Las animaciones infinitas (indicadores "en vivo", spinners) no se esperan.
  await page.waitForFunction(() => document.getAnimations().every(a =>
    a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  let builder = new AxeBuilder({ page }).withTags(WCAG)
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  const report = violations.map(v =>
    `[${v.impact}] ${v.id}: ${v.help}\n` +
    v.nodes.slice(0, 5).map(n => `    ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`).join('\n')
  ).join('\n')
  expect(violations, `${label}:\n${report}`).toEqual([])
}
