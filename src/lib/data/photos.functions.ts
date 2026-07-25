import { createServerFn } from "@tanstack/react-start";

// Mapa id -> foto do perfil, igual para admin, colaboradores e usuários.
export const getProfilePhotos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, string>> => {
    const { fetchProfilePhotos } = await import("./photos.server");
    return fetchProfilePhotos();
  },
);
