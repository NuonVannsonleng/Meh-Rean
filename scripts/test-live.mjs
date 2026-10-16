#!/usr/bin/env node
/**
 * Checks for live quizzes (Kahoot-style games), against a LOCAL Supabase
 * only, after supabase/schema.sql. Timing and scoring are decided by the
 * database; this tries to get around them.
 *
 *   npm run test:live
 */

import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("live quiz checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "live");
const { anon } = people;
const host = await people.create("h");
const ana = await people.create("a");
const bo = await people.create("b");
const outsider = await people.create("x");
const questions = [
  { prompt: "2 + 2 = ?", choices: ["3", "4", "5"], answer: 1, seconds: 20 },
  { prompt: "Capital of Cambodia?", choices: ["Phnom Penh", "Siem Reap"], answer: 0, seconds: 10 },
];
let quizId;
let game;

await check("a quiz is private to its owner, and its shape is checked", async () => {
  const saved = await host.client.from("live_quizzes").insert({ title: "Warm-up", questions }).select("id").single();
  if (saved.error) throw new Error(saved.error.message);
  quizId = saved.data.id;
  const peek = await ana.client.from("live_quizzes").select("id").eq("id", quizId);
  assert(!peek.data?.length, "another user can read the quiz (and its answers)");
  const bad = [
    [],
    [{ ...questions[0], answer: 3 }],
    [{ ...questions[0], choices: ["only"] }],
    [{ ...questions[0], seconds: 2 }],
    [{ ...questions[0], seconds: 7.5 }],
    [{ ...questions[0], prompt: " " }],
  ];
  for (const set of bad) assert((await host.client.from("live_quizzes").insert({ title: "Bad", questions: set })).error, `accepted ${JSON.stringify(set)}`);
  assert((await anon.from("live_quizzes").insert({ title: "x", questions })).error, "a visitor saved a quiz");
});

await check("only the owner starts a game; it gets a 6-digit code", async () => {
  const stolen = await ana.client.rpc("create_live_game", { quiz: quizId });
  assert(stolen.error, "started a game from someone else's quiz");
  const { data, error } = await host.client.rpc("create_live_game", { quiz: quizId });
  if (error) throw new Error(error.message);
  game = data[0];
  assert(/^\d{6}$/.test(game.code), `code ${game.code}`);
});

await check("joining: by code, with a name; not the host, not a wrong code", async () => {
  const wrong = await ana.client.rpc("join_live_game", { join_code: "000000x", nickname: "Ana" });
  assert(!wrong.error && wrong.data === null, "a bad code did not come back empty");
  assert((await host.client.rpc("join_live_game", { join_code: game.code, nickname: "Host" })).error, "the host joined as a player");
  assert((await ana.client.rpc("join_live_game", { join_code: game.code, nickname: " " })).error, "joined without a name");
  assert((await anon.rpc("join_live_game", { join_code: game.code, nickname: "Anon" })).error, "a visitor joined");
  const a = await ana.client.rpc("join_live_game", { join_code: game.code, nickname: "Ana" });
  const b = await bo.client.rpc("join_live_game", { join_code: game.code, nickname: "Bo" });
  assert(a.data === game.game_id && b.data === game.game_id, "join did not return the game");
});

await check("players see the game and each other, never the answers; outsiders see nothing", async () => {
  const state = await ana.client.from("live_game_state").select("status, question_count").eq("game_id", game.game_id).single();
  assert(state.data?.status === "lobby" && state.data.question_count === 2, JSON.stringify(state.data));
  const players = await ana.client.from("live_players").select("nickname").eq("game_id", game.game_id);
  assert(players.data?.length === 2, `${players.data?.length} players visible`);
  const answers = await ana.client.from("live_games").select("questions").eq("id", game.game_id);
  assert(!answers.data?.length, "a player can read the game's questions with answers");
  const outside = await outsider.client.from("live_game_state").select("game_id").eq("game_id", game.game_id);
  assert(!outside.data?.length, "an outsider can see the game");
  const anonState = await anon.from("live_game_state").select("game_id").eq("game_id", game.game_id);
  assert(!anonState.data?.length, "a visitor can see the game");
});

await check("only the host moves the game on; a question shows without its answer", async () => {
  assert((await ana.client.rpc("live_next", { game: game.game_id })).error, "a player moved the game on");
  const { data, error } = await host.client.rpc("live_next", { game: game.game_id });
  if (error) throw new Error(error.message);
  assert(data === "question", data);
  const state = await ana.client.from("live_game_state").select("*").eq("game_id", game.game_id).single();
  const s = state.data;
  const seconds = (Date.parse(s.deadline_at) - Date.parse(s.started_at)) / 1000;
  assert(s.status === "question" && s.prompt === "2 + 2 = ?" && s.choices.length === 3 && s.correct_choice === null && seconds === 20, JSON.stringify(s));
  assert((await host.client.rpc("live_next", { game: game.game_id })).error, "skipped a question without revealing it");
});

await check("answers: once each, members only, scored on the server, hidden until the reveal", async () => {
  const right = await ana.client.rpc("live_answer", { game: game.game_id, choice: 1 });
  assert(right.data === "saved", `Ana: ${right.data ?? right.error?.message}`);
  const again = await ana.client.rpc("live_answer", { game: game.game_id, choice: 0 });
  assert(again.data === "already", `second answer: ${again.data}`);
  const wrong = await bo.client.rpc("live_answer", { game: game.game_id, choice: 2 });
  assert(wrong.data === "saved", `Bo: ${wrong.data}`);
  assert((await outsider.client.rpc("live_answer", { game: game.game_id, choice: 1 })).error, "an outsider answered");
  assert((await bo.client.rpc("live_answer", { game: game.game_id, choice: 9 })).data !== "saved", "an impossible choice was saved");
  const peek = await ana.client.from("live_answers").select("correct, points").eq("game_id", game.game_id);
  assert(peek.error, "a player can see whether they were right before the reveal");
  const mine = await ana.client.from("live_answers").select("choice").eq("game_id", game.game_id);
  assert(mine.data?.length === 1 && mine.data[0].choice === 1, "own choice not readable");
  const forged = await ana.client.from("live_players").update({ score: 99999 }).eq("game_id", game.game_id).select();
  assert(forged.error || !forged.data?.length, "a score was written directly");
  const state = await host.client.from("live_game_state").select("answered").eq("game_id", game.game_id).single();
  assert(state.data.answered === 2, `answered ${state.data.answered}`);
});

await check("the reveal shows the answer and counts and adds speed-based points", async () => {
  assert((await bo.client.rpc("live_reveal", { game: game.game_id })).error, "a player revealed");
  const { error } = await host.client.rpc("live_reveal", { game: game.game_id });
  if (error) throw new Error(error.message);
  const state = await ana.client.from("live_game_state").select("status, correct_choice, choice_counts").eq("game_id", game.game_id).single();
  assert(state.data.status === "reveal" && state.data.correct_choice === 1 && JSON.stringify(state.data.choice_counts) === "[0,1,1]", JSON.stringify(state.data));
  const players = await ana.client.from("live_players").select("nickname, score, last_points, correct_count").eq("game_id", game.game_id);
  const by = Object.fromEntries(players.data.map((p) => [p.nickname, p]));
  assert(by.Ana.score >= 900 && by.Ana.score <= 1000 && by.Ana.last_points === by.Ana.score && by.Ana.correct_count === 1, JSON.stringify(by.Ana));
  assert(by.Bo.score === 0 && by.Bo.last_points === 0, JSON.stringify(by.Bo));
  const late = await bo.client.rpc("live_answer", { game: game.game_id, choice: 1 });
  assert(late.data === "closed", `answer after the reveal: ${late.data}`);
  await host.client.rpc("live_reveal", { game: game.game_id });
  const twice = await ana.client.from("live_players").select("score").eq("game_id", game.game_id).eq("nickname", "Ana").single();
  assert(twice.data.score === by.Ana.score, "revealing twice added points twice");
});

await check("after the deadline, answers are refused", async () => {
  await host.client.rpc("live_next", { game: game.game_id });
  sql(`update public.live_game_state set deadline_at = now() - interval '5 seconds' where game_id = '${game.game_id}'`);
  const late = await ana.client.rpc("live_answer", { game: game.game_id, choice: 0 });
  assert(late.data === "late", `late answer: ${late.data}`);
});

await check("the last next finishes the game; its code can no longer be joined", async () => {
  await host.client.rpc("live_reveal", { game: game.game_id });
  const { data } = await host.client.rpc("live_next", { game: game.game_id });
  assert(data === "finished", data);
  const state = await ana.client.from("live_game_state").select("status").eq("game_id", game.game_id).single();
  assert(state.data.status === "finished", state.data.status);
  assert((await outsider.client.rpc("join_live_game", { join_code: game.code, nickname: "Late" })).data === null, "joined a finished game");
});

await check("players see names and scores, never account ids; each finds their own row", async () => {
  const fresh = (await host.client.rpc("create_live_game", { quiz: quizId })).data[0];
  await ana.client.rpc("join_live_game", { join_code: fresh.code, nickname: "Ana" });
  await bo.client.rpc("join_live_game", { join_code: fresh.code, nickname: "Bo" });
  const ids = await ana.client.from("live_players").select("user_id").eq("game_id", fresh.game_id);
  assert(ids.error, "a player can read account ids");
  const rows = await ana.client.from("live_players").select("player_id, nickname").eq("game_id", fresh.game_id);
  assert(rows.data?.length === 2, `${rows.data?.length} players`);
  const mine = await ana.client.rpc("live_my_player", { game: fresh.game_id });
  assert(rows.data.find((row) => row.player_id === mine.data)?.nickname === "Ana", "own row not found by player id");
  const state = await host.client.from("live_game_state").select("player_count").eq("game_id", fresh.game_id).single();
  assert(state.data.player_count === 2, `player_count ${state.data.player_count}`);
  await host.client.rpc("live_finish", { game: fresh.game_id });
});

await check("guessing codes is slowed down; old lobbies close", async () => {
  let refused = null;
  for (let n = 0; n < 32 && !refused; n += 1) {
    const result = await outsider.client.rpc("join_live_game", { join_code: String(100000 + n), nickname: "Guess" });
    if (result.error) refused = n;
  }
  assert(refused !== null && refused >= 25, `throttle at attempt ${refused}`);
  const old = (await host.client.rpc("create_live_game", { quiz: quizId })).data[0];
  sql(`update public.live_games set created_at = now() - interval '7 hours' where id = '${old.game_id}'`);
  const late = await bo.client.rpc("join_live_game", { join_code: old.code, nickname: "Bo" });
  assert(!late.error && late.data === null, "joined a lobby older than 6 hours");
});

await check("starting a new game ends the host's unfinished one", async () => {
  const first = (await host.client.rpc("create_live_game", { quiz: quizId })).data[0];
  const second = (await host.client.rpc("create_live_game", { quiz: quizId })).data[0];
  const old = await host.client.from("live_game_state").select("status").eq("game_id", first.game_id).single();
  assert(old.data.status === "finished" && second.code, "the older game is still open");
  await host.client.rpc("live_finish", { game: second.game_id });
});

await people.cleanUp();
finish();
