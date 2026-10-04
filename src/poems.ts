import poemData from "../assets/poemes.json";

export type Poem = {
  id: string;
  title: string;
  theme: string;
  date?: string;
  dedication?: string;
  text: string;
};
export const authorName = "Yves Cholet";
export const isDemo = false;
export const poems: Poem[] = poemData;
export const themes = [...new Set(poems.map((poem) => poem.theme))];
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’']/g, "'");
export const readingMinutes = (text: string) =>
  Math.max(1, Math.ceil(text.split(/\s+/).length / 180));
export const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(date))
    : "Sans date";
