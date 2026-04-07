export function InlineSkeleton(props: {
  widthClass?: string;
  heightClass?: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "ui-skeleton inline-block",
        props.widthClass ?? "w-24",
        props.heightClass ?? "h-4",
        props.className ?? "",
      ].join(" ")}
      aria-hidden
    />
  );
}
