import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, FileIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { errorCode } from "../lib/errors";
import { getPost } from "../services/api";
import type { PostView } from "../types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; post: PostView }
  | { status: "not-found" }
  | { status: "error" };

export default function PostDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", post: await getPost(id) });
    } catch (error) {
      setState({ status: errorCode(error) === "NOT_FOUND" ? "not-found" : "error" });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.post.title} · ${t.common.appName}`;
    return () => {
      document.title = t.common.appName;
    };
  }, [state]);

  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <Link to="/" className="link mb-5 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.post.backToFeed}
      </Link>

      {state.status === "loading" && <LoadingState count={1} />}
      {state.status === "error" && <ErrorState onRetry={load} />}
      {state.status === "not-found" && (
        <EmptyState
          icon={<FileIcon className="h-6 w-6" />}
          title={t.post.notFoundTitle}
          body={t.post.notFoundBody}
          action={
            <Link to="/" className="btn-primary">
              {t.post.backToFeed}
            </Link>
          }
        />
      )}
      {state.status === "ready" && <PostCard key={`${state.post.id}-${user?.id ?? "guest"}`} post={state.post} variant="detail" />}
    </div>
  );
}
