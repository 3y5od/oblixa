import type { ReactNode } from "react";

export function EmptyState(props: {
  title: string;
  copy: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state flex flex-col items-center justify-center">
      {props.icon}
      <h3 className="ui-empty-state-title">{props.title}</h3>
      <p className="ui-empty-state-copy">{props.copy}</p>
      {props.action ? <div className="mt-6">{props.action}</div> : null}
    </div>
  );
}
