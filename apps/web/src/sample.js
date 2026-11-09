export function makeSample() {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 440;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sky = context.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, "#0b102b");
  sky.addColorStop(0.58, "#34165d");
  sky.addColorStop(1, "#151a4c");
  context.fillStyle = sky;
  context.fillRect(0, 0, 720, 440);

  function glow(x, y, radius, color) {
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  glow(134, 205, 190, "#c03ada");
  glow(514, 181, 194, "#5a36ff");
  glow(350, 369, 170, "#1c80c9");

  let seed = 413;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let index = 0; index < 920; index++) {
    const x = random() * 720;
    const y = random() * 440;
    const size = random() * 3 + 0.5;
    context.fillStyle = index % 7 ? "#a8b7f4a8" : "#ffdfa5";
    context.fillRect(x, y, size, size);
  }

  function planet(x, y, radius, light, middle) {
    const fill = context.createRadialGradient(x - radius * 0.58, y - radius * 0.72, 1, x, y, radius * 1.03);
    fill.addColorStop(0, light);
    fill.addColorStop(0.52, middle);
    fill.addColorStop(0.85, "#171a52");
    fill.addColorStop(1, "#0a0e28");
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = light;
    context.globalAlpha = 0.35;
    context.lineWidth = 2;
    context.stroke();
    context.globalAlpha = 1;
  }

  planet(552, 307, 180, "#92fff3", "#3465b5");
  planet(171, 130, 55, "#ffd0ac", "#8b417b");

  return {
    name: "Cosmic sample",
    width: canvas.width,
    height: canvas.height,
    frame: context.getImageData(0, 0, canvas.width, canvas.height),
  };
}
