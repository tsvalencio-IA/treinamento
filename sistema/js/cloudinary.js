import { APP_CONFIG } from "./config.js";

function hasImageProviderConfig() {
  const cfg = APP_CONFIG.cloudinary || {};
  return Boolean(
    cfg.cloudName &&
    cfg.uploadPreset &&
    !/COLE_AQUI|ALTERE_/i.test(`${cfg.cloudName} ${cfg.uploadPreset}`)
  );
}

export async function uploadImage(file, fileName = "") {
  if (!file) return "";

  if (!hasImageProviderConfig()) {
    throw new Error("O envio de fotos ainda não foi conectado. Finalize a configuração de imagens antes de cadastrar fotos.");
  }

  const cfg = APP_CONFIG.cloudinary;
  const form = new FormData();
  if (fileName && file instanceof Blob) {
    form.append("file", file, fileName);
  } else {
    form.append("file", file);
  }
  form.append("upload_preset", cfg.uploadPreset);
  if (cfg.folder) form.append("folder", cfg.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error("Não foi possível salvar a foto da joia. Confira a configuração de imagens e tente novamente.");
  }

  const data = await response.json();
  return data.secure_url || data.url || "";
}
