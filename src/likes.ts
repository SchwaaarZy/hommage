import { getSupabaseClient } from "./supabase";

type LikeCountRow = {
  poem_id: string;
  likes_count: number | string;
};

type LikeData = {
  counts: Record<string, number>;
  likedPoemIds: string[];
};

let anonymousUserIdRequest: Promise<string> | null = null;

async function getAnonymousUserId() {
  const client = await getSupabaseClient();
  if (!anonymousUserIdRequest) {
    anonymousUserIdRequest = (async () => {
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session?.user) return sessionData.session.user.id;

      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      if (!data.user) throw new Error("Anonymous sign-in returned no user.");
      return data.user.id;
    })().catch((error: unknown) => {
      anonymousUserIdRequest = null;
      throw error;
    });
  }
  return anonymousUserIdRequest;
}

function toCounts(rows: LikeCountRow[] | null) {
  return Object.fromEntries(
    (rows ?? []).map((row) => [row.poem_id, Number(row.likes_count)]),
  );
}

export async function loadPoemLikeCounts() {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_poem_like_counts");
  if (error) throw error;
  return toCounts(data as LikeCountRow[] | null);
}

export async function loadPoemLikeState(): Promise<LikeData> {
  const client = await getSupabaseClient();
  const userId = await getAnonymousUserId();
  const [countsResult, likesResult] = await Promise.all([
    client.rpc("get_poem_like_counts"),
    client.from("poem_likes").select("poem_id").eq("user_id", userId),
  ]);
  if (countsResult.error) throw countsResult.error;
  if (likesResult.error) throw likesResult.error;

  return {
    counts: toCounts(countsResult.data as LikeCountRow[] | null),
    likedPoemIds: (likesResult.data ?? []).map((like) => like.poem_id),
  };
}

export async function savePoemLike(poemId: string, liked: boolean) {
  const client = await getSupabaseClient();
  const userId = await getAnonymousUserId();
  const result = liked
    ? await client.from("poem_likes").insert({ poem_id: poemId, user_id: userId })
    : await client
        .from("poem_likes")
        .delete()
        .eq("poem_id", poemId)
        .eq("user_id", userId);
  if (result.error) throw result.error;
}