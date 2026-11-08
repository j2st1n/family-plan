import assert from 'node:assert/strict';
export async function slideTaskCompletion(page, taskName, scope = page) {
  const thumb = scope.getByRole('button', { name: `滑动完成: ${taskName}`, exact: true });
  await thumb.scrollIntoViewIfNeeded();
  await page.waitForTimeout(220); // Let a cancelled gesture finish its visible snap-back.
  const geometry = await thumb.evaluate(e => {
    const b=e.getBoundingClientRect(),r=e.parentElement.getBoundingClientRect();
    return { x:b.x+b.width/2, y:b.y+b.height/2, end:r.right-4-b.width/2 };
  });
  assert.ok(geometry.end>geometry.x+64);
  await page.mouse.move(geometry.x,geometry.y); await page.mouse.down();
  await page.mouse.move(geometry.end,geometry.y,{steps:12}); await page.mouse.up();
}
