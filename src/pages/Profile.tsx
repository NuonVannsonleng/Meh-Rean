import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  BookmarkIcon,
  CalendarIcon,
  FileTextIcon,
  GraduationIcon,
  MapPinIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { errorCode } from "../lib/errors";
import { formatCount, formatDate } from "../lib/format";
import { getFeed, getProfile } from "../services/api";
import type { PostView, ProfileView } from "../types";

type Tab = "posts" | "saved";

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileView }
  | { status: "not-found" }
  | { status: "error" };

function ProfileHeader({ profile, isOwn }: { profile: ProfileView; isOwn: boolean }) {
  const { user, stats } = profile;
  const facts = [
    { Icon: GraduationIcon, value: user.school },
    { Icon: FileTextIcon, value: user.fieldOfStudy },
    { Icon: MapPinIcon, value: user.country },
    { Icon: CalendarIcon, value: t.profile.joined(formatDate(user.createdAt)) },
  ].filter((fact) => fact.value);

  const statItems = [
    { label: t.profile.posts, value: formatCount(stats.posts) },
    { label: t.profile.reactions, value: formatCount(stats.reactions) },
    { label: t.profile.rating, value: stats.averageRating ? stats.averageRating.toFixed(1) : t.profile.noRating },
  ];

  return (
    <section className="card animate-rise overflow-hidden">
      <div className="bg-brand-50 h-24 sm:h-32" aria-hidden="true" />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          <Avatar user={user} size="xl" className="ring-surface ring-4" />
          {isOwn && (
            <Link to="/settings" className="btn-secondary h-10">
              <SettingsIcon className="h-4 w-4" />
              {t.profile.edit}
            </Link>
          )}
        </div>
        <h1 className="text-ink-900 mt-3 text-2xl font-bold tracking-tight">{user.displayName}</h1>
        <p className="text-ink-500">@{user.username}</p>
        {user.bio && <p className="text-ink-700 mt-3 max-w-2xl whitespace-pre-line">{user.bio}</p>}

        <ul className="text-ink-500 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {facts.map(({ Icon, value }) => (
            <li key={value} className="flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              {value}
            </li>
          ))}
        </ul>

        <dl className="border-line mt-5 grid grid-cols-3 border-t pt-4 text-center sm:max-w-md sm:text-left">
          {statItems.map((item) => (
            <div key={item.label}>
              <dt className="text-ink-500 text-xs font-medium sm:text-sm">{item.label}</dt>
              <dd className="text-ink-900 text-lg font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default function Profile() {
  const { username = "" } = useParams<{ username: string }>();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const isOwn = user?.username === username.toLowerCase();
  const tab: Tab = isOwn && params.get("tab") === "saved" ? "saved" : "posts";

  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [postsError, setPostsError] = useState(false);

  const loadProfile = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", profile: await getProfile(username) });
    } catch (error) {
      setState({ status: errorCode(error) === "NOT_FOUND" ? "not-found" : "error" });
    }
  }, [username]);

  const loadPosts = useCallback(async () => {
    setPosts(null);
    setPostsError(false);
    try {
      setPosts(await getFeed(tab === "saved" ? { savedOnly: true } : { authorUsername: username }));
    } catch {
      setPostsError(true);
    }
  }, [tab, username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts, user?.id]);

  if (state.status === "loading") {
    return (
      <div className="container-page max-w-3xl py-6 sm:py-10">
        <LoadingState count={1} variant="block" />
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="container-page max-w-3xl py-6 sm:py-10">
        {state.status === "error" ? (
          <ErrorState onRetry={loadProfile} />
        ) : (
          <EmptyState
            icon={<UserIcon className="h-6 w-6" />}
            title={t.profile.notFoundTitle}
            body={t.profile.notFoundBody}
            action={
              <Link to="/" className="btn-primary">
                {t.notFound.action}
              </Link>
            }
          />
        )}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: t.profile.tabPosts },
    ...(isOwn ? [{ id: "saved" as const, label: t.profile.tabSaved }] : []),
  ];

  const empty =
    tab === "saved"
      ? { title: t.profile.emptySavedTitle, body: t.profile.emptySavedBody, icon: <BookmarkIcon className="h-6 w-6" /> }
      : isOwn
        ? { title: t.profile.emptyOwnTitle, body: t.profile.emptyOwnBody, icon: <FileTextIcon className="h-6 w-6" /> }
        : { title: t.profile.emptyOtherTitle, body: t.profile.emptyOtherBody, icon: <FileTextIcon className="h-6 w-6" /> };

  return (
    <div className="container-page max-w-3xl space-y-5 py-6 sm:py-10">
      <ProfileHeader profile={state.profile} isOwn={isOwn} />

      {tabs.length > 1 && (
        <nav aria-label={t.profile.tabsLabel} className="border-line flex gap-1 border-b">
          {tabs.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setParams(item.id === "posts" ? {} : { tab: item.id }, { replace: true })}
                className={`press relative h-11 px-4 text-sm font-semibold ${
                  active ? "text-accent" : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
                {active && <span className="bg-brand-600 animate-fade absolute inset-x-2 -bottom-px h-0.5 rounded-full" />}
              </button>
            );
          })}
        </nav>
      )}

      {postsError ? (
        <ErrorState onRetry={loadPosts} />
      ) : posts === null ? (
        <LoadingState count={2} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          body={empty.body}
          action={
            isOwn && tab === "posts" ? (
              <Link to="/create" className="btn-primary">
                <PlusIcon className="h-4 w-4" />
                {t.feed.composerAction}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={`${post.id}-${user?.id ?? "guest"}`}
              post={post}
              onChange={(next) => {
                if (tab === "saved" && !next.saved) {
                  setPosts((current) => current?.filter((item) => item.id !== next.id) ?? null);
                }
              }}
              onDeleted={(id) => {
                setPosts((current) => current?.filter((item) => item.id !== id) ?? null);
                loadProfile();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
