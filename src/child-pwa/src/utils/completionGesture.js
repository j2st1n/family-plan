export function slideProgress(startX, currentX, travel) {
  if (![startX, currentX, travel].every(Number.isFinite) || travel <= 0) return 0;
  return Math.max(0, Math.min(1, (currentX - startX) / travel));
}
export function acceptsCompletionSlide(gesture, endX, endY) {
  if (!gesture || !gesture.moved || gesture.cancelled || gesture.travel < 64) return false;
  return Number.isFinite(endY) && Math.abs(endY - gesture.startY) <= 40
    && slideProgress(gesture.startX, endX, gesture.travel) >= .96;
}
