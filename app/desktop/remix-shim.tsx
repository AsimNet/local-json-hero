import React, { useMemo, useState } from "react";

type FetcherState<T> = {
  type: "init" | "done";
  data?: T;
};

type FormProps = React.FormHTMLAttributes<HTMLFormElement> & {
  action?: string;
  method?: string;
};

export function Link({
  to,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  prefetch?: string;
}) {
  return (
    <a href={to ?? props.href ?? "#"} {...props}>
      {children}
    </a>
  );
}

export function Form({ children, ...props }: FormProps) {
  return <form {...props}>{children}</form>;
}

export function useFetcher<T = unknown>() {
  const [state, setState] = useState<FetcherState<T>>({ type: "init" });

  return useMemo(
    () => ({
      ...state,
      load: () => {
        setState({
          type: "done",
          data: {
            error: "External URL previews are disabled in the desktop app.",
          } as unknown as T,
        });
      },
      submit: () => undefined,
      Form,
    }),
    [state]
  );
}

export function useTransition() {
  return { state: "idle", submission: undefined };
}

export function useLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function useNavigate() {
  return (to: string) => {
    window.location.hash = to;
  };
}
