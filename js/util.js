/* Small helpers shared by the app and both data layers. */
(function () {
  // Mirror of public.norm_text() (supabase/migrations/006): lowercase, no accents, letters+digits only,
  // and common spelling variants count as the same: "Oudh"/"Aoud" = "Oud", "Misk" = "Musk",
  // "EDP" = "Eau de Parfum", "Attar"/"Perfume Oil" = "Perfume Oil / Attar".
  const WHOLE = { edp: "eaudeparfum", edt: "eaudetoilette", edc: "eaudecologne", cologne: "eaudecologne",
    extrait: "extraitdeparfum", parfumextrait: "extraitdeparfum", attar: "perfumeoilattar", ittar: "perfumeoilattar",
    itr: "perfumeoilattar", perfumeoil: "perfumeoilattar", oil: "perfumeoilattar", concentratedperfumeoil: "perfumeoilattar" };
  function normText(t) {
    const x = String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/œ/g, "o").replace(/æ/g, "a")
      .replace(/\b(oudh|aoud|oude)\b/g, "oud")
      .replace(/\b(misk|mousk)\b/g, "musk")
      .replace(/[^a-z0-9]+/g, "");
    return WHOLE[x] || x;
  }
  function brandNameKey(brand, name) { return normText(brand) + "|" + normText(name); }
  function perfumeKey(brand, name, conc) { return brandNameKey(brand, name) + "|" + normText(conc); }

  // Shrink a photo before saving it (keeps uploads small and fast).
  function resizeImage(file, maxSide = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That image could not be opened."));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          canvas.toBlob((blob) => resolve({ blob, dataUrl }), "image/jpeg", quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.Util = { normText, brandNameKey, perfumeKey, resizeImage };
})();
