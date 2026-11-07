export const APP_DESCRIPTION = "Family Habit Planner";
export const BRAND_SLOGAN = "Small steps. Shared growth.";
export const BRAND_MARK_URL = "/assets/brand/parent-star-v1.svg";

// Production vector artwork, redrawn from the selected parent-and-child concept.
// The same geometry powers the SVG, app icons and exported canvas posters.
export const BRAND_PATHS = [
  { color: "#0071e3", commands: [
    ["M", 552, 427], ["C", 552, 487, 503, 536, 442, 536],
    ["C", 381, 536, 332, 487, 332, 427], ["C", 332, 367, 381, 318, 442, 318],
    ["C", 503, 318, 552, 367, 552, 427], ["Z"],
  ] },
  { color: "#0071e3", commands: [
    ["M", 431, 550], ["C", 520, 550, 585, 500, 620, 438],
    ["C", 635, 408, 651, 409, 661, 428], ["C", 687, 475, 628, 567, 579, 617],
    ["C", 519, 669, 537, 723, 584, 760], ["C", 657, 826, 789, 830, 882, 776],
    ["C", 792, 893, 631, 948, 479, 879], ["C", 365, 832, 295, 742, 307, 654],
    ["C", 317, 592, 368, 551, 431, 550], ["Z"],
  ] },
  { color: "#0071e3", commands: [
    ["M", 909, 542], ["C", 909, 580, 878, 611, 839, 611],
    ["C", 800, 611, 769, 580, 769, 542], ["C", 769, 504, 800, 473, 839, 473],
    ["C", 878, 473, 909, 504, 909, 542], ["Z"],
  ] },
  { color: "#0071e3", commands: [
    ["M", 710, 431], ["C", 723, 429, 730, 441, 730, 462],
    ["C", 730, 539, 755, 606, 807, 619], ["C", 835, 625, 862, 624, 884, 638],
    ["C", 963, 687, 891, 789, 796, 794], ["C", 762, 798, 723, 794, 696, 783],
    ["C", 755, 759, 761, 707, 721, 650], ["C", 681, 594, 667, 514, 682, 459],
    ["C", 688, 439, 698, 431, 710, 431], ["Z"],
  ] },
  { color: "#ffb547", commands: [
    ["M", 669, 212], ["C", 680, 192, 700, 192, 710, 215],
    ["L", 727, 250], ["L", 769, 257], ["C", 795, 262, 797, 281, 779, 300],
    ["L", 752, 326], ["L", 755, 367], ["C", 758, 397, 740, 411, 719, 398],
    ["L", 680, 377], ["L", 642, 394], ["C", 619, 408, 594, 397, 603, 372],
    ["L", 615, 329], ["L", 586, 300], ["C", 568, 283, 577, 262, 599, 257],
    ["L", 645, 251], ["Z"],
  ] },
];

export function brandMarkSvg() {
  const paths = BRAND_PATHS.map(({ color, commands }) =>
    `<path fill="${color}" d="${commands.map(c => c.join(" ")).join(" ")}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 150 720 800">${paths}</svg>`;
}

export function drawBrandMark(ctx, x, y, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(height / 800, height / 800);
  ctx.translate(-250, -150);
  for (const { color, commands } of BRAND_PATHS) {
    ctx.beginPath();
    for (const [command, ...args] of commands) {
      if (command === "M") ctx.moveTo(...args);
      else if (command === "L") ctx.lineTo(...args);
      else if (command === "C") ctx.bezierCurveTo(...args);
      else ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}
