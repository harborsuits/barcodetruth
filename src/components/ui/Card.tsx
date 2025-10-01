import * as React from "react";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={
        "rounded-2xl border bg-[var(--card)] border-[var(--border)] shadow-sm " +
        (props.className || "")
      }
    />
  );
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={"p-4 sm:p-5 " + (props.className || "")} />;
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={"p-4 sm:p-5 pt-0 " + (props.className || "")} />;
}
