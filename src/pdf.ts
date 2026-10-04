import { jsPDF } from "jspdf";
import { authorName, isDemo, type Poem } from "./poems";
let font: string | undefined;
export async function downloadCollection(collection: Poem[], title: string) {
  if (!font) {
    const response = await fetch(
      `${import.meta.env.BASE_URL}fonts/CrimsonText-Regular.ttf`,
    );
    if (!response.ok) throw new Error("La police du recueil est indisponible.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    font = btoa(binary);
  }
  const document = new jsPDF();
  document.addFileToVFS("CrimsonText.ttf", font);
  document.addFont("CrimsonText.ttf", "Crimson", "normal");
  document.setFont("Crimson");
  document.setTextColor("#1B263B");
  document.setFontSize(28);
  document.text(title, 105, 85, { align: "center" });
  document.setFontSize(17);
  document.text(`Les mots de Coco · ${authorName}`, 105, 105, {
    align: "center",
  });
  document.setFontSize(12);
  if (isDemo)
    document.text(
      "Textes de démonstration, non attribués au grand-père.",
      105,
      125,
      { align: "center" },
    );
  document.text("À la mémoire de notre Coco", 105, 245, {
    align: "center",
  });
  document.text("Décédé le 21 septembre 2026", 105, 253, { align: "center" });
  document.addPage();
  document.setFontSize(24);
  document.text("Index des poèmes", 24, 30);
  let indexY = 48;
  collection.forEach((poem) => {
    document.setFontSize(13);
    const indexLines: string[] = document.splitTextToSize(
      `${poem.title} · ${poem.theme}`,
      162,
    );
    if (indexY + indexLines.length * 6 > 270) {
      document.addPage();
      indexY = 30;
    }
    document.text(indexLines, 24, indexY);
    indexY += indexLines.length * 6 + 5;
  });
  for (const poem of collection) {
    document.addPage();
    document.setFontSize(25);
    const titleLines: string[] = document.splitTextToSize(poem.title, 162);
    document.text(titleLines, 24, 34);
    const metadataY = 34 + titleLines.length * 11;
    document.setFontSize(11);
    document.text(
      `${poem.theme}${poem.date ? ` · ${new Date(poem.date).getUTCFullYear()}` : ""}`,
      24,
      metadataY,
    );
    document.setFontSize(14);
    let lineY = metadataY + 18;
    if (poem.dedication) {
      const dedicationLines: string[] = document.splitTextToSize(
        poem.dedication,
        162,
      );
      document.text(dedicationLines, 24, lineY);
      lineY += dedicationLines.length * 8 + 8;
    }
    for (const line of poem.text.split("\n")) {
      const wrappedLines: string[] = line
        ? document.splitTextToSize(line, 162)
        : [""];
      for (const wrappedLine of wrappedLines) {
        if (lineY > 267) {
          document.addPage();
          lineY = 30;
        }
        document.text(wrappedLine, 24, lineY);
        lineY += 8;
      }
    }
  }
  const pageCount = document.getNumberOfPages();
  for (let page = 2; page <= pageCount; page++) {
    document.setPage(page);
    document.setFontSize(10);
    document.text(`${page} / ${pageCount}`, 105, 282, { align: "center" });
  }
  document.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
