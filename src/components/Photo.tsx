/** A decorative photo from public/photos, in two widths so phones fetch the small one (credits: src/data/photo-credits.json). */
export default function Photo({
  name,
  sizes,
  widths = [360, 640],
  eager = false,
  className = "",
}: {
  name: string;
  sizes: string;
  widths?: [number, number];
  eager?: boolean;
  className?: string;
}) {
  const [small, large] = widths;
  return (
    <img
      src={`/photos/${name}-${large}.webp`}
      srcSet={`/photos/${name}-${small}.webp ${small}w, /photos/${name}-${large}.webp ${large}w`}
      sizes={sizes}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`bg-surface-hover object-cover ${className}`}
    />
  );
}
