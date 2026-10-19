import { expect } from '@playwright/test';

export async function expectDarkPalette(page) {
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const unexpected = await page.evaluate(() => {
    const allowed = new Set(['11,15,21', '22,29,39', '33,43,59', '39,52,68', '34,197,94', '74,222,128', '248,113,113', '248,250,252', '148,163,184', '100,116,139', '20,59,38', '72,9,9', '0,0,0']);
    const issues = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.closest('nextjs-portal')) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const style = getComputedStyle(el);
      const properties = ['backgroundColor'];
      if (el instanceof SVGElement || [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) properties.push('color');
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(style[`border${side}Width`]) > 0 && !['none', 'hidden'].includes(style[`border${side}Style`])) properties.push(`border${side}Color`);
      }
      for (const prop of properties) {
        const channels = style[prop].match(/[\d.]+/g)?.map(Number);
        if (!channels || channels.length === 4 && channels[3] === 0) continue;
        if (!allowed.has(channels.slice(0, 3).join(','))) issues.push(`${el.tagName}.${el.classList.value}: ${prop}=${style[prop]}`);
      }
    }
    return [...new Set(issues)].slice(0, 35);
  });
  expect(unexpected, 'Visible UI uses the documented dark palette').toEqual([]);
}

export async function expectReferenceLayout(page, selectors) {
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const boxes = await page.evaluate(selectors => selectors.map(selector => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing layout element: ${selector}`);
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { selector, width: rect.width, height: rect.height, font: style.fontFamily, viewport: innerWidth };
  }), selectors);
  for (const box of boxes) {
    expect(box.width, box.selector).toBeGreaterThan(0);
    expect(box.height, box.selector).toBeGreaterThan(0);
    expect(box.width, box.selector).toBeLessThanOrEqual(box.viewport + 1);
    expect(box.font, box.selector).toContain('Inter');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

export async function expectHomeBack(page) {
  const back = page.getByRole('button', { name: 'Back to Home', exact: true });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeVisible();
  const button = await back.boundingBox();
  const heading = await page.locator('.section-back-title h2').boundingBox();
  expect(button.x + button.width).toBeLessThanOrEqual(heading.x);
  expect(button.width).toBeGreaterThanOrEqual(44);
}
