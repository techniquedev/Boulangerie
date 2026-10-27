// Photo réduite (vignette JPEG) pour rester légère en stockage local hors-ligne.
export const readPhoto = (file: File) => new Promise<string>((resolve, reject) => {
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, 480 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = img.width * k; c.height = img.height * k
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(img.src); resolve(c.toDataURL('image/jpeg', 0.6))
  }
  img.onerror = reject
  img.src = URL.createObjectURL(file)
})
