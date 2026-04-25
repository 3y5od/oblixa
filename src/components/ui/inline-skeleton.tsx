export function InlineSkeleton(props: {
  widthClass?: string;
  heightClass?: string;
  className?: string;
  roundedClass?: string;
}) {
  return (
    <span
      className={[
        "ui-skeleton inline-block align-middle",
        props.widthClass ?? "w-24",
        props.heightClass ?? "h-4",
        props.roundedClass ?? "rounded",
        props.className ?? "",
      ].join(" ")}
      aria-hidden
    />
  );
}
